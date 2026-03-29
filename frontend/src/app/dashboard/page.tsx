"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Compass,
  Lightbulb,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { TaskComposer } from "@/components/executive/TaskComposer";
import { cn } from "@/lib/utils";
import {
  api,
  type OverviewData,
  type ExecutiveAgent,
  type OverviewItem,
  type OverviewApproval,
  type OverviewActivity,
} from "@/lib/executive-api";

// ─── Small components ────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: string }) {
  const styles: Record<string, string> = {
    high: "bg-red-100 text-red-800",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", styles[urgency] ?? styles.medium)}>
      {urgency}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        status === "active" && "bg-emerald-500",
        status === "bound" && "bg-blue-400",
        status === "stale" && "bg-amber-500",
        status === "error" && "bg-red-500",
      )}
    />
  );
}

function AgentSnapshotCard({ agent }: { agent: ExecutiveAgent }) {
  return (
    <Link
      href={`/executive-agents/${agent.id}`}
      className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{agent.avatar_emoji || "🤖"}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {agent.display_name}
            </h3>
            <StatusDot status={agent.status} />
          </div>
          <p className="text-xs text-slate-500">{agent.executive_role}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {agent.pending_approvals_count > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
              {agent.pending_approvals_count} pending
            </span>
          )}
          {agent.active_tasks_count > 0 && (
            <span className="text-[10px] text-slate-400">
              {agent.active_tasks_count} active
            </span>
          )}
        </div>
      </div>
      {agent.current_focus && (
        <p className="mt-3 text-xs text-slate-600 line-clamp-2">
          {agent.current_focus}
        </p>
      )}
      {agent.current_risk && (
        <p className="mt-2 flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle className="h-3 w-3" />
          <span className="line-clamp-1">{agent.current_risk}</span>
        </p>
      )}
    </Link>
  );
}

