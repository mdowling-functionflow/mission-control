"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Send,
  Sparkles,
  Users,
} from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { cn } from "@/lib/utils";
import {
  api,
  type ExecutiveAgent,
  type ComposedTask,
  type OverviewData,
  type OverviewItem,
  type AgentSuggestion,
  type TaskAssignmentInput,
} from "@/lib/executive-api";

// ─── Full-Screen Chat Home ───────────────────────────────────────────

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
      setAgents(a); setTasks(t); setOverview(o);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 15_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/home" }}
      title=""
      stickyHeader={false}
    >
      <SignedOut>
        <div className="py-20 text-center" style={{ color: "var(--text-muted)" }}>Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          </div>
        ) : (
          <div className="flex h-[calc(100vh-64px)] flex-col">
            {/* Thread area — scrollable */}
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
                {/* Quick actions strip */}
                {overview && <QuickActions overview={overview} />}

                {/* Message thread */}
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--surface-muted)" }}>
                      <Send className="h-8 w-8" style={{ color: "var(--text-quiet)" }} />
                    </div>
                    <h2 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                      What do you want done?
                    </h2>
                    <p className="mt-1 text-sm max-w-sm" style={{ color: "var(--text-muted)" }}>
                      Ask your AI executive team to prepare a deck, research a market, follow up on a deal, or anything else.
                    </p>
                  </div>
                ) : (
                  <ThreadView tasks={tasks} />
                )}
              </div>
            </div>

            {/* Composer — fixed at bottom */}
            <div className="border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="mx-auto max-w-2xl px-4 py-4">
                <ComposerBar agents={agents} onCreated={loadData} />
              </div>
            </div>
          </div>
        )}
      </SignedIn>
    </DashboardPageLayout>
  );
}

// ─── Quick Actions Strip ─────────────────────────────────────────────

function QuickActions({ overview }: { overview: OverviewData }) {
  const items = [
    ...overview.what_matters_now.slice(0, 3),
    ...overview.waiting_on_michael.slice(0, 2).map((a) => ({
      title: a.action_type,
      agent: a.agent_name,
      agent_emoji: a.agent_emoji,
      urgency: "high" as const,
      needs_michael: true,
      link: "/approvals",
    })),
  ].slice(0, 4);

  if (items.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {items.map((item, i) => (
        <MaybeLink key={i} href={"link" in item ? (item as any).link : undefined}>
          <div className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs whitespace-nowrap transition-smooth cursor-pointer hover:shadow-elevation-2 shrink-0",
            item.needs_michael ? "border-amber-200 dark:border-amber-800/30" : "",
          )} style={{ borderColor: item.needs_michael ? undefined : "var(--border)", background: "var(--surface)" }}>
            {item.needs_michael && <Clock className="h-3 w-3 text-amber-500" />}
            {"agent_emoji" in item && item.agent_emoji && <span>{item.agent_emoji}</span>}
            <span className="font-medium" style={{ color: "var(--text)" }}>{item.title}</span>
            <ChevronRight className="h-3 w-3" style={{ color: "var(--text-quiet)" }} />
          </div>
        </MaybeLink>
      ))}
    </div>
  );
}

// ─── Thread View ─────────────────────────────────────────────────────

function ThreadView({ tasks }: { tasks: ComposedTask[] }) {
  return (
    <div className="space-y-3">
      {tasks.slice(0, 20).map((task) => (
        <ThreadItem key={task.id} task={task} />
      ))}
    </div>
  );
}

function ThreadItem({ task }: { task: ComposedTask }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      {/* User request */}
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5" style={{ background: "var(--accent)", color: "white" }}>
          <p className="text-sm">{task.original_request || task.title}</p>
        </div>
      </div>

      {/* System response */}
      <div className="flex justify-start">
        <div
          className="max-w-[85%] rounded-2xl rounded-bl-md border px-4 py-3 transition-smooth"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            {task.assignments.map((a) => (
              <span key={a.id} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {a.agent_avatar_emoji} {a.agent_display_name}
              </span>
            ))}
            <span className={cn(
              "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              task.status === "active" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
              task.status === "in_progress" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
              task.status === "completed" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
              task.status === "cancelled" && "bg-slate-100 text-slate-500",
            )}>
              {task.status === "in_progress" ? "Working..." : task.status}
            </span>
          </div>

          {/* Agent updates */}
          {task.assignments.some((a) => a.last_update) && (
            <div className="space-y-1.5 mt-2">
              {task.assignments.filter((a) => a.last_update).map((a) => (
                <div key={a.id} className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="font-medium">{a.agent_avatar_emoji} {a.agent_display_name}:</span>{" "}
                  {a.last_update}
                </div>
              ))}
            </div>
          )}

          {/* Expand for details */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-[11px] transition-fast"
            style={{ color: "var(--text-quiet)" }}
          >
            {expanded ? "Less" : "Details"}
          </button>

          {expanded && (
            <div className="mt-2 pt-2 border-t space-y-1 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-quiet)" }}>
              {task.collaboration_mode && (
                <p>Mode: {task.collaboration_mode}</p>
              )}
              <p>Created: {new Date(task.created_at).toLocaleString()}</p>
              <Link href={`/tasks/${task.id}`} className="flex items-center gap-1 mt-1" style={{ color: "var(--accent)" }}>
                Open task <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Composer Bar ────────────────────────────────────────────────────

function ComposerBar({ agents, onCreated }: { agents: ExecutiveAgent[]; onCreated: () => void }) {
  const [request, setRequest] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [collaborationMode, setCollaborationMode] = useState<string | null>(null);
  const [showAgents, setShowAgents] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSuggest = async () => {
    if (!request.trim()) return;
    setSuggesting(true);
    try {
      const result = await api.tasks.suggestAgents(request);
      setSelectedAgents(new Set(result.suggestions.map((s) => s.executive_agent_id)));
      if (result.recommended_mode) setCollaborationMode(result.recommended_mode);
      setShowAgents(true);
    } catch (e) { console.error(e); }
    finally { setSuggesting(false); }
  };

  const handleSend = async () => {
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
      setRequest("");
      setSelectedAgents(new Set());
      setCollaborationMode(null);
      setShowAgents(false);
      onCreated();
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  };

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 150) + "px";
    }
  }, [request]);

  return (
    <div className="space-y-2">
      {/* Agent selector */}
      {showAgents && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {agents.map((agent) => {
            const selected = selectedAgents.has(agent.id);
            return (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-fast",
                  selected
                    ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "border-[color:var(--border)] text-[color:var(--text-quiet)] hover:border-[color:var(--border-strong)]",
                )}
              >
                <span className="text-xs">{agent.avatar_emoji}</span>
                {agent.display_name}
              </button>
            );
          })}
          {selectedAgents.size > 1 && (
            <div className="flex gap-1 ml-2">
              {(["parallel", "sequential", "review"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setCollaborationMode(m)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium capitalize transition-fast",
                    collaborationMode === m
                      ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                      : "text-[color:var(--text-quiet)]",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <div className="flex-1 rounded-2xl border shadow-elevation-1" style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}>
          <textarea
            ref={textareaRef}
            className="w-full resize-none bg-transparent px-4 py-3 text-sm placeholder:text-[color:var(--text-quiet)] focus:outline-none"
            style={{ color: "var(--text)" }}
            rows={1}
            placeholder="What do you want done?"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (selectedAgents.size > 0) handleSend();
                else if (request.trim()) handleSuggest();
              }
            }}
          />
        </div>
        <div className="flex gap-1.5 shrink-0 pb-1">
          <button
            onClick={() => setShowAgents(!showAgents)}
            className={cn(
              "rounded-xl p-2.5 transition-fast",
              showAgents
                ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                : "text-[color:var(--text-quiet)] hover:bg-[color:var(--surface-muted)]",
            )}
            title="Select agents"
          >
            <Users className="h-4 w-4" />
          </button>
          <button
            onClick={handleSuggest}
            disabled={!request.trim() || suggesting}
            className="rounded-xl p-2.5 transition-fast disabled:opacity-30"
            style={{ color: "var(--text-quiet)" }}
            title="Auto-suggest agents"
          >
            <Sparkles className="h-4 w-4" />
          </button>
          <button
            onClick={handleSend}
            disabled={!request.trim() || selectedAgents.size === 0 || creating}
            className="rounded-xl p-2.5 bg-[color:var(--accent)] text-white transition-fast disabled:opacity-30"
            title="Send (Enter)"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function MaybeLink({ href, children }: { href?: string | null; children: React.ReactNode }) {
  if (href) return <Link href={href}>{children}</Link>;
  return <>{children}</>;
}
