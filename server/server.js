import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const {
  PORT = 3001,
  AWS_REGION = "ap-southeast-2", // シドニーリージョン。SESを作った場所に合わせる
  MAIL_FROM, // SESで検証済みの送信元アドレス（必須）
  MAIL_TO, // 受信したい自分のアドレス（必須）
  ALLOW_ORIGIN = "*", // 本番は自分のサイトのURLを入れる
} = process.env;

if (!MAIL_FROM || !MAIL_TO) {
  console.error(
    "環境変数 MAIL_FROM と MAIL_TO は必須です。.env を確認してください。",
  );
  process.exit(1);
}

// EC2にIAMロールを付けていれば、ここでキーを書く必要はありません（推奨）。
// IAMロールが使えない場合のみ .env の AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY が使われます。
const ses = new SESClient({ region: AWS_REGION });

const app = express();
// Apache等のリバースプロキシ(同一ホスト=loopback)経由の X-Forwarded-For を信頼する。
// これが無いと express-rate-limit がプロキシ経由のリクエストでエラーになる。
app.set("trust proxy", "loopback");
app.use(express.json({ limit: "20kb" }));
app.use(cors({ origin: ALLOW_ORIGIN }));

// 1IPあたり10分で5回までに制限（いたずら送信対策）
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    error: "送信回数が多すぎます。しばらく待って再度お試しください。",
  },
});

// 簡易バリデーション
const isEmail = (v) =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const clip = (v, n) =>
  String(v ?? "")
    .trim()
    .slice(0, n);
const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/contact", limiter, async (req, res) => {
  try {
    const name = clip(req.body.name, 100);
    const company = clip(req.body.company, 100);
    const email = clip(req.body.email, 200);
    const budget = clip(req.body.budget, 50);
    const message = clip(req.body.message, 5000);
    const honeypot = clip(req.body.website, 100); // bot対策の隠しフィールド

    // botが埋めがちな隠しフィールドに値が入っていたら成功を装って捨てる
    if (honeypot) {
      console.log("honeypot発火: website=", JSON.stringify(honeypot), "→ 送信スキップ");
      return res.json({ ok: true });
    }

    if (!name || !isEmail(email) || !message) {
      return res
        .status(400)
        .json({
          ok: false,
          error: "お名前・有効なメールアドレス・お問い合わせ内容は必須です。",
        });
    }

    const subject = `【ポートフォリオ】お問い合わせ: ${name} 様`;
    const lines = [
      `お名前: ${name}`,
      `会社名・屋号: ${company || "(未記入)"}`,
      `メール: ${email}`,
      `ご予算: ${budget || "(未選択)"}`,
      "",
      "お問い合わせ内容:",
      message,
    ];
    const textBody = lines.join("\n");
    const htmlBody = `<div style="font-family:sans-serif;line-height:1.7">
      <p><strong>お名前:</strong> ${esc(name)}</p>
      <p><strong>会社名・屋号:</strong> ${esc(company) || "(未記入)"}</p>
      <p><strong>メール:</strong> ${esc(email)}</p>
      <p><strong>ご予算:</strong> ${esc(budget) || "(未選択)"}</p>
      <hr>
      <p style="white-space:pre-wrap">${esc(message)}</p>
    </div>`;

    await ses.send(
      new SendEmailCommand({
        Source: MAIL_FROM,
        Destination: { ToAddresses: [MAIL_TO] },
        // 受信メールで「返信」を押すと問い合わせ者に返せるようにする
        ReplyToAddresses: [email],
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: textBody, Charset: "UTF-8" },
            Html: { Data: htmlBody, Charset: "UTF-8" },
          },
        },
      }),
    );

    console.log("SES送信成功 → 宛先:", MAIL_TO);
    return res.json({ ok: true });
  } catch (err) {
    console.error("SES送信エラー:", err);
    return res
      .status(500)
      .json({
        ok: false,
        error: "送信に失敗しました。時間をおいて再度お試しください。",
      });
  }
});

app.listen(PORT, () => {
  console.log(`Contact API listening on :${PORT}`);
});
