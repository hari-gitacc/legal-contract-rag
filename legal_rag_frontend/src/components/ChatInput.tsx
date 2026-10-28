import { useState, useRef, useEffect } from "react";
import { Send, Loader2, CornerDownLeft } from "lucide-react";

type ChatInputProps = {
  onSend: (message: string) => void;
  isLoading: boolean;
  selectedDocCount: number;
};

export default function ChatInput({
  onSend,
  isLoading,
  selectedDocCount,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 border-t border-border-subtle glass">
      {/* Filter indicator */}
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-1.5 h-1.5 rounded-full ${selectedDocCount > 0 ? "bg-accent-emerald" : "bg-accent-blue"}`} />
          <span className="text-[10px] text-text-dim">
            {selectedDocCount > 0
              ? `Searching ${selectedDocCount} selected document${selectedDocCount !== 1 ? "s" : ""}`
              : "Searching all uploaded documents"}
          </span>
        </div>

        {/* Input bar */}
        <div className="flex items-end gap-2 bg-bg-elevated rounded-xl border border-border-light focus-within:border-accent-blue/40 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.08)] transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your legal contracts..."
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent px-4 py-3 text-sm text-text-primary placeholder:text-text-dim resize-none outline-none max-h-40"
          />

          <div className="flex items-center gap-1.5 pr-2 pb-2">
            {/* Keyboard shortcut hint */}
            {input.trim() && !isLoading && (
              <span className="hidden sm:flex items-center gap-1 text-[10px] text-text-dim mr-1">
                <CornerDownLeft className="w-3 h-3" />
                Enter
              </span>
            )}

            {/* Send button */}
            <button
              onClick={handleSubmit}
              disabled={isLoading || !input.trim()}
              className="p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed enabled:hover:bg-accent-blue/20 enabled:active:scale-95 gradient-blue disabled:bg-none disabled:bg-bg-hover"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-text-dim mt-2">
          Responses are generated from your uploaded contracts only. Always verify critical legal advice.
        </p>
      </div>
    </div>
  );
}