// ─── Main page ───────────────────────────────────────────────────────

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = () => {
    api.overview().then(setData).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(loadData, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await api.agents.seed();
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSeeding(false);
    }
  };

  const agents = data?.agent_snapshots ?? [];
  const hasAgents = agents.length > 0;

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/dashboard" }}
      title="Overview"
      description="What matters now"
      headerActions={
        <button
          onClick={() => setComposerOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" /> New Task
        </button>
      }
    >
      <SignedOut>
        <div className="py-20 text-center text-slate-500">
          Sign in to view your Mission Control.
        </div>
      </SignedOut>
      <SignedIn>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-8">
            {/* Seed prompt */}
            {!hasAgents && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-400" />
                <h3 className="mt-3 text-sm font-medium text-slate-700">
                  No executive agents bound yet
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Seed the 5 executive agents from your OpenClaw configuration.
                </p>
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {seeding ? "Seeding..." : "Seed Executive Team"}
                </button>
              </div>
            )}

            {/* What Matters Now */}
            {(data?.what_matters_now?.length ?? 0) > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  What Matters Now
                </h2>
                <div className="space-y-2">
                  {data!.what_matters_now.map((item, i) => (
                    <MaybeLink key={i} href={item.link}>
                      <div
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3 transition",
                          item.needs_michael
                            ? "border-amber-200 bg-amber-50"
                            : "border-slate-200 bg-white",
                          item.link && "hover:shadow-sm cursor-pointer",
                        )}
                      >
                        <UrgencyBadge urgency={item.urgency} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">{item.title}</p>
                          {item.agent && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {item.agent_emoji && <span className="mr-1">{item.agent_emoji}</span>}
                              {item.agent}
                            </p>
                          )}
                        </div>
                        {item.action && (
                          <span className="text-xs text-slate-500 shrink-0 flex items-center gap-1">
                            {item.action}
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </MaybeLink>
                  ))}
                </div>
              </section>
            )}

            {/* Waiting on Michael */}
            {(data?.waiting_on_michael?.length ?? 0) > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Waiting on Michael
                  </h2>
                  <Link
                    href="/approvals"
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {data!.waiting_on_michael.slice(0, 5).map((a) => (
                    <Link
                      key={a.id}
                      href="/approvals"
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 transition"
                    >
                      <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {a.agent_emoji && <span className="text-sm">{a.agent_emoji}</span>}
                          <p className="text-sm text-slate-900 truncate">{a.action_type}</p>
                        </div>
                        {a.rationale && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">{a.rationale}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-slate-400">
                          {Math.round(a.confidence)}%
                        </span>
                        {a.agent_name && (
                          <p className="text-[10px] text-slate-400">{a.agent_name}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Executive Agent Snapshots */}
            {hasAgents && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Executive Team
                  </h2>
                  <Link
                    href="/executive-agents"
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {agents.map((agent) => (
                    <AgentSnapshotCard key={agent.id} agent={agent} />
                  ))}
                </div>
              </section>
            )}

            {/* Risks & Alerts */}
            {(data?.risks_and_alerts?.length ?? 0) > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Risks & Alerts
                </h2>
                <div className="space-y-2">
                  {data!.risks_and_alerts.map((risk, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
                    >
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                      <div>
                        <p className="text-sm text-red-900">{risk.title}</p>
                        {risk.agent && (
                          <p className="text-xs text-red-600">
                            {risk.agent_emoji && <span className="mr-1">{risk.agent_emoji}</span>}
                            {risk.agent}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* What Changed */}
            {(data?.what_changed?.length ?? 0) > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  What Changed (24h)
                </h2>
                <div className="space-y-1.5">
                  {data!.what_changed.slice(0, 10).map((event, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded px-3 py-2 text-xs text-slate-600"
                    >
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 shrink-0">
                        {event.label}
                      </span>
                      <span className="flex-1 truncate">{event.message || "—"}</span>
                      {event.agent_name && (
                        <span className="text-slate-400 shrink-0">{event.agent_name}</span>
                      )}
                      <span className="text-slate-300 shrink-0">
                        {new Date(event.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Summary cards */}
            {hasAgents && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Link href="/approvals" className="rounded-xl border border-slate-200 bg-white p-4 text-center hover:border-slate-300 transition">
                  <p className="text-2xl font-bold text-slate-900">{data?.pending_approvals_count ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1">Pending Approvals</p>
                </Link>
                <Link href="/improvements" className="rounded-xl border border-slate-200 bg-white p-4 text-center hover:border-slate-300 transition">
                  <p className="text-2xl font-bold text-slate-900">{data?.active_improvements_count ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1">Active Improvements</p>
                </Link>
                <Link href="/executive-agents" className="rounded-xl border border-slate-200 bg-white p-4 text-center hover:border-slate-300 transition">
                  <p className="text-2xl font-bold text-slate-900">{agents.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Executive Agents</p>
                </Link>
                <Link href="/weekly-review" className="rounded-xl border border-slate-200 bg-white p-4 text-center hover:border-slate-300 transition">
                  <CalendarCheck className="mx-auto h-5 w-5 text-slate-400" />
                  <p className="text-xs text-slate-500 mt-1">Weekly Review</p>
                </Link>
              </div>
            )}

            {/* Clean state */}
            {hasAgents &&
              !data?.what_matters_now?.length &&
              !data?.waiting_on_michael?.length &&
              !data?.risks_and_alerts?.length &&
              !data?.what_changed?.length && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <Compass className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">
                    All clear. No pending items or alerts.
                  </p>
                </div>
              )}
          </div>
        )}
        <TaskComposer
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          onCreated={() => loadData()}
        />
      </SignedIn>
    </DashboardPageLayout>
  );
}

function MaybeLink({ href, children }: { href?: string | null; children: React.ReactNode }) {
  if (href) return <Link href={href}>{children}</Link>;
  return <>{children}</>;
}
