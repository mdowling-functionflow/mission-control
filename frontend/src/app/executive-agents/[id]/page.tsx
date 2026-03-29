"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lightbulb,
  Activity,
  XCircle,
} from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { cn } from "@/lib/utils";
import {
  api,
  type ExecutiveAgent,
  type AgentActivity,
  type AgentApproval,
  type AgentImprovement,
} from "@/lib/executive-api";

type Tab = "activity" | "approvals" | "improvements";

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<ExecutiveAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("activity");

  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [approvals, setApprovals] = useState<AgentApproval[]>([]);
  const [improvements, setImprovements] = useState<AgentImprovement[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    if (agentId) {
      api.agents.get(agentId).then(setAgent).catch(console.error).finally(() => setLoading(false));
    }
  }, [agentId]);

  useEffect(() => {
    if (!agentId) return;
    setTabLoading(true);
    if (activeTab === "activity") {
      api.agents.activity(agentId).then(setActivities).catch(console.error).finally(() => setTabLoading(false));
    } else if (activeTab === "approvals") {
      api.agents.approvals(agentId).then(setApprovals).catch(console.error).finally(() => setTabLoading(false));
    } else if (activeTab === "improvements") {
      api.agents.improvements(agentId).then(setImprovements).catch(console.error).finally(() => setTabLoading(false));
    }
  }, [agentId, activeTab]);

  if (loading) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/home" }} title="Agent">
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        </div>
      </DashboardPageLayout>
    );
  }

  if (!agent) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/home" }} title="Agent not found">
        <div className="py-20 text-center text-slate-500">Agent not found.</div>
      </DashboardPageLayout>
    );
  }

  const tabs: Array<{ key: Tab; label: string; icon: typeof Activity; count?: number }> = [
    { key: "activity", label: "Activity", icon: Activity },
    { key: "approvals", label: "Approvals", icon: CheckCircle2, count: agent.pending_approvals_count },
    { key: "improvements", label: "Improvements", icon: Lightbulb },
  ];

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/home" }}
      title={agent.display_name}
      description={agent.executive_role}
      headerActions={
        <Link href="/executive-agents" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      }
    >
      <SignedOut>
        <div className="py-20 text-center text-slate-500">Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-start gap-4">
              <span className="text-4xl">{agent.avatar_emoji || "🤖"}</span>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">{agent.display_name}</h2>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    agent.status === "active" && "bg-emerald-100 text-emerald-800",
                    agent.status === "bound" && "bg-blue-100 text-blue-800",
                    agent.status === "stale" && "bg-amber-100 text-amber-800",
                    agent.status === "error" && "bg-red-100 text-red-800",
                  )}>
                    {agent.status}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{agent.executive_role}</p>
                {agent.last_seen_at && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last seen {new Date(agent.last_seen_at).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-3 shrink-0">
                <div className="text-center">
                  <p className="text-xl font-bold text-slate-900">{agent.pending_approvals_count}</p>
                  <p className="text-[10px] text-slate-500">Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-slate-900">{agent.active_tasks_count}</p>
                  <p className="text-[10px] text-slate-500">Active</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mandate + Focus + Risk row */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Mandate</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {agent.role_description || "No mandate set."}
              </p>
            </div>
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Current Focus</h3>
                <p className="text-sm text-slate-700">
                  {agent.current_focus || "No current focus set."}
                </p>
              </div>
              {agent.current_risk && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-700">Risk</h3>
                  </div>
                  <p className="text-sm text-amber-900">{agent.current_risk}</p>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-200">
            <div className="flex gap-1">
              {tabs.map(({ key, label, icon: Icon, count }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-sm transition border-b-2",
                    activeTab === key
                      ? "border-slate-900 text-slate-900 font-medium"
                      : "border-transparent text-slate-500 hover:text-slate-700",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {count != null && count > 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="min-h-[200px]">
            {tabLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
              </div>
            ) : activeTab === "activity" ? (
              <ActivityTab items={activities} />
            ) : activeTab === "approvals" ? (
              <ApprovalsTab items={approvals} />
            ) : (
              <ImprovementsTab items={improvements} />
            )}
          </div>

          {/* OpenClaw binding */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">OpenClaw Binding</h3>
            <div className="space-y-1 text-sm text-slate-600">
              <p><span className="text-slate-400">Agent ID:</span> {agent.openclaw_agent_id}</p>
              {agent.openclaw_workspace && (
                <p><span className="text-slate-400">Workspace:</span> <code className="text-xs bg-slate-100 px-1 rounded">{agent.openclaw_workspace}</code></p>
              )}
            </div>
          </div>
        </div>
      </SignedIn>
    </DashboardPageLayout>
  );
}

function ActivityTab({ items }: { items: AgentActivity[] }) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No recent activity for this agent.
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {items.map((e) => (
        <div key={e.id} className="flex items-center gap-3 rounded px-3 py-2 text-xs text-slate-600">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 shrink-0">
            {e.event_type}
          </span>
          <span className="flex-1 truncate">{e.message || "—"}</span>
          <span className="text-slate-400 shrink-0">
            {new Date(e.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      ))}
    </div>
  );
}

function ApprovalsTab({ items }: { items: AgentApproval[] }) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No approvals for this agent.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((a) => (
        <div key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
          {a.status === "pending" ? (
            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
          ) : a.status === "approved" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-900">{a.action_type}</p>
            {a.rationale && <p className="text-xs text-slate-500 truncate">{a.rationale}</p>}
          </div>
          <div className="text-right shrink-0">
            <span className={cn(
              "text-xs font-medium",
              a.status === "pending" && "text-amber-600",
              a.status === "approved" && "text-emerald-600",
              a.status === "rejected" && "text-red-600",
            )}>
              {a.status}
            </span>
            <p className="text-[10px] text-slate-400">
              {new Date(a.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ImprovementsTab({ items }: { items: AgentImprovement[] }) {
  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No improvements proposed by this agent.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.id} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-slate-400 shrink-0" />
            <h4 className="text-sm font-medium text-slate-900 flex-1">{i.title}</h4>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              i.status === "proposed" && "bg-blue-100 text-blue-800",
              i.status === "adopted" && "bg-emerald-100 text-emerald-800",
              i.status === "rejected" && "bg-red-100 text-red-800",
              i.status === "reviewing" && "bg-purple-100 text-purple-800",
              i.status === "testing" && "bg-amber-100 text-amber-800",
            )}>
              {i.status}
            </span>
          </div>
          {i.description && (
            <p className="text-xs text-slate-600 mt-1 ml-6 line-clamp-2">{i.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
