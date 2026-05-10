"use client";

import type { PipelineStep } from "@/lib/rag/types";

interface Props {
  isReady: boolean;
  pipelineSteps: PipelineStep[];
  sourceCount: number;
  totalChunks: number;
  selectedSourceCount: number;
}

const RAG_STEPS = [
  { icon: "①", label: "Ingestion", desc: "Files loaded from upload or folder" },
  { icon: "②", label: "Chunking", desc: "RecursiveCharacterTextSplitter 1000 / 200" },
  { icon: "③", label: "Embedding", desc: "OpenAI text-embedding-3-small" },
  { icon: "④", label: "Store", desc: "Qdrant collection for retrieval" },
  { icon: "⑤", label: "Retrieve", desc: "Top-k similarity search over chunks" },
  { icon: "⑥", label: "Answer", desc: "OpenRouter chat model with strict grounding" },
];

export default function StudioPanel({ isReady, pipelineSteps, sourceCount, totalChunks, selectedSourceCount }: Props) {
  const completedCount = pipelineSteps.filter((step) => step.status === "completed").length;
  const activeStep = pipelineSteps.find((step) => step.status === "active")?.label ?? "Waiting for upload";

  return (
    <div className="flex h-full flex-col">
      <div className="panel-header justify-between">
        <span>Studio</span>
        <button className="icon-button" aria-label="Studio menu">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <div className={`glass-panel p-4 ${isReady ? "glass-panel-success" : ""}`}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className={`status-dot ${isReady ? "status-dot-ready" : "status-dot-waiting"}`} />
              <p className="text-sm font-medium text-slate-100">{isReady ? "Document ready" : "Waiting for documents"}</p>
            </div>
            <span className="text-xs text-slate-400">{sourceCount} source(s)</span>
          </div>
          <p className="text-xs text-slate-400 leading-6">
            {isReady ? `Active step: ${activeStep}` : "Upload files to activate the notebook and enable grounded answers."}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
            <div className="mini-metric">
              <span className="text-slate-400">Sources</span>
              <strong>{sourceCount}</strong>
            </div>
            <div className="mini-metric">
              <span className="text-slate-400">Chunks</span>
              <strong>{totalChunks}</strong>
            </div>
            <div className="mini-metric col-span-2">
              <span className="text-slate-400">Selected</span>
              <strong>{selectedSourceCount}</strong>
            </div>
          </div>
          {isReady && (
            <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-500" style={{ width: `${(completedCount / pipelineSteps.length) * 100}%` }} />
            </div>
          )}
        </div>

        <div>
          <div className="section-label">Pipeline</div>
          <div className="space-y-2">
            {pipelineSteps.map((step) => (
              <div key={step.id} className="pipeline-card">
                <div className={`pipeline-marker pipeline-${step.status}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-100">{step.label}</p>
                  <p className="text-xs text-slate-400">{step.status === "completed" ? "Complete" : step.status === "active" ? "Processing" : step.status === "error" ? "Needs attention" : "Pending"}</p>
                </div>
                <span className="text-xs text-slate-500">
                  {step.status === "active" ? "…" : step.status === "completed" ? "✓" : step.status === "error" ? "!" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="section-label">Answer style</div>
          <div className="glass-panel p-4 space-y-3">
            <div className="style-card">
              <span>Grounded</span>
              <p>Only uses retrieved document context.</p>
            </div>
            <div className="style-card">
              <span>Traceable</span>
              <p>Shows source snippets and page references when available.</p>
            </div>
            <div className="style-card">
              <span>Strict fallback</span>
              <p>Returns the exact not-found message when the document does not contain the answer.</p>
            </div>
          </div>
        </div>

        <div>
          <div className="section-label">Tech stack</div>
          <div className="glass-panel p-4 space-y-2 text-sm">
            <div className="stack-row"><span>Framework</span><strong>Next.js App Router</strong></div>
            <div className="stack-row"><span>LLM</span><strong>OpenRouter</strong></div>
            <div className="stack-row"><span>Embeddings</span><strong>OpenAI</strong></div>
            <div className="stack-row"><span>Vector DB</span><strong>Qdrant</strong></div>
            <div className="stack-row"><span>Chunking</span><strong>LangChain.js</strong></div>
          </div>
        </div>

        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-100">Notebook hints</p>
            <span className="text-xs text-slate-400">Quick view</span>
          </div>
          <div className="space-y-2 text-xs text-slate-400 leading-6">
            <p>• Upload one PDF or a folder of files.</p>
            <p>• Answers are grounded only in retrieved chunks.</p>
            <p>• If the context is weak, the assistant should refuse to guess.</p>
          </div>
        </div>

        <div className="mt-auto pt-2 text-center text-xs text-slate-500">
          Built for Assignment 03 · Google NotebookLM RAG
        </div>
      </div>
    </div>
  );
}