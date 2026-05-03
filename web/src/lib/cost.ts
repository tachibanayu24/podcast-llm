/**
 * 文字起こし/要約のコスト見積もり (JPY)。
 *
 * 価格は Vertex AI 公式の標準料金 (バッチ非適用) を採用。
 * モデルや為替レートが変わったらここを更新する。
 * https://cloud.google.com/vertex-ai/generative-ai/pricing
 */

// USD → JPY 換算 (おおまかな目安)
const USD_TO_JPY = 155;

// Gemini 2.5 Flash (Vertex AI 標準料金)
const FLASH_AUDIO_INPUT_USD_PER_M = 1.0;
const FLASH_TEXT_OUTPUT_USD_PER_M = 2.5;

// 音声の token 換算: 25 tokens / 秒 (Vertex AI の audio tokenization 既定)
const AUDIO_TOKENS_PER_SEC = 25;

// 文字起こし出力の経験値: 日本語/英語 podcast で 1 秒あたり ~10 output tokens
// (=毎分 ~600 tokens、60分エピソードで ~36k tokens)
const OUTPUT_TOKENS_PER_SEC = 10;

/**
 * Gemini 2.5 Flash で文字起こしした場合の概算 (JPY)。
 * 1円未満は切り上げ。
 */
export function estimateTranscribeCostJpy(durationSec: number): number {
  if (!durationSec || durationSec <= 0) return 0;
  const inputTokens = durationSec * AUDIO_TOKENS_PER_SEC;
  const outputTokens = durationSec * OUTPUT_TOKENS_PER_SEC;
  const usd =
    (inputTokens * FLASH_AUDIO_INPUT_USD_PER_M +
      outputTokens * FLASH_TEXT_OUTPUT_USD_PER_M) /
    1_000_000;
  const jpy = usd * USD_TO_JPY;
  return Math.max(1, Math.ceil(jpy));
}
