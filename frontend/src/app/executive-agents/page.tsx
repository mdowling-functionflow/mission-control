"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Crown,
  Plus,
  Users,
  X,
} from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { cn } from "@/lib/utils";
import { api, type ExecutiveAgent } from "@/lib/executive-api";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    bound: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    stale: "bg-amber-100 text-amber-800",
    error: "bg-red-100 text-red-800",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", colors[status] ?? "bg-slate-100 text-slate-600")}>
      {status}
    </span>
  );
}

export default function ExecutiveAgentsPage() {
  const [agents, setAgents] = useState<ExecutiveAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadAgents = () => {
    api.agents.list().then(setAgents).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadAgents(); }, []);

  const primaryAgents = agents.filter((a) => a.agent_type === "primary" || !a.agent_type);
  const helperAgents = agents.filter((a) => a.agent_type === "helper");

  const handlePromote = async (agent: ExecutiveAgent) => {
    await api.agents.update(agent.id, { agent_type: "primary", parent_agent_id: null as any, sidebar_visible: true } as any);
    loadAgents();
  };

  const handleDemote = async (agent: ExecutiveAgent, parentId: string) => {
    await api.agents.update(agent.id, { agent_type: "helper", parent_agent_id: parentId, sidebar_visible: false } as any);
    loadAgents();
  };

  const handleToggleSidebar = async (agent: ExecutiveAgent) => {
    await api.agents.update(agent.id, { sidebar_visible: !agent.sidebar_visible } as any);
    loadAgents();
  };

  const handleCreate = async (data: {
    display_name: string; openclaw_agent_id: string; executive_role: string;
    avatar_emoji?: string; agent_type: string; parent_agent_id?: string;
  }) => {
    try {
      await api.agents.create(data);
      setShowCreate(false);
      loadAgents();
    } catch (e) { console.error(e); alert("Failed to create agent"); }
  };

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/agent/main" }}
      title="Agents"
      description="Manage your AI executive team"
      headerActions={
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 rounded-lg bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-fast"
        >
          {showCreate ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showCreate ? "Cancel" : "New Agent"}
        </button>
      }
    >
      <SignedOut>
        <div className="py-20 text-center" style={{ color: "var(--text-muted)" }}>Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Create form */}
          {showCreate && <CreateAgentForm primaryAgents={primaryAgents} onSubmit={handleCreate} />}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            </div>
          ) : (
            <>
              {/* Primary agents */}
              <section>
                <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: "var(--text-quiet)" }}>
                  <Crown className="h-3 w-3" /> Primary Agents ({primaryAgents.length})
                </h3>
                <div className="space-y-2">
                  {primaryAgents.map((agent) => {
                    const helpers = helperAgents.filter((h) => h.parent_agent_id === agent.id);
                    return (
                      <div key={agent.id}>
                        <AgentCard
                          agent={agent}
                          onToggleSidebar={() => handleToggleSidebar(agent)}
                        />
                        {helpers.length > 0 && (
                          <div className="ml-8 mt-1 space-y-1">
                            {helpers.map((h) => (
                              <AgentCard
                                key={h.id}
                                agent={h}
                                isHelper
                                onPromote={() => handlePromote(h)}
                                onToggleSidebar={() => handleToggleSidebar(h)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Unparented helpers */}
              {helperAgents.filter((h) => !h.parent_agent_id || !primaryAgents.find((p) => p.id === h.parent_agent_id)).length > 0 && (
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: "var(--text-quiet)" }}>
                    <Users className="h-3 w-3 inline mr-1" /> Helper Agents (unassigned)
                  </h3>
                  <div className="space-y-2">
                    {helperAgents.filter((h) => !h.parent_agent_id).map((agent) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        isHelper
                        onPromote={() => handlePromote(agent)}
                        onToggleSidebar={() => handleToggleSidebar(agent)}
                      />
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

function AgentCard({ agent, isHelper, onPromote, onToggleSidebar }: {
  agent: ExecutiveAgent;
  isHelper?: boolean;
  onPromote?: () => void;
  onToggleSidebar?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border p-4 transition-smooth",
        isHelper ? "border-dashed" : "",
      )}
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <span className="text-2xl">{agent.avatar_emoji || "🤖"}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/agent/${agent.openclaw_agent_id}`} className="text-sm font-semibold hover:underline" style={{ color: "var(--text)" }}>
            {agent.display_name}
          </Link>
          <StatusBadge status={agent.status} />
          <span className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            agent.agent_type === "primary"
              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
              : "bg-slate-100 text-slate-500",
          )}>
            {agent.agent_type || "primary"}
          </span>
          {agent.sidebar_visible && (
            <span className="text-[10px]" style={{ color: "var(--text-quiet)" }}>• sidebar</span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{agent.executive_role}</p>
        <div className="mt-1 flex items-center gap-3 text-[11px]" style={{ color: "var(--text-quiet)" }}>
          <span>{agent.openclaw_agent_id}</span>
          {agent.openclaw_workspace && <span className="truncate max-w-[200px]">{agent.openclaw_workspace}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {isHelper && onPromote && (
          <button
            onClick={onPromote}
            className="rounded px-2 py-1 text-[10px] font-medium transition-fast"
            style={{ color: "var(--accent)" }}
            title="Promote to primary"
          >
            ↑ Promote
          </button>
        )}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="rounded px-2 py-1 text-[10px] font-medium transition-fast"
            style={{ color: "var(--text-muted)" }}
            title={agent.sidebar_visible ? "Hide from sidebar" : "Show in sidebar"}
          >
            {agent.sidebar_visible ? "Hide" : "Show"}
          </button>
        )}
        <Link
          href={`/agent/${agent.openclaw_agent_id}`}
          className="rounded p-1.5 transition-fast hover:bg-[color:var(--surface-muted)]"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function CreateAgentForm({ primaryAgents, onSubmit }: {
  primaryAgents: ExecutiveAgent[];
  onSubmit: (data: any) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [role, setRole] = useState("");
  const [emoji, setEmoji] = useState("🤖");
  const [type, setType] = useState<"primary" | "helper">("helper");
  const [parentId, setParentId] = useState("");

  // Auto-generate slug from name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")) {
      setSlug(val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
    }
  };

  return (
    <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Create New Agent</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1" style={{ color: "var(--text-quiet)" }}>Display Name</label>
          <input className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text)" }}
            placeholder="Research Assistant" value={name} onChange={(e) => handleNameChange(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1" style={{ color: "var(--text-quiet)" }}>Agent ID (slug)</label>
          <input className="w-full rounded-lg border px-3 py-2 text-sm font-mono" style={{ borderColor: "var(--border)", color: "var(--text)" }}
            placeholder="research-assistant" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1" style={{ color: "var(--text-quiet)" }}>Role / Purpose</label>
          <input className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text)" }}
            placeholder="Research and analysis specialist" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1" style={{ color: "var(--text-quiet)" }}>Emoji</label>
          <input className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text)" }}
            placeholder="🤖" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1" style={{ color: "var(--text-quiet)" }}>Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => setType("primary")}
              className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-fast",
                type === "primary" ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]" : "text-[color:var(--text-muted)]"
              )} style={{ borderColor: type === "primary" ? undefined : "var(--border)" }}
            >
              <Crown className="h-3 w-3 inline mr-1" /> Primary
            </button>
            <button
              onClick={() => setType("helper")}
              className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-fast",
                type === "helper" ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]" : "text-[color:var(--text-muted)]"
              )} style={{ borderColor: type === "helper" ? undefined : "var(--border)" }}
            >
              <Users className="h-3 w-3 inline mr-1" /> Helper
            </button>
          </div>
        </div>
        {type === "helper" && (
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1" style={{ color: "var(--text-quiet)" }}>Parent Agent</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--text)" }}
              value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">Select parent...</option>
              {primaryAgents.map((a) => <option key={a.id} value={a.id}>{a.avatar_emoji} {a.display_name}</option>)}
            </select>
          </div>
        )}
      </div>

      <p className="text-[10px]" style={{ color: "var(--text-quiet)" }}>
        This will create a real OpenClaw agent at ~/.openclaw/workspace-{slug}/
      </p>

      <button
        onClick={() => onSubmit({
          display_name: name,
          openclaw_agent_id: slug,
          executive_role: role,
          avatar_emoji: emoji || "🤖",
          agent_type: type,
          ...(type === "helper" && parentId ? { parent_agent_id: parentId } : {}),
        })}
        disabled={!name.trim() || !slug.trim() || !role.trim() || (type === "helper" && !parentId)}
        className="rounded-lg bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
      >
        Create Agent
      </button>
    </div>
  );
}
