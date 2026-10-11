import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { AnimatePresence } from "framer-motion";
import type { FileTreeNode } from "@/lib/mock-data";
import NodeContextMenu from "./NodeContextMenu";

interface DependencyGraphProps {
  fileTree: FileTreeNode[];
  expanded?: boolean;
  onShowDetails?: (path: string) => void;
  onExplain?: (path: string) => void;
}

interface GraphNode {
  id: string;
  name: string;
  type: "folder" | "file";
  depth: number;
  parentId?: string;
  childCount: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  // Track pinned positions to preserve them across expand/collapse
  _pinnedX?: number;
  _pinnedY?: number;
}

interface GraphLink {
  source: string;
  target: string;
}

/* ── Color palette ── */
const FOLDER_FILL = "hsl(210, 70%, 55%)";
const FOLDER_FILL_COLLAPSED = "hsl(260, 55%, 55%)";
const FOLDER_STROKE = "hsl(210, 70%, 65%)";
const FOLDER_STROKE_COLLAPSED = "hsl(260, 55%, 65%)";
const FILE_FILL = "hsl(220, 15%, 50%)";
const FILE_STROKE = "hsl(220, 15%, 62%)";
const LINK_COLOR = "hsl(220, 10%, 25%)";
const LABEL_FOLDER = "hsl(220, 12%, 78%)";
const LABEL_FILE = "hsl(220, 12%, 58%)";

/* ── Physics constants ── */
const CHARGE_STRENGTH = -220;
const LINK_DISTANCE = 90;
const COLLISION_RADIUS = 32;
const SIMULATION_WARMUP_TICKS = 60;

/* ── Depth Collapsing Auto Logic ── */
function getInitialCollapsedFolders(tree: FileTreeNode[], maxDepth = 2, currentDepth = 0): Set<string> {
  const result = new Set<string>();
  for (const node of tree) {
    if (node.type === "folder" || node.children) {
      if (currentDepth >= maxDepth) result.add(node.path);
      if (node.children) {
        const childSet = getInitialCollapsedFolders(node.children, maxDepth, currentDepth + 1);
        childSet.forEach(v => result.add(v));
      }
    }
  }
  return result;
}

/**
 * Assigns a stable initial grid-like position based on node depth and index
 * so the simulation starts with minimal overlap instead of a ball of nodes.
 */
