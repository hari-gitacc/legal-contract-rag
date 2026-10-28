import { useState, useCallback } from "react";

export type Metadata = {
  citations: string[];
  sources: string[];
  conflict_detected: boolean;
  conflict_details: string | null;
  out_of_scope: boolean;
  validation_passed: boolean;
};

export type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
  status?: string;
  metadata?: Metadata;
  timestamp: Date;
};

/**
 * Custom hook to manage chat state and SSE streaming from the LangGraph backend.
 *
 * Handles three event types from the stream:
 * - `status`   → Pipeline phase updates (shown as spinner labels)
 * - `token`    → Streamed LLM text (appended character by character)
 * - `metadata` → Final citations, sources, conflict flags
 *
 * Regeneration handling: When the citation validator fails and the graph
 * loops back to `answer_generator_node`, a second "Generating answer..."
 * status event arrives. This hook detects it and clears the previously
 * streamed text so the user only sees the corrected answer.
 */
export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (question: string, selectedDocuments: string[] | null) => {
      setIsLoading(true);

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: question,
        timestamp: new Date(),
      };

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "ai",
        content: "",
        status: "Initializing pipeline...",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, aiMsg]);

      // Track whether the generator node has been entered before
      // so we can detect regeneration loops and clear stale text.
      let generatorEntered = false;

      try {
        const response = await fetch("http://localhost:8000/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            selected_documents: selectedDocuments,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (!part.startsWith("data: ")) continue;
            const dataStr = part.slice(6);
            if (dataStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(dataStr);

              setMessages((prev) => {
                const updated = [...prev];
                const current = { ...updated[updated.length - 1] };

                if (parsed.type === "status") {
                  // Detect regeneration: answer generator entering a second time
                  if (parsed.content === "Generating answer with citations...") {
                    if (generatorEntered) {
                      // Citation validation failed → clear stale text
                      current.content = "";
                    }
                    generatorEntered = true;
                  }
                  current.status = parsed.content;
                } else if (parsed.type === "token") {
                  current.content += parsed.content;
                  current.status = undefined;
                } else if (parsed.type === "metadata") {
                  current.metadata = parsed as Metadata;
                  current.status = undefined;
                }

                updated[updated.length - 1] = current;
                return updated;
              });
            } catch {
              // Skip malformed JSON chunks
            }
          }
        }
      } catch (error) {
        console.error("Chat stream error:", error);
        setMessages((prev) => {
          const updated = [...prev];
          const current = { ...updated[updated.length - 1] };
          current.content =
            "⚠️ Failed to connect to the server. Please check that the backend is running on port 8000.";
          current.status = undefined;
          updated[updated.length - 1] = current;
          return updated;
        });
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, sendMessage, isLoading, clearMessages };
}
