import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import { Send, PanelRightOpen, PanelRightClose, Share2, Check, History, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FileTree from "@/components/chat/FileTree";
import ChatMessageComponent from "@/components/chat/ChatMessage";
import FileViewer from "@/components/chat/FileViewer";
import { type ChatMessage, type Citation } from "@/lib/mock-data";
import WorkspaceNav from "@/components/layout/WorkspaceNav";
import NoRepoLoaded from "@/components/layout/NoRepoLoaded";
import { useRepoStore } from "@/lib/store";
import { streamChat } from "@/lib/api";
import { createChatSession, updateSessionMessages, loadChatSession } from "@/lib/chat-session";
import { getChatHistory, saveChatHistoryEntry, removeChatHistoryEntry, type ChatHistoryEntry } from "@/lib/chat-history";
import { toast } from "@/hooks/use-toast";
import { useCompactMode } from "@/hooks/use-compact-mode";
import { useSettingsStore } from "@/lib/settings-store";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const ChatInterface = () => {
  const { repoId } = useParams();
  const location = useLocation();
  const compact = useCompactMode();
  const reducedMotion = useReducedMotion();
  const { settings } = useSettingsStore();
  const { meta: storeMeta, fileTree: storeFileTree, repoContext, githubToken, indexMode: storeIndexMode, unfetchedFiles: storeUnfetchedFiles } = useRepoStore();

  const repo = storeMeta;
  const fileTree = storeFileTree;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showFileTree, setShowFileTree] = useState(() => !compact && window.matchMedia("(min-width: 1024px)").matches);
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatHistory(getChatHistory().filter((h) => h.repoId === repoId));
  }, [repoId]);

  useEffect(() => {
    const state = location.state as { initialQuestion?: string } | null;
    if (state?.initialQuestion && storeMeta) {
      handleSend(state.initialQuestion);
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  }, [messages, reducedMotion]);

  const persistToHistory = useCallback(async (msgs: ChatMessage[], sid: string) => {
    if (!settings.autoSaveChatHistory || !repo) return;

    const lastMsg = msgs.filter((m) => m.role === "assistant").pop();
    saveChatHistoryEntry({
      sessionId: sid,
      repoId: repoId || "unknown",
      repoName: repo.name,
      repoOwner: repo.owner,
      lastMessage: lastMsg?.content?.slice(0, 100) || "New chat",
      messageCount: msgs.length,
      updatedAt: new Date().toISOString(),
    });
    setChatHistory(getChatHistory().filter((h) => h.repoId === repoId));
  }, [repoId, repo, settings.autoSaveChatHistory]);

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    if (!repo) throw new Error("No repository loaded");
    if (!settings.autoSaveChatHistory) return "local-session-" + Date.now();

    const sid = await createChatSession(
      repoId || "unknown", repo,
      repoContext || `Repository: ${repo.name} by ${repo.owner}`
    );
    setSessionId(sid);
    return sid;
  };

  const handleSend = async (text?: string) => {
    const content = text || inputValue.trim();
    if (!content || isStreaming || !repo) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    let fullContent = "";
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date() }]);

    try {
      const sid = await ensureSession();
      const chatHist = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

      // Build context — in on-demand mode, append a file listing so AI knows what's available
      let contextForAI = repoContext || `Repository: ${repo.name} by ${repo.owner}`;
      if (storeIndexMode === "on-demand" && storeUnfetchedFiles?.length > 0) {
        const fileList = storeUnfetchedFiles.slice(0, 500).map(f => f.path).join("\n");
        contextForAI += `\n\n--- ADDITIONAL FILES AVAILABLE ON-DEMAND (not yet fetched) ---\n${fileList}\n--- END FILE LISTING ---\nNote: The above files have not been fetched yet. You can reference them but their contents are not available in context. Focus on the files whose contents are shown above.`;
      }

      await streamChat({
        messages: chatHist,
        repoContext: contextForAI,
        repoId,
        onDelta: (chunk) => {
          fullContent += chunk;
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m)));
        },
        onDone: () => {
          const citations = extractCitations(fullContent);
          setMessages((prev) => {
            const updated = prev.map((m) => m.id === assistantId ? { ...m, content: fullContent, citations } : m);
            if (settings.autoSaveChatHistory) {
              updateSessionMessages(sid, updated);
              persistToHistory(updated, sid);
            }
            return updated;
          });
          setIsStreaming(false);
        },
        onError: (error) => {
          toast({ title: "Error", description: error, variant: "destructive" });
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          setIsStreaming(false);
        },
      });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed to send", variant: "destructive" });
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      setIsStreaming(false);
    }
  };

  const handleCitationClick = (citation: Citation) => {
    setActiveCitation(citation);
    setSelectedFile(citation.filePath);
  };

  const handleFileSelect = (filePath: string | undefined) => {
    setSelectedFile(filePath);
    if (filePath) {
      setActiveCitation({
        filePath,
        startLine: 1,
        endLine: 999999, // Show entire file
        snippet: "Full file"
      });
    } else {
      setActiveCitation(null);
    }
  };

  const handleShare = useCallback(async () => {
    try {
      const sid = await ensureSession();
      await updateSessionMessages(sid, messages);
      const url = `${window.location.origin}/shared/${sid}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied!", description: "Anyone with the link can view this chat." });
    } catch {
      toast({ title: "Error", description: "Failed to create share link.", variant: "destructive" });
    }
  }, [sessionId, messages, repoId, repo, repoContext]);

  const loadSession = async (entry: ChatHistoryEntry) => {
    try {
      const session = await loadChatSession(entry.sessionId);
      if (session) {
        setSessionId(session.id);
        setMessages(session.messages);
        setShowHistory(false);
      } else {
        toast({ title: "Session not found", variant: "destructive" });
        removeChatHistoryEntry(entry.sessionId);
        setChatHistory(getChatHistory().filter((h) => h.repoId === repoId));
      }
    } catch {
      toast({ title: "Error", description: "Failed to load session.", variant: "destructive" });
    }
  };

  const startNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setActiveCitation(null);
    setShowHistory(false);
  };

  const deleteHistoryEntry = (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    removeChatHistoryEntry(sid);
    setChatHistory(getChatHistory().filter((h) => h.repoId === repoId));
  };

  if (!repo) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <WorkspaceNav repoId={repoId ?? ""} active="chat" sticky={false} />
        <div className="flex-1">
          <NoRepoLoaded repoId={repoId} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <WorkspaceNav
        repoId={repoId ?? ""}
        owner={repo.owner}
        name={repo.name}
        active="chat"
        sticky={false}
        badge={storeIndexMode === "on-demand" && (
          <span className="ml-1.5 rounded border border-border bg-muted px-2 py-1 text-xs font-medium text-warning">On-demand</span>
        )}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={startNewChat} className="h-11 px-3 text-sm sm:h-9 text-muted-foreground gap-1" aria-label="Start new chat">
              <Plus className="h-3 w-3" aria-hidden="true" /> New
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}
              className={`h-11 px-3 text-sm sm:h-9 gap-1 ${showHistory ? "text-primary" : "text-muted-foreground"}`} aria-label="Toggle chat history">
              <History className="h-3 w-3" aria-hidden="true" /> History
            </Button>
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleShare} className="h-11 px-3 text-sm sm:h-9 text-muted-foreground gap-1" aria-label="Copy share link">
                {copied ? <Check className="h-3 w-3 text-success" /> : <Share2 className="h-3 w-3" />}
                {copied ? "Copied" : "Share"}
              </Button>
            )}
            {!compact && (
              <Button variant="ghost" size="sm" onClick={() => setShowFileTree(!showFileTree)} className="h-11 w-11 p-0 text-muted-foreground sm:h-9 sm:w-9" aria-label="Toggle file tree">
                {showFileTree ? <PanelRightClose className="h-3 w-3" /> : <PanelRightOpen className="h-3 w-3" />}
              </Button>
            )}
          </>
        }
      />

      <div id="main-content" tabIndex={-1} role="main" className="relative flex min-h-0 flex-1">
        <AnimatePresence>
          {showFileTree && !compact && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-y-0 left-0 z-20 w-[min(280px,100%)] shrink-0 overflow-auto border-r border-border bg-background lg:static lg:w-[260px]">
              <FileTree tree={fileTree} onFileSelect={handleFileSelect} selectedFile={selectedFile} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-w-0">
          {/* History */}
          <AnimatePresence>
            {showHistory && chatHistory.length > 0 && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }}
                className="overflow-hidden border-b border-border">
                <div className="p-2.5 max-h-40 overflow-y-auto space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Previous Sessions</p>
                  {chatHistory.map((entry) => (
                    <div key={entry.sessionId} className={`flex items-center gap-2 rounded-md ${entry.sessionId === sessionId ? "bg-accent" : ""}`}>
                      <button onClick={() => loadSession(entry)} className="min-h-11 min-w-0 flex-1 rounded-md px-3 py-2 text-left hover:bg-accent">
                        <p className="break-words text-sm text-foreground">{entry.lastMessage || "Empty chat"}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.messageCount} messages · {new Date(entry.updatedAt).toLocaleDateString()}
                        </p>
                      </button>
                      <button onClick={(e) => deleteHistoryEntry(e, entry.sessionId)} aria-label="Delete saved conversation"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center pt-16 px-6">
                <p className="text-sm text-foreground font-medium mb-1">
                  Ask anything about {repo.owner}/{repo.name}
                </p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Answers are retrieved from the indexed code and cite file paths with line numbers — verify them in the file viewer.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <ChatMessageComponent key={msg.id} message={msg} onCitationClick={handleCitationClick} />
            ))}
            {isStreaming && messages[messages.length - 1]?.content === "" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-9">
                <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 p-3 border-t border-border">
            <div className="flex gap-2 max-w-2xl mx-auto">
              <Input placeholder="Ask about this codebase..." value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                disabled={isStreaming}
                className="h-11 bg-card text-base sm:h-10 sm:text-sm" aria-label="Message about this codebase" />
              <Button onClick={() => handleSend()} disabled={!inputValue.trim() || isStreaming}
                size="icon" className="h-11 w-11 shrink-0 sm:h-10 sm:w-10" aria-label="Send message">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {activeCitation && !compact && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 z-30 w-full shrink-0 overflow-hidden bg-background lg:static lg:w-[40%]">
              <FileViewer
                citation={activeCitation}
                repoOwner={repo.owner}
                repoName={repo.name}
                githubToken={githubToken}
                onClose={() => {
                  setActiveCitation(null);
                  setSelectedFile(undefined);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

function extractCitations(text: string): Citation[] {
  const citations: Citation[] = [];
  const regex = /`?([a-zA-Z0-9_/.-]+\.[a-zA-Z]+):(\d+)[-–](\d+)`?/g;
  let match;
  const seen = new Set<string>();
  while ((match = regex.exec(text)) !== null) {
    const key = `${match[1]}:${match[2]}-${match[3]}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({ filePath: match[1], startLine: parseInt(match[2]), endLine: parseInt(match[3]), snippet: `Lines ${match[2]}-${match[3]}` });
    }
    if (citations.length >= 5) break;
  }
  return citations;
}

export default ChatInterface;