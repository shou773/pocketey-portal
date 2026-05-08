# Feedback System — 実装記録

> **概要**：各ゲーム詳細ページの埋め込み直下に表示される「👍 / 👎 / 🐛 Report a bug」ウィジェット。
>
> **実装日**：2026-05-07
> **担当**：shou773 + Claude Code セッション
> **コミット**：`adf2957`（feature）, `<次commit>`（await fix）
> **参考にしたサイト**：CrazyGames（投票UI）、Poki（コンセプト）、GameMonetize（簡素な配置）

---

## 1. 何を作ったか

ゲーム詳細ページ（`/games/<slug>/`）に以下のUIを追加：

```
┌─ GameEmbed (iframe) ─┐
│  ゲーム本体           │
└──────────────────────┘
   👍 87%  👎    🐛 Report a bug
   152 votes
```

機能：

- **👍 / 👎 投票**：百分率と総投票数を表示。同じボタンを2度押しでトグル off、別ボタンで切替
- **🐛 Report a bug**：モーダルが開き、自由記述＋ブラウザ/デバイス情報（任意）を送信
- **永続化**：Cloudflare KV に保存。バグ報告は加えて Resend 経由でメール通知（`shishiyo1@gmail.com`）
- **重複防止**：IP+slug ハッシュで30日 TTL の dedup キー
- **レート制限**：同一IPからのバグ報告は1時間に5件まで（429返却）

---

## 2. アーキテクチャ

```
┌─────────────────────────────┐
│  Astro 静的サイト           │
│  /games/<slug>/             │
│  └ GameFeedback.astro       │  ← UI コンポーネント（投票ボタン + モーダル）
└──────────┬──────────────────┘
           │ fetch /api/*
           ▼
┌─────────────────────────────┐
│  Cloudflare Pages Functions │
│  functions/api/             │
│    ├ votes.ts  GET          │
│    ├ vote.ts   POST         │
│    └ report.ts POST         │
└──────────┬──────────────────┘
           │
     ┌─────┴─────────┐
     ▼               ▼
┌─────────┐   ┌──────────┐
│ KV      │   │ Resend   │
│FEEDBACK │   │ API      │
│ _KV     │   │          │
└─────────┘   └──────────┘
```

- 静的サイトは Cloudflare Pages にデプロイ
- `functions/` フォルダは Pages Functions として自動デプロイされる（同じプロジェクト内）
- KV は同じ Cloudflare アカウントの namespace を binding 経由で読み書き
- Resend は外部サービス（無料枠 100通/日）

---

## 3. ファイル一覧

### フロントエンド（portal/src/）

| パス | 役割 |
|---|---|
| `components/GameFeedback.astro` | ウィジェット本体。HTML + scoped CSS + `is:inline` スクリプト |
| `pages/games/[slug].astro` | GameEmbed の直下に `<GameFeedback>` を配置 |
| `locales/en.json` | UI 文字列（"Like this game", "Report a bug" 等） |

### バックエンド（portal/functions/）

| パス | 役割 |
|---|---|
| `_lib.ts` | 共通ヘルパー：型定義、IPハッシュ、KV読み書き、JSONレスポンス |
| `api/votes.ts` | `GET /api/votes?slug=foo` または `?slugs=a,b,c` |
| `api/vote.ts` | `POST /api/vote` `{ slug, value }` |
| `api/report.ts` | `POST /api/report` `{ slug, message, browserNote?, url? }` |

### ドキュメント

| パス | 役割 |
|---|---|
| `portal/README.md` | API 仕様、env 設定、ローカル開発手順を追記 |
| `portal/docs/FEEDBACK_SYSTEM.md` | このファイル（実装記録） |

---

## 4. KV スキーマ

namespace: `pocketey-feedback`（binding 名 `FEEDBACK_KV`）

| キー | 値 | TTL | 用途 |
|---|---|---|---|
| `vote:<slug>` | `{"up": N, "down": N}` JSON | なし | 各ゲームの投票数 |
| `ip:<ipHash>` | `"up"` または `"down"` | 30日 | 投票重複防止＋トグル/切替判定 |
| `report:<id>` | StoredReport JSON（slug, message, ts, ipHash 等） | 365日 | バグ報告本体（メール失敗時のバックアップ） |
| `report-rl:<ipHash>` | カウンタ文字列 | 1時間 | レート制限（5回/時） |

