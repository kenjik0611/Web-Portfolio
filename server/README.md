# お問い合わせフォーム バックエンド (EC2 + SES)

フォーム送信を AWS SES 経由で自分のメールに転送する Node.js サーバーです。

## 全体の流れ

```
ブラウザ → nginx → Node(このサーバー :3001) → AWS SES → 自分のメール
                 └ 静的ファイル(/var/www/html)
```

---

## 1. AWS SES の準備

1. SESのリージョンはシドニー（ap-southeast-2）。`.env` の `AWS_REGION` もこれに合わせる。
2. **送信元アドレスを検証する**
   - SESコンソール →「検証済みID」→ 作成 → メールアドレス（例 `no-reply@あなたのドメイン`）。
   - 届いた確認メールのリンクをクリック。これが `MAIL_FROM`。
   - ドメインを持っていなければ、受信用の自分のアドレス（例 Gmail）も同じ手順で検証すれば `MAIL_FROM` に使えます。
3. **サンドボックス解除**
   - SESは初期状態（サンドボックス）だと「検証済みアドレス宛」にしか送れません。
   - 受信先 `MAIL_TO`（自分のメール）も検証しておけばサンドボックスのままでもテスト可能。
   - 不特定多数の問い合わせ者に自動返信などをするなら、SESの「本番アクセス申請」を行う。
     （※今回の構成は問い合わせを“自分宛”に送るだけなので、MAIL_FROM と MAIL_TO を検証すればサンドボックスのままで動きます）

## 2. EC2 に SES 送信権限を与える（推奨: IAMロール）

アクセスキーを `.env` に直書きせず、EC2インスタンスに IAMロールを付けるのが安全です。

- IAMで以下のポリシーを持つロールを作り、EC2にアタッチする:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "ses:SendEmail", "Resource": "*" }
  ]
}
```

ロールを付ければ `.env` に AWS のキーを書く必要はありません（SDKが自動で取得）。
ロールが使えない場合のみ `.env` に `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` を設定。

## 3. サーバーのセットアップ（EC2上で）

```bash
# Node.js 18+ が無ければインストール（例: Amazon Linux 2023）
sudo dnf install -y nodejs

cd /var/www/html/server     # デプロイ先に合わせる（後述の注意も参照）
cp .env.example .env
nano .env                   # MAIL_FROM / MAIL_TO などを設定
npm install
node server.js             # 動作確認。Ctrl+C で停止
```

別ターミナルで確認:

```bash
curl http://localhost:3001/api/health        # {"ok":true}
```

## 4. 常駐させる（systemd）

`/etc/systemd/system/contact-api.service` を作成:

```ini
[Unit]
Description=Portfolio Contact API
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/html/server
ExecStart=/usr/bin/node server.js
Restart=always
User=ec2-user
EnvironmentFile=/var/www/html/server/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now contact-api
sudo systemctl status contact-api
```

## 5. nginx で /api を Node に転送

サイトの server ブロックに追記:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

これで `https://あなたのサイト/api/contact` にフロントから送信され、メールが届きます。

---

## ⚠️ デプロイ設定についての注意

`.github/workflows/deploy.yml` は `source: "."` で **リポジトリ全体を `/var/www/html` にコピー**します。
このままだと `server/` も webroot 内に入ります。問題になり得る点:

- `node_modules` と `.env` は **Gitに含めない**（この `.gitignore` で除外済み）。
  → `npm install` と `.env` 作成は **EC2側で1回手動**で行う（デプロイで上書きされない）。
- できれば webroot の外（例 `/opt/contact-api`）にサーバーを置く方が安全。
  その場合は systemd と nginx のパスをそのディレクトリに変更してください。
