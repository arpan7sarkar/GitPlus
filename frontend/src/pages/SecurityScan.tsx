import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Shield, ShieldAlert, AlertTriangle, Info, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspaceRepo } from "@/hooks/use-workspace-repo";
import { useCompactMode } from "@/hooks/use-compact-mode";
import { generateSecurityScan, type SecurityFinding } from "@/lib/api";
import type { RepoMeta } from "@/lib/mock-data";
import WorkspaceNav from "@/components/layout/WorkspaceNav";
import NoRepoLoaded from "@/components/layout/NoRepoLoaded";

const severityConfig = {
  critical: { color: "text-destructive", bg: "bg-destructive/5 border-destructive/30", icon: ShieldAlert, label: "Critical" },
  high: { color: "text-warning", bg: "bg-warning/5 border-warning/30", icon: ShieldAlert, label: "High" },
  medium: { color: "text-warning", bg: "bg-muted border-border", icon: AlertTriangle, label: "Medium" },
  low: { color: "text-info", bg: "bg-muted border-border", icon: Shield, label: "Low" },
  info: { color: "text-muted-foreground", bg: "bg-muted border-border", icon: Info, label: "Info" },
};

const SecurityScan = () => {
  const { repoId } = useParams();
  const { meta, repoContext, repoId: canonicalId } = useWorkspaceRepo(repoId);
  if (!meta) return <div className="min-h-screen bg-background"><WorkspaceNav repoId={repoId ?? ""} active="security" /><NoRepoLoaded repoId={repoId} /></div>;
  return <SecurityWorkspace key={`${repoId}:${canonicalId}`} routeId={repoId ?? ""} meta={meta} repoContext={repoContext} />;
};

function SecurityWorkspace({ routeId, meta, repoContext }: { routeId: string; meta: RepoMeta; repoContext: string }) {
  const compact = useCompactMode();
  const generation = useRef(0);
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { generation.current += 1; }, []);

  const runScan = async () => {
    if (!repoContext || isScanning) return;
    const attempt = ++generation.current;
    setIsScanning(true);
    setError(null);
    setHasScanned(false);
    try {
      const results = await generateSecurityScan(repoContext);
      if (attempt !== generation.current) return;
      setFindings(results);
      setHasScanned(true);
    } catch (failure) {
      if (attempt !== generation.current) return;
      setError(failure instanceof Error ? failure.message : "Could not generate security findings.");
    } finally {
      if (attempt === generation.current) setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <WorkspaceNav repoId={routeId} owner={meta.owner} name={meta.name} active="security" actions={
        <Button onClick={() => void runScan()} disabled={isScanning || !repoContext} variant="outline" className="min-h-11 gap-2 text-sm sm:min-h-9">
          {isScanning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          {isScanning ? "Analyzing…" : hasScanned ? "Run again" : "Generate findings"}
        </Button>
      } />
      <main id="main-content" tabIndex={-1} className={`mx-auto w-full max-w-4xl px-4 sm:px-6 ${compact ? "py-5" : "py-8"}`}>
        <h1 className="text-2xl font-semibold tracking-tight">Security findings</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">AI-generated observations from the repository context currently loaded. This is not a complete security audit; verify each finding against the source.</p>
        {!repoContext && <p role="alert" className="mt-4 rounded-lg border border-border p-4 text-sm">Repository context is unavailable. Return to the overview to load source data before generating findings.</p>}
        {error && <div role="alert" className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4"><h2 className="font-medium">No scan result is available</h2><p className="mt-1 break-words text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={() => void runScan()} className="mt-3 min-h-11 sm:min-h-9">Try again</Button></div>}
        {isScanning && <div role="status" className="mt-5 flex items-center gap-3 rounded-lg border border-border p-5 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />Generating findings from the loaded context…</div>}
        {!hasScanned && !isScanning && !error && repoContext && <div className="mt-5 rounded-lg border border-dashed border-border p-5"><h2 className="font-medium">Review potential security concerns</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Request findings, then check the referenced files and recommendations before acting.</p><Button onClick={() => void runScan()} className="mt-4 min-h-11 gap-2 sm:min-h-9"><Shield className="h-4 w-4" aria-hidden="true" />Generate findings</Button></div>}
        {hasScanned && !isScanning && <section className="mt-5 space-y-4" aria-label="Generated security findings">
          <div className="flex flex-wrap gap-2">{(Object.keys(severityConfig) as Array<keyof typeof severityConfig>).map((severity) => {
            const config = severityConfig[severity];
            return <span key={severity} className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${config.bg}`}><config.icon className={`h-4 w-4 ${config.color}`} aria-hidden="true" /><span>{config.label}: {findings.filter((finding) => finding.severity === severity).length}</span></span>;
          })}</div>
          {findings.length === 0 ? <div className="rounded-lg border border-border p-5"><h2 className="font-medium">No findings were returned</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">This response does not establish that the repository is secure. The model may miss issues, and unloaded files are outside this review.</p></div> : <ul className="space-y-3">{findings.map((finding) => {
            const config = severityConfig[finding.severity];
            return <li key={finding.id} className={`rounded-lg border p-4 ${config.bg}`}><div className="flex items-start gap-3"><config.icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.color}`} aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-mono text-muted-foreground">{finding.id}</span><h2 className="break-words text-base font-medium">{finding.title}</h2></div><p className="mt-2 break-words text-sm leading-relaxed text-secondary-foreground">{finding.description}</p>{finding.file && finding.file !== "General" && <p className="mt-2 break-all font-mono text-sm text-muted-foreground">{finding.file}{finding.line ? `:${finding.line}` : ""}</p>}<div className="mt-3 rounded-md border border-border bg-background p-3"><h3 className="text-sm font-medium">Suggested follow-up</h3><p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">{finding.recommendation}</p></div></div></div></li>;
          })}</ul>}
        </section>}
      </main>
    </div>
  );
}

export default SecurityScan;
