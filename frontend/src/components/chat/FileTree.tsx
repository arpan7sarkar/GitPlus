import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen, Search, CloudDownload } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { FileTreeNode } from "@/lib/mock-data";

interface FileTreeProps {
  tree: FileTreeNode[];
  onFileSelect: (path: string) => void;
  selectedFile?: string;
  loadedPaths?: string[];
  onDemand?: boolean;
}

function filterTree(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  if (!query) return nodes;
  return nodes.flatMap((node) => {
    if (node.path.toLowerCase().includes(query)) return [node];
    const children = filterTree(node.children ?? [], query);
    return children.length ? [{ ...node, children }] : [];
  });
}

function FileTreeItem({ node, depth, onFileSelect, selectedFile, filtering, loadedPaths, onDemand }: {
  node: FileTreeNode;
  depth: number;
  onFileSelect: (path: string) => void;
  selectedFile?: string;
  filtering: boolean;
  loadedPaths: Set<string>;
  onDemand: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const open = expanded || filtering;
  const folder = node.type === "folder";
  const needsFetch = !folder && onDemand && !loadedPaths.has(node.path);

  return (
    <li>
      <button
        type="button"
        onClick={() => folder ? setExpanded(!expanded) : onFileSelect(node.path)}
        aria-expanded={folder ? open : undefined}
        aria-current={!folder && selectedFile === node.path ? "true" : undefined}
        aria-label={folder ? `${open ? "Collapse" : "Expand"} ${node.path}` : `Open ${node.path}${needsFetch ? ", fetch on demand" : ""}`}
        title={node.path}
        className={`flex min-h-11 w-full items-center gap-2 rounded-md pr-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9 ${selectedFile === node.path ? "bg-accent text-primary" : "text-secondary-foreground"}`}
        style={{ paddingLeft: `${Math.min(depth * 12 + 12, 96)}px` }}
      >
        {folder && (open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />)}
        {folder ? (open ? <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />) : needsFetch ? <CloudDownload className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
        <span className="min-w-0 flex-1 break-all py-1">{node.name}</span>
      </button>
      {folder && open && node.children && (
        <ul>
          {node.children.map((child) => <FileTreeItem key={child.path} node={child} depth={depth + 1} onFileSelect={onFileSelect} selectedFile={selectedFile} filtering={filtering} loadedPaths={loadedPaths} onDemand={onDemand} />)}
        </ul>
      )}
    </li>
  );
}

const FileTree = ({ tree, onFileSelect, selectedFile, loadedPaths = [], onDemand = false }: FileTreeProps) => {
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLowerCase();
  const filtered = useMemo(() => filterTree(tree, query), [tree, query]);
  const loaded = useMemo(() => new Set(loadedPaths), [loadedPaths]);

  return (
    <section aria-label="Repository files" className="flex h-full min-h-0 flex-col border-r border-border bg-background">
      <div className="shrink-0 space-y-2 border-b border-border p-3">
        <h2 className="text-lg font-medium text-foreground">Files</h2>
        <label htmlFor="file-tree-filter" className="sr-only">Filter repository files</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="file-tree-filter" placeholder="Filter paths…" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-11 pl-9 text-sm sm:h-10" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
        {filtered.length ? (
          <ul>{filtered.map((node) => <FileTreeItem key={node.path} node={node} depth={0} onFileSelect={onFileSelect} selectedFile={selectedFile} filtering={Boolean(query)} loadedPaths={loaded} onDemand={onDemand} />)}</ul>
        ) : (
          <p role="status" className="px-3 py-4 text-sm text-secondary-foreground">{query ? "No file paths match this filter." : "No file tree is available for this repository."}</p>
        )}
      </div>
      {onDemand && <p className="shrink-0 border-t border-border p-3 text-xs leading-relaxed text-muted-foreground">Files marked for download load when opened.</p>}
    </section>
  );
};

export default FileTree;
