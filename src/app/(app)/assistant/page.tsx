"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "model";
  text: string;
};

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
}

const STARTER_QUESTIONS = [
  "Show my student list",
  "Give me a student's details",
  "Who has low attendance?",
  "Show today's attendance",
  "What files have I imported?",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: "Hello! I'm SM, your Smart Attendance assistant. Ask me about your students, attendance, or existing Profile data.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  async function sendMessage(messageOverride?: string) {
    const message = (messageOverride ?? input).trim();

    if (!message || loading) return;

    const userMessage: Message = {
      role: "user",
      text: message,
    };

    const conversation = [...messages, userMessage];

    setMessages(conversation);
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

      const data: unknown = await response.json();

      if (
        !response.ok ||
        !data ||
        typeof data !== "object" ||
        !("answer" in data) ||
        typeof data.answer !== "string"
      ) {
        throw new Error("SM could not process the request.");
      }

      const answer = data.answer;

      setMessages((current) => [
        ...current,
        {
          role: "model",
          text: answer,
        },
      ]);

      speak(answer);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Something went wrong while contacting SM.";

      setMessages((current) => [
        ...current,
        {
          role: "model",
          text: errorMessage,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  }

  function startListening() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessages((current) => [
        ...current,
        {
          role: "model",
          text: "Voice input is not supported by this browser. Please use a recent version of Chrome or Edge.",
        },
      ]);
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }

      setInput(transcript);

      const finalResult =
        event.results[event.results.length - 1]?.isFinal ?? false;

      if (finalResult) {
        void sendMessage(transcript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
      <section className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-lg font-bold text-white shadow-sm">
            SM
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              SM Assistant
            </h1>
            <p className="text-sm text-muted-foreground">
              Your Smart Attendance AI assistant
            </p>
          </div>
        </div>

        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Ask SM about your existing students, attendance records, and files
          imported through Profile. SM does not require a separate file upload.
        </p>
      </section>

      <section className="mb-5">
        <p className="mb-3 text-sm font-medium">Try asking</p>

        <div className="flex flex-wrap gap-2">
          {STARTER_QUESTIONS.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => void sendMessage(question)}
              disabled={loading}
              className="rounded-full border px-4 py-2 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {question}
            </button>
          ))}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border bg-background shadow-sm">
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "bg-black text-white"
                    : "bg-muted text-foreground"
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                SM is thinking…
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-3 sm:p-4">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Ask SM about students or attendance..."
              rows={2}
              disabled={loading}
              className="min-h-12 flex-1 resize-none rounded-2xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />

            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              disabled={loading}
              aria-label={listening ? "Stop listening" : "Start voice input"}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-lg transition ${
                listening
                  ? "bg-black text-white"
                  : "hover:bg-muted"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {listening ? "■" : "🎙️"}
            </button>

            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={loading || !input.trim()}
              className="h-12 rounded-2xl bg-black px-5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </div>

          <p className="mt-2 px-1 text-xs text-muted-foreground">
            Press Enter to send · Shift + Enter for a new line · 🎙️ for voice
          </p>
        </div>
      </section>
    </main>
  );
}








