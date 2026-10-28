const BASE_URL = "http://localhost:8000/api";

export type DocumentInfo = {
  filename: string;
  file_size_kb: number;
};

export const fetchDocuments = async (): Promise<DocumentInfo[]> => {
  const res = await fetch(`${BASE_URL}/documents`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
};

export const uploadDocuments = async (files: FileList): Promise<DocumentInfo[]> => {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("files", file));

  const res = await fetch(`${BASE_URL}/documents/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
};

export const deleteDocument = async (filename: string): Promise<void> => {
  const res = await fetch(`${BASE_URL}/documents/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Delete failed");
};
