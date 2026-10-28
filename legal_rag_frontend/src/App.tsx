import { useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import ChatInput from "./components/ChatInput";
import { useChatStream } from "./hooks/useChatStream";

export default function App() {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const { messages, sendMessage, isLoading, clearMessages } = useChatStream();

  const handleSend = (question: string) => {
    const docFilter = selectedDocs.length > 0 ? selectedDocs : null;
    sendMessage(question, docFilter);
  };

  return (
    <div className="flex h-screen bg-bg-primary">
      <Sidebar
        selectedDocs={selectedDocs}
        setSelectedDocs={setSelectedDocs}
        onClearChat={clearMessages}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="px-6 py-3 border-b border-border-subtle glass flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Contract Analysis
            </h2>
            <p className="text-[10px] text-text-dim mt-0.5">
              {selectedDocs.length > 0
                ? `Filtered: ${selectedDocs.join(", ")}`
                : "Global search across all documents"}
            </p>
          </div>
          {messages.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-emerald animate-pulse-glow" />
              <span className="text-[10px] text-text-dim">
                {isLoading ? "Processing..." : "Ready"}
              </span>
            </div>
          )}
        </div>

        {/* Chat area */}
        <ChatArea messages={messages} isLoading={isLoading} />

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          selectedDocCount={selectedDocs.length}
        />
      </div>
    </div>
  );
}
