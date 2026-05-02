import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { defineSecret } from "firebase-functions/params";

export const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

export const MODELS = {
  fast: "gemini-2.5-flash",
  smart: "gemini-3.1-pro-preview",
} as const;

export function getGoogle() {
  return createGoogleGenerativeAI({
    apiKey: GEMINI_API_KEY.value(),
  });
}
