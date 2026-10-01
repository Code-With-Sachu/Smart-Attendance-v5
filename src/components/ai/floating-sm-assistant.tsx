"use client";

import * as React from "react";
import { Bot, Mic, Send, Sparkles, X } from "lucide-react";

type Message = {
  role: "user" | "model";
  text: string;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const STARTERS = [
  "Show my student list",
  "Who has low attendance?",
  "Show today's attendance",
];

export function FloatingSMAssistant() {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([
    {
      role: "model",
      text: "Hello! I'm SM, your Smart Attendance assistant. Ask me about your students, attendance, or existing Profile data.",
    },
  ]);
  const [loading, setLoading] = React.useState(false);
  const [listening, setListening] = React.useState(false);

  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  React.useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function speak(text: string) {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window)
    ) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1;
    utterance.pitch = 1;

    window.speechSynthesis.speak(utterance);
  }

  async function sendMessage(value?: string) {
    const message = (value ?? input).trim();

    if (!message || loading) {
      return;
    }

    const nextMessages: Message[] = [
      ...messages,
      {
        role: "user",
        text: message,
      },
    ];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          conversation: messages.slice(-10),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
            data?.message ||
            "SM could not respond.",
        );
      }

      const answer =
        typeof data.answer === "string"
          ? data.answer
          : "I couldn't generate a response.";

      setMessages((current) => [
        ...current,
        {
          role: "model",
          text: answer,
        },
      ]);

      speak(answer);
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "Something went wrong while contacting SM.";

      setMessages((current) => [
        ...current,
        {
          role: "model",
          text,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function startListening() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessages((current) => [
        ...current,
        {
          role: "model",
          text: "Voice input is not supported by this browser. Please use Chrome or Edge.",
        },
      ]);
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript =
        event.results[event.resultIndex]?.[0]?.transcript ?? "";

      if (transcript.trim()) {
        setInput(transcript);
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-[100] flex h-[min(620px,calc(100vh-120px))] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">

          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary-foreground">
                <Bot className="size-5 text-primary" />
              </div>

              <div>
                <div className="flex items-center gap-2 font-semibold">
                  SM

                  <span className="flex items-center gap-1 text-xs font-normal">
                    <span className="size-1.5 rounded-full bg-primary-foreground" />
                    Online
                  </span>
                </div>

                <p className="text-xs opacity-90">
                  Smart Attendance AI
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-primary px-2 py-2 transition hover:bg-primary/80"
              aria-label="Close SM"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* CHAT AREA */}
          <div className="flex-1 overflow-y-auto bg-card p-4">
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm"
                      : "mr-auto max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-muted px-4 py-3 text-sm text-fg shadow-sm"
                  }
                >
                  {message.text}
                </div>
              ))}

              {/* STARTER QUESTIONS */}
              {messages.length === 1 && (
                <div className="pt-2">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-fg-muted">
                    <Sparkles className="size-3.5" />
                    Try asking SM
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {STARTERS.map((starter) => (
                      <button
                        key={starter}
                        type="button"
                        onClick={() => void sendMessage(starter)}
                        className="rounded-full border border-border bg-card px-3 py-2 text-xs text-fg-muted shadow-sm transition hover:border-primary hover:bg-muted hover:text-primary"
                      >
                        {starter}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* LOADING */}
              {loading && (
                <div className="mr-auto rounded-2xl rounded-bl-md border border-border bg-muted px-4 py-3 text-sm text-fg-muted shadow-sm">
                  SM is thinking...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* INPUT AREA */}
          <div className="border-t border-border bg-card p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-muted p-2">

              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Ask SM anything..."
                rows={1}
                className="max-h-28 min-h-10 flex-1 resize-none bg-card px-2 py-2 text-sm text-fg outline-none placeholder:text-fg-subtle"
              />

              {/* MICROPHONE */}
              <button
                type="button"
                onClick={startListening}
                className={
                  listening
                    ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive text-destructive-foreground transition"
                    : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-fg transition hover:bg-primary hover:text-primary-foreground"
                }
                aria-label={
                  listening
                    ? "Stop listening"
                    : "Voice input"
                }
                title={
                  listening
                    ? "Stop listening"
                    : "Voice input"
                }
              >
                <Mic className="size-4" />
              </button>

              {/* SEND */}
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || loading}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="size-4" />
              </button>
            </div>

            <p className="mt-2 text-center text-[10px] text-fg-subtle">
              SM uses your existing Smart Attendance data.
            </p>
          </div>
        </div>
      )}

      {/* FLOATING SM BUTTON */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[100] flex items-center gap-2 rounded-full border border-border bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-xl transition hover:scale-105 hover:bg-primary/90 hover:shadow-2xl"
          aria-label="Open SM AI Assistant"
        >
          <Bot className="size-5" />
          <span>SM</span>
        </button>
      )}
    </>
  );
}