`<ipHash>` は IP+slug+salt を SHA-256 でハッシュした最初16バイトの hex 文字列（解析不能）。

> **注意**：KV は eventually consistent。`vote:<slug>` を JSON で読み書きしているため、ピーク時に同時投票が来ると lost-update が起こり得る。個人ポータル規模では問題なし。トラフィックが伸びたら Durable Objects への移行を検討。

---

## 5. API 仕様

### `GET /api/votes`

```
?slug=arrow-pop          → { slug: "arrow-pop", up: 42, down: 3 }
?slugs=a,b,c             → { counts: { a: { up, down }, b: ..., c: ... } }
```

### `POST /api/vote`

Request:
```json
{ "slug": "arrow-pop", "value": "up" }
```

Response:
```json
{ "slug": "arrow-pop", "up": 43, "down": 3, "your": "up" }
```

`your` は投票後の状態。`null` ならトグル off された。

### `POST /api/report`

Request:
```json
{
  "slug": "arrow-pop",
  "message": "Stuck on level 5",
  "browserNote": "iPhone 14 Safari",   // optional
  "url": "https://pocketey.com/games/arrow-pop/"   // optional
}
```

Response:
```json
{ "ok": true, "id": "1746...-abc12345" }
```

エラー：`429`（レート制限）/ `400`（バリデーション失敗）

---

## 6. Cloudflare 側のセットアップ手順（再現用）

実施日：2026-05-07

### A. KV namespace 作成

1. Cloudflare Dashboard → **Storage & databases → KV** → **Create Instance**
2. Name: `pocketey-feedback`
3. namespace ID が発行される（控え不要）

### B. Pages プロジェクトに binding

1. Workers & Pages → **pocketey-portal** → Settings → **Bindings**
2. Add binding（Production・Preview の両方）：
   - Type: KV namespace
   - Variable name: `FEEDBACK_KV`
   - Namespace: `pocketey-feedback`

### C. Resend 登録 + API キー発行

1. https://resend.com に `shishiyo1@gmail.com` でサインアップ
2. メール確認リンクをクリック（verified 状態にする）
3. **API keys → Create API key**
4. Name: `pocketey-portal`、Permission: Full access（Sending access でも可）、Domain: All domains
5. 表示された `re_xxxxxxxxxxxx` を**その場でコピー**（再表示不可）

> 無料枠で `onboarding@resend.dev` を送信元として使う限り、**送信先は Resend アカウントの verified email のみ**。今回は受信先 = `shishiyo1@gmail.com` = Resend登録メアドなので問題なし。
> 自前ドメインからの送信が必要になったら、Resend → Domains で `pocketey.com` を追加して SPF/DKIM/DMARC を設定。

### D. 環境変数を Pages プロジェクトに追加

Settings → Variables and Secrets で **Production と Preview の両方**に：

| 変数名 | Type | 値 |
|---|---|---|
| `IP_HASH_SALT` | Secret | `openssl rand -hex 32` 相当のランダム64文字 |
| `RESEND_API_KEY` | Secret | `re_xxxxxxxxxxxx`（Resendから取得） |
| `REPORT_TO_EMAIL` | text | `shishiyo1@gmail.com` |
| `RESEND_FROM` | text | `onboarding@resend.dev`（または自前ドメインverify後はその値） |

> ⚠️ env vars を変更したら **Deployments → Retry deployment** を必ず実行。新しいビルドにしか焼き込まれない。

### E. 検証

https://pocketey.com/games/arrow-pop/ で 👍 と 🐛 Report をテスト → メール到着 → 完了。

---

## 7. 遭遇したバグと修正

### 症状

- `/api/report` の HTTP レスポンスは 200 OK
- KV にはバグ報告が正しく保存されている
- **しかし Resend のログ／Emails ページが完全に空** = リクエストが Resend に1度も届いていない
- Cloudflare Real-time logs にも `resend failed` のようなエラーは一切出ない

### 原因

`functions/api/report.ts` の中で `sendEmail()` を **fire-and-forget**（`await` せず投げっぱなし）にしていた：

```ts
// バグあり
sendEmail(env, report).catch((err) => console.error("email failed", err));
return jsonResponse({ ok: true, id });
```

Cloudflare Workers のランタイムは `Response` を返した瞬間に in-flight 状態を解除し、未完了の Promise を**キャンセル**する。`fetch` が Resend に到達する前に切られていた。

