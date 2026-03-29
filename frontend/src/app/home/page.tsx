"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Send,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { cn } from "@/lib/utils";
import {
  api,
  type ExecutiveAgent,
  type ComposedTask,
  type OverviewData,
  type AgentSuggestion,
  type TaskAssignmentInput,
} from "@/lib/executive-api";

// ─── Home Page ───────────────────────────────────────────────────────

export default function HomePage() {
  const [agents, setAgents] = useState<ExecutiveAgent[]>([]);
  const [tasks, setTasks] = useState<ComposedTask[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    Promise.all([
      api.agents.list().catch(() => []),
      api.tasks.list().catch(() => []),
      api.overview().catch(() => null),
    ]).then(([a, t, o]) => {
      setAgents(a);
      setTasks(t);
      setOverview(o);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 30_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/home" }}
      title="Mission Control"
    >
      <SignedOut>
        <div className="py-20 text-center text-slate-500">Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-8">
            {/* Inline Composer */}
            <InlineComposer agents={agents} onCreated={loadData} />

            {/* Suggested Actions */}
            {overview && <SuggestedActions overview={overview} />}

            {/* Request Thread */}
            <RequestThread tasks={tasks} />
          </div>
        )}
      </SignedIn>
    </DashboardPageLayout>
  );
}

// ─── Inline Composer ─────────────────────────────────────────────────

