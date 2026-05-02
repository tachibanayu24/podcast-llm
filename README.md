# Podcast LLM

AIで聴く、あたらしいPodcast。
要約・文字起こし・対話で、エピソードを深く理解する個人用 PWA。

## できること

- **検索 + 購読**: iTunes Search API から番組を検索して RSS で購読
- **再生**: ミニプレイヤー / フルスクリーンプレイヤー、メディアセッション、再生速度、メディアキー
- **進捗管理**: 残り時間表示、再生済みマーク、YouTube 風の進捗バー
- **AI 要約**: Vertex AI Gemini で TL;DR + セクション要約
- **AI 文字起こし**: gs:// URI で Vertex AI に直接渡してセグメント単位で取得 (RSS の `podcast:transcript` がある場合はそちらを優先)
- **AI 翻訳**: 要約・文字起こしを日本語などに翻訳
- **AI QA チャット**: エピソード内容(要約/Show Notes/文字起こし)をコンテキストに対話
- **チャプター**: Podcasting 2.0 (`psc:chapters`, `podcast:chapters`) と Show Notes 内のタイムスタンプから抽出
- **オフライン再生**: IndexedDB で音声 Blob 保存。容量管理画面付き
- **新着フィード**: 全購読番組を横断した最新順表示
- **あとで聴く**: ブックマーク

## アーキテクチャ

- **Frontend**: Vite 7 + React 19 + TanStack Router/Query + zustand + Tailwind v4 + vite-plugin-pwa
- **Backend**: Firebase Functions Gen2 (Node 24, asia-northeast1) + Cloud Storage
- **AI**: Vercel AI SDK + `@ai-sdk/google-vertex` (Gemini 2.5 Flash/Pro)
- **DB**: Firestore (`users/{uid}/{podcasts,episodes,transcripts,summaries,translations}`)
- **Auth**: Firebase Authentication (Google sign-in)
- **Hosting**: Firebase Hosting + custom domain

## 開発

```bash
# 依存関係インストール
pnpm install

# 環境変数を web/.env.local に作成
cat > web/.env.local <<EOF
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
EOF

# Web 開発サーバ
cd web && pnpm dev

# Functions 開発 (TypeScript watch)
cd functions && pnpm build:watch

# Functions ローカル実行 (要 firebase emulators)
firebase emulators:start
```

## デプロイ

```bash
# Functions
firebase deploy --only functions

# Hosting
cd web && pnpm build
firebase deploy --only hosting

# Firestore rules / indexes
firebase deploy --only firestore
```

### IAM (新規 onCall/onRequest 関数を追加した場合)

Cloud Run の `allUsers/run.invoker` を手動付与する必要があります(Firebase CLI の `invoker:public` バグ対応):

```bash
gcloud run services add-iam-policy-binding <function-name-lowercase> \
  --region=asia-northeast1 \
  --member=allUsers \
  --role=roles/run.invoker \
  --project=<project-id>
```

### カスタムドメインで認証する場合

Firebase Auth の authDomain にカスタムドメインを設定したら:

1. Firebase Console > Auth > Settings > 認証済みドメイン に追加
2. GCP Console > APIs & Services > Credentials の OAuth 2.0 クライアントに以下を追加:
   - JavaScript 生成元: `https://<custom-domain>`
   - リダイレクト URI: `https://<custom-domain>/__/auth/handler`
3. PWA の Service Worker は `/__/auth/*` を `navigateFallback` で食わないよう denylist 設定が必要
   (`vite.config.ts` の `workbox.navigateFallbackDenylist: [/^\/__\//, /^\/api\//]`)

## ディレクトリ

```
.
├── web/              # フロントエンド (Vite + React PWA)
│   └── src/
│       ├── components/  # UI コンポーネント
│       ├── hooks/       # React フック
│       ├── lib/         # Firebase, player-store, errors
│       ├── pages/       # ルートコンポーネント
│       └── router.tsx
├── functions/        # Cloud Functions Gen2
│   └── src/
│       ├── lib/         # admin, ai, safe-fetch, rss-parser etc
│       ├── chat.ts
│       ├── context.ts   # transcript/chapters のオンデマンド取得
│       ├── ingest.ts    # RSS フィードの取得とエピソード追加
│       ├── rss.ts       # 購読・全フィード再取得
│       ├── search.ts
│       ├── summarize.ts
│       ├── transcribe.ts
│       ├── translate.ts
│       └── unsubscribe.ts
├── shared/           # web/functions 両方で使う型定義
└── notes/dev-log.md  # 開発メモ・設計判断の記録
```

## ライセンス

Personal project — no license. Don't use this in production without the necessary credentials and IAM setup.
