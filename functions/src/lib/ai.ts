import { createVertex } from "@ai-sdk/google-vertex";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? "";
const LOCATION = "asia-northeast1";

export const MODELS = {
  fast: "gemini-2.5-flash",
  smart: "gemini-2.5-pro",
  // Lite は asia-northeast1 では未提供(US/EU のみ)。global endpoint で呼ぶ。
  lite: "gemini-2.5-flash-lite",
} as const;

let vertexRegional: ReturnType<typeof createVertex> | null = null;
let vertexGlobal: ReturnType<typeof createVertex> | null = null;

export function getVertex() {
  if (!vertexRegional) {
    vertexRegional = createVertex({
      project: PROJECT_ID,
      location: LOCATION,
    });
  }
  return vertexRegional;
}

// Flash-Lite など asia-northeast1 で未対応のモデル用。
export function getVertexGlobal() {
  if (!vertexGlobal) {
    vertexGlobal = createVertex({
      project: PROJECT_ID,
      location: "global",
    });
  }
  return vertexGlobal;
}
