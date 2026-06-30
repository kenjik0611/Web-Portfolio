# Portfolio サイト（kiyokiyoken.com）

フリーランスWebクリエイターのポートフォリオサイト。
本番URL: https://www.kiyokiyoken.com

静的なHTML/CSS/JSサイト + お問い合わせフォーム用の小さなバックエンド（Node.js）で構成され、AWS EC2 上で稼働しています。フォームの送信内容は AWS SES 経由で自分のメールに転送されます。

---

## これまでにできたこと（2026-06-24 時点）

- ✅ ポートフォリオサイト本体（Hero / Skills / Works / Service / About / Contact）を制作・公開
- ✅ レスポンシブ対応（PC・タブレット・スマホ）
- ✅ **お問い合わせフォーム → 自分のメール（kkiyose.work@gmail.com）への自動転送を実装・稼働**
  - ブラウザのJSがバックエンド `/api/contact` にPOST → Node が AWS SES でメール送信
  - 受信メールの「返信」で問い合わせ者に直接返信できる（ReplyTo 設定済み）
  - いたずら対策（レート制限・honeypot・入力バリデーション・HTMLエスケープ）入り
- ✅ EC2 上で Node を **systemd 常駐化**（SSHを閉じても・サーバー再起動しても自動稼働）
- ✅ Apache のリバースプロキシで `/api/` をNodeに転送
- ✅ JSのキャッシュ対策（`script.js?v=N` のバージョン付与）

### 今後やりたいこと
- ⬜ SEO対応（Google検索でヒット・上位表示を目指す）
  - title / meta description の最適化、Google Search Console 登録、サイトマップ送信、構造化データ(JSON-LD) など

---

## フォルダ・ファイル構成

```
Portfolio/
├── index.html              … サイト本体（全セクションのHTML）
├── style.css               … スタイル（デザイン全般）
├── script.js               … フロントのJS（ナビ・アニメ・フォーム送信処理）
├── README.md               … このファイル（プロジェクト全体の説明）
│
├── server/                 … お問い合わせフォームのバックエンド（Node.js）
│   ├── server.js           … Express + AWS SES でメール送信する本体
│   ├── package.json        … 依存パッケージ定義
│   ├── .env                … 設定値（送信元/受信先など）※Git管理外・EC2上に手動作成
│   ├── .env.example        … .env のテンプレート
│   ├── .gitignore          … node_modules / .env を除外
│   └── README.md           … バックエンドの詳細セットアップ手順（SES/IAM/Apache/systemd）
│
└── .github/workflows/
    └── deploy.yml          … main へ push すると EC2 の /var/www/html へ自動デプロイ
```

### デプロイの流れ
`main` ブランチに push すると GitHub Actions が起動し、リポジトリの中身を EC2 の `/var/www/html` に rsync します。
※ `server/.env` と `server/node_modules` はGit管理外のため、**EC2上で一度だけ手動作成・インストール**しています（デプロイで上書きされません）。
※ `server.js` を更新した場合は、デプロイ後に EC2 で `sudo systemctl restart contact-api` が必要です。

---

## 使用している AWS サービス

すべて **ap-southeast-2（シドニー）リージョン**。

| サービス | 役割 |
|---|---|
| **EC2** | サーバー1台。Webサイトの配信とバックエンドNodeの実行を兼ねる。 |
| **SES (Simple Email Service)** | フォーム送信内容をメール送信。ドメイン `kiyokiyoken.com` 検証済み、送信元 `no-reply@kiyokiyoken.com`、受信先 `kkiyose.work@gmail.com`（検証済み）。 |
| **IAM ロール** | EC2 に `ses:SendEmail` 権限を付与。これによりコードにAWSキーを書かずにSES送信できる。 |

### EC2内部の構成

```
インターネット
   │  https://www.kiyokiyoken.com
   ▼
[ Apache (httpd) :80/443 ]
   ├── 通常のリクエスト ─→ 静的ファイル配信 (/var/www/html)
   └── /api/ で始まる ───→ リバースプロキシ ─→ [ Node (server.js) :3001 ]
                                                      │
                                                      ▼
                                              [ AWS SES ] ─→ メール送信
```

- **Webサーバー**: Apache (httpd) … ドキュメントルート `/var/www/html`
- **バックエンド**: Node.js (Express)、systemd サービス名 `contact-api`、ポート 3001
- **プロキシ設定**: `/etc/httpd/conf.d/contact-api.conf` で `/api/` を `127.0.0.1:3001` に転送

---

## よく使う運用コマンド（EC2上）

```bash
# バックエンドの状態確認 / 再起動
sudo systemctl status contact-api
sudo systemctl restart contact-api

# ログ確認（送信成功/エラーの確認）
sudo journalctl -u contact-api -n 50 --no-pager

# 動作確認（サーバー単体）
curl https://www.kiyokiyoken.com/api/health   # => {"ok":true}
```

セットアップ手順の詳細は [server/README.md](server/README.md) を参照。