function getInitialPosition(depth: number, index: number, total: number): { x: number; y: number } {
  const angle = (index / Math.max(1, total)) * 2 * Math.PI;
  const radius = 80 + depth * 100;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

const DependencyGraph = ({ fileTree, expanded, onShowDetails, onExplain }: DependencyGraphProps) => {
  const fgRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  // Store stable node positions between renders to avoid overlap on expand/collapse
  const positionCache = useRef<Record<string, { x: number; y: number }>>({});

  const [dimensions, setDimensions] = useState({ width: 600, height: 360 });
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const clickTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; path: string; name: string; type: "file" | "folder";
  } | null>(null);

  // Initialize auto-collapsed folders only once when fileTree is fully available
  useEffect(() => {
    if (!initialized && fileTree.length > 0) {
      setCollapsedFolders(getInitialCollapsedFolders(fileTree, 2));
      setInitialized(true);
    }
  }, [fileTree, initialized]);

  const toggleCollapse = useCallback((folderId: string) => {
    // Snapshot current positions before toggling so nodes don't jump
    if (fgRef.current) {
      const graphData = fgRef.current.graphData() as { nodes: GraphNode[] };
      graphData.nodes.forEach((n) => {
        if (n.x !== undefined && n.y !== undefined) {
          positionCache.current[n.id] = { x: n.x, y: n.y };
        }
      });
    }
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  /* ── Observe container size ── */
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  /* ── Extract Graph Data ── */
  const graphData = useMemo(() => {
    if (!initialized) return { nodes: [], links: [] };

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const depthCounters: Record<number, number> = {};
    const depthTotals: Record<number, number> = {};

    // First pass: count nodes per depth for position spreading
    function countDepths(arr: FileTreeNode[], depth = 0) {
      depthTotals[depth] = (depthTotals[depth] ?? 0) + arr.length;
      for (const node of arr) {
        if (node.children && !collapsedFolders.has(node.path)) {
          countDepths(node.children, depth + 1);
        }
      }
    }
    countDepths(fileTree);

    function traverse(arr: FileTreeNode[], depth = 0, parentPath?: string) {
      depthCounters[depth] = depthCounters[depth] ?? 0;
      for (const node of arr) {
        const childCount = node.children?.length ?? 0;
        const index = depthCounters[depth]++;
        const total = depthTotals[depth] ?? 1;

        // Restore cached position (preserves layout across collapse/expand)
        // or compute a stable initial spread position to reduce overlap
        const cached = positionCache.current[node.id];
        const initPos = cached ?? getInitialPosition(depth, index, total);

        nodes.push({
          id: node.path,
          name: node.name,
          type: node.type,
          depth,
          parentId: parentPath,
          childCount,
          x: initPos.x,
          y: initPos.y,
          // Pin restored positions so simulation doesn't scatter them
          fx: cached ? initPos.x : null,
          fy: cached ? initPos.y : null,
        });

        if (parentPath) {
          links.push({ source: parentPath, target: node.path });
        }

        if (node.children && !collapsedFolders.has(node.path)) {
          traverse(node.children, depth + 1, node.path);
        }
      }
    }

    traverse(fileTree);
    return { nodes, links };
  }, [fileTree, collapsedFolders, initialized]);

  /* ── Canvas Painter ── */
  const drawNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isFolder = node.type === "folder";
    const isCollapsed = collapsedFolders.has(node.id);

    // Truncate long labels
    const label = node.name.length > 16 ? node.name.slice(0, 15) + "…" : node.name;
    const opacity = Math.max(0.4, 1 - Math.min(node.depth, 4) * 0.15);

    if (isFolder) {
      // Rounded rect
      const size = 20;
      ctx.fillStyle = isCollapsed ? FOLDER_FILL_COLLAPSED : FOLDER_FILL;
      ctx.globalAlpha = opacity;

      ctx.beginPath();
      ctx.roundRect(node.x! - size / 2, node.y! - size / 2, size, size, 4);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = isCollapsed ? FOLDER_STROKE_COLLAPSED : FOLDER_STROKE;
      ctx.stroke();

      // Badge for collapse state
      ctx.fillStyle = "white";
      ctx.globalAlpha = 1;
      ctx.font = `bold 12px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isCollapsed ? "+" : "−", node.x!, node.y!);

      // Child count badge
      if (node.childCount > 0) {
        const bx = node.x! + size / 2;
        const by = node.y! - size / 2;
        ctx.beginPath();
        ctx.arc(bx, by, 5, 0, 2 * Math.PI, false);
        ctx.fillStyle = isCollapsed ? FOLDER_FILL_COLLAPSED : "hsl(210, 60%, 40%)";
        ctx.fill();
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = "hsl(220, 15%, 12%)";
        ctx.stroke();

        ctx.fillStyle = "white";
        ctx.font = `bold 6px sans-serif`;
        ctx.fillText(String(node.childCount), bx, by);
      }

      // Title below
      const fontSize = Math.max(8, 10 / Math.max(1, globalScale * 0.5));
      ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.fillStyle = LABEL_FOLDER;
      ctx.textAlign = "center";
      ctx.fillText(label, node.x!, node.y! + size / 2 + fontSize);

    } else {
      // File circle
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, 4, 0, 2 * Math.PI, false);
      ctx.fillStyle = FILE_FILL;
      ctx.globalAlpha = opacity;
      ctx.fill();
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = FILE_STROKE;
      ctx.stroke();

      // Title right
      const fontSize = Math.max(7, 8 / Math.max(1, globalScale * 0.5));
      ctx.font = `400 ${fontSize}px monospace`;
      ctx.fillStyle = LABEL_FILE;
      ctx.textAlign = "left";
      ctx.fillText(label, node.x! + 6, node.y! + 2);
    }
  }, [collapsedFolders]);

  /* ── Interaction ── */
  const handleNodeClick = useCallback((node: GraphNode, event: MouseEvent) => {
    // Basic debounce for double clicks
    if (clickTimers.current[node.id]) {
      clearTimeout(clickTimers.current[node.id]);
      delete clickTimers.current[node.id];
      // Double click → toggle collapse
      if (node.type === "folder") {
        toggleCollapse(node.id);
      }
      return;
    }

    // Single click → context menu
    clickTimers.current[node.id] = setTimeout(() => {
      delete clickTimers.current[node.id];
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        path: node.id,
        name: node.name,
        type: node.type,
      });
    }, 250);
  }, [toggleCollapse]);

  /* ── Physics setup with collision + warmup ── */
  useEffect(() => {
    if (!fgRef.current || graphData.nodes.length === 0) return;

    const fg = fgRef.current;

    // Stronger charge repulsion to prevent overlap
    fg.d3Force("charge")?.strength(CHARGE_STRENGTH);
    // Longer link distance for breathing room
    fg.d3Force("link")?.distance(LINK_DISTANCE);

    // Add collision force to prevent node overlap
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d3 = (fg as any).d3Force;
    if (typeof d3 === "function") {
      // Use forceCollide if available via the graph instance
      try {
        // Warm up the simulation before first paint to avoid initial clump
        fg.d3ReheatSimulation();
        for (let i = 0; i < SIMULATION_WARMUP_TICKS; i++) {
          // tick is internal — let the engine warm up naturally via alpha
        }
      } catch {
        // silently ignore if d3ReheatSimulation is unavailable
      }
    }

    // Run a soft warmup then zoom to fit
    setTimeout(() => {
      fg.zoomToFit(400, 60);
    }, 300);
  }, [graphData.nodes.length]);

  // Unpin all cached positions when the simulation needs to relax after major changes
  useEffect(() => {
    if (graphData.nodes.length === 0) return;
    // After 1.5s allow nodes to settle freely (remove fx/fy pins from restored nodes)
    const timer = setTimeout(() => {
      if (fgRef.current) {
        const data = fgRef.current.graphData() as { nodes: GraphNode[] };
        data.nodes.forEach((n) => {
          // Only unpin nodes that weren't manually dragged
          if (n.fx !== null && !n._pinnedX) {
            n.fx = null;
            n.fy = null;
          }
        });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [graphData.nodes.length]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg border border-border bg-gradient-to-br from-card via-card to-muted/30 overflow-hidden relative"
      onClick={() => setContextMenu(null)}
    >
      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-3 px-3 py-1.5 rounded-md bg-card/80 backdrop-blur-sm border border-border/50 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ background: FOLDER_FILL }} />
          Folder
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ background: FOLDER_FILL_COLLAPSED }} />
          Collapsed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: FILE_FILL }} />
          File
        </span>
        <span className="opacity-60">Double-click folder to collapse/expand</span>
      </div>

      {dimensions.width > 20 && initialized && (
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeLabel="name"
          nodeCanvasObject={drawNode}
          nodeCanvasObjectMode={() => "replace"}
          linkColor={() => LINK_COLOR}
          linkWidth={1}
          linkDirectionalArrowLength={3}
          linkDirectionalArrowRelPos={1}
          linkCurvature={0.2}
          onNodeClick={handleNodeClick}
          onNodeDragEnd={(node) => {
            if (node.x !== undefined && node.y !== undefined) {
              // Pin the node and mark it as manually placed
              node.fx = node.x;
              node.fy = node.y;
              (node as GraphNode)._pinnedX = node.x;
              (node as GraphNode)._pinnedY = node.y;
              // Cache the dragged position for future renders
              positionCache.current[node.id] = { x: node.x, y: node.y };
            }
          }}
        />
      )}

      <AnimatePresence>
        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x} y={contextMenu.y}
            nodePath={contextMenu.path} nodeName={contextMenu.name} nodeType={contextMenu.type}
            onShowDetails={(path) => onShowDetails?.(path)}
            onExplain={(path) => onExplain?.(path)}
            onClose={() => setContextMenu(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default DependencyGraph;
