# Minecraft PVE Bot セットアップ手順

## 1. Supabase

1. [supabase.com](https://supabase.com) でプロジェクト作成
2. `SQL Editor` を開き `supabase_schema.sql` の内容を貼り付けて実行
3. `Project Settings > API` から以下をコピー
   - `Project URL` → `SUPABASE_URL`
   - `anon public` キー → `SUPABASE_ANON_KEY`

## 2. Discord Bot アプリ

1. [Discord Developer Portal](https://discord.com/developers/applications) でアプリを作成
2. `Bot` タブ → `Reset Token` でトークン取得 → `DISCORD_TOKEN`
3. `General Information` → `Application ID` → `CLIENT_ID`
4. `Bot` タブ → `Privileged Gateway Intents` は不要（Guildsのみ）
5. `OAuth2 > URL Generator` で `bot` + `applications.commands` にチェック
   - Bot権限: `Send Messages`, `Embed Links`, `Read Message History`
   - 生成されたURLでサーバーに招待
6. サーバー設定 → 右クリック → `IDをコピー` → `GUILD_ID`

## 3. 最初の管理者登録

Supabase の `Table Editor > admins` を開いて手動で自分のDiscord IDを追加する。  
（以降は `/admin-add` コマンドで追加可能）

## 4. GitHub にpush

```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/<あなた>/minecraft-bot.git
git push -u origin main
```

## 5. Koyeb デプロイ

1. [koyeb.com](https://www.koyeb.com) でアカウント作成
2. `Create App` → `GitHub` でリポジトリを選択
3. `Environment Variables` に `.env.example` の項目を全て入力
4. `Port`: `3000`
5. デプロイ完了後、発行されたURL（例: `https://xxx.koyeb.app`）をコピー

## 6. UptimeRobot 設定

1. [uptimerobot.com](https://uptimerobot.com) でアカウント作成
2. `Add New Monitor`
   - Type: `HTTP(s)`
   - URL: Koyebで発行されたURL
   - Interval: `5 minutes`

---

## コマンド一覧

| コマンド | 権限 | 説明 |
|---|---|---|
| `/item-add` | 管理者 | アイテム登録（name / icon画像 / lore画像） |
| `/recipe-add` | 管理者 | レシピ登録（item_name / grid画像 / ing1〜ing9） |
| `/admin-add` | 管理者 or オーナー | 管理者追加 |
| `/item` | 全員 | アイテム表示（オートコンプリート付き） |
| `/recipe` | 全員 | レシピ表示（オートコンプリート付き） |

### 材料の入力形式

```
ing1: ダイヤ*2
ing2: 棒*1
```

`アイテム名*個数` の形式で入力。そのアイテムがitemsに登録されていると、
レシピ表示時にボタンになり、押すとそのアイテムのレシピを表示します。
