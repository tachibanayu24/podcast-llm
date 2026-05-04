/**
 * AI 利用コストの表示 (USD)。実コストはサーバ側で計算して Firestore に保存。
 * フロントは事前見積もりとフォーマッタのみ。
 *   https://cloud.google.com/speech-to-text/pricing
 */

// Chirp 3 (Speech-to-Text V2) — durationMin × rate
const CHIRP_USD_PER_MIN_STANDARD = 0.016;

/** 文字起こし(Chirp 3)の事前見積。 */
export function estimateTranscribeCostUsd(durationSec: number): number {
  if (!durationSec || durationSec <= 0) return 0;
  return (durationSec / 60) * CHIRP_USD_PER_MIN_STANDARD;
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
