"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import {
  Clock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Zap,
} from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { cn } from "@/lib/utils";
import { api, type CronJob, type CronListResponse, type ExecutiveAgent } from "@/lib/executive-api";

function humanCron(job: CronJob): string {
  const s = job.schedule;
  if (!s) return "No schedule";
  if (s.every) return `Every ${s.every}`;
  if (s.expr) {
    const tz = s.tz ? ` (${s.tz})` : "";
    return `${s.expr}${tz}`;
  }
  return s.kind;
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function SchedulesPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [agents, setAgents] = useState<ExecutiveAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.schedules.list().catch(() => ({ jobs: [] } as CronListResponse)),
      api.agents.list().catch(() => []),
    ]).then(([cronResp, a]) => {
      setJobs(cronResp.jobs || []);
      setAgents(a);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const agentMap = new Map(agents.map((a) => [a.openclaw_agent_id, a]));

  const handleToggle = async (job: CronJob) => {
    try {
      if (job.enabled) await api.schedules.disable(job.id);
      else await api.schedules.enable(job.id);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleRun = async (job: CronJob) => {
    try {
      await api.schedules.run(job.id);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleRemove = async (job: CronJob) => {
    if (!confirm(`Remove "${job.name}"?`)) return;
    try {
      await api.schedules.remove(job.id);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleCreate = async (data: {
    name: string; agent_id?: string; cron_expr?: string; every?: string;
    message?: string; description?: string; tz?: string;
  }) => {
    try {
      await api.schedules.create(data);
      setShowCreate(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in", forceRedirectUrl: "/agent/main" }}
      title="Schedules"
      description="Cron jobs and automation"
      headerActions={
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="rounded-lg border p-1.5 transition-fast" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 rounded-lg bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-fast"
          >
            {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showCreate ? "Cancel" : "New Schedule"}
          </button>
        </div>
      }
    >
      <SignedOut>
        <div className="py-20 text-center" style={{ color: "var(--text-muted)" }}>Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-4xl space-y-4">
          {showCreate && <CreateForm agents={agents} onSubmit={handleCreate} />}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center" style={{ borderColor: "var(--border)" }}>
              <Clock className="mx-auto h-8 w-8" style={{ color: "var(--text-quiet)" }} />
              <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>No cron jobs found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => {
                const agent = job.agentId ? agentMap.get(job.agentId) : null;
                return (
                  <div
                    key={job.id}
                    className="rounded-xl border p-4"
                    style={{ borderColor: "var(--border)", background: "var(--surface)", opacity: job.enabled ? 1 : 0.6 }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {agent && <span className="text-sm">{agent.avatar_emoji}</span>}
                          <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{job.name}</h3>
                          {!job.enabled && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--surface-muted)", color: "var(--text-quiet)" }}>
                              Disabled
                            </span>
                          )}
                        </div>
                        {job.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{job.description}</p>}
                        <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[11px]" style={{ color: "var(--text-quiet)" }}>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {humanCron(job)}
                          </span>
                          {agent && <span>{agent.display_name}</span>}
                          {job.payload?.message && (
                            <span className="truncate max-w-[300px]" title={job.payload.message}>
                              {job.payload.message.slice(0, 60)}...
                            </span>
                          )}
                          <span>Updated {timeAgo(job.updatedAtMs)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleToggle(job)}
                          className="rounded p-1.5 transition-fast hover:bg-[color:var(--surface-muted)]"
                          style={{ color: "var(--text-muted)" }}
                          title={job.enabled ? "Disable" : "Enable"}
                        >
                          {job.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => handleRun(job)}
                          className="rounded p-1.5 transition-fast hover:bg-[color:var(--surface-muted)]"
                          style={{ color: "var(--accent)" }}
                          title="Run now"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemove(job)}
                          className="rounded p-1.5 transition-fast hover:bg-red-50 dark:hover:bg-red-950/20"
                          style={{ color: "var(--danger)" }}
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SignedIn>
    </DashboardPageLayout>
  );
}

function CreateForm({ agents, onSubmit }: {
  agents: ExecutiveAgent[];
  onSubmit: (data: { name: string; agent_id?: string; cron_expr?: string; every?: string; message?: string; description?: string; tz?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [cronExpr, setCronExpr] = useState("");
  const [message, setMessage] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="rounded-xl border p-5 space-y-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>New Schedule</h3>
      <input
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--text)" }}
        placeholder="Job name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex gap-3">
        <select
          className="rounded-lg border px-2 py-1.5 text-sm flex-1"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
        >
          <option value="">No agent (default)</option>
          {agents.map((a) => <option key={a.openclaw_agent_id} value={a.openclaw_agent_id}>{a.avatar_emoji} {a.display_name}</option>)}
        </select>
        <input
          className="rounded-lg border px-3 py-1.5 text-sm flex-1 font-mono"
          style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--text)" }}
          placeholder="Cron: 0 9 * * 1-5"
          value={cronExpr}
          onChange={(e) => setCronExpr(e.target.value)}
        />
      </div>
      <input
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--text)" }}
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <textarea
        className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
        style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--text)" }}
        rows={3}
        placeholder="Agent message / prompt..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button
        onClick={() => onSubmit({
          name,
          ...(agentId ? { agent_id: agentId } : {}),
          ...(cronExpr ? { cron_expr: cronExpr } : {}),
          ...(message ? { message } : {}),
          ...(description ? { description } : {}),
          tz: "Europe/Dublin",
        })}
        disabled={!name.trim()}
        className="rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
      >
        Create
      </button>
    </div>
  );
}
