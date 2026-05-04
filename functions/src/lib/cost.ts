/**
 * AI 利用コスト計算 (USD)。
 *
 * - 価格は Vertex AI 標準料金 (バッチ非適用)。
 *   https://cloud.google.com/vertex-ai/generative-ai/pricing
 * - usage に audio/text の内訳が無いため、音声入力タスクは「durationSec から
 *   audio token を推定 → input から差し引いた残りを text input とする」近似。
 * - 100% 正確な実料金ではなく "見積もり" として扱う。
 */

// USD per 1M tokens
interface ModelPricing {
  textIn: number;
  audioIn: number;
  textOut: number;
}

const PRICING: Record<string, ModelPricing> = {
  "gemini-2.5-flash": { textIn: 0.3, audioIn: 1.0, textOut: 2.5 },
  // Pro は 200k context 以下の標準 tier。それを超えると textIn 2.5 / textOut 15 に上がる。
  "gemini-2.5-pro": { textIn: 1.25, audioIn: 1.25, textOut: 10.0 },
  "gemini-2.5-flash-lite": { textIn: 0.1, audioIn: 0.3, textOut: 0.4 },
};

// Gemini 2.5 系の音声トークン換算: 1秒 = 32 tokens
export const AUDIO_TOKENS_PER_SEC = 32;

// 文字起こしの出力分量の経験値: 1秒あたり 約10 tokens (60分で 36k tokens 程度)
const OUTPUT_TOKENS_PER_SEC = 10;

// Speech-to-Text V2 / Chirp 3 価格(USD per minute)
// https://cloud.google.com/speech-to-text/pricing
export const CHIRP_USD_PER_MIN_STANDARD = 0.016;
export const CHIRP_USD_PER_MIN_DYNAMIC_BATCH = 0.004;

function pricingOf(model: string): ModelPricing {
  return PRICING[model] ?? PRICING["gemini-2.5-flash"]!;
}

/** 文字起こしコスト(Gemini)の事前見積 (durationSec のみで概算)。 */
export function estimateTranscribeCostUsd(
  durationSec: number,
  model: string,
): number {
  if (!durationSec || durationSec <= 0) return 0;
  const p = pricingOf(model);
  const audioTokens = durationSec * AUDIO_TOKENS_PER_SEC;
  const outputTokens = durationSec * OUTPUT_TOKENS_PER_SEC;
  return (audioTokens * p.audioIn + outputTokens * p.textOut) / 1_000_000;
}

/** Chirp 3 のコスト計算 (durationSec から)。 */
export function chirpCostUsd(
  durationSec: number,
  tier: "standard" | "dynamicBatch" = "standard",
): number {
  if (!durationSec || durationSec <= 0) return 0;
  const rate =
    tier === "dynamicBatch"
      ? CHIRP_USD_PER_MIN_DYNAMIC_BATCH
      : CHIRP_USD_PER_MIN_STANDARD;
  return (durationSec / 60) * rate;
}

/** usage から実コストを算出 (純テキスト I/O 用)。 */
export function actualCostUsd(
  model: string,
  usage: { inputTokens?: number; outputTokens?: number } | undefined,
): number {
  if (!usage) return 0;
  const p = pricingOf(model);
  const inTok = usage.inputTokens ?? 0;
  const outTok = usage.outputTokens ?? 0;
  return (inTok * p.textIn + outTok * p.textOut) / 1_000_000;
}

/**
 * 音声入力を含む usage から実コストを算出。
 * audio_tokens = durationSec * 32 と仮定して input から分離する。
 */
export function actualAudioCostUsd(
  model: string,
  usage: { inputTokens?: number; outputTokens?: number } | undefined,
  audioDurationSec: number,
): number {
  if (!usage) return 0;
  const p = pricingOf(model);
  const inTok = usage.inputTokens ?? 0;
  const outTok = usage.outputTokens ?? 0;
  const audioTok = Math.min(audioDurationSec * AUDIO_TOKENS_PER_SEC, inTok);
  const textInTok = Math.max(0, inTok - audioTok);
  return (
    (audioTok * p.audioIn + textInTok * p.textIn + outTok * p.textOut) /
    1_000_000
  );
}
