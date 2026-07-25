// Graph mock data for react-force-graph-2d

export interface GraphNode {
  id: string;
  label: string;
  type: "entry" | "module" | "util" | "config" | "external";
  size?: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export const MOCK_GRAPH_NODES: GraphNode[] = [
  { id: "next-server", label: "next-server.ts", type: "entry", size: 14 },
  { id: "app-render", label: "app-render.tsx", type: "module", size: 12 },
  { id: "router", label: "router.ts", type: "module", size: 10 },
  { id: "webpack-config", label: "webpack-config.ts", type: "config", size: 9 },
  { id: "route-matcher", label: "route-matcher.ts", type: "util", size: 7 },
  { id: "middleware", label: "middleware.ts", type: "module", size: 8 },
  { id: "image-optimizer", label: "image-optimizer.ts", type: "module", size: 8 },
  { id: "font-loader", label: "font-loader.ts", type: "module", size: 6 },
  { id: "error-handler", label: "error-handler.ts", type: "util", size: 5 },
  { id: "cache-handler", label: "cache-handler.ts", type: "util", size: 6 },
  { id: "react", label: "react", type: "external", size: 12 },
  { id: "react-dom", label: "react-dom", type: "external", size: 11 },
  { id: "swc", label: "@swc/core", type: "external", size: 9 },
  { id: "webpack", label: "webpack", type: "external", size: 10 },
];

export const MOCK_GRAPH_LINKS: GraphLink[] = [
  { source: "next-server", target: "app-render" },
  { source: "next-server", target: "router" },
  { source: "next-server", target: "middleware" },
  { source: "next-server", target: "error-handler" },
  { source: "app-render", target: "react" },
  { source: "app-render", target: "react-dom" },
  { source: "app-render", target: "cache-handler" },
  { source: "router", target: "route-matcher" },
  { source: "router", target: "react" },
  { source: "webpack-config", target: "webpack" },
  { source: "webpack-config", target: "swc" },
  { source: "image-optimizer", target: "next-server" },
  { source: "font-loader", target: "webpack-config" },
  { source: "middleware", target: "route-matcher" },
  { source: "cache-handler", target: "route-matcher" },
];
