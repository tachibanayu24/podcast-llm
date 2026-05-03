import { MessageSquare, Send, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Episode } from "@podcast-llm/shared";
import { Section } from "@/components/episode/Section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEpisodeChat } from "@/hooks/useEpisodeChat";
import { cn } from "@/lib/utils";

interface Props {
  episodeId: string;
  episode: Episode;
}

export function ChatSection({ episodeId, episode }: Props) {
  const { messages, send, stop, isStreaming, error } = useEpisodeChat(episodeId);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const stickyToBottom = useRef(true);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    stickyToBottom.current =
      el.scrollHeight - (el.scrollTop + el.clientHeight) < 80;
  }

  useEffect(() => {
    if (stickyToBottom.current) {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isStreaming) {
      stop();
      return;
    }
    const text = input;
    setInput("");
    await send(text);
  }

  const placeholder = `「${episode.title}」について質問してみる…`;

  return (
    <Section title="QA チャット" icon={<MessageSquare className="size-5" />}>
      <Card className="overflow-hidden">
        {messages.length === 0 ? (
          <div className="px-5 py-8 text-center space-y-2 text-sm text-muted-foreground">
            <Sparkles className="size-5 text-primary mx-auto" />
            <p>このエピソードの内容について何でも聞いてください。</p>
            <p className="text-xs">
              要約・チャプター・Show Notes
              {episode.transcript?.status === "done" ? "・文字起こし" : ""}
              を踏まえてお答えします。
            </p>
          </div>
        ) : (
          <div
            ref={listRef}
            onScroll={onScroll}
            className="max-h-[60vh] overflow-y-auto p-4 space-y-3"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm max-w-[85%] leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground whitespace-pre-line"
                      : "bg-secondary text-secondary-foreground prose-chat",
                  )}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : m.content ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ children, href }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2 break-all"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  ) : isStreaming ? (
                    "…"
                  ) : (
                    ""
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="px-5 py-2 text-xs text-destructive border-t border-border">
            {error}
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="border-t border-border p-2 flex items-center gap-2"
        >
          <input
            aria-label="質問を入力"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm px-3 py-2 outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="submit"
            variant={isStreaming ? "secondary" : "gradient"}
            size="icon"
            disabled={!isStreaming && !input.trim()}
            aria-label={isStreaming ? "停止" : "送信"}
          >
            {isStreaming ? (
              <Square className="size-4" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </Card>
    </Section>
  );
}
