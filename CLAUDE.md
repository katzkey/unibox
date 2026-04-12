# CLAUDE.md — UniBox 開発ガイド

このファイルはClaude Codeが毎回読み込む設計書です。
コードを書く前に必ずここを参照し、仕様・ルール・型定義に従ってください。

---

## プロジェクト概要

**アプリ名**: UniBox（統合インボックス）
**一言説明**: Gmail・Slack・Discord・X・Instagramのメッセージを1つのタイムラインで閲覧できるWebアプリ
**返信方針**: Phase 1はアプリ内返信なし。「開く」ボタンでネイティブアプリ/Webページへ遷移する

---

## 技術スタック

| 層 | 技術 |
|---|---|
| フレームワーク | Next.js 14（App Router） |
| 言語 | TypeScript（strict mode） |
| スタイリング | Tailwind CSS + shadcn/ui |
| 状態管理 | TanStack Query（サーバー状態） + Zustand（UI状態） |
| DB | PostgreSQL（本番）/ SQLite（ローカル開発） |
| ORM | Prisma |
| 認証 | NextAuth.js v5（OAuth管理） |
| 暗号化 | Node.js crypto（AES-256-GCM） |
| テスト | Vitest + Testing Library |
| デプロイ | Vercel（フロント）+ Railway（DB） |

---

## ディレクトリ構成

```
unibox/
├── CLAUDE.md                    # このファイル
├── .env.local                   # 環境変数（Gitに含めない）
├── .env.example                 # 環境変数のテンプレート
├── prisma/
│   └── schema.prisma            # DBスキーマ
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── page.tsx             # インボックス一覧（メイン画面）
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── messages/route.ts        # GET: 一覧取得
│   │   │   ├── messages/[id]/route.ts   # PATCH: 既読更新
│   │   │   ├── connect/[service]/route.ts  # OAuth開始
│   │   │   └── callback/[service]/route.ts # OAuthコールバック
│   │   └── connect/page.tsx     # サービス連携管理画面
│   ├── lib/
│   │   ├── db.ts                # Prismaクライアント
│   │   ├── crypto.ts            # トークン暗号化/復号
│   │   ├── fetch-messages.ts    # 各サービスから取得→正規化（統括）
│   │   └── services/
│   │       ├── gmail.ts         # Gmail API連携
│   │       ├── slack.ts         # Slack API連携
│   │       ├── discord.ts       # Discord API連携
│   │       ├── twitter.ts       # X (Twitter) API連携
│   │       └── instagram.ts     # Instagram Graph API連携
│   ├── types/
│   │   └── message.ts           # 共通型定義（下記参照）
│   └── components/
│       ├── MessageList.tsx      # メッセージ一覧
│       ├── MessageCard.tsx      # 1件のカード
│       ├── ServiceIcon.tsx      # サービスアイコン（色付き）
│       ├── FilterBar.tsx        # サービスフィルタータブ
│       └── ConnectButton.tsx    # 連携ボタン
```

---

## 共通型定義（必ず遵守）

`src/types/message.ts` に以下を定義する。新しい型はここに追加する。

```typescript
export type ServiceType =
  | "gmail"
  | "slack"
  | "discord"
  | "x"
  | "instagram"
  | "line";

export interface UnifiedMessage {
  id: string;               // アプリ内ユニークID（UUID）
  source: ServiceType;
  sourceId: string;         // 元サービス上のメッセージID（重複取得防止用）
  threadId?: string;        // スレッド / 会話ID
  sender: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  channel?: string;         // Slackチャンネル名・Discordサーバー名など
  subject?: string;         // メール件名
  bodyText: string;         // プレーンテキスト（一覧プレビュー用）
  bodyHtml?: string;        // HTML本文（詳細表示用）
  timestamp: Date;          // 受信日時（タイムライン並び替えキー）
  isRead: boolean;
  openUrl: string;          // 「開く」ボタンの遷移先URL
  attachments?: Attachment[];
  raw?: unknown;            // 元レスポンス（デバッグ用）
}

export interface Attachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface ServiceConnection {
  service: ServiceType;
  accessToken: string;      // AES-256-GCM暗号化済み
  refreshToken?: string;    // AES-256-GCM暗号化済み
  expiresAt?: Date;
  scopes: string[];
}
```

---

## DBスキーマ（Prisma）

```prisma
model ServiceConnection {
  id           String   @id @default(uuid())
  userId       String
  service      String                        // ServiceType
  accessToken  String                        // 暗号化済み
  refreshToken String?                       // 暗号化済み
  expiresAt    DateTime?
  scopes       String[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([userId, service])
}

model Message {
  id        String   @id @default(uuid())
  userId    String
  source    String                           // ServiceType
  sourceId  String                           // 元サービスのID
  data      Json                             // UnifiedMessage全体をJSON保存
  isRead    Boolean  @default(false)
  fetchedAt DateTime @default(now())

  @@unique([userId, source, sourceId])      // 重複取得防止
  @@index([userId, fetchedAt(sort: Desc)])
}
```

---

## 各サービスの「開く」URL

