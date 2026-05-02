import { createVertex } from "@ai-sdk/google-vertex";

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? "";
const LOCATION = "asia-northeast1";

export const MODELS = {
  fast: "gemini-2.5-flash",
  smart: "gemini-3-pro-preview",
} as const;

let vertex: ReturnType<typeof createVertex> | null = null;

export function getVertex() {
  if (!vertex) {
    vertex = createVertex({
      project: PROJECT_ID,
      location: LOCATION,
    });
  }
  return vertex;
}
