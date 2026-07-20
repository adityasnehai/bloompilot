"use client";

import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
};

type StreamDelta = {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
};

const SUGGESTIONS = [
  "Which plants need water today?",
  "What are my high-priority care tasks?",
  "How is my garden health trending?",
  "What should I watch for after diagnosis?",
];

function LeafIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
      <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
      <path d="M12 22V12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return;
    setError(null);

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text.trim() };
    const assistantId = crypto.randomUUID();

    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const history = [...messages, userMessage].map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Chat request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break;

          try {
            const delta = JSON.parse(raw) as StreamDelta;
            const token = delta.choices?.[0]?.delta?.content ?? "";
            if (token) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + token } : m,
                ),
              );
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="flex h-[calc(100vh-88px)] flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-[var(--color-ink)]">
            <LeafIcon />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">Garden assistant</p>
            <p className="text-xs text-[var(--color-muted)]">Your plants, tasks, care plan, diagnoses, and reminders</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--color-line)] bg-white/5 text-[var(--color-ink)]">
              <LeafIcon />
            </div>
            <div>
              <p className="text-base font-semibold text-[var(--color-ink)]">What do you need to know?</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Ask about a plant, task, diagnosis, weather, or reminder.
              </p>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void sendMessage(suggestion)}
                  className="rounded-full border border-[var(--color-line)] bg-white/5 px-3 py-1.5 text-xs font-medium text-[var(--color-muted)] transition hover:border-white/20 hover:bg-white/8 hover:text-[var(--color-ink)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                  message.role === "user"
                    ? "bg-[var(--color-canopy)] text-white"
                    : "border border-[var(--color-line)] bg-white/5 text-[var(--color-ink)]"
                }`}>
                  {message.role === "user" ? "U" : <LeafIcon />}
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "bg-[var(--color-canopy)] text-white"
                    : "border border-[var(--color-line)] bg-white/5 text-[var(--color-ink)]"
                }`}>
                  {message.content || (streaming && message.role === "assistant" ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="animate-bounce delay-0 h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                      <span className="animate-bounce delay-75 h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                      <span className="animate-bounce delay-150 h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                    </span>
                  ) : "")}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Error */}
      {error ? (
        <div className="shrink-0 mx-4 mb-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-[var(--color-muted)]">
          {error}
        </div>
      ) : null}

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="Ask about your plants, tasks, or care advice…"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none rounded-xl border border-[var(--color-line)] bg-white/5 px-4 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-60"
            style={{ maxHeight: 120, overflowY: "auto" }}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-canopy)] text-white shadow-sm transition hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
          >
            <SendIcon />
          </button>
        </form>
        <p className="mx-auto mt-1.5 max-w-2xl text-center text-[9px] text-[var(--color-muted)]">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
