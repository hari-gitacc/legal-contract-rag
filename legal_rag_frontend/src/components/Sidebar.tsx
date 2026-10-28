import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  HardDrive,
  Scale,
} from "lucide-react";
import { fetchDocuments, uploadDocuments, deleteDocument } from "../lib/api";
import type { DocumentInfo } from "../lib/api";

type SidebarProps = {
  selectedDocs: string[];
  setSelectedDocs: React.Dispatch<React.SetStateAction<string[]>>;
  onClearChat: () => void;
};

export default function Sidebar({
  selectedDocs,
  setSelectedDocs,
  onClearChat,
}: SidebarProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (e) {
      console.error("Failed to load documents", e);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsUploading(true);
    try {
      await uploadDocuments(files);
      await loadDocs();
    } catch (e) {
      console.error("Upload failed", e);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (filename: string) => {
    try {
      await deleteDocument(filename);
      setSelectedDocs((prev) => prev.filter((d) => d !== filename));
      setDeleteConfirm(null);
      await loadDocs();
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const toggleDoc = (filename: string) => {
    setSelectedDocs((prev) =>
      prev.includes(filename)
        ? prev.filter((d) => d !== filename)
        : [...prev, filename]
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  const getFileIcon = (filename: string) => {
    if (filename.endsWith(".pdf")) return "📄";
    if (filename.endsWith(".docx")) return "📝";
    return "📃";
  };

  if (collapsed) {
    return (
      <div className="w-16 flex flex-col items-center py-4 glass-light border-r border-border-subtle">
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg hover:bg-bg-hover transition-colors mb-6"
          title="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5 text-text-secondary" />
        </button>
        <div className="flex flex-col items-center gap-3">
          <Scale className="w-5 h-5 text-accent-blue" />
          <div className="w-8 h-[1px] bg-border-subtle" />
          {documents.map((doc) => (
            <button
              key={doc.filename}
              onClick={() => toggleDoc(doc.filename)}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all ${
                selectedDocs.includes(doc.filename)
                  ? "bg-accent-blue/20 ring-1 ring-accent-blue/40"
                  : "hover:bg-bg-hover"
              }`}
              title={doc.filename}
            >
              {getFileIcon(doc.filename)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 flex flex-col glass-light border-r border-border-subtle">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg gradient-blue flex items-center justify-center">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-text-primary tracking-tight">
              Legal Contract AI
            </h1>
            <p className="text-[10px] text-text-muted font-medium uppercase tracking-widest">
              RAG Engine
            </p>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1.5 rounded-md hover:bg-bg-hover transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-text-muted" />
        </button>
      </div>

      {/* Upload Zone */}
      <div className="px-4 pt-4 pb-2">
        <div
          className={`drop-zone rounded-xl p-5 text-center cursor-pointer transition-all ${
            isDragging ? "dragging" : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-accent-blue animate-spin" />
              <p className="text-xs text-accent-blue-light font-medium">
                Parsing & Indexing...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-accent-blue/10 flex items-center justify-center">
                <Upload className="w-5 h-5 text-accent-blue" />
              </div>
              <div>
                <p className="text-xs font-semibold text-text-secondary">
                  Drop contracts here
                </p>
                <p className="text-[10px] text-text-dim mt-0.5">
                  PDF, DOCX, or TXT
                </p>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
            disabled={isUploading}
          />
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex items-center justify-between mt-3 mb-2">
          <h2 className="text-[10px] font-bold text-text-dim uppercase tracking-widest flex items-center gap-1.5">
            <HardDrive className="w-3 h-3" />
            Knowledge Base
          </h2>
          {documents.length > 0 && (
            <span className="text-[10px] text-text-dim">
              {documents.length} file{documents.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {selectedDocs.length > 0 && (
          <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-between">
            <span className="text-[10px] font-medium text-accent-blue-light">
              {selectedDocs.length} selected — filtered search
            </span>
            <button
              onClick={() => setSelectedDocs([])}
              className="text-accent-blue-light hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <ul className="space-y-1">
          {documents.map((doc) => (
            <li
              key={doc.filename}
              className={`group flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer ${
                selectedDocs.includes(doc.filename)
                  ? "bg-accent-blue/10 border border-accent-blue/20"
                  : "hover:bg-bg-hover border border-transparent"
              }`}
              onClick={() => toggleDoc(doc.filename)}
            >
              {/* Selection indicator */}
              <div
                className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                  selectedDocs.includes(doc.filename)
                    ? "bg-accent-blue border-accent-blue"
                    : "border-text-dim group-hover:border-text-secondary"
                }`}
              >
                {selectedDocs.includes(doc.filename) && (
                  <Check className="w-3 h-3 text-white" />
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-medium text-text-primary truncate"
                  title={doc.filename}
                >
                  {doc.filename}
                </p>
                <p className="text-[10px] text-text-dim">
                  {doc.file_size_kb} KB
                </p>
              </div>

              {/* Delete */}
              {deleteConfirm === doc.filename ? (
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleDelete(doc.filename)}
                    className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 transition-colors"
                    title="Confirm delete"
                  >
                    <Check className="w-3 h-3 text-red-400" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="p-1 rounded hover:bg-bg-hover transition-colors"
                    title="Cancel"
                  >
                    <X className="w-3 h-3 text-text-muted" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(doc.filename);
                  }}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                  title="Delete document"
                >
                  <Trash2 className="w-3.5 h-3.5 text-text-dim hover:text-red-400" />
                </button>
              )}
            </li>
          ))}
        </ul>

        {documents.length === 0 && !isUploading && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FileText className="w-8 h-8 text-text-dim mb-2" />
            <p className="text-xs text-text-dim">No contracts uploaded yet</p>
            <p className="text-[10px] text-text-dim mt-1">
              Upload your first document to get started
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border-subtle">
        <button
          onClick={onClearChat}
          className="w-full py-2 text-[11px] font-medium text-text-muted rounded-lg hover:bg-bg-hover hover:text-text-secondary transition-all"
        >
          Clear conversation
        </button>
      </div>
    </div>
  );
}
