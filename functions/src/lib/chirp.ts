import { protos, v2 } from "@google-cloud/speech";

type SpeechClient = v2.SpeechClient;

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? "";
// Chirp 3 は us / eu multi-region のみ。
// Cloud Function (asia-northeast1) から cross-region で呼ぶ。
const REGION = "us";

let client: SpeechClient | null = null;
function getClient(): SpeechClient {
  if (!client) {
    client = new v2.SpeechClient({
      apiEndpoint: `${REGION}-speech.googleapis.com`,
    });
  }
  return client;
}

export interface ChirpSegment {
  start: number; // seconds
  end: number; // seconds
  speakerLabel: string; // "1", "2", ...(Chirp が ID 採番)
  text: string;
}

export interface ChirpResult {
  language: string;
  segments: ChirpSegment[];
  /** 対象音声の長さ(秒)。usage 計算に使う。 */
  durationSec: number;
}

function durationToSec(
  d: protos.google.protobuf.IDuration | null | undefined,
): number {
  if (!d) return 0;
  const s = Number(d.seconds ?? 0);
  const n = Number(d.nanos ?? 0);
  return s + n / 1e9;
}

/**
 * Chirp 3 (Speech-to-Text V2 BatchRecognize) で文字起こし + 話者分離。
 *
 * 制約:
 * - Chirp 3 は word-level timestamps 非対応(ja で degraded)。result-level で
 *   segment timestamps を構築する。
 * - 話者ラベルは ID ("1", "2", ...) のみ。実名解決は呼び出し側で別途。
 */
export async function transcribeWithChirp(
  gcsUri: string,
  options: { languageCodes?: string[]; maxSpeakers?: number } = {},
): Promise<ChirpResult> {
  const speech = getClient();
  // 動的 recognizer (`_`) を使うと Recognizer リソース作成不要。
  const recognizer = `projects/${PROJECT_ID}/locations/${REGION}/recognizers/_`;

  const config: protos.google.cloud.speech.v2.IRecognitionConfig = {
    autoDecodingConfig: {},
    model: "chirp_3",
    languageCodes: options.languageCodes ?? ["auto"],
    features: {
      diarizationConfig: {
        minSpeakerCount: 1,
        maxSpeakerCount: options.maxSpeakers ?? 6,
      },
    },
  };

  const [op] = await speech.batchRecognize({
    recognizer,
    config,
    files: [{ uri: gcsUri }],
    recognitionOutputConfig: { inlineResponseConfig: {} },
    // STANDARD: 数分で完了する代わりに $0.016/min。
    // Cloud Function 540s timeout 内に収めるため標準で運用。
    processingStrategy:
      protos.google.cloud.speech.v2.BatchRecognizeRequest.ProcessingStrategy
        .PROCESSING_STRATEGY_UNSPECIFIED,
  });

  const [response] = await op.promise();
  const fileResults = response.results?.[gcsUri];
  const results = fileResults?.transcript?.results ?? [];

  let prevEnd = 0;
  const segments: ChirpSegment[] = [];
  let language = "ja";

  for (const r of results) {
    const alt = r.alternatives?.[0];
    const text = alt?.transcript?.trim();
    if (!text) continue;

    if (r.languageCode) language = r.languageCode;

    const endSec = durationToSec(r.resultEndOffset);

    // 話者は word.speakerLabel から多数決。
    const counts = new Map<string, number>();
    for (const w of alt?.words ?? []) {
      const lbl = String(w.speakerLabel ?? "1");
      counts.set(lbl, (counts.get(lbl) ?? 0) + 1);
    }
    let dominant = "1";
    let max = 0;
    for (const [k, v] of counts) {
      if (v > max) {
        dominant = k;
        max = v;
      }
    }

    segments.push({
      start: Math.max(0, prevEnd),
      end: endSec > prevEnd ? endSec : prevEnd,
      speakerLabel: dominant,
      text,
    });
    prevEnd = endSec;
  }

  return {
    language,
    segments,
    durationSec: prevEnd,
  };
}
