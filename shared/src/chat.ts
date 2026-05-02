export type ChatRole = "user" | "assistant";

export interface ToolCall {
  type: "google_search" | "url_context";
  query?: string;
  url?: string;
  result?: unknown;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface Chat {
  id: string;
  episodeId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
