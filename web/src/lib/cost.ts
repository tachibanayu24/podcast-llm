/**
 * AI 利用コスト計算 / 表示 (USD)。
 *
 * - 価格は Vertex AI 標準料金 (バッチ非適用)。
 *   https://cloud.google.com/vertex-ai/generative-ai/pricing
 * - 100% 正確な実料金ではなく "見積もり"。usage に audio/text の内訳が無いため
 *   音声入力タスクは durationSec から audio token を推定する近似式を使う。
 */

interface ModelPricing {
  textIn: number;
  audioIn: number;
  textOut: number;
}

// USD per 1M tokens
const PRICING: Record<string, ModelPricing> = {
  "gemini-2.5-flash": { textIn: 0.3, audioIn: 1.0, textOut: 2.5 },
  "gemini-2.5-pro": { textIn: 1.25, audioIn: 1.25, textOut: 10.0 },
  "gemini-2.5-flash-lite": { textIn: 0.1, audioIn: 0.3, textOut: 0.4 },
};

const AUDIO_TOKENS_PER_SEC = 32;
const OUTPUT_TOKENS_PER_SEC = 10;

function pricingOf(model: string): ModelPricing {
  return PRICING[model] ?? PRICING["gemini-2.5-flash"]!;
}

/** 文字起こしコストの事前見積 (durationSec のみで概算)。 */
export function estimateTranscribeCostUsd(
  durationSec: number,
  model = "gemini-2.5-flash",
): number {
  if (!durationSec || durationSec <= 0) return 0;
  const p = pricingOf(model);
  const audioTokens = durationSec * AUDIO_TOKENS_PER_SEC;
  const outputTokens = durationSec * OUTPUT_TOKENS_PER_SEC;
  return (audioTokens * p.audioIn + outputTokens * p.textOut) / 1_000_000;
}

/**
 * USD 金額のフォーマット。微小金額は cents、それ以下はミルセント単位で表示する。
 */
export function formatUsd(usd: number): string {
  if (!usd || usd <= 0) return "$0";
  if (usd < 0.001) return "<$0.001";
  if (usd < 1) return `$${usd.toFixed(3)}`;
  if (usd < 100) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(1)}`;
}
