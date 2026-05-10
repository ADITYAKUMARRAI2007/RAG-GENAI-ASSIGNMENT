"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { IndexedFileSummary, PipelineStep, UploadResponse } from "@/lib/rag/types";

interface Props {
  onIndexed: (payload: UploadResponse) => void;
  onPipelineUpdate: (steps: PipelineStep[]) => void;
  pipelineSteps: PipelineStep[];
  indexedSources: IndexedFileSummary[];
  sourceCount: number;
  totalChunks: number;
  selectedSourceNames: string[];
  onToggleSource: (fileName: string) => void;
}

function setStep(steps: PipelineStep[], id: string, status: PipelineStep["status"]): PipelineStep[] {
  return steps.map((step) => (step.id === id ? { ...step, status } : step));
}

function resetSteps(steps: PipelineStep[]): PipelineStep[] {
  return steps.map((step) => ({ ...step, status: "pending" }));
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getFileLabel(file: File) {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

function isSupported(file: File) {
  const ext = getFileLabel(file).split(".").pop()?.toLowerCase();
  return !!ext && ["pdf", "txt", "csv"].includes(ext);
}

export default function SourcesPanel({
  onIndexed,
  onPipelineUpdate,
  pipelineSteps,
  indexedSources,
  sourceCount,
  totalChunks,
  selectedSourceNames,
  onToggleSource,
}: Props) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const sourceSummary = useMemo(() => {
    if (selectedFiles.length === 0) {
      return "Drop PDFs, TXT files, or a folder here";
    }
    if (selectedFiles.length === 1) {
      return getFileLabel(selectedFiles[0]);
    }
    return `${selectedFiles.length} selected files`;
  }, [selectedFiles]);

  const recentSources = indexedSources.slice(0, 6);
  const selectedCount = selectedSourceNames.length;
  const allIndexedSelected = indexedSources.length > 0 && selectedCount === indexedSources.length;

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files).filter(isSupported);
    if (incoming.length === 0) {
      setError("Only PDF, TXT, or CSV files are supported.");
      return;
    }

    setError(null);
    setSelectedFiles((current) => {
      const seen = new Set(current.map((file) => `${getFileLabel(file)}:${file.size}`));
      const merged = [...current];
      for (const file of incoming) {
        const key = `${getFileLabel(file)}:${file.size}`;
        if (!seen.has(key)) {
          merged.push(file);
          seen.add(key);
        }
      }
      return merged;
    });
  };

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }, []);

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || isLoading) return;

    setIsLoading(true);
    setError(null);
    setUploadNotice(null);

    let steps = resetSteps(pipelineSteps);
    onPipelineUpdate([...steps]);

    try {
      steps = setStep(steps, "upload", "active");
      onPipelineUpdate([...steps]);
      await delay(180);
      steps = setStep(steps, "upload", "completed");
      steps = setStep(steps, "load", "active");
      onPipelineUpdate([...steps]);
      await delay(220);
      steps = setStep(steps, "load", "completed");
      steps = setStep(steps, "chunk", "active");
      onPipelineUpdate([...steps]);

      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file, getFileLabel(file)));

      await delay(200);
      steps = setStep(steps, "chunk", "completed");
      steps = setStep(steps, "embed", "active");
      onPipelineUpdate([...steps]);

      let res: Response;
      let data: UploadResponse;
      try {
        res = await fetch("/api/upload", { method: "POST", body: formData });
        data = (await res.json()) as UploadResponse;
      } catch {
        throw new Error("Server unreachable. Make sure `npm run dev` is running.");
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Upload failed.");
      }

      steps = setStep(steps, "embed", "completed");
      steps = setStep(steps, "store", "active");
      onPipelineUpdate([...steps]);
      await delay(220);
      steps = setStep(steps, "store", "completed");
      steps = setStep(steps, "ready", "active");
      onPipelineUpdate([...steps]);
      await delay(200);
      steps = setStep(steps, "ready", "completed");
      onPipelineUpdate([...steps]);

      onIndexed(data);
      if (data.fileErrors && data.fileErrors.length > 0) {
        setUploadNotice(
          `Indexed ${data.totalFiles ?? 0} file(s). ${data.fileErrors.length} file(s) were skipped.`
        );
      } else {
        setUploadNotice(`Indexed ${data.totalFiles ?? 0} file(s) successfully.`);
      }
      setSelectedFiles([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setError(msg);
      steps = steps.map((step) => (step.status === "active" ? { ...step, status: "error" } : step));
      onPipelineUpdate([...steps]);
    } finally {
      setIsLoading(false);
    }
  };

  const stepColors: Record<PipelineStep["status"], string> = {
    pending: "#4b5563",
    active: "#7c3aed",
    completed: "#22c55e",
    error: "#ef4444",
  };

  return (
    <div className="flex h-full flex-col">
      <div className="panel-header justify-between">
        <span>Sources</span>
        <button className="icon-button" aria-label="Sources menu">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <button className="add-source-button" onClick={() => fileInputRef.current?.click()}>
          <span className="add-source-icon">+</span>
          Add sources
        </button>

        <div className="search-source-card">
          <div className="search-source-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 21l-4.35-4.35" strokeLinecap="round" /><circle cx="11" cy="11" r="7" /></svg>
            <span>Search the web for new sources</span>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button className="chip-filter">Web</button>
            <button className="chip-filter">Fast Research</button>
            <button className="chip-filter" onClick={() => folderInputRef.current?.click()}>Folder</button>
          </div>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`upload-dropzone ${isDragging ? "is-dragging" : ""}`}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="drop-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3v12m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 15.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3.5" strokeLinecap="round" /></svg>
            </div>
            <p className="text-sm font-medium text-slate-100">{sourceSummary}</p>
            <p className="text-xs text-slate-400">Drop files here or pick a folder for batch indexing</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.csv"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />

        <input
          ref={folderInputRef}
          type="file"
          accept=".pdf,.txt,.csv"
          multiple
          className="hidden"
          {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />

        <div className="sources-list-head">
          <span>Select all</span>
          <button
            className="text-slate-400 hover:text-slate-100 text-xs"
            onClick={() => {
              if (allIndexedSelected) {
                selectedSourceNames.forEach((fileName) => onToggleSource(fileName));
                return;
              }

              indexedSources.forEach((source) => {
                if (!selectedSourceNames.includes(source.fileName)) {
                  onToggleSource(source.fileName);
                }
              });
            }}
          >
            {allIndexedSelected ? "☑" : "☐"}
          </button>
        </div>

        {(selectedFiles.length > 0 || recentSources.length > 0) && (
          <div className="glass-panel p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-100">Selected</p>
                <p className="text-xs text-slate-400">{selectedFiles.length} file(s) ready to index</p>
              </div>
              <button className="text-xs text-slate-400 hover:text-slate-100" onClick={() => setSelectedFiles([])}>
                Clear
              </button>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {selectedFiles.map((file) => (
                <button key={`${getFileLabel(file)}-${file.size}`} type="button" className="selected-file-row text-left" onClick={() => onToggleSource(getFileLabel(file))}>
                  <div className="selected-file-icon">{file.name.endsWith(".pdf") ? "PDF" : file.name.endsWith(".csv") ? "CSV" : "TXT"}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-100">{getFileLabel(file)}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <span className="source-check">{selectedSourceNames.includes(getFileLabel(file)) ? "☑" : "☐"}</span>
                </button>
              ))}
              {selectedFiles.length === 0 && recentSources.map((source) => (
                <button key={source.fileName} type="button" className="indexed-source-row text-left" onClick={() => onToggleSource(source.fileName)}>
                  <div className="indexed-source-dot" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-100">{source.fileName}</p>
                    <p className="text-xs text-slate-400">{source.totalChunks} chunk(s)</p>
                  </div>
                  <span className="source-check">{selectedSourceNames.includes(source.fileName) ? "☑" : "☐"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="status-error text-xs">
            {error}
          </div>
        )}

        {uploadNotice && (
          <div className="status-success text-xs">
            {uploadNotice}
          </div>
        )}

        <button onClick={handleUpload} disabled={isLoading || selectedFiles.length === 0} className="primary-button w-full">
          {isLoading ? (
            <>
              <span className="loading-ring" />
              Indexing notebook…
            </>
          ) : (
            <>
              <span>+</span>
              Index notebook
            </>
          )}
        </button>

        <div className="source-summary-card">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-slate-100">Indexed sources</p>
            <span className="text-xs text-slate-400">{sourceCount} source(s)</span>
          </div>
          {indexedSources.length === 0 ? (
            <p className="text-xs text-slate-400 leading-relaxed">
              Your uploaded files will appear here after indexing. Use a folder if you want a batch notebook.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {indexedSources.map((source) => (
                <button key={source.fileName} type="button" className="indexed-source-row text-left" onClick={() => onToggleSource(source.fileName)}>
                  <div className="indexed-source-dot" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-100">{source.fileName}</p>
                    <p className="text-xs text-slate-400">{source.totalChunks} chunk(s)</p>
                  </div>
                  <span className="source-check">{selectedSourceNames.includes(source.fileName) ? "☑" : "☐"}</span>
                </button>
              ))}
              <div className="pt-2 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between">
                <span>{totalChunks} total chunks</span>
                <span>{sourceCount} file(s)</span>
              </div>
            </div>
          )}
        </div>

        {indexedSources.length > 0 && (
          <div className="space-y-2">
            {indexedSources.map((source) => (
              <button key={`src-${source.fileName}`} type="button" className="indexed-source-row text-left" onClick={() => onToggleSource(source.fileName)}>
                <div className="indexed-source-dot" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-100">{source.fileName}</p>
                  <p className="text-xs text-slate-400">{source.totalChunks} chunks · ready</p>
                </div>
                <span className="source-check">{selectedSourceNames.includes(source.fileName) ? "☑" : "☐"}</span>
              </button>
            ))}
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 mb-2">Notebook guidance</p>
          <p className="text-xs text-slate-400 leading-6">
            Upload one PDF or a whole folder. The app chunks, embeds, stores, and retrieves only from your indexed documents.
          </p>
        </div>
      </div>
    </div>
  );
}