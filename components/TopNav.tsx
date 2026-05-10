"use client";

interface Props {
  notebookLabel: string;
  sourceCount: number;
  totalChunks: number;
  onShare: () => void;
  onSettings: () => void;
  onToggleSources: () => void;
  onToggleStudio: () => void;
}

export default function TopNav({ notebookLabel, sourceCount, totalChunks, onShare, onSettings, onToggleSources, onToggleStudio }: Props) {
  return (
    <div className="top-bar">
      <div className="flex items-center gap-3 min-w-0">
        <div className="brand-mark">
          <span />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-sm sm:text-base font-semibold text-white truncate">
              DocuMind RAG
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] tracking-wide uppercase badge-soft">
              Assignment 03
            </span>
          </div>
          <p className="text-xs text-slate-300 truncate mt-0.5">
            {notebookLabel}
          </p>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-2 ml-auto mr-4 text-xs text-slate-300">
        <span className="chip-stat">{sourceCount} sources</span>
        <span className="chip-stat">{totalChunks} chunks</span>
        <span className="chip-stat">OpenRouter + Qdrant</span>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={onToggleSources} title="Toggle sources panel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 5h18v14H3z" opacity="0.28" />
            <path d="M8 5v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Sources
        </button>
        <button className="btn-ghost" onClick={onToggleStudio} title="Toggle studio panel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 5h18v14H3z" opacity="0.28" />
            <path d="M16 5v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Studio
        </button>
        <button className="btn-ghost" onClick={onShare}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
          </svg>
          Share
        </button>
        <button className="btn-ghost" onClick={onSettings}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
          </svg>
          Settings
        </button>
        <div className="user-orb" title="Profile">
          <span />
        </div>
      </div>
    </div>
  );
}
