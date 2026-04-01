"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Lightbulb,
  Target,
  XCircle,
} from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { cn } from "@/lib/utils";
import { api, type ExecutiveAgent, type CronJob, type DailyItemRead } from "@/lib/executive-api";

export default function OverviewPage() {
  const [agents, setAgents] = useState<ExecutiveAgent[]>([]);
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [dailyItems, setDailyItems] = useState<DailyItemRead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.agents.list().catch(() => []),
      api.schedules.list().catch(() => ({ jobs: [] })),
      api.dailyItems.list().catch(() => []),
    ]).then(([a, s, d]) => {
      setAgents(a);
      setJobs(s.jobs || []);
      setDailyItems(d);
    }).finally(() => setLoading(false));
  }, []);

  const primaryAgents = agents.filter((a) => a.agent_type === "primary");
  const failingJobs = jobs.filter((j) => j.enabled && j.state?.lastStatus === "error");
  const pendingApprovals = agents.reduce((sum, a) => sum + a.pending_approvals_count, 0);
  const pendingItems = dailyItems.filter((i) => i.status === "pending");
  const highUrgency = pendingItems.filter((i) => i.urgency === "high");

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in", forceRedirectUrl: "/agent/main" }}
      title="Overview"
      description="What matters now across all lanes"
    >
      <SignedOut>
        <div className="py-20 text-center" style={{ color: "var(--text-muted)" }}>Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-5xl space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            </div>
          ) : (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-4 gap-3">
                <StatCard icon={Activity} label="Agents" value={`${primaryAgents.length} active`} color="text-emerald-600" />
                <StatCard
                  icon={AlertTriangle}
                  label="Failing Schedules"
                  value={failingJobs.length > 0 ? `${failingJobs.length} failing` : "All healthy"}
                  color={failingJobs.length > 0 ? "text-red-600" : "text-emerald-600"}
                />
                <StatCard
                  icon={Clock}
                  label="Pending Approvals"
                  value={pendingApprovals > 0 ? `${pendingApprovals} pending` : "None"}
                  color={pendingApprovals > 0 ? "text-amber-600" : "text-emerald-600"}
                />
                <StatCard
                  icon={Target}
                  label="Today's Items"
                  value={`${pendingItems.length} pending${highUrgency.length > 0 ? ` (${highUrgency.length} urgent)` : ""}`}
                  color={highUrgency.length > 0 ? "text-red-600" : "text-blue-600"}
                />
              </div>

              {/* Agent grid */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: "var(--text-quiet)" }}>
                  Workspaces
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {primaryAgents.map((agent) => {
                    const agentJobs = jobs.filter((j) => j.agentId === agent.openclaw_agent_id);
                    const agentFailing = agentJobs.filter((j) => j.state?.lastStatus === "error" && j.enabled);
                    const agentItems = dailyItems.filter((i) => i.executive_agent_id === agent.id && i.status === "pending");
                    return (
                      <Link
                        key={agent.id}
                        href={`/agent/${agent.openclaw_agent_id}`}
                        className="rounded-xl border p-4 transition-smooth hover:shadow-elevation-2"
                        style={{ borderColor: agentFailing.length > 0 ? "var(--danger)" : "var(--border)", background: "var(--surface)" }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{agent.avatar_emoji || "🤖"}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{agent.display_name}</p>
                            <p className="text-[11px]" style={{ color: "var(--text-quiet)" }}>{agent.executive_role}</p>
                          </div>
                          <span className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                            agent.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                          )}>
                            {agent.status}
                          </span>
                        </div>
                        {agent.goal && (
                          <p className="text-[11px] mb-2 flex items-center gap-1" style={{ color: "var(--text-quiet)" }}>
                            <Target className="h-3 w-3 shrink-0" /> {agent.goal}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-quiet)" }}>
                          {agent.current_focus && <span className="truncate" style={{ color: "var(--accent)" }}>Focus: {agent.current_focus}</span>}
                          {agentFailing.length > 0 && <span className="text-red-600">{agentFailing.length} failing</span>}
                          {agentItems.length > 0 && <span>{agentItems.length} items today</span>}
                          {agent.current_risk && <span className="text-amber-600">Risk: {agent.current_risk}</span>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>

              {/* Failing schedules */}
              {failingJobs.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 text-red-600">
                    Failing Schedules
                  </h3>
                  <div className="space-y-2">
                    {failingJobs.map((job) => (
                      <Link
                        key={job.id}
                        href="/schedules"
                        className="flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-800 p-3 transition-smooth hover:shadow-sm"
                        style={{ background: "var(--surface)" }}
                      >
                        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{job.name}</p>
                          {job.state?.lastError && (
                            <p className="text-[11px] text-red-600 dark:text-red-400 truncate">{job.state.lastError}</p>
                          )}
                        </div>
                        <span className="text-[10px] shrink-0" style={{ color: "var(--text-quiet)" }}>
                          {job.agentId || "system"}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </SignedIn>
    </DashboardPageLayout>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("h-4 w-4", color)} />
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-quiet)" }}>{label}</span>
      </div>
      <p className={cn("text-sm font-medium", color)}>{value}</p>
    </div>
  );
}
