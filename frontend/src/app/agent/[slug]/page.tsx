"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCode,
  FileText,
  Lightbulb,
  ListTodo,
  MessageSquare,
  Users,
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
  type ComposedTask,
  type InstalledSkill,
  type DocumentItem,
} from "@/lib/executive-api";

type Tab = "agent" | "skills" | "tasks" | "knowledge" | "improvements";

const TABS: Array<{ key: Tab; label: string; icon: typeof Activity }> = [
  { key: "agent", label: "Agent", icon: Activity },
  { key: "skills", label: "Skills", icon: FileCode },
  { key: "tasks", label: "Tasks", icon: ListTodo },
  { key: "knowledge", label: "Knowledge", icon: FileText },
  { key: "improvements", label: "Improvements", icon: Lightbulb },
];

export default function AgentWorkspacePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [agent, setAgent] = useState<ExecutiveAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("agent");

  useEffect(() => {
    api.agents.list().then((agents) => {
      const match = agents.find((a) => a.openclaw_agent_id === slug);
      setAgent(match || null);
    }).catch(console.error).finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/home" }} title="Workspace">
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        </div>
      </DashboardPageLayout>
    );
  }

  if (!agent) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/home" }} title="Agent not found">
        <div className="py-20 text-center" style={{ color: "var(--text-muted)" }}>Agent not found.</div>
      </DashboardPageLayout>
    );
  }

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in", forceRedirectUrl: "/home" }}
      title={`${agent.avatar_emoji || ""} ${agent.display_name}`}
      description={agent.executive_role}
    >
      <SignedOut>
        <div className="py-20 text-center" style={{ color: "var(--text-muted)" }}>Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <div className="rounded-2xl border p-5 shadow-elevation-1" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="flex items-start gap-4">
              <span className="text-4xl">{agent.avatar_emoji || "🤖"}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>{agent.display_name}</h2>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    agent.status === "active" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
                    agent.status === "bound" && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                  )}>
                    {agent.status}
                  </span>
                </div>
                <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{agent.executive_role}</p>
                {agent.current_focus && <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{agent.current_focus}</p>}
              </div>
              <div className="flex gap-4 text-center shrink-0">
                <div>
                  <p className="text-lg font-bold" style={{ color: "var(--text)" }}>{agent.pending_approvals_count}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-quiet)" }}>Pending</p>
                </div>
                <div>
                  <p className="text-lg font-bold" style={{ color: "var(--text)" }}>{agent.active_tasks_count}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-quiet)" }}>Active</p>
                </div>
              </div>
            </div>
            {agent.current_risk && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 p-2.5 text-xs text-amber-800 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {agent.current_risk}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-fast",
                  activeTab === key
                    ? "border-[color:var(--accent)] text-[color:var(--accent)]"
                    : "border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="min-h-[200px]">
            {activeTab === "agent" && <AgentTab agent={agent} />}
            {activeTab === "skills" && <SkillsTab />}
            {activeTab === "tasks" && <TasksTab agentId={agent.id} />}
            {activeTab === "knowledge" && <KnowledgeTab agentId={agent.id} />}
            {activeTab === "improvements" && <ImprovementsTab agentId={agent.id} />}
          </div>
        </div>
      </SignedIn>
    </DashboardPageLayout>
  );
}

// ─── Tab Components ──────────────────────────────────────────────────

