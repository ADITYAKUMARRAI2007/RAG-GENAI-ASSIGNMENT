"use client";

import { useEffect, useRef, useState, Dispatch, SetStateAction } from "react";
import type { ChatMessage, SourceChunk } from "@/lib/rag/types";
import SourceCard from "@/components/SourceCard";
import { renderMarkdownWithParagraphs } from "@/lib/markdown-renderer";

interface Props {
  isReady: boolean;
  notebookLabel: string;
  sourceCount: number;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  selectedSourceNames: string[];
  onSaveLatestAnswer: () => void;
  onCopyLatestAnswer: () => void;
  onFeedback: (message: string) => void;
}

export default function ChatPanel({ isReady, notebookLabel, sourceCount, messages, setMessages, selectedSourceNames, onSaveLatestAnswer, onCopyLatestAnswer, onFeedback }: Props) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const send = async (question: string) => {
    if (!question.trim() || isLoading) return;

    if (!isReady) {
      setError("Index your documents first using the Sources panel on the left.");
      return;
    }

    setError(null);
    setInput("");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed.");

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKey = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(input);
    }
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    const element = event.target;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 132)}px`;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span>Chat</span>
          <span className="text-xs text-slate-400 truncate">{notebookLabel}</span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
          <span className="chip-stat">{sourceCount} sources</span>
          <span className="chip-stat">Grounded answers</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="empty-chat-shell">
            <div className="hero-card">
              <div className="hero-card-top">
                <div className="hero-icon">⌂</div>
                <button className="hero-customize">Customize</button>
              </div>
              <div className="hero-card-body">
                <h2 className="hero-title">{notebookLabel}</h2>
                <p className="hero-meta">{sourceCount} source{sourceCount === 1 ? "" : "s"} · {new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                <p className="hero-copy">
                  Upload documents, then ask any question. Answers are grounded only in the uploaded sources.
                </p>
              </div>
            </div>

            <div className="empty-note-card">
              <div>
                <p className="text-sm text-slate-100 font-medium">Notebook style answer flow</p>
                <p className="text-xs text-slate-400 mt-1 leading-6">
                  Retrieval happens first, then the answer is written from the retrieved context only. When evidence is weak, the assistant says so.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-5">
            {messages.map((message) => (
              <div key={message.id} className="animate-in">
                {message.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="user-message-bubble">{message.content}</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="hero-card compact">
                      <div className="hero-card-top">
                        <div className="hero-icon">⌂</div>
                        <button className="hero-customize">Customize</button>
                      </div>
                      <div className="hero-card-body">
                        <h3 className="hero-title-small">Grounded answer</h3>
                        <p className="hero-meta">{sourceCount} source{sourceCount === 1 ? "" : "s"} available</p>
                      </div>
                    </div>

                    <div className="assistant-message-card">
                      <div className="assistant-avatar">⌘</div>
                      <div className="flex-1 min-w-0">
                        <div className="assistant-label-row">
                          <span>DocuMind</span>
                          <span>Grounded response</span>
                        </div>
                        <div className="assistant-answer">{renderMarkdownWithParagraphs(message.content)}</div>
                      </div>
                    </div>

                    {message.sources && message.sources.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Sources</p>
                          <p className="text-xs text-slate-400">{message.sources.length} retrieved chunk(s)</p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {message.sources.map((source: SourceChunk, index: number) => (
                            <SourceCard key={`${index}-${source.fileName ?? "source"}`} source={source} index={index} />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="action-strip justify-start">
                      <button className="action-chip" onClick={onSaveLatestAnswer}>Save to note</button>
                      <button className="action-chip" onClick={onCopyLatestAnswer}>Copy</button>
                      <button className="action-chip" onClick={() => onFeedback("Marked as helpful.")}>Helpful</button>
                      <button className="action-chip" onClick={() => onFeedback("Marked as not helpful.")}>Not helpful</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="assistant-message-card">
                <div className="assistant-avatar">⌘</div>
                <div className="space-y-3">
                  <div className="assistant-label-row">
                    <span>DocuMind</span>
                    <span>Thinking</span>
                  </div>
                  <div className="loading-line" />
                  <div className="loading-line short" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {error && <div className="mx-6 mb-2 status-error">{error}</div>}

      <div className="px-6 pb-6 pt-2">
        <div className="composer-shell">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKey}
            placeholder={isReady ? "Ask about the uploaded sources…" : "Upload files to start chatting…"}
            disabled={!isReady || isLoading}
            rows={1}
            className="composer-input"
          />

          <div className="composer-actions">
            <span className="text-xs text-slate-400 hidden md:inline">{sourceCount} source(s)</span>
            <button
              onClick={() => send(input)}
              disabled={!isReady || isLoading || !input.trim()}
              className="send-button"
              aria-label="Send question"
            >
              {isLoading ? <span className="loading-ring" /> : <span>➜</span>}
            </button>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-slate-400">
          DocuMind only answers from the uploaded documents. {selectedSourceNames.length > 0 ? `${selectedSourceNames.length} source(s) are currently selected.` : "If the answer is missing, it says so explicitly."}
        </p>
      </div>
    </div>
  );
}