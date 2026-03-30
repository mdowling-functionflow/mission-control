"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  History,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
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
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  agent={job.agentId ? agentMap.get(job.agentId) : undefined}
                  onToggle={() => handleToggle(job)}
                  onRun={() => handleRun(job)}
                  onRemove={() => handleRemove(job)}
                  onReload={loadData}
                />
              ))}
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

      {/* Templates */}
      <div className="border-t pt-3 mt-3" style={{ borderColor: "var(--border)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-quiet)" }}>Templates</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => { setName(t.name); setCronExpr(t.cron); setMessage(t.message); setDescription(t.description || ""); }}
              className="rounded-lg border px-2 py-1 text-[10px] transition-fast hover:bg-[color:var(--surface-muted)]"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const TEMPLATES = [
  { label: "Morning Digest", name: "morning-digest", cron: "0 8 * * 1-5", message: "Summarize what matters today: key meetings, pending approvals, urgent follow-ups, and overnight changes.", description: "Daily morning briefing on weekdays" },
  { label: "Inbox Summary", name: "inbox-summary", cron: "0 8-18/2 * * 1-5", message: "Scan recent emails and summarize any that need attention. Flag urgent items.", description: "Email summary every 2 hours during working hours" },
  { label: "Weekly Audit", name: "weekly-audit", cron: "0 9 * * 1", message: "Review this past week: tasks completed, documents produced, risks identified, friction points, and suggest 2-3 improvements for next week.", description: "Monday morning weekly self-audit" },
  { label: "Weekly Research", name: "weekly-research", cron: "0 16 * * 5", message: "Produce a weekly research summary covering market trends, competitor moves, and relevant industry news.", description: "Friday afternoon research roundup" },
  { label: "Reminder", name: "reminder", cron: "0 9 * * 1", message: "Remind Michael about: [describe what to remind about]", description: "Weekly reminder" },
];


function JobCard({ job, agent, onToggle, onRun, onRemove, onReload }: {
  job: CronJob;
  agent?: ExecutiveAgent;
  onToggle: () => void;
  onRun: () => void;
  onRemove: () => void;
  onReload?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(job.name);
  const [editCron, setEditCron] = useState(job.schedule?.expr || "");
  const [editMessage, setEditMessage] = useState(job.payload?.message || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.schedules.edit(job.id, {
        name: editName !== job.name ? editName : undefined,
        cron_expr: editCron !== (job.schedule?.expr || "") ? editCron : undefined,
        message: editMessage !== (job.payload?.message || "") ? editMessage : undefined,
      });
      setEditing(false);
      onReload?.();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--surface)", opacity: job.enabled ? 1 : 0.6 }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        <button onClick={() => setExpanded(!expanded)} className="mt-0.5 shrink-0" style={{ color: "var(--text-quiet)" }}>
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {agent && <span className="text-sm">{agent.avatar_emoji}</span>}
            <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{job.name}</h3>
            {!job.enabled && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--surface-muted)", color: "var(--text-quiet)" }}>Disabled</span>
            )}
          </div>
          {job.description && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{job.description}</p>}
          <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[11px]" style={{ color: "var(--text-quiet)" }}>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{humanCron(job)}</span>
            {agent && <span>{agent.display_name}</span>}
            <span>Updated {timeAgo(job.updatedAtMs)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onToggle} className="rounded p-1.5 transition-fast hover:bg-[color:var(--surface-muted)]" style={{ color: "var(--text-muted)" }} title={job.enabled ? "Disable" : "Enable"}>
            {job.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onRun} className="rounded p-1.5 transition-fast hover:bg-[color:var(--surface-muted)]" style={{ color: "var(--accent)" }} title="Run now">
            <Zap className="h-3.5 w-3.5" />
          </button>
          <button onClick={onRemove} className="rounded p-1.5 transition-fast hover:bg-red-50 dark:hover:bg-red-950/20" style={{ color: "var(--danger)" }} title="Remove">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-3 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}>
          {/* Edit/view toggle */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-quiet)" }}>Configuration</span>
            <button
              onClick={() => setEditing(!editing)}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-fast"
              style={{ color: "var(--accent)" }}
            >
              {editing ? <X className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}
              {editing ? "Cancel" : "Edit"}
            </button>
          </div>

          {editing ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium block mb-0.5" style={{ color: "var(--text-quiet)" }}>Name</label>
                  <input className="w-full rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--border)", color: "var(--text)" }}
                    value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] font-medium block mb-0.5" style={{ color: "var(--text-quiet)" }}>Cron Expression</label>
                  <input className="w-full rounded border px-2 py-1 text-xs font-mono" style={{ borderColor: "var(--border)", color: "var(--text)" }}
                    value={editCron} onChange={(e) => setEditCron(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium block mb-0.5" style={{ color: "var(--text-quiet)" }}>Message / Prompt</label>
                <textarea className="w-full rounded border px-2 py-1 text-xs font-mono" style={{ borderColor: "var(--border)", color: "var(--text)" }}
                  rows={4} value={editMessage} onChange={(e) => setEditMessage(e.target.value)} />
              </div>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1 rounded bg-[color:var(--accent)] px-3 py-1 text-[10px] font-medium text-white disabled:opacity-40">
                <Save className="h-3 w-3" /> {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                <Detail label="Job ID" value={job.id} />
                <Detail label="Agent" value={job.agentId || "default"} />
                <Detail label="Schedule" value={job.schedule?.expr || job.schedule?.every || "—"} />
                <Detail label="Timezone" value={job.schedule?.tz || "UTC"} />
                <Detail label="Model" value={job.payload?.model || "default"} />
                <Detail label="Timeout" value={job.payload?.timeoutSeconds ? `${job.payload.timeoutSeconds}s` : "default"} />
                <Detail label="Thinking" value={job.payload?.thinking || "default"} />
                <Detail label="Delivery" value={job.delivery?.mode || "none"} />
                {job.delivery?.channel && <Detail label="Channel" value={job.delivery.channel} />}
              </div>
              {job.payload?.message && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-quiet)" }}>Message / Prompt</p>
                  <pre className="text-[11px] whitespace-pre-wrap rounded-lg p-2 max-h-[200px] overflow-auto" style={{ background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                    {job.payload.message}
                  </pre>
                </div>
              )}
            </>
          )}

          <p className="text-[10px]" style={{ color: "var(--text-quiet)" }}>
            Created: {new Date(job.createdAtMs).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] font-medium" style={{ color: "var(--text-quiet)" }}>{label}: </span>
      <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{value}</span>
    </div>
  );
}