function InlineComposer({ agents, onCreated }: { agents: ExecutiveAgent[]; onCreated: () => void }) {
  const [request, setRequest] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [collaborationMode, setCollaborationMode] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const handleSuggest = async () => {
    if (!request.trim()) return;
    setSuggesting(true);
    try {
      const result = await api.tasks.suggestAgents(request);
      setSuggestions(result.suggestions);
      setSelectedAgents(new Set(result.suggestions.map((s) => s.executive_agent_id)));
      if (result.recommended_mode) setCollaborationMode(result.recommended_mode);
    } catch (e) { console.error(e); }
    finally { setSuggesting(false); }
  };

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!request.trim() || selectedAgents.size === 0) return;
    setCreating(true);
    try {
      const assignments: TaskAssignmentInput[] = Array.from(selectedAgents).map((id, i) => ({
        executive_agent_id: id,
        role: i === 0 ? "primary" : "collaborator",
        order_index: i,
      }));
      await api.tasks.create({
        title: request.slice(0, 100),
        original_request: request,
        task_type: selectedAgents.size > 1 ? "multi_agent" : "single_agent",
        collaboration_mode: selectedAgents.size > 1 ? collaborationMode : null,
        assignments,
      });
      setCreated(true);
      onCreated();
      setTimeout(() => {
        setRequest(""); setSelectedAgents(new Set()); setCollaborationMode(null);
        setSuggestions([]); setCreated(false);
      }, 1500);
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  };

  return (
    <div className="rounded-2xl border bg-[color:var(--surface)] p-6 shadow-elevation-2" style={{ borderColor: "var(--border)" }}>
      {created ? (
        <div className="py-6 text-center">
          <Check className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--text)" }}>Task created</p>
        </div>
      ) : (
        <>
          <textarea
            className="w-full resize-none rounded-xl border bg-[color:var(--surface-muted)] px-4 py-3 text-sm placeholder:text-[color:var(--text-quiet)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
            rows={3}
            placeholder="What do you want done? e.g. 'Have Sales and Strategy prepare an investor update'"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) handleCreate(); }}
          />

          {/* Agent selector */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {agents.map((agent) => {
              const selected = selectedAgents.has(agent.id);
              return (
                <button
                  key={agent.id}
                  onClick={() => toggleAgent(agent.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-fast",
                    selected
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                      : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]",
                  )}
                >
                  <span className="text-sm">{agent.avatar_emoji}</span>
                  {agent.display_name}
                </button>
              );
            })}
          </div>

          {/* Collaboration mode */}
          {selectedAgents.size > 1 && (
            <div className="mt-3 flex gap-2">
              {(["parallel", "sequential", "review"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCollaborationMode(mode)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11px] font-medium capitalize transition-fast",
                    collaborationMode === mode
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                      : "border-[color:var(--border)] text-[color:var(--text-quiet)]",
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30 p-2.5 text-xs text-blue-800 dark:text-blue-300">
              {suggestions.map((s) => (
                <span key={s.executive_agent_id} className="mr-3">
                  {s.avatar_emoji} {s.display_name} — {s.reason}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleSuggest}
              disabled={!request.trim() || suggesting}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-fast disabled:opacity-40"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {suggesting ? "..." : "Suggest"}
            </button>
            <button
              onClick={handleCreate}
              disabled={!request.trim() || selectedAgents.size === 0 || creating}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-[color:var(--accent)] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40 transition-fast"
            >
              <Send className="h-3.5 w-3.5" />
              {creating ? "Creating..." : "Send"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Suggested Actions ───────────────────────────────────────────────

function SuggestedActions({ overview }: { overview: OverviewData }) {
  const items = [
    ...overview.what_matters_now.slice(0, 3),
    ...overview.waiting_on_michael.slice(0, 2).map((a) => ({
      title: a.action_type,
      agent: a.agent_name,
      agent_emoji: a.agent_emoji,
      urgency: "high" as const,
      needs_michael: true,
      action: "Review",
      link: "/approvals",
    })),
  ].slice(0, 6);

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-quiet)" }}>
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item, i) => (
          <MaybeLink key={i} href={"link" in item ? (item as any).link : undefined}>
            <div className={cn(
              "rounded-xl border p-3 text-xs transition-smooth hover:shadow-elevation-2 cursor-pointer",
              item.needs_michael ? "border-amber-200 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-950/20" : "",
            )} style={{ borderColor: item.needs_michael ? undefined : "var(--border)" }}>
              <div className="flex items-center gap-1.5 mb-1">
                {item.needs_michael && <Clock className="h-3 w-3 text-amber-500" />}
                {"agent_emoji" in item && item.agent_emoji && <span className="text-xs">{item.agent_emoji}</span>}
                {"agent" in item && item.agent && <span className="font-medium" style={{ color: "var(--text-muted)" }}>{item.agent}</span>}
              </div>
              <p className="line-clamp-2 font-medium" style={{ color: "var(--text)" }}>{item.title}</p>
            </div>
          </MaybeLink>
        ))}
      </div>
    </div>
  );
}

// ─── Request Thread ──────────────────────────────────────────────────

function RequestThread({ tasks }: { tasks: ComposedTask[] }) {
  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm" style={{ color: "var(--text-quiet)" }}>
          No tasks yet. Use the composer above to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-quiet)" }}>
          Recent Requests
        </h3>
        <Link href="/tasks" className="flex items-center gap-1 text-[11px] transition-smooth" style={{ color: "var(--text-quiet)" }}>
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {tasks.slice(0, 10).map((task) => (
          <Link
            key={task.id}
            href={`/tasks/${task.id}`}
            className="flex items-start gap-3 rounded-xl border p-3.5 transition-smooth hover:shadow-elevation-2"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{task.title}</p>
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  task.status === "active" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                  task.status === "in_progress" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                  task.status === "completed" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                )}>
                  {task.status === "in_progress" ? "In Progress" : task.status}
                </span>
              </div>
              {task.assignments.length > 0 && (
                <div className="mt-1.5 flex gap-1">
                  {task.assignments.map((a) => (
                    <span key={a.id} className="text-xs" style={{ color: "var(--text-quiet)" }}>
                      {a.agent_avatar_emoji} {a.agent_display_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[10px] shrink-0" style={{ color: "var(--text-quiet)" }}>
              {new Date(task.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MaybeLink({ href, children }: { href?: string | null; children: React.ReactNode }) {
  if (href) return <Link href={href}>{children}</Link>;
  return <>{children}</>;
}
