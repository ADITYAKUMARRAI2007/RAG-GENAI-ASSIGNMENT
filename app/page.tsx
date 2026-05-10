"use client";

import { useState } from "react";
import SourcesPanel from "@/components/SourcesPanel";
import ChatPanel from "@/components/ChatPanel";
import StudioPanel from "@/components/StudioPanel";
import TopNav from "@/components/TopNav";
import type { ChatMessage, IndexedFileSummary, PipelineStep, UploadResponse } from "@/lib/rag/types";

const INITIAL_STEPS: PipelineStep[] = [
  { id: "upload", label: "Upload", description: "", status: "pending", icon: "" },
  { id: "load", label: "Load", description: "", status: "pending", icon: "" },
  { id: "chunk", label: "Chunk", description: "", status: "pending", icon: "" },
  { id: "embed", label: "Embed", description: "", status: "pending", icon: "" },
  { id: "store", label: "Store", description: "", status: "pending", icon: "" },
  { id: "ready", label: "Retrieve", description: "", status: "pending", icon: "" },
];

export default function Home() {
  const [pipelineSteps, setPipelineSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [indexedSources, setIndexedSources] = useState<IndexedFileSummary[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showSourcesPanel, setShowSourcesPanel] = useState(true);
  const [showStudioPanel, setShowStudioPanel] = useState(true);
  const [selectedSourceNames, setSelectedSourceNames] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const notebookLabel = indexedSources.length > 0
    ? indexedSources.length === 1
      ? indexedSources[0].fileName.replace(/\.[^/.]+$/, "")
      : `${indexedSources.length} sources indexed`
    : "NotebookLM-style document workspace";

  const sourceCount = indexedSources.length;
  const latestAnswer = [...messages].reverse().find((message) => message.role === "assistant")?.content ?? "";
  const selectedSources = selectedSourceNames.length > 0
    ? indexedSources.filter((source) => selectedSourceNames.includes(source.fileName))
    : indexedSources;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage);
    } catch {
      showToast("Clipboard access was blocked.");
    }
  };

  const handleIndexed = (payload: UploadResponse) => {
    const indexedFiles: IndexedFileSummary[] =
      payload.files?.length ? payload.files : payload.fileName ? [{ fileName: payload.fileName, totalChunks: payload.totalChunks }] : [];

    setIndexedSources((current) => {
      const merged = [...current];
      for (const file of indexedFiles) {
        const existingIndex = merged.findIndex((entry) => entry.fileName === file.fileName);
        if (existingIndex >= 0) {
          merged[existingIndex] = file;
        } else {
          merged.push(file);
        }
      }
      return merged;
    });
    setTotalChunks((current) => current + payload.totalChunks);
  };

  const handleShare = async () => {
    const summary = `${notebookLabel} · ${sourceCount} source(s) · ${totalChunks} chunk(s)`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "DocuMind RAG",
          text: summary,
          url: window.location.href,
        });
        showToast("Share dialog opened.");
        return;
      } catch {
        // Fall back to clipboard below.
      }
    }

    await copyToClipboard(`${summary}\n${window.location.href}`, "Notebook link copied to clipboard.");
  };

  const handleSettings = async () => {
    const settingsSummary = [
      `Notebook: ${notebookLabel}`,
      `Sources: ${sourceCount}`,
      `Chunks: ${totalChunks}`,
      `Selected sources: ${selectedSources.length}`,
      `Has answer: ${latestAnswer ? "yes" : "no"}`,
    ].join("\n");

    await copyToClipboard(settingsSummary, "Settings summary copied.");
  };

  const handleCopyLatestAnswer = async () => {
    if (!latestAnswer) {
      showToast("No assistant answer to copy yet.");
      return;
    }

    await copyToClipboard(latestAnswer, "Latest answer copied.");
  };

  const handleSaveLatestAnswer = () => {
    if (!latestAnswer) {
      showToast("No assistant answer to save yet.");
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Saved note:\n\n${latestAnswer}`,
        timestamp: new Date(),
      },
    ]);
    showToast("Saved the latest answer into the notebook.");
  };

  const handleFeedback = (message: string) => showToast(message);

  const handleSourceToggle = (fileName: string) => {
    setSelectedSourceNames((current) =>
      current.includes(fileName)
        ? current.filter((name) => name !== fileName)
        : [...current, fileName]
    );
  };

  return (
    <div className="app-shell flex flex-col h-screen overflow-hidden">
      <TopNav
        notebookLabel={notebookLabel}
        sourceCount={sourceCount}
        totalChunks={totalChunks}
        onShare={handleShare}
        onSettings={handleSettings}
        onToggleSources={() => setShowSourcesPanel((value) => !value)}
        onToggleStudio={() => setShowStudioPanel((value) => !value)}
      />

      {toast && <div className="app-toast">{toast}</div>}

      <div className="workspace-grid flex flex-1 overflow-hidden">
        {showSourcesPanel && (
          <div className="panel-surface sources-column flex-shrink-0 flex flex-col overflow-hidden">
            <SourcesPanel
              onIndexed={handleIndexed}
              onPipelineUpdate={setPipelineSteps}
              pipelineSteps={pipelineSteps}
              indexedSources={indexedSources}
              sourceCount={sourceCount}
              totalChunks={totalChunks}
              selectedSourceNames={selectedSourceNames}
              onToggleSource={handleSourceToggle}
            />
          </div>
        )}

        <div className="center-column flex-1 flex flex-col overflow-hidden">
          <ChatPanel
            isReady={sourceCount > 0}
            notebookLabel={notebookLabel}
            sourceCount={sourceCount}
            messages={messages}
            setMessages={setMessages}
            selectedSourceNames={selectedSourceNames}
            onSaveLatestAnswer={handleSaveLatestAnswer}
            onCopyLatestAnswer={handleCopyLatestAnswer}
            onFeedback={handleFeedback}
          />
        </div>

        {showStudioPanel && (
          <div className="panel-surface studio-column flex-shrink-0 flex flex-col overflow-hidden">
            <StudioPanel
              isReady={sourceCount > 0}
              pipelineSteps={pipelineSteps}
              sourceCount={sourceCount}
              totalChunks={totalChunks}
              selectedSourceCount={selectedSources.length}
            />
          </div>
        )}
      </div>
    </div>
  );
}
