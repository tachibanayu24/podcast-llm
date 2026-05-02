# CLAUDE.md

このファイルは Claude Code がこのリポジトリで作業する際のガイドです。

## プロジェクト概要

個人用の Podcast PWA。Vite + React の SPA がフロント、Firebase Functions Gen2 がバックエンド。LLM 部分は Vertex AI の Gemini を Vercel AI SDK 経由で使用。

ユーザは1人(本人)のみ。コードは個人用品質ではなく "個人用でも妥協しない" 方針。プレースホルダ文言や仮 UI は NG。

## ワークスペース

pnpm workspaces:
- `web/` — フロントエンド (`@podcast-llm/web`)
- `functions/` — Cloud Functions (`@podcast-llm/functions`)
- `shared/` — 型定義 (`@podcast-llm/shared`, web からのみ参照)
- `notes/dev-log.md` — 設計メモ・開発記録

functions は shared package を参照していません(Firebase deploy がワークスペース依存をうまく扱えないため)。functions/src/lib/types.ts に同等の型を二重管理しています — shared 側を変更したら functions 側も合わせる必要があります。

## 開発で気をつけること

### ビルド前にエラーを潰す
- `web/`: `pnpm build` で `tsc --noEmit && vite build`
- `functions/`: `pnpm build` で `tsc`

両方とも素直な構成。デプロイ前は両方ビルドして OK を確認する習慣で。

### 依存関係は最新安定版
推測値で書かず、`pnpm view <pkg> version` で確認した最新を使うこと。

### コミット粒度
1行メッセージ、Co-Authored-By 不要、適切な粒度で都度コミット。

### Cloud Functions Gen2 の IAM 注意点
Firebase CLI の `invoker: "public"` 設定は反映されないバグがあります。新関数をデプロイした後は、Cloud Run の IAM を手動で付与する必要があります:

```bash
gcloud run services add-iam-policy-binding <function-name-lowercase> \
  --region=asia-northeast1 \
  --member=allUsers \
  --role=roles/run.invoker \
  --project=podcast-llm-495107
```

## 主要な実装メモ

### LLM のコンテキスト戦略
要約・QA・翻訳のすべての機能は「文字起こしが無くても動く」ように設計されています。エピソードに使えるコンテキストを以下の優先順位で集めます:

1. RSS の `podcast:transcript` (VTT/JSON)
2. Vertex AI Gemini で生成した文字起こし (gs:// URI 直渡し)
3. Show Notes (HTML サニタイズ後のテキスト + リンク)
4. チャプター (`psc:chapters` / `podcast:chapters` / Show Notes 内タイムスタンプ)

文字起こしが無くても Show Notes が詳しい番組(Rebuild など)なら QA も要約もまともに動きます。

### Vertex AI と認証
`@ai-sdk/google-vertex` を使用。Cloud Functions の Application Default Credentials で動くので `GEMINI_API_KEY` のようなシークレットは不要です。1時間級の音声ファイルも `gs://` URI を `fileData.fileUri` に渡せば直接処理できます (Files API への二段アップロード不要)。

### 要約は2モデル使い分け
- 普通のエピソード: Gemini 2.5 Flash
- 文字起こしが長大 (200k chars 超) や複雑な番組: Gemini 2.5 Pro

`SummaryDoc.contextTier` フィールドで使ったコンテキストの種類を保存しています。

### Firebase Auth + カスタムドメイン
- authDomain にカスタムドメインを使うと、Firebase 既定の OAuth クライアントの redirect URI を Console 側で手動追加する必要があります(`https://<domain>/__/auth/handler`)。
- PWA の Service Worker が `/__/auth/handler` を `navigateFallback` で SPA shell に書き換えてしまわないよう、`workbox.navigateFallbackDenylist: [/^\/__\//, /^\/api\//]` を vite.config.ts に書いています。

### SSRF 対策
RSS や Show Notes 内のメディア/サブリソース取得には `functions/src/lib/safe-fetch.ts` を経由します。プライベート IP や `metadata.google.internal` 等を弾き、サイズ上限とタイムアウトを設けています。`/api/chat` 経由の LLM ストリーミングは `streamText().pipeTextStreamToResponse(res)` で実装しています。

### オフライン
PWA 本体の Service Worker でアプリシェルをキャッシュ、音声は `idb-keyval` で IndexedDB に Blob 保存。Player.tsx は再生時に offline blob を見て、あれば `URL.createObjectURL(blob)` に差し替える戦略。CORS NG なホストはサポート外(諦める)。

## 開発時の検索・探索ヒント

- ルートは `web/src/router.tsx`
- 画面は `web/src/pages/`
- フックは `web/src/hooks/`
- プレイヤー状態は `web/src/lib/player-store.ts` (zustand persist)
- 関数のエントリポイントは `functions/src/index.ts`(全 export を集約)

## ドキュメント類

- `notes/dev-log.md` — 設計判断・トラブルシューティングの履歴。新しく学んだことは末尾に追記。
