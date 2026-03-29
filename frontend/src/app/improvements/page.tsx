"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Lightbulb, Plus, X } from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { cn } from "@/lib/utils";
import { api, type Improvement, type ImprovementStats, type ExecutiveAgent } from "@/lib/executive-api";

const STATUS_TABS = ["all", "proposed", "reviewing", "testing", "adopted", "rejected"] as const;

const NEXT_STATUS: Record<string, string[]> = {
  proposed: ["reviewing"],
  reviewing: ["testing", "rejected"],
  testing: ["adopted", "rejected"],
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    proposed: "bg-blue-100 text-blue-800",
    reviewing: "bg-purple-100 text-purple-800",
    testing: "bg-amber-100 text-amber-800",
    adopted: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", colors[status] ?? "bg-slate-100 text-slate-600")}>
      {status}
    </span>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    urgent: "bg-red-500",
    high: "bg-amber-500",
    normal: "bg-blue-400",
    low: "bg-slate-300",
  };
  return <span className={cn("inline-block h-2 w-2 rounded-full", colors[priority] ?? "bg-slate-300")} />;
}

export default function ImprovementsPage() {
  const [improvements, setImprovements] = useState<Improvement[]>([]);
  const [stats, setStats] = useState<ImprovementStats | null>(null);
  const [agents, setAgents] = useState<ExecutiveAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);

  const loadData = (status?: string) => {
    setLoading(true);
    Promise.all([
      api.improvements.list(status === "all" ? undefined : status),
      api.improvements.stats(),
    ])
      .then(([items, s]) => {
        setImprovements(items);
        setStats(s);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    api.agents.list().then(setAgents).catch(console.error);
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    loadData(tab);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await api.improvements.update(id, { status: newStatus });
      loadData(activeTab);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (data: { title: string; description: string; rationale: string; category: string; priority: string; executive_agent_id?: string }) => {
    try {
      await api.improvements.create(data);
      setShowForm(false);
      loadData(activeTab);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/dashboard" }}
      title="Improvements"
      description="Agent-proposed workflow improvements"
      headerActions={
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showForm ? "Cancel" : "Propose"}
        </button>
      }
    >
      <SignedOut>
        <div className="py-20 text-center text-slate-500">Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Create form */}
          {showForm && <CreateForm agents={agents} onSubmit={handleCreate} />}

          {/* Stats bar */}
          {stats && stats.total > 0 && (
            <div className="flex gap-4 text-xs text-slate-500">
              <span>{stats.proposed} proposed</span>
              <span>{stats.reviewing} reviewing</span>
              <span>{stats.testing} testing</span>
              <span className="text-emerald-600">{stats.adopted} adopted</span>
              <span className="text-red-500">{stats.rejected} rejected</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className={cn(
                  "px-3 py-2 text-sm capitalize transition border-b-2",
                  activeTab === tab
                    ? "border-slate-900 text-slate-900 font-medium"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            </div>
          ) : improvements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <Lightbulb className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm text-slate-500">
                No improvements {activeTab !== "all" ? `with status "${activeTab}"` : "yet"}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {improvements.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start gap-3">
                    <PriorityDot priority={item.priority} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.agent_avatar_emoji && <span>{item.agent_avatar_emoji}</span>}
                        <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                        <StatusBadge status={item.status} />
                      </div>
                      {item.description && (
                        <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                      )}
                      {item.rationale && (
                        <p className="mt-1 text-xs text-slate-500 italic">Why: {item.rationale}</p>
                      )}
                      {item.resolution_note && (
                        <p className="mt-1 text-xs text-slate-500">Resolution: {item.resolution_note}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                        {item.agent_display_name && <span>{item.agent_display_name}</span>}
                        <span className="capitalize">{item.category}</span>
                        <span>{item.priority} priority</span>
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Status transition buttons */}
                    {NEXT_STATUS[item.status] && (
                      <div className="flex gap-1 shrink-0">
                        {NEXT_STATUS[item.status].map((next) => (
                          <button
                            key={next}
                            onClick={() => handleStatusChange(item.id, next)}
                            className={cn(
                              "rounded px-2 py-1 text-[10px] font-medium transition",
                              next === "rejected"
                                ? "border border-red-200 text-red-600 hover:bg-red-50"
                                : next === "adopted"
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                  : "border border-slate-200 text-slate-600 hover:bg-slate-50",
                            )}
                          >
                            {next === "reviewing" ? "Review" : next === "testing" ? "Test" : next === "adopted" ? "Adopt" : "Reject"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SignedIn>
    </DashboardPageLayout>
  );
}

function CreateForm({
  agents,
  onSubmit,
}: {
  agents: ExecutiveAgent[];
  onSubmit: (data: { title: string; description: string; rationale: string; category: string; priority: string; executive_agent_id?: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rationale, setRationale] = useState("");
  const [category, setCategory] = useState("process");
  const [priority, setPriority] = useState("normal");
  const [agentId, setAgentId] = useState("");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">Propose Improvement</h3>
      <input
        className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
        rows={2}
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <textarea
        className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
        rows={2}
        placeholder="Why does this matter?"
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
      />
      <div className="flex gap-3">
        <select className="rounded border border-slate-200 px-2 py-1.5 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="process">Process</option>
          <option value="tooling">Tooling</option>
          <option value="communication">Communication</option>
          <option value="automation">Automation</option>
        </select>
        <select className="rounded border border-slate-200 px-2 py-1.5 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <select className="rounded border border-slate-200 px-2 py-1.5 text-sm" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">No agent</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.avatar_emoji} {a.display_name}</option>
          ))}
        </select>
      </div>
      <button
        onClick={() => onSubmit({ title, description, rationale, category, priority, ...(agentId ? { executive_agent_id: agentId } : {}) })}
        disabled={!title.trim()}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        Submit
      </button>
    </div>
  );
}
