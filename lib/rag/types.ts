export interface UploadResponse {
  success: boolean;
  fileName?: string;
  files?: Array<{
    fileName: string;
    totalChunks: number;
  }>;
  totalFiles?: number;
  totalChunks: number;
  message: string;
  error?: string;
  fileErrors?: Array<{
    fileName: string;
    error: string;
  }>;
}

export interface IndexedFileSummary {
  fileName: string;
  totalChunks: number;
}

export interface SourceChunk {
  content: string;
  page?: number;
  chunkIndex?: number;
  score?: number;
  fileName?: string;
}

export interface ChatRequest {
  question: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
  error?: string;
}

export interface PipelineStep {
  id: string;
  label: string;
  description: string;
  status: "pending" | "active" | "completed" | "error";
  icon: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
  timestamp: Date;
}

export interface DocumentMetadata {
  fileName: string;
  pageNumber?: number;
  chunkIndex: number;
  uploadedAt: string;
  source?: string;
}