ログにエラーすら出なかったのは、Promise の中の `await fetch(...)` 自体が完了する前に context が消滅したため、`if (!res.ok)` に到達していなかったから。

### 修正

```ts
// 修正後
await sendEmail(env, report).catch((err) =>
  console.error("email failed", err)
);
return jsonResponse({ ok: true, id });
```

`await` で待つことで Response 返却前に fetch が確実に完了するようにした。レスポンスタイムが Resend の応答時間（通常 500ms〜1s）分延びるが、許容範囲。

将来的にレスポンス即時返却が必要なら、Pages Function の context オブジェクトの `ctx.waitUntil(promise)` を使うのが正攻法。`Ctx` 型に `waitUntil` を含めて：

```ts
ctx.waitUntil(sendEmail(env, report).catch(...));
return jsonResponse({ ok: true, id });
```

ただし `await` 方式の方がエラーが Real-time logs にちゃんと出るので、デバッグしやすい。当面はこちらでOK。

### 学び

- **Workers/Pages Functions では Response 後の Promise は信頼できない**。`await` か `ctx.waitUntil` のどちらかを必ず使う
- 早期 return で何もログを残さないコードはデバッグ困難。`if (!env.X) { console.warn(...); return; }` のように**通った経路を必ず観測可能にする**

---

## 8. 運用ノート

### 投票数の確認

Cloudflare → Storage & databases → KV → `pocketey-feedback` → KV Pairs で：

- `vote:` プレフィックス検索 → 各ゲームの投票数（JSON）
- `report:` プレフィックス検索 → バグ報告一覧（JSON クリックで内容閲覧）

### バグ報告の閲覧

1. **メール（推奨）**：`shishiyo1@gmail.com` の受信トレイ。件名 `[Pocketey] Bug report: <slug>`
2. **KV バックアップ**：上記 KV ブラウザから `report:<id>` を直接読む
3. **Resend ダッシュボード**：https://resend.com/emails で送信履歴

### KV のクリーンアップ

テスト中に溜まったデータを綺麗にする際：

| プレフィックス | 削除影響 |
|---|---|
| `vote:` | 投票数リセット |
| `ip:` | 自分の投票履歴削除→再投票可能 |
| `report:` | バグ報告履歴削除（メールは残る） |
| `report-rl:` | レート制限即解除 |

### レート制限の調整

`functions/api/report.ts`：
```ts
const RATE_LIMIT_WINDOW = 60 * 60; // 1 hour
const RATE_LIMIT_MAX = 5;
```

ここを調整→commit→push で自動デプロイ。

### IP_HASH_SALT のローテーション

理論上はやらなくてOK（外部に流出しない限り）。ローテーションすると過去の dedup キーが効かなくなり、同じユーザーが再度投票可能になるが、実害は軽微。

### Resend の無料枠（100通/日）超過対応

- 個人ポータルで100通/日のバグ報告は通常超えない
- 超える場合は Resend 有料プラン（$20/月）または別サービス（Web3Forms 等）へ切替
- `sendEmail` 関数の中身を差し替えるだけで済む

---

## 9. 今後の改善余地

- [ ] **コメント機能**：ratings の隣にコメントスレッドを追加。負担増のため当面なし
- [ ] **管理用ダッシュボード**：portal の `/admin/` で全 KV データを GUI 閲覧。簡易認証＋ Astro で実装可能
- [ ] **集計ページ**：人気ゲームランキングを portal で表示（vote_score 順）。20本超えたら検討
- [ ] **Discord / Slack 通知**：バグ報告が来たら webhook で通知。Resend 並列で組み込むだけ
- [ ] **GameMonetize 配信版にも対応**：現状 widget はポータルページにしか出ない。`html5.gamemonetize.com/[ID]/` で遊んだユーザーは投票できない。広告ネットワーク経由のトラフィックも拾うなら、ゲーム本体に postMessage で投票UIを差し込む設計が必要
- [ ] **Astro Islands で hydrate**：現状 `is:inline` スクリプトで自前管理。Solid.js などで書き換えると保守性向上（ただし JS バンドルが増える）

---

## 10. 関連ドキュメント

- `portal/README.md` § "Game feedback API" — API 仕様と env 設定
- `STATUS.md` — 完了マイルストーン（2026-05-07 セクション）
- `SHARED_SPEC.md` — サイト全体の規約（このシステムは規約に違反していない）

<!-- last-updated: 2026-05-07 -->
