import React from "react";

/**
 * Simple markdown to JSX renderer for bold, italic, and links.
 * Handles **bold**, *italic*, and [link](url)
 */
export function renderMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Pattern to match **bold**, *italic*, [link](url), and plain text
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)|([^*[\n]+)/g;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    // Add any text before this match
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    if (match[1]) {
      // **bold** text
      parts.push(
        <strong key={`bold-${parts.length}`} className="font-semibold text-white">
          {match[1]}
        </strong>
      );
    } else if (match[2]) {
      // *italic* text
      parts.push(
        <em key={`italic-${parts.length}`} className="italic">
          {match[2]}
        </em>
      );
    } else if (match[3] && match[4]) {
      // [link](url)
      parts.push(
        <a
          key={`link-${parts.length}`}
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          {match[3]}
        </a>
      );
    } else if (match[5]) {
      // Plain text (including newlines)
      parts.push(match[5]);
    }

    lastIndex = pattern.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

/**
 * Renders markdown text as paragraphs, preserving line breaks
 */
export function renderMarkdownWithParagraphs(text: string): React.ReactNode {
  return text.split("\n").map((line, idx) => (
    <React.Fragment key={idx}>
      {renderMarkdown(line)}
      {idx < text.split("\n").length - 1 && <br />}
    </React.Fragment>
  ));
}