function AgentTab({ agent }: { agent: ExecutiveAgent }) {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.agents.activity(agent.id).then(setActivities).catch(console.error).finally(() => setLoading(false));
  }, [agent.id]);

  return (
    <div className="space-y-6">
      {agent.role_description && (
        <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h4 className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-quiet)" }}>Mandate</h4>
          <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text)" }}>{agent.role_description}</p>
        </div>
      )}
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-quiet)" }}>Recent Activity</h4>
        {loading ? <Spinner /> : activities.length === 0 ? <EmptyState text="No recent activity" /> : (
          <div className="space-y-1">
            {activities.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded px-3 py-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="rounded bg-[color:var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium shrink-0">{e.event_type}</span>
                <span className="flex-1 truncate">{e.message || "—"}</span>
                <span style={{ color: "var(--text-quiet)" }} className="shrink-0">
                  {new Date(e.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillsTab() {
  const [skills, setSkills] = useState<InstalledSkill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.skills.list().then(setSkills).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (skills.length === 0) return <EmptyState text="No skills found" />;

  return (
    <div className="space-y-2">
      {skills.slice(0, 20).map((skill) => (
        <Link
          key={skill.path}
          href={`/skills-editor/${skill.encoded_path}`}
          className="flex items-center gap-3 rounded-xl border p-3 transition-smooth hover:shadow-elevation-2"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <FileCode className="h-4 w-4 shrink-0" style={{ color: "var(--text-quiet)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{skill.name}</p>
            {skill.summary && <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{skill.summary}</p>}
          </div>
        </Link>
      ))}
      {skills.length > 20 && (
        <Link href="/skills-editor" className="text-xs" style={{ color: "var(--accent)" }}>
          View all {skills.length} skills
        </Link>
      )}
    </div>
  );
}

function TasksTab({ agentId }: { agentId: string }) {
  const [tasks, setTasks] = useState<ComposedTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.tasks.list().then((all) => {
      const mine = all.filter((t) => t.assignments.some((a) => a.executive_agent_id === agentId));
      setTasks(mine);
    }).catch(console.error).finally(() => setLoading(false));
  }, [agentId]);

  if (loading) return <Spinner />;
  if (tasks.length === 0) return <EmptyState text="No tasks assigned to this agent" />;

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <Link
          key={task.id}
          href={`/tasks/${task.id}`}
          className="flex items-center gap-3 rounded-xl border p-3 transition-smooth hover:shadow-elevation-2"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <ListTodo className="h-4 w-4 shrink-0" style={{ color: "var(--text-quiet)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{task.title}</p>
          </div>
          <span className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            task.status === "active" && "bg-blue-100 text-blue-700",
            task.status === "in_progress" && "bg-amber-100 text-amber-700",
            task.status === "completed" && "bg-emerald-100 text-emerald-700",
          )}>
            {task.status}
          </span>
        </Link>
      ))}
    </div>
  );
}

function KnowledgeTab({ agentId }: { agentId: string }) {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.documents.list(agentId).then(setDocs).catch(console.error).finally(() => setLoading(false));
  }, [agentId]);

  if (loading) return <Spinner />;
  if (docs.length === 0) return <EmptyState text="No documents from this agent yet" />;

  return (
    <div className="space-y-2">
      {docs.map((doc) => (
        <Link
          key={doc.id}
          href={`/docs/${doc.id}`}
          className="flex items-center gap-3 rounded-xl border p-3 transition-smooth hover:shadow-elevation-2"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--text-quiet)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{doc.title}</p>
            <p className="text-xs" style={{ color: "var(--text-quiet)" }}>{doc.doc_type}</p>
          </div>
          <span className="text-[10px]" style={{ color: "var(--text-quiet)" }}>
            {new Date(doc.updated_at).toLocaleDateString()}
          </span>
        </Link>
      ))}
    </div>
  );
}

function ImprovementsTab({ agentId }: { agentId: string }) {
  const [items, setItems] = useState<AgentImprovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.agents.improvements(agentId).then(setItems).catch(console.error).finally(() => setLoading(false));
  }, [agentId]);

  if (loading) return <Spinner />;
  if (items.length === 0) return <EmptyState text="No improvements proposed by this agent" />;

  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 shrink-0" style={{ color: "var(--text-quiet)" }} />
            <p className="text-sm font-medium flex-1" style={{ color: "var(--text)" }}>{i.title}</p>
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              i.status === "proposed" && "bg-blue-100 text-blue-700",
              i.status === "adopted" && "bg-emerald-100 text-emerald-700",
              i.status === "rejected" && "bg-red-100 text-red-700",
            )}>
              {i.status}
            </span>
          </div>
          {i.description && <p className="text-xs mt-1 ml-6" style={{ color: "var(--text-muted)" }}>{i.description}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-12 text-center text-sm" style={{ color: "var(--text-quiet)" }}>{text}</div>;
}
