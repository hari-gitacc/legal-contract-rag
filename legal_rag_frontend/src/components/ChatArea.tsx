import { useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  BookOpen,
  Info,
  ShieldCheck,
  ShieldAlert,
  Scale,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import type { Message } from "../hooks/useChatStream";

type ChatAreaProps = {
  messages: Message[];
  isLoading: boolean;
};

const BACKEND_URL = "http://localhost:8000";

/**
 * Parses a citation string like "MSA_2025.pdf | Section 4.2 | Page 6"
 * and opens the document in a new browser tab.
 */
const handleCitationClick = (citation: string) => {
  const [filename, , pagePart] = citation.split(" | ");
  const pageNumber = pagePart?.replace("Page ", "").trim();
  const url = `${BACKEND_URL}/storage/contracts/${encodeURIComponent(filename.trim())}${
    pageNumber ? `#page=${pageNumber}` : ""
  }`;
  window.open(url, "_blank");
};

/**
 * Takes the raw LLM answer and replaces inline bracket citations
 * like [Filename.pdf | Section X | Page Y] with styled clickable links.
 * Returns React elements.
 */
function renderContentWithCitations(content: string) {
  // Split on citation brackets: [Filename | Section | Page N]
  const citationRegex = /\[([^\]]+\|[^\]]+\|[^\]]+)\]/g;
  const parts: (string | { citation: string })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = citationRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push({ citation: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  // If there are no citations, return content as-is for markdown processing
  if (parts.length === 1 && typeof parts[0] === "string") {
    return null; // Signal to use markdown renderer
  }

  return parts.map((part, i) => {
    if (typeof part === "string") {
      // Render text parts through markdown
      return (
        <ReactMarkdown
          key={i}
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {part}
        </ReactMarkdown>
      );
    }
    // Render citation as clickable pill
    return (
      <button
        key={i}
        onClick={() => handleCitationClick(part.citation)}
        className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded bg-accent-blue/10 border border-accent-blue/25 text-[11px] text-accent-blue-light font-medium hover:bg-accent-blue/20 hover:border-accent-blue/40 transition-all cursor-pointer align-baseline"
        title={`Open: ${part.citation}`}
      >
        <BookOpen className="w-2.5 h-2.5 flex-shrink-0" />
        {part.citation}
      </button>
    );
  });
}

/**
 * Custom markdown component overrides for consistent styling
 */
const markdownComponents = {
  p: ({ children, ...props }: React.ComponentProps<"p">) => (
    <p className="mb-2 last:mb-0 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }: React.ComponentProps<"strong">) => (
    <strong className="font-semibold text-text-primary" {...props}>
      {children}
    </strong>
  ),
  ul: ({ children, ...props }: React.ComponentProps<"ul">) => (
    <ul className="list-disc list-inside mb-3 space-y-1.5 ml-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.ComponentProps<"ol">) => (
    <ol className="list-decimal list-inside mb-3 space-y-1.5 ml-1" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.ComponentProps<"li">) => (
    <li className="text-sm leading-relaxed text-text-primary" {...props}>
      {children}
    </li>
  ),
  h1: ({ children, ...props }: React.ComponentProps<"h1">) => (
    <h1 className="text-lg font-bold mb-2 text-text-primary" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.ComponentProps<"h2">) => (
    <h2 className="text-base font-bold mb-2 text-text-primary" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.ComponentProps<"h3">) => (
    <h3 className="text-sm font-bold mb-1 text-text-primary" {...props}>
      {children}
    </h3>
  ),
  blockquote: ({ children, ...props }: React.ComponentProps<"blockquote">) => (
    <blockquote
      className="border-l-2 border-accent-blue/40 pl-3 my-2 text-text-secondary italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ children, ...props }: React.ComponentProps<"code">) => (
    <code
      className="px-1.5 py-0.5 rounded bg-bg-elevated text-accent-cyan text-xs font-mono"
      {...props}
    >
      {children}
    </code>
  ),
};

export default function ChatArea({ messages, isLoading }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [
    messages,
    messages[messages.length - 1]?.content,
    messages[messages.length - 1]?.status,
    scrollToBottom,
  ]);

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-2xl gradient-blue flex items-center justify-center mb-6 shadow-lg shadow-accent-blue/20">
          <Scale className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Legal Contract AI
        </h2>
        <p className="text-sm text-text-secondary max-w-md mb-8 leading-relaxed">
          Upload your legal contracts and ask questions. The AI will search
          across your documents, detect conflicts, and provide cited answers in
          real-time.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full">
          {[
            {
              icon: BookOpen,
              title: "Multi-Document Search",
              desc: "Query across all contracts simultaneously",
            },
            {
              icon: ShieldCheck,
              title: "Validated Citations",
              desc: "Every claim is traced to its source",
            },
            {
              icon: AlertTriangle,
              title: "Conflict Detection",
              desc: "Automatic cross-document discrepancy alerts",
            },
          ].map((feat) => (
            <div
              key={feat.title}
              className="p-4 rounded-xl bg-bg-card border border-border-subtle hover:border-border-light transition-all group"
            >
              <feat.icon className="w-5 h-5 text-accent-blue mb-2 group-hover:text-accent-cyan transition-colors" />
              <p className="text-xs font-semibold text-text-primary mb-1">
                {feat.title}
              </p>
              <p className="text-[10px] text-text-dim leading-relaxed">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {[
            "What are the payment terms?",
            "Summarize the confidentiality clause",
            "What happens upon breach?",
          ].map((q) => (
            <span
              key={q}
              className="px-3 py-1.5 text-[11px] text-text-muted bg-bg-elevated rounded-full border border-border-subtle hover:border-accent-blue/30 hover:text-accent-blue-light cursor-default transition-all"
            >
              "{q}"
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {messages.map((msg, idx) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} ${
            msg.role === "user" ? "animate-slide-right" : "animate-slide-left"
          }`}
          style={{ animationDelay: `${idx * 30}ms` }}
        >
          {/* AI Avatar */}
          {msg.role === "ai" && (
            <div className="w-7 h-7 rounded-lg gradient-blue flex items-center justify-center mr-3 mt-1 flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
          )}

          <div
            className={`max-w-2xl rounded-2xl ${
              msg.role === "user"
                ? "gradient-blue text-white px-5 py-3 shadow-lg shadow-accent-blue/10"
                : "bg-bg-card border border-border-subtle px-5 py-4"
            }`}
          >
            {/* User message */}
            {msg.role === "user" && (
              <p className="text-sm leading-relaxed">{msg.content}</p>
            )}

            {/* AI message */}
            {msg.role === "ai" && (
              <div>
                {/* Status spinner */}
                {msg.status && (
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="relative w-4 h-4">
                      <div className="absolute inset-0 rounded-full border-2 border-accent-blue/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-blue animate-spin" />
                    </div>
                    <span className="text-xs shimmer-text font-medium">
                      {msg.status}
                    </span>
                  </div>
                )}

                {/* Streamed content — rendered as markdown with inline citations */}
                {msg.content && (
                  <div className="text-sm text-text-primary leading-relaxed">
                    {(() => {
                      const withCitations = renderContentWithCitations(
                        msg.content
                      );
                      if (withCitations) {
                        return (
                          <>
                            {withCitations}
                            {isLoading &&
                              idx === messages.length - 1 &&
                              !msg.status && (
                                <span className="inline-block w-[2px] h-4 bg-accent-blue ml-0.5 align-middle animate-blink" />
                              )}
                          </>
                        );
                      }
                      return (
                        <>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {msg.content}
                          </ReactMarkdown>
                          {isLoading &&
                            idx === messages.length - 1 &&
                            !msg.status && (
                              <span className="inline-block w-[2px] h-4 bg-accent-blue ml-0.5 align-middle animate-blink" />
                            )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* No content + no status = still waiting */}
                {!msg.content && !msg.status && (
                  <div className="loading-dots text-text-dim text-sm">
                    <span>●</span> <span>●</span> <span>●</span>
                  </div>
                )}

                {/* ─── Post-stream metadata ─── */}

                {/* Conflict Alert */}
                {msg.metadata?.conflict_detected && (
                  <div className="mt-4 p-3 rounded-xl bg-warn-bg border border-warn-border/30 flex gap-3 animate-fade-in">
                    <ShieldAlert className="w-5 h-5 text-warn-text flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-warn-text mb-1">
                        ⚠ Legal Discrepancy Detected
                      </p>
                      <p className="text-xs text-warn-text/80 leading-relaxed">
                        {msg.metadata.conflict_details}
                      </p>
                    </div>
                  </div>
                )}

                {/* Out of Scope Notice */}
                {msg.metadata?.out_of_scope && (
                  <div className="mt-4 p-3 rounded-xl bg-accent-blue/5 border border-accent-blue/20 flex gap-3 animate-fade-in">
                    <Info className="w-5 h-5 text-accent-blue flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-accent-blue-light leading-relaxed">
                      This question appears to be outside the scope of your
                      uploaded documents. Try uploading a relevant contract or
                      rephrasing your question.
                    </p>
                  </div>
                )}

                {/* Validated Citations — clickable */}
                {msg.metadata?.citations &&
                  msg.metadata.citations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border-subtle animate-fade-in">
                      <p className="text-[10px] font-bold text-text-dim uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-success-text" />
                        Validated Citations
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.metadata.citations.map((cit, i) => (
                          <button
                            key={i}
                            onClick={() => handleCitationClick(cit)}
                            className="group/cit inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-[10px] text-text-secondary font-medium hover:border-accent-blue/30 hover:bg-accent-blue/10 hover:text-accent-blue-light transition-all cursor-pointer"
                            title={`Open document: ${cit}`}
                          >
                            <BookOpen className="w-3 h-3 text-accent-blue" />
                            {cit}
                            <ExternalLink className="w-2.5 h-2.5 text-text-dim group-hover/cit:text-accent-blue transition-colors" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Source Documents */}
                {msg.metadata?.sources &&
                  msg.metadata.sources.length > 0 &&
                  !msg.metadata.out_of_scope && (
                    <div className="mt-2">
                      <p className="text-[10px] text-text-dim">
                        Sources:{" "}
                        {msg.metadata.sources.map((s, i) => (
                          <span key={i}>
                            <button
                              onClick={() => {
                                const url = `${BACKEND_URL}/storage/contracts/${encodeURIComponent(s)}`;
                                window.open(url, "_blank");
                              }}
                              className="text-text-muted font-medium hover:text-accent-blue-light underline underline-offset-2 decoration-border-light hover:decoration-accent-blue transition-all cursor-pointer"
                            >
                              {s}
                            </button>
                            {i < msg.metadata!.sources.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </p>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
