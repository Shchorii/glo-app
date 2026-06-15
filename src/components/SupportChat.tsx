"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { GloBot } from "./GloBot";

type ChatRole = "user" | "assistant";
type ChatMessage = { id: string; role: ChatRole; content: string };

const STARTERS = [
  "How do I upload a Reel?",
  "What geos can I target?",
  "How do I pause a campaign?",
] as const;

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi — I'm Glo's Campaign Manager assistant. Ask about uploads, geos, screens, or pausing. For billing or account issues, use your dashboard or hi@glo.io.",
};

function newId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function SupportChat() {
  const panelId = useId();
  const inputId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    if (window.innerWidth < 768) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function sendUserText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || status === "sending") return;

    const userMsg: ChatMessage = { id: newId(), role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setDraft("");
    setStatus("sending");
    setError("");

    const apiMessages = nextMessages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: { role: string; content: string };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);

      const content = data.message?.content?.trim();
      if (!content) throw new Error("Empty reply");

      setMessages((prev) => [...prev, { id: newId(), role: "assistant", content }]);
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setError(
        e instanceof Error ? e.message : "Couldn't reach support chat. Try again or email hi@glo.io."
      );
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void sendUserText(draft);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendUserText(draft);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 md:bottom-8 md:right-8 z-[38] flex flex-col items-end gap-3">
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-labelledby={`${panelId}-title`}
          className="w-[min(100vw-2rem,400px)] h-[min(72vh,560px)] flex flex-col card overflow-hidden shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line-900 bg-bg-900/80">
            <div className="flex items-center gap-2.5">
              <GloBot variant="avatar" size={30} title="GloBot" />
              <div>
                <div id={`${panelId}-title`} className="text-[15px] font-semibold text-ink-50">
                  Glo support
                </div>
                <div className="text-[12px] text-ink-400">Campaign Manager help</div>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
              className="w-9 h-9 rounded-lg border border-line-700 text-ink-200 hover:text-ink-50 hover:bg-bg-800 transition-colors"
            >
              ×
            </button>
          </div>

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-bg-950/40"
            aria-live="polite"
          >
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[92%] rounded-xl px-3 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-cy-500/15 text-cy-100 border border-cy-500/25"
                      : "bg-bg-900/90 text-ink-100 border border-line-800"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {status === "sending" && (
              <div className="text-[13px] text-ink-400 font-mono">Thinking…</div>
            )}
            {status === "error" && error && (
              <div className="text-[13px] text-lime-300/90">{error}</div>
            )}
          </div>

          {messages.length <= 1 && status !== "sending" && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendUserText(q)}
                  className="text-left text-[12px] px-3 py-1.5 rounded-full border border-line-700 text-ink-200 hover:text-ink-50 hover:border-cy-500/40 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="p-3 border-t border-line-900 bg-bg-900/60">
            <label htmlFor={inputId} className="sr-only">
              Message
            </label>
            <div className="flex gap-2 items-end">
              <textarea
                id={inputId}
                ref={inputRef}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={status === "sending"}
                placeholder="Ask about campaigns…"
                className="flex-1 resize-none rounded-lg border border-line-700 bg-bg-950 px-3 py-2 text-[14px] text-ink-50 placeholder:text-ink-500 focus:outline-none focus:border-cy-500/50 min-h-[44px] max-h-[120px]"
              />
              <button
                type="submit"
                disabled={status === "sending" || !draft.trim()}
                className="btn btn-primary shrink-0 px-4 py-2.5 text-[14px] disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-[11px] text-ink-500 leading-snug">
              Answers from public Glo info.{" "}
              <a
                href="https://we-are-glo.com/contact"
                className="text-cy-300 hover:text-cy-200"
                target="_blank"
                rel="noopener noreferrer"
              >
                Contact
              </a>{" "}
              for account help.
            </p>
          </form>
        </div>
      )}

      {open ? (
        <button
          type="button"
          aria-expanded
          aria-controls={panelId}
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-full px-4 py-3 text-[14px] font-medium shadow-lg border bg-bg-900 border-line-700 text-ink-100 transition-all hover:bg-bg-800 hover:text-ink-50"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-cy-300 shadow-glow-cy" aria-hidden />
          Close chat
        </button>
      ) : (
        <div className="gb-launch relative flex items-center">
          <span className="gb-bubble absolute right-full top-1/2 mr-3 whitespace-nowrap rounded-full bg-bg-900/95 border border-line-700 px-3 py-1.5 text-[12px] text-ink-100 shadow-lg">
            Need a hand? <span className="text-cy-300 font-medium">Ask GloBot</span>
          </span>
          <button
            type="button"
            aria-label="Open Glo support chat"
            aria-expanded={false}
            onClick={() => setOpen(true)}
            className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cy-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-950"
          >
            <span className="gb-hoverscale">
              <GloBot variant="launcher" size={92} className="gb-bob" title="GloBot — open support chat" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
