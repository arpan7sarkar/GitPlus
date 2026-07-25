"use client";

import { create } from "zustand";
import type { RepoMeta, FileNode, RepoOverview } from "../api";

export interface FileContent {
  path: string;
  content: string;
}

interface RepoState {
  repoId: string | null;
  meta: RepoMeta | null;
  overview: RepoOverview | null;
  fileTree: FileNode[];
  fileContents: Record<string, string>;
  repoContext: string | null;
  githubToken: string | null;

  // Indexing state
  isIndexing: boolean;
  indexingStage: number;
  indexingMessage: string;

  // On-demand mode
  indexMode: "full" | "on-demand";
  totalSourceFiles: number;
  unfetchedFiles: FileNode[];

  // File editor state
  openedFiles: string[];
  activeFilePath: string | null;
  dirtyFiles: Set<string>;

  // Terminal logs
  terminalLogs: string[];

  // Actions
  setRepoData: (data: {
    repoId: string;
    meta: RepoMeta;
    fileTree: FileNode[];
    fileContents: Record<string, string>;
    repoContext: string;
    githubToken?: string;
    indexMode?: "full" | "on-demand";
    totalSourceFiles?: number;
    unfetchedFiles?: FileNode[];
  }) => void;
  setOverview: (overview: RepoOverview | null) => void;
  setIndexing: (isIndexing: boolean, stage?: number, message?: string) => void;
  upsertFileContent: (path: string, content: string) => void;
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  addTerminalLog: (log: string) => void;
  clearTerminal: () => void;
  setFileDirty: (path: string, dirty: boolean) => void;
  reset: () => void;
}

const initialState = {
  repoId: null,
  meta: null,
  overview: null,
  fileTree: [],
  fileContents: {},
  repoContext: null,
  githubToken: null,
  isIndexing: false,
  indexingStage: 0,
  indexingMessage: "",
  indexMode: "full" as const,
  totalSourceFiles: 0,
  unfetchedFiles: [],
  openedFiles: [],
  activeFilePath: null,
  dirtyFiles: new Set<string>(),
  terminalLogs: [],
};

export const useRepoStore = create<RepoState>((set) => ({
  ...initialState,

  setRepoData: (data) =>
    set({
      repoId: data.repoId,
      meta: data.meta,
      fileTree: data.fileTree,
      fileContents: data.fileContents,
      repoContext: data.repoContext,
      githubToken: data.githubToken ?? null,
      indexMode: data.indexMode ?? "full",
      totalSourceFiles: data.totalSourceFiles ?? 0,
      unfetchedFiles: data.unfetchedFiles ?? [],
    }),

  setOverview: (overview) => set({ overview }),

  setIndexing: (isIndexing, stage = 0, message = "") =>
    set({ isIndexing, indexingStage: stage, indexingMessage: message }),

  upsertFileContent: (path, content) =>
    set((state) => ({
      fileContents: { ...state.fileContents, [path]: content },
    })),

  openFile: (path) =>
    set((state) => ({
      openedFiles: state.openedFiles.includes(path)
        ? state.openedFiles
        : [...state.openedFiles, path],
      activeFilePath: path,
    })),

  closeFile: (path) =>
    set((state) => {
      const newFiles = state.openedFiles.filter((f) => f !== path);
      return {
        openedFiles: newFiles,
        activeFilePath:
          state.activeFilePath === path
            ? newFiles[newFiles.length - 1] ?? null
            : state.activeFilePath,
      };
    }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  addTerminalLog: (log) =>
    set((state) => ({
      terminalLogs: [...state.terminalLogs.slice(-200), log],
    })),

  clearTerminal: () => set({ terminalLogs: [] }),

  setFileDirty: (path, dirty) =>
    set((state) => {
      const next = new Set(state.dirtyFiles);
      if (dirty) next.add(path);
      else next.delete(path);
      return { dirtyFiles: next };
    }),

  reset: () => set({ ...initialState, dirtyFiles: new Set() }),
}));