```typescript
// src/lib/services/open-url.ts に実装する
export function buildOpenUrl(source: ServiceType, raw: unknown): string {
  switch (source) {
    case "gmail":
      return `https://mail.google.com/mail/u/0/#inbox/${(raw as any).id}`;
    case "slack":
      // slack:// ディープリンク → fallbackとしてWeb URL
      return `https://app.slack.com/client/${(raw as any).team}/${(raw as any).channel}/p${(raw as any).ts.replace(".", "")}`;
    case "discord":
      return `https://discord.com/channels/${(raw as any).guild_id}/${(raw as any).channel_id}/${(raw as any).id}`;
    case "x":
      return `https://x.com/i/status/${(raw as any).id}`;
    case "instagram":
      return `https://www.instagram.com/direct/inbox/`;
    default:
      return "#";
  }
}
```

---

## セキュリティ実装ルール

### OAuthフロー（必須）
- `state` パラメータを必ずセッションに保存し、コールバック時に検証する（CSRF対策）
- X (Twitter) は PKCE（`code_verifier` / `code_challenge`）を使う
- `state` の不一致は即座に `400 Bad Request` を返す

### トークン暗号化（必須）
- `access_token` / `refresh_token` はDBに生で保存しない
- `src/lib/crypto.ts` の `encrypt()` / `decrypt()` を経由して保存・取得する
- 暗号鍵は `ENCRYPTION_KEY` 環境変数から読む（32バイト hex）

```typescript
// src/lib/crypto.ts の実装例
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");

export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, encHex] = payload.split(":");
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(encHex, "hex")) + decipher.final("utf8");
}
```

### 環境変数（`.env.local`）
```
# DB
DATABASE_URL=postgresql://...

# 暗号化
ENCRYPTION_KEY=<32バイトのランダムhex文字列>

# NextAuth
NEXTAUTH_SECRET=<ランダム文字列>
NEXTAUTH_URL=http://localhost:3000

# Gmail (Google Cloud Console)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Slack
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=

# Discord
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# X (Twitter)
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=

# Instagram
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
```

---

## コーディングルール

### 全般
- TypeScript strict mode。`any` は `raw?: unknown` の扱い以外で使わない
- 関数はすべて named export（default export は Next.js page/layout のみ）
- エラーは必ず `try/catch` でキャッチし、`console.error` でログを残す
- APIルートは必ずステータスコードを明示する（`200` / `400` / `401` / `500`）

### サービス連携ファイル（`src/lib/services/*.ts`）
各ファイルは以下の関数をエクスポートする：
```typescript
// 例: src/lib/services/gmail.ts
export async function fetchGmailMessages(
  accessToken: string,
  since?: Date
): Promise<UnifiedMessage[]>

export async function refreshGmailToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }>
```

### コンポーネント
- `ServiceIcon` は `service: ServiceType` を受け取り、ブランドカラーのアイコンを返す
- メッセージカードはクリックで「開く」URL に遷移（`window.open(url, "_blank")`）
- 日時は `date-fns/formatDistanceToNow` で「3時間前」形式で表示

---

## 現在の進捗と次のタスク

### 完了
- [ ] なし（これから開始）

### Phase 1 タスク（この順番で進める）

```
[ ] 1. プロジェクト初期化
        npx create-next-app@latest unibox --typescript --tailwind --app
        cd unibox && npx prisma init

[ ] 2. DBスキーマ作成
        prisma/schema.prisma に ServiceConnection, Message を定義
        npx prisma migrate dev --name init

[ ] 3. 暗号化ユーティリティ
        src/lib/crypto.ts を実装・テスト

[ ] 4. Gmail OAuth連携
        src/lib/services/gmail.ts
        src/app/api/connect/gmail/route.ts
        src/app/api/callback/gmail/route.ts

[ ] 5. Gmail メッセージ取得・正規化
        UnifiedMessage 型に変換して DB 保存

[ ] 6. メッセージ一覧 API
        GET /api/messages?service=gmail&limit=50

[ ] 7. フロントエンド一覧画面
        MessageList / MessageCard / ServiceIcon / FilterBar

[ ] 8. Slack 連携（4〜5と同じパターン）

[ ] 9. Discord 連携

[ ] 10. X / Instagram 連携
```

---

## 制約・既知の問題

| サービス | 制約 |
|---|---|
| LINE | 個人間DMはAPI非公開。Phase 1では対応しない |
| SMS | Webブラウザからの読み取り不可。スマホアプリで対応予定 |
| X | 無料枠は月500件読み取りのみ。超過時はエラーを握りつぶさずユーザーに通知する |
| Instagram | Business/Creatorアカウント必須。個人アカウントは不可 |

---

## よく使うコマンド

```bash
# 開発サーバー起動
npm run dev

# DBマイグレーション
npx prisma migrate dev --name <変更名>

# Prisma Studio（DBブラウザ）
npx prisma studio

# 型チェック
npx tsc --noEmit

# テスト実行
npm run test

# ビルド確認
npm run build
```

---

*最終更新: 2026-04-12 | 次のアクション: プロジェクト初期化（タスク1）から開始*
