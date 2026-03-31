"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileCode, Filter, Folder, Plus, Search, X } from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { cn } from "@/lib/utils";
import { api, type InstalledSkill, type ExecutiveAgent } from "@/lib/executive-api";

type SkillMapping = { id: string; skill_path: string; relevance: string; agent_id: string; agent_display_name: string; agent_emoji: string | null };

export default function SkillsWorkbenchPage() {
  const [skills, setSkills] = useState<InstalledSkill[]>([]);
  const [mappings, setMappings] = useState<SkillMapping[]>([]);
  const [agents, setAgents] = useState<ExecutiveAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterOwnership, setFilterOwnership] = useState<string>("all");

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.skills.list().catch(() => []),
      api.agents.allSkillMappings().catch(() => []),
      api.agents.list().catch(() => []),
    ]).then(([s, m, a]) => {
      setSkills(s);
      setMappings(m);
      setAgents(a);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  // Build ownership map: skill_name → [{ agent, relevance, mapping_id }]
  const ownershipMap = new Map<string, Array<{ agent: ExecutiveAgent; relevance: string; mappingId: string }>>();
  for (const m of mappings) {
    const agent = agents.find((a) => a.id === m.agent_id);
    if (!agent) continue;
    const existing = ownershipMap.get(m.skill_path) || [];
    existing.push({ agent, relevance: m.relevance, mappingId: m.id });
    ownershipMap.set(m.skill_path, existing);
  }

  const filtered = skills.filter((s) => {
    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !(s.summary && s.summary.toLowerCase().includes(q))) return false;
    }
    // Agent filter
    if (filterAgent !== "all") {
      const owners = ownershipMap.get(s.name) || [];
      if (!owners.some((o) => o.agent.openclaw_agent_id === filterAgent)) return false;
    }
    // Ownership filter
    if (filterOwnership === "assigned") {
      if (!ownershipMap.has(s.name)) return false;
    } else if (filterOwnership === "unassigned") {
      if (ownershipMap.has(s.name)) return false;
    }
    return true;
  });

  // Stats
  const assignedCount = skills.filter((s) => ownershipMap.has(s.name)).length;
  const unassignedCount = skills.length - assignedCount;

  const handleAssign = async (skillName: string, agentId: string) => {
    try {
      await api.skillMappings.add(agentId, skillName);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleUnassign = async (agentId: string, mappingId: string) => {
    try {
      await api.skillMappings.remove(agentId, mappingId);
      loadData();
    } catch (e) { console.error(e); }
  };

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/agent/main" }}
      title="Skills Workbench"
      description="Manage capabilities across the agent bench"
    >
      <SignedOut>
        <div className="py-20 text-center text-slate-500">Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-4xl space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            </div>
          ) : (
            <>
              {/* Stats bar */}
              <div className="flex items-center gap-4 text-[12px]" style={{ color: "var(--text-muted)" }}>
                <span>{skills.length} skills</span>
                <span className="text-emerald-600">{assignedCount} assigned</span>
                <span className="text-amber-600">{unassignedCount} unassigned</span>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-quiet)" }} />
                  <input
                    className="w-full rounded-xl border py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
                    style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
                    placeholder="Search skills..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  className="rounded-xl border px-3 py-2 text-xs"
                  style={{ borderColor: "var(--border)", color: "var(--text)" }}
                  value={filterAgent}
                  onChange={(e) => setFilterAgent(e.target.value)}
                >
                  <option value="all">All agents</option>
                  {agents.filter((a) => a.agent_type === "primary").map((a) => (
                    <option key={a.openclaw_agent_id} value={a.openclaw_agent_id}>{a.avatar_emoji} {a.display_name}</option>
                  ))}
                  {agents.filter((a) => a.agent_type === "helper").map((a) => (
                    <option key={a.openclaw_agent_id} value={a.openclaw_agent_id}>↳ {a.display_name}</option>
                  ))}
                </select>
                <div className="flex gap-1 rounded-lg border p-0.5" style={{ borderColor: "var(--border)" }}>
                  {[
                    { key: "all", label: "All" },
                    { key: "assigned", label: "Assigned" },
                    { key: "unassigned", label: "Unassigned" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFilterOwnership(f.key)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-medium transition-fast",
                        filterOwnership === f.key
                          ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                          : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] ml-auto" style={{ color: "var(--text-quiet)" }}>
                  {filtered.length} shown
                </span>
              </div>

              {/* Skills list */}
              <div className="space-y-2">
                {filtered.map((skill) => {
                  const owners = ownershipMap.get(skill.name) || [];
                  return (
                    <div
                      key={skill.path}
                      className="flex items-center gap-3 rounded-xl border p-3 transition hover:shadow-sm"
                      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                    >
                      <FileCode className="h-4 w-4 shrink-0" style={{ color: "var(--text-quiet)" }} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/skills-editor/${skill.encoded_path}`} className="text-sm font-semibold hover:underline" style={{ color: "var(--text)" }}>
                          {skill.name}
                        </Link>
                        {skill.summary && (
                          <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{skill.summary}</p>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-[10px]" style={{ color: "var(--text-quiet)" }}>
                          <span><Folder className="inline h-3 w-3" /> {skill.source}</span>
                          {skill.last_modified && <span>Modified {new Date(skill.last_modified).toLocaleDateString()}</span>}
                          <span>{skill.file_count} files</span>
                        </div>
                      </div>

                      {/* Ownership pills */}
                      <div className="flex items-center gap-1 flex-wrap shrink-0">
                        {owners.map((o) => (
                          <button
                            key={o.mappingId}
                            onClick={() => handleUnassign(o.agent.id, o.mappingId)}
                            className={cn(
                              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-fast group",
                              o.relevance === "core"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                            )}
                            title={`${o.relevance} — click to remove`}
                          >
                            <span>{o.agent.avatar_emoji}</span>
                            <span>{o.agent.persona_name || o.agent.display_name}</span>
                            <X className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
                          </button>
                        ))}
                        {/* Assign dropdown */}
                        <AssignDropdown
                          agents={agents}
                          currentOwners={owners.map((o) => o.agent.id)}
                          onAssign={(agentId) => handleAssign(skill.name, agentId)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </SignedIn>
    </DashboardPageLayout>
  );
}

function AssignDropdown({ agents, currentOwners, onAssign }: {
  agents: ExecutiveAgent[];
  currentOwners: string[];
  onAssign: (agentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = agents.filter((a) => !currentOwners.includes(a.id));
  if (available.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] transition-fast hover:bg-[color:var(--surface-muted)]"
        style={{ borderColor: "var(--border)", color: "var(--text-quiet)" }}
        title="Assign to agent"
      >
        <Plus className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 w-48 rounded-xl border shadow-elevation-3 py-1" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {available.map((a) => (
            <button
              key={a.id}
              onClick={() => { onAssign(a.id); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-fast hover:bg-[color:var(--surface-muted)]"
              style={{ color: "var(--text)" }}
            >
              <span>{a.avatar_emoji}</span>
              <span>{a.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
