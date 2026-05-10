"use client";

import type { SourceChunk } from "@/lib/rag/types";

interface Props {
  source: SourceChunk;
  index: number;
}

export default function SourceCard({ source, index }: Props) {
  const scorePercent = source.score !== undefined
    ? Math.round(source.score * 100)
    : null;

  const scoreColor =
    scorePercent === null
      ? "text-slate-400"
      : scorePercent >= 80
      ? "text-emerald-400"
      : scorePercent >= 60
      ? "text-yellow-400"
      : "text-orange-400";

  return (
    <div className="mt-2 p-3 rounded-xl border border-white/8 bg-white/3 backdrop-blur-sm text-xs animate-fade-in">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 font-medium">
            Source {index + 1}
          </span>
          {source.page && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              Page {source.page}
            </span>
          )}
          {source.chunkIndex !== undefined && (
            <span className="text-slate-500">Chunk #{source.chunkIndex}</span>
          )}
        </div>
        {scorePercent !== null && (
          <span className={`font-semibold ${scoreColor} flex-shrink-0`}>
            {scorePercent}% match
          </span>
        )}
      </div>
      <p className="text-slate-400 leading-relaxed line-clamp-3">
        {source.content}
      </p>
      {source.fileName && (
        <p className="mt-1 text-slate-400 truncate">📄 {source.fileName}</p>
      )}
    </div>
  );
}
