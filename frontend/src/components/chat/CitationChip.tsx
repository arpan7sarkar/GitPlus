import { FileCode } from "lucide-react";
import type { Citation } from "@/lib/mock-data";

interface CitationChipProps {
  citation: Citation;
  onClick: (citation: Citation) => void;
}

const CitationChip = ({ citation, onClick }: CitationChipProps) => {
  const fileName = citation.filePath.split("/").pop();

  return (
    <button
      type="button"
      onClick={() => onClick(citation)}
      aria-label={`Open ${citation.filePath}, lines ${citation.startLine} to ${citation.endLine}`}
      title={citation.filePath}
      className="inline-flex min-h-10 max-w-full items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono bg-muted text-secondary-foreground border border-border hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
    >
      <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 break-all text-left">{fileName}:{citation.startLine}–{citation.endLine}</span>
    </button>
  );
};

export default CitationChip;
