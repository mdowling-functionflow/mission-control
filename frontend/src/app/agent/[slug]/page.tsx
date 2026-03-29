"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileCode,
  FileText,
  Lightbulb,
  ListTodo,
  MessageSquare,
  Send,
  Users,
  X,
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
  type ChatMessage,
} from "@/lib/executive-api";

type Tab = "chat" | "agent" | "skills" | "tasks" | "knowledge" | "improvements" | "approvals" | "review";

const BASE_TABS: Array<{ key: Tab; label: string; icon: typeof Activity }> = [
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "agent", label: "Agent", icon: Activity },
  { key: "skills", label: "Skills", icon: FileCode },
  { key: "tasks", label: "Tasks", icon: ListTodo },
  { key: "knowledge", label: "Knowledge", icon: FileText },
  { key: "improvements", label: "Improvements", icon: Lightbulb },
];

const MARIO_EXTRA_TABS: Array<{ key: Tab; label: string; icon: typeof Activity }> = [
  { key: "approvals", label: "Approvals", icon: CheckCircle2 },
  { key: "review", label: "Weekly Review", icon: CalendarCheck },
];

export default function AgentWorkspacePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [agent, setAgent] = useState<ExecutiveAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("chat");

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
          <div className="flex gap-1 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
            {[...BASE_TABS, ...(slug === "main" ? MARIO_EXTRA_TABS : [])].map(({ key, label, icon: Icon }) => (
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
          <div className="min-h-[300px]">
            {activeTab === "chat" && <ChatTab agent={agent} />}
            {activeTab === "agent" && <AgentTab agent={agent} />}
            {activeTab === "skills" && <SkillsTab agentId={agent.id} />}
            {activeTab === "tasks" && <TasksTab agentId={agent.id} />}
            {activeTab === "knowledge" && <KnowledgeTab agentId={agent.id} />}
            {activeTab === "improvements" && <ImprovementsTab agentId={agent.id} />}
            {activeTab === "approvals" && <ApprovalsTab />}
            {activeTab === "review" && <WeeklyReviewTab />}
          </div>
        </div>
      </SignedIn>
    </DashboardPageLayout>
  );
}

// ─── Tab Components ──────────────────────────────────────────────────

function ChatTab({ agent }: { agent: ExecutiveAgent }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [clearedAt, setClearedAt] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadMessages = () => {
    api.chat.messages(agent.id).then((all) => {
      // Only show messages after the clear timestamp
      const filtered = clearedAt ? all.filter((m) => m.created_at > clearedAt) : all;
      setMessages(filtered);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMessages();
    const iv = setInterval(loadMessages, 8_000);
    return () => clearInterval(iv);
  }, [agent.id, clearedAt]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    // Clear input immediately (before async)
    setInput("");
    setSending(true);
    // Keep clearedAt — only shows messages after clear point

    try {
      const msg = await api.chat.send(agent.id, text);
      setMessages((prev) => [...prev, msg]);
      // Refetch to pick up any system messages from dispatch
      setTimeout(loadMessages, 1000);
    } catch (e) {
      console.error(e);
      // Restore input on failure
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    setClearedAt(new Date().toISOString());
    setMessages([]);
  };

  // Slash commands
  const SLASH_COMMANDS = [
    { cmd: "/help", desc: "Show available commands" },
    { cmd: "/status", desc: "Agent status" },
    { cmd: "/focus", desc: "Current focus" },
    { cmd: "/clear", desc: "Clear chat" },
  ];

  const showSlashMenu = input.startsWith("/") && !input.includes(" ");
  const filteredCmds = SLASH_COMMANDS.filter((c) => c.cmd.startsWith(input));

  const handleSlashCommand = (cmd: string) => {
    if (cmd === "/clear") {
      handleClear();
      setInput("");
      return;
    }
    if (cmd === "/status") {
      setInput("");
      // Insert a synthetic agent status message
      const statusMsg: ChatMessage = {
        id: `status-${Date.now()}`,
        role: "agent",
        content: `**${agent.display_name}** (${agent.executive_role})\nStatus: ${agent.status}\nFocus: ${agent.current_focus || "Not set"}\nRisk: ${agent.current_risk || "None"}\nPending approvals: ${agent.pending_approvals_count}\nActive tasks: ${agent.active_tasks_count}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, statusMsg]);
      return;
    }
    if (cmd === "/focus") {
      setInput("");
      const focusMsg: ChatMessage = {
        id: `focus-${Date.now()}`,
        role: "agent",
        content: agent.current_focus || "No current focus set. You can set one from the Agent tab.",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, focusMsg]);
      return;
    }
    if (cmd === "/help") {
      setInput("");
      const helpMsg: ChatMessage = {
        id: `help-${Date.now()}`,
        role: "system",
        content: SLASH_COMMANDS.map((c) => `${c.cmd} — ${c.desc}`).join("\n"),
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, helpMsg]);
      return;
    }
    // Default: send as regular message
    setInput(cmd + " ");
  };

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 320px)", minHeight: "400px" }}>
      {/* Messages — scrollable */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-4">
        {loading ? <Spinner /> : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-8 w-8 mb-2" style={{ color: "var(--text-quiet)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Start a conversation with {agent.display_name}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-quiet)" }}>
              Type / for commands
            </p>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <div key={m.id} className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start",
              )}>
                {m.role === "system" ? (
                  <div className="w-full rounded-lg p-3" style={{ background: "var(--surface-muted)" }}>
                    <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-muted)" }}>{m.content}</p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 max-w-[85%]">
                    {m.role === "agent" && (
                      <span className="mt-1 text-lg shrink-0">{agent.avatar_emoji || "🤖"}</span>
                    )}
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm",
                        m.role === "user"
                          ? "rounded-br-md bg-[color:var(--accent)] text-white"
                          : "rounded-bl-md border",
                      )}
                      style={m.role !== "user" ? { borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" } : undefined}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                      <p className={cn("text-[10px] mt-1", m.role === "user" ? "text-white/60" : "")} style={m.role !== "user" ? { color: "var(--text-quiet)" } : undefined}>
                        {m.role === "agent" && <span className="font-medium mr-1">{agent.display_name}</span>}
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {/* Typing indicator */}
            {messages.length > 0 && messages[messages.length - 1].role === "user" && (
              <div className="flex items-center gap-2">
                <span className="text-lg">{agent.avatar_emoji || "🤖"}</span>
                <div className="rounded-2xl rounded-bl-md border px-4 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: "200ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: "400ms" }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Slash command menu */}
      {showSlashMenu && filteredCmds.length > 0 && (
        <div className="border rounded-xl p-1 mb-2 shadow-elevation-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {filteredCmds.map((c) => (
            <button
              key={c.cmd}
              onClick={() => handleSlashCommand(c.cmd)}
              className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-xs transition-fast hover:bg-[color:var(--surface-muted)]"
            >
              <span className="font-mono font-medium" style={{ color: "var(--accent)" }}>{c.cmd}</span>
              <span style={{ color: "var(--text-muted)" }}>{c.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input — fixed at bottom */}
      <div className="border-t pt-3 flex gap-2 shrink-0" style={{ borderColor: "var(--border)" }}>
        <input
          ref={inputRef}
          className="flex-1 rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
          style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--text)" }}
          placeholder={`Message ${agent.display_name}... (/ for commands)`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (showSlashMenu && filteredCmds.length > 0) {
                handleSlashCommand(filteredCmds[0].cmd);
              } else {
                handleSend();
              }
            }
          }}
          autoFocus
        />
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="rounded-xl p-2.5 transition-fast hover:bg-[color:var(--surface-muted)]"
            style={{ color: "var(--text-quiet)" }}
            title="Clear chat"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="rounded-xl p-2.5 bg-[color:var(--accent)] text-white disabled:opacity-30 transition-fast"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AgentTab({ agent }: { agent: ExecutiveAgent }) {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.agents.activity(agent.id).then(setActivities).catch(console.error).finally(() => setLoading(false));
  }, [agent.id]);

  return (
    <div className="space-y-6">
      <EditableField
        label="Mandate"
        value={agent.role_description || ""}
        onSave={async (val) => { await api.agents.update(agent.id, { role_description: val }); }}
        multiline
      />
      <EditableField
        label="Current Focus"
        value={agent.current_focus || ""}
        onSave={async (val) => { await api.agents.update(agent.id, { current_focus: val }); }}
      />
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

function SkillsTab({ agentId }: { agentId: string }) {
  const [skills, setSkills] = useState<InstalledSkill[]>([]);
  const [mappings, setMappings] = useState<Array<{ id: string; skill_path: string; relevance: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    Promise.all([
      api.skills.list().catch(() => []),
      api.skillMappings.list(agentId).catch(() => []),
    ]).then(([s, m]) => { setSkills(s); setMappings(m); }).finally(() => setLoading(false));
  }, [agentId]);

  if (loading) return <Spinner />;

  const mappedPaths = new Set(mappings.map((m) => m.skill_path));
  const coreSkills = skills.filter((s) => mappedPaths.has(s.encoded_path));
  const otherSkills = skills.filter((s) => !mappedPaths.has(s.encoded_path));

  const handleAdd = async (encodedPath: string) => {
    try {
      const m = await api.skillMappings.add(agentId, encodedPath);
      setMappings((prev) => [...prev, { ...m, skill_path: encodedPath, relevance: "core" }]);
    } catch (e) { console.error(e); }
  };

  const handleRemove = async (encodedPath: string) => {
    const mapping = mappings.find((m) => m.skill_path === encodedPath);
    if (!mapping) return;
    try {
      await api.skillMappings.remove(agentId, mapping.id);
      setMappings((prev) => prev.filter((m) => m.id !== mapping.id));
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-4">
      {/* Core skills */}
      {coreSkills.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-quiet)" }}>
            Core Skills ({coreSkills.length})
          </h4>
          <div className="space-y-1.5">
            {coreSkills.map((skill) => (
              <SkillRow key={skill.encoded_path} skill={skill} mapped onToggle={() => handleRemove(skill.encoded_path)} />
            ))}
          </div>
        </div>
      )}

      {coreSkills.length === 0 && (
        <div className="rounded-xl border border-dashed p-4 text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-quiet)" }}>
          No skills mapped to this agent yet. Add skills below.
        </div>
      )}

      {/* All skills */}
      <div>
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs font-medium transition-fast"
          style={{ color: "var(--accent)" }}
        >
          {showAll ? "Hide all skills" : `Show all ${otherSkills.length} available skills`}
        </button>
        {showAll && (
          <div className="mt-2 space-y-1.5">
            {otherSkills.map((skill) => (
              <SkillRow key={skill.encoded_path} skill={skill} mapped={false} onToggle={() => handleAdd(skill.encoded_path)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillRow({ skill, mapped, onToggle }: { skill: InstalledSkill; mapped: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <Link href={`/skills-editor/${skill.encoded_path}`} className="flex items-center gap-3 min-w-0 flex-1">
        <FileCode className="h-4 w-4 shrink-0" style={{ color: "var(--text-quiet)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{skill.name}</p>
          {skill.summary && <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{skill.summary}</p>}
        </div>
      </Link>
      <button
        onClick={(e) => { e.preventDefault(); onToggle(); }}
        className={cn(
          "rounded-lg px-2 py-1 text-[10px] font-medium transition-fast",
          mapped
            ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
            : "bg-[color:var(--accent-soft)] text-[color:var(--accent)] hover:opacity-80",
        )}
      >
        {mapped ? "Remove" : "Add"}
      </button>
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

function ApprovalsTab() {
  const [approvals, setApprovals] = useState<Array<{ id: string; action_type: string; status: string; confidence: number; agent_name: string | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.approvals.global("pending").then(setApprovals).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (approvals.length === 0) return <EmptyState text="No pending approvals. All clear." />;

  return (
    <div className="space-y-2">
      {approvals.map((a) => (
        <div key={a.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <Clock className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{a.action_type}</p>
            {a.agent_name && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{a.agent_name}</p>}
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-medium text-amber-600">{a.status}</span>
            <p className="text-[10px]" style={{ color: "var(--text-quiet)" }}>{Math.round(a.confidence)}%</p>
          </div>
        </div>
      ))}
      <Link href="/approvals" className="flex items-center gap-1 text-xs" style={{ color: "var(--accent)" }}>
        View all approvals <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function WeeklyReviewTab() {
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.weeklyReviews.current().then(setReview).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!review) return <EmptyState text="No weekly review yet." />;

  const sections = [
    { title: "Wins", items: review.wins },
    { title: "Key Risks", items: review.risks },
    { title: "Friction", items: review.friction_points },
    { title: "Next Week", items: review.next_week_priorities },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          Week of {new Date(review.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </h4>
        <span className={cn("text-xs font-medium", review.status === "finalized" ? "text-emerald-600" : "text-amber-600")}>
          {review.status}
        </span>
      </div>
      {sections.map(({ title, items }) => (
        <div key={title}>
          <h5 className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-quiet)" }}>{title}</h5>
          {items && items.length > 0 ? (
            <ul className="space-y-1">
              {items.map((item: any, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-slate-400 shrink-0" />
                  {item.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs italic" style={{ color: "var(--text-quiet)" }}>None yet</p>
          )}
        </div>
      ))}
      <Link href="/weekly-review" className="flex items-center gap-1 text-xs" style={{ color: "var(--accent)" }}>
        Full review <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function EditableField({ label, value, onSave, multiline }: {
  label: string;
  value: string;
  onSave: (val: string) => Promise<void>;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-quiet)" }}>{label}</h4>
        <button
          onClick={() => { if (editing) { setDraft(value); } setEditing(!editing); }}
          className="text-[11px] transition-fast"
          style={{ color: "var(--text-quiet)" }}
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
      {editing ? (
        <div className="space-y-2">
          {multiline ? (
            <textarea
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
              style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--text)" }}
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : (
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
              style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--text)" }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 transition-fast"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap" style={{ color: value ? "var(--text)" : "var(--text-quiet)" }}>
          {value || `No ${label.toLowerCase()} set. Click Edit to add one.`}
        </p>
      )}
    </div>
  );
}

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
