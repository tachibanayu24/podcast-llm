# 開発メモ

このプロジェクトは「自分専用のPodcastクライアント」をPWAで作るというもの。配信機能はいらない、聞く側に特化。Firebase / Google Cloud のスタックでまとめて、Geminiで要約や文字起こしもさせる。

開発しながら「なぜこういう構成にしたか」をメモしていく。

---

## 2026-05-02: 設計の出発点

### 何を作るか
- PWA（メインはAndroid、iPadでも一応動けばラッキーくらい）
- Google認証
- Firebase / Google Cloud のスタック
- Gemini で文字起こし・要約・QA・翻訳
- 検索、ウォッチリスト、オフライン再生（ダウンロード）

普段Spotifyのpodcast機能を使っていて、なんとなく不満があった（要約欲しいとか、好きな部分にすぐ戻りたいとか）ので、自分用に欲しい機能だけ詰め込んだものを作る、という動機。

### なぜFirebase/GCPに寄せたか
個人プロジェクトで一番面倒なのはインフラの面倒見。Firebase だと認証・DB・関数・ホスティング・ストレージが一箇所で揃って、無料枠も広い。LLMもGoogleのGeminiを使うので、認証・課金まわりが同じプロジェクト内で完結する。

スプリットしてVercelに乗せたりCloudflareにしたりも考えたけど、結局その分の面倒見が増える。1か所にまとめる方が個人開発としては勝ち。

### 検索のソースは iTunes Search API にした
日本語のpodcastを聞くので、検索の網羅性が一番大事。SpotifyのAPIはOAuthが面倒なわりに日本語カバレッジで Apple Podcasts に勝てない。Podcast Index は良いプロジェクトだけど日本語のカバレッジは弱い。

iTunes Search API は無料・OAuth不要・レスポンスにRSS feedのURLが入っている。検索したらRSSのURLを取って、そこから先は普通のRSSパースで済む。シンプル。

### iOSは捨てた（ほぼ）
Android Chrome のPWAは Background Fetch API、ストレージ容量、Service Worker周りが充実していて、ネイティブアプリに近い体験が作れる。

iOSのSafariは…まあ、色々厳しい。ストレージはeviction されやすいし、Background Fetch も無いし、Web Push も最近やっと対応した。どっちも狙うと最大公約数で機能を削ることになるので、Androidに寄せ切ることにした。iPadは「動けばラッキー」枠。

### LLMの構成は2モデル使い分けにした
最初は「全部Gemini 3.1 Proに投げればいいや」と思ってたけど、コストを試算すると個人用にしては高い。

調べてみると、用途別で必要な賢さが違う：
- **文字起こし**: 音声 → テキスト変換。そんなに賢さは要らない、品質は十分
- **要約・翻訳**: テキスト → テキスト。これも賢さより一貫性
- **チャットQA**: ユーザーが「このエピソードのこの部分について教えて」みたいに聞く。**これだけは賢い方がいい**

なので「単純作業はFlash、頭を使うところだけPro」という分担に。具体的には：
- Gemini 2.5 Flash → 文字起こし・要約・翻訳・チャプター抽出
- Gemini 3.1 Pro Preview → チャットQA（webアクセス含む）

これだけで月のLLMコストが体感1/3〜1/4くらいになる試算。

### 音声をGeminiにどう渡すか問題
podcastのmp3を文字起こしさせるとき、最初は「URLを渡せば勝手に取ってきて文字起こししてくれるんじゃないの」と思ったけど、調べたら**公式ドキュメント上、音声のHTTPS URL直渡しは未対応**だった。動くという話もネット上にはあるけど本番依存はリスキー。

選択肢は3つ：
1. Files API にアップロード（48時間保持・無料）
2. GCSバケットに置いて gs:// URI で渡す
3. base64 inline（20MB上限なので長尺podcastは無理）

最終的にGCS経由を選んだ。理由は副次効果で、

- GCSは標準でCORSヘッダ・Range Requestsに対応している
- 署名付きURLが標準機能
- → クライアント側のオフラインダウンロード（IndexedDBに保存する用）にもそのまま使える

つまり「Geminiに渡すための場所」と「クライアントがダウンロードするための場所」を1つで兼ねられる。Cloud Run でストリーミングプロキシを書く案もあったけど、GCSで済むなら不要。

### オフライン保存の寿命
GCSは7日くらいで自動削除する。**でもクライアント側のIndexedDBに保存したものは消えない**ので、オフライン保存自体は無期限。GCSはあくまで「配信元から取ってくる→クライアントとGeminiに配るまで」の中継地。

### コストはだいたい月$2-4くらいで収まりそう
試算：
- Cloud Functions, Firestore, Auth, Hosting → 無料枠で済むはず
- GCS（Storage + Egress 10GB/月）→ $1.4
- Gemini API → $1-3（Flash 2.5の無料枠次第でもっと下がる）

予算$5の範囲には余裕で収まる。

### データモデルは「フラット」にした
Firestoreで普通シェアド・カタログ（複数ユーザーで購読番組をデデュープ）を作るけど、**そもそも自分しか使わない**ので意味がない。`users/{uid}` 配下にフラットに episodes を置いて、`isInWatchlist`、`isDownloaded` みたいなフラグで横串クエリできるようにした。シンプルが正義。

---

### スタックは最新安定版に揃えた
依存パッケージは基本的に2026年5月時点のlatest stableで揃えた：

- React 19 / TypeScript 6 / Tailwind v4
- Vite 7（最新は8だがPWAプラグインが追従待ち）
- Firebase 12 / Firebase Functions v7（Cloud Functions Gen2、Node 24 GA）
- Vercel AI SDK v6 / @ai-sdk/google v3
- TanStack Router / Query 最新
- Zod 4

理由は「個人プロジェクトで古いものに合わせる必要がない」「peer dep警告が出るのが嫌」「最新のAPIや改善を素直に享受したい」あたり。Vite 7だけはエコシステムの追従待ちで例外、これはこういうことが時々ある。

### モノレポは pnpm workspace
パッケージは `web` (PWA), `functions` (Cloud Functions), `shared` (型定義) の3つ。型を共有することで API 境界の整合性を保てる。Firebase CLI 15はpnpm workspaceに対応してるのでFunctionsのデプロイも問題なし。

`shared` はビルドステップなしで `.ts` のまま提供する設計にした。Functions側は `import type` だけで使うので、コンパイル後のJSにshared由来のコードは残らない。type-onlyな共有ならこれが一番ラク。

---

## 次にやること

- Firebase側のサービス有効化（Auth、Firestore、Storage）と Blaze プラン化
- 検索 → 購読 → エピソード表示までの最小フロー
- Google認証フロー
- 音声プレイヤー実装
