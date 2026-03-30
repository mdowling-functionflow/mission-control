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
  Plus,
  Send,
  Square,
  Users,
  X,
  XCircle,
} from "lucide-react";

import ReactMarkdown from "react-markdown";
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
  type AgentFileInfo,
  type ChatThreadItem,
  type CronJob,
  type InstalledSkill,
  type ThreadMessage,
  type DocumentItem,
  type ChatMessage,
} from "@/lib/executive-api";

type Tab = "chat" | "agent" | "skills" | "schedules" | "knowledge" | "improvements" | "approvals" | "review";

const BASE_TABS: Array<{ key: Tab; label: string; icon: typeof Activity }> = [
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "agent", label: "Agent", icon: Activity },
  { key: "skills", label: "Skills", icon: FileCode },
  { key: "schedules", label: "Schedules", icon: Clock },
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
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/agent/main" }} title="Workspace">
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        </div>
      </DashboardPageLayout>
    );
  }

  if (!agent) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/agent/main" }} title="Agent not found">
        <div className="py-20 text-center" style={{ color: "var(--text-muted)" }}>Agent not found.</div>
      </DashboardPageLayout>
    );
  }

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in", forceRedirectUrl: "/agent/main" }}
      title=""
      hideHeader
    >
      <SignedOut>
        <div className="py-20 text-center" style={{ color: "var(--text-muted)" }}>Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        <div className="flex flex-col h-[calc(100vh-64px)]">
          {/* Compact header bar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <span className="text-lg">{agent.avatar_emoji || "🤖"}</span>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{agent.display_name}</h2>
            <span className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium",
              agent.status === "active" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
              agent.status === "bound" && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
            )}>
              {agent.status}
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-quiet)" }}>{agent.executive_role}</span>
            {agent.current_focus && (
              <span className="text-[11px] truncate max-w-[200px]" style={{ color: "var(--text-muted)" }}>
                · {agent.current_focus}
              </span>
            )}
            <div className="ml-auto flex items-center gap-3 text-[11px] shrink-0" style={{ color: "var(--text-quiet)" }}>
              {agent.pending_approvals_count > 0 && (
                <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  {agent.pending_approvals_count} pending
                </span>
              )}
              <span>{agent.active_tasks_count} active</span>
            </div>
          </div>

          {/* Risk banner */}
          {agent.current_risk && (
            <div className="flex items-center gap-2 px-4 py-1.5 border-b text-xs shrink-0" style={{ borderColor: "var(--border)", background: "rgba(217,119,6,0.05)", color: "var(--warning)" }}>
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {agent.current_risk}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-0.5 px-4 border-b overflow-x-auto shrink-0" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            {[...BASE_TABS, ...(slug === "main" ? MARIO_EXTRA_TABS : [])].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-fast whitespace-nowrap",
                  activeTab === key
                    ? "border-[color:var(--accent)] text-[color:var(--accent)]"
                    : "border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]",
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content — fills remaining space */}
          <div className={cn("flex-1", activeTab === "chat" ? "overflow-hidden" : "overflow-y-auto p-4")}>
            {activeTab === "chat" && <ChatTab agent={agent} />}
            {activeTab === "agent" && <AgentTab agent={agent} slug={slug} />}
            {activeTab === "skills" && <SkillsTab agentId={agent.id} />}
            {activeTab === "schedules" && <SchedulesTab agentSlug={slug} />}
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
  const [threads, setThreads] = useState<ChatThreadItem[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load threads
  useEffect(() => {
    api.chatThreads.list(agent.id).then((t) => {
      setThreads(t);
      if (t.length > 0) setActiveThreadId(t[0].id);
    }).catch(console.error).finally(() => setLoading(false));
  }, [agent.id]);

  // Load messages when active thread changes
  useEffect(() => {
    if (!activeThreadId) return;
    api.chatThreads.messages(activeThreadId).then((msgs) => {
      setMessages(msgs);
      // Scroll to bottom on thread switch
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    }).catch(console.error);
    // Poll for new messages (agent responses) — but don't auto-scroll
    const iv = setInterval(() => {
      api.chatThreads.messages(activeThreadId).then(setMessages).catch(console.error);
    }, 8_000);
    return () => clearInterval(iv);
  }, [activeThreadId]);

  // Refresh thread list periodically
  useEffect(() => {
    const iv = setInterval(() => {
      api.chatThreads.list(agent.id).then(setThreads).catch(console.error);
    }, 30_000);
    return () => clearInterval(iv);
  }, [agent.id]);

  // Auto-resize textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    try {
      let threadId = activeThreadId;
      // Auto-create thread if none exists
      if (!threadId) {
        const thread = await api.chatThreads.create(agent.id);
        setThreads((prev) => [thread, ...prev]);
        setActiveThreadId(thread.id);
        threadId = thread.id;
      }
      const msg = await api.chatThreads.send(threadId, text);
      setMessages((prev) => [...prev, msg]);
      api.chatThreads.list(agent.id).then(setThreads).catch(console.error);
      // Scroll to bottom after sending
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch (e) {
      console.error(e);
      setInput(text);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleNewChat = async () => {
    try {
      const thread = await api.chatThreads.create(agent.id);
      setThreads((prev) => [thread, ...prev]);
      setActiveThreadId(thread.id);
      setMessages([]);
      textareaRef.current?.focus();
    } catch (e) { console.error(e); }
  };

  // Slash commands
  const SLASH_COMMANDS = [
    { cmd: "/help", desc: "Show available commands" },
    { cmd: "/status", desc: "Agent status" },
    { cmd: "/focus", desc: "Current focus" },
    { cmd: "/new", desc: "New conversation" },
  ];

  const showSlashMenu = input.startsWith("/") && !input.includes(" ");
  const filteredCmds = SLASH_COMMANDS.filter((c) => c.cmd.startsWith(input));

  const handleSlashCommand = (cmd: string) => {
    if (cmd === "/new") {
      handleNewChat();
      setInput("");
      return;
    }
    if (cmd === "/status") {
      setInput("");
      // Insert a synthetic agent status message
      const statusMsg: ThreadMessage = {
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
      const focusMsg: ThreadMessage = {
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
      const helpMsg: ThreadMessage = {
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

  // Relative time for thread list
  const relTime = (iso: string) => {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 60_000) return "now";
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
    return `${Math.floor(d / 86_400_000)}d`;
  };

  return (
    <div className="flex h-full">
      {/* ── Thread sidebar ── */}
      <div className="w-[220px] shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="p-3 pb-2">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs font-medium transition-fast"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <Plus className="h-3.5 w-3.5" /> New session
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {threads.map((t) => (
            <div
              key={t.id}
              className={cn(
                "group flex items-center rounded-lg mb-0.5 transition-fast",
                activeThreadId === t.id
                  ? "bg-[color:var(--surface-muted)]"
                  : "hover:bg-[color:var(--surface-muted)]",
              )}
            >
              <button
                onClick={() => setActiveThreadId(t.id)}
                className="flex-1 text-left px-3 py-2 text-[12px] min-w-0"
              >
                <p className="font-medium truncate" style={{ color: activeThreadId === t.id ? "var(--text)" : "var(--text-muted)" }}>
                  {t.title || "New session"}
                </p>
                <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-quiet)" }}>
                  {relTime(t.updated_at)}
                </p>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  api.chatThreads.update(t.id, { is_active: false }).then(() => {
                    setThreads((prev) => prev.filter((x) => x.id !== t.id));
                    if (activeThreadId === t.id) {
                      const remaining = threads.filter((x) => x.id !== t.id);
                      setActiveThreadId(remaining.length > 0 ? remaining[0].id : null);
                      setMessages([]);
                    }
                  }).catch(console.error);
                }}
                className="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 mr-1 rounded transition-fast hover:bg-red-50 dark:hover:bg-red-950/20"
                style={{ color: "var(--danger)" }}
                title="Delete conversation"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages — only this part scrolls */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-4 space-y-4">
            {loading ? <Spinner /> : !activeThreadId ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <MessageSquare className="h-10 w-10 mb-3" style={{ color: "var(--text-quiet)" }} />
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Start a conversation</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-quiet)" }}>Click "New session" or type below</p>
              </div>
            ) : messages.length === 0 ? (
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
              <div key={m.id}>
                {m.role === "system" ? (
                  <div className="text-center py-1">
                    <span className="text-[11px] italic" style={{ color: "var(--text-quiet)" }}>{m.content}</span>
                  </div>
                ) : m.role === "user" ? (
                  /* User message — indented, subtle emphasis */
                  <div className="ml-8 rounded-xl px-4 py-3 text-[13px] font-medium" style={{ background: "var(--surface-muted)", color: "var(--text)" }}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                ) : (
                  /* Agent response — clean text with markdown */
                  <div className="px-1 py-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-sm shrink-0">{agent.avatar_emoji || "🤖"}</span>
                      <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-[13px]" style={{ color: "var(--text)" }}>
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {/* Typing indicator + stop button */}
            {messages.length > 0 && messages[messages.length - 1].role === "user" && (
              <div className="flex items-center gap-3 px-1 py-2">
                <span className="text-sm">{agent.avatar_emoji || "🤖"}</span>
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--text-quiet)", animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--text-quiet)", animationDelay: "200ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--text-quiet)", animationDelay: "400ms" }} />
                </div>
                <button
                  onClick={() => {
                    setMessages((prev) => [...prev, {
                      id: `stop-${Date.now()}`,
                      role: "system",
                      content: "Generation stopped.",
                      created_at: new Date().toISOString(),
                    }]);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-fast hover:bg-[color:var(--surface-muted)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  <Square className="h-3 w-3" />
                  Stop
                </button>
              </div>
            )}
          </>
            )}
          </div>
        </div>

        {/* ── Input area — pinned to bottom, never moves ── */}
        <div className="shrink-0 border-t relative" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {/* Slash command menu — absolute positioned above input */}
          {showSlashMenu && filteredCmds.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mx-6 mb-1">
              <div className="rounded-xl border p-1 shadow-elevation-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
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
            </div>
          )}

          <div className="max-w-3xl mx-auto px-6 py-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                <textarea
                  ref={textareaRef}
                  className="w-full resize-none px-4 py-2.5 text-[13px] bg-transparent focus:outline-none"
                  style={{ color: "var(--text)", maxHeight: "200px" }}
                  rows={1}
                  placeholder={`Message ${agent.display_name}...`}
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
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="rounded-xl p-2.5 transition-fast disabled:opacity-20"
                style={{ color: "var(--accent)" }}
                title="Send (Enter)"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentTab({ agent, slug }: { agent: ExecutiveAgent; slug: string }) {
  const [files, setFiles] = useState<AgentFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    api.agentFiles.list(slug).then((f) => {
      setFiles(f);
      // Auto-select SOUL.md if it exists
      const soul = f.find((x) => x.name === "SOUL.md");
      if (soul) setSelectedFile(soul.name);
      else if (f.length > 0) setSelectedFile(f[0].name);
    }).catch(console.error).finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!selectedFile) return;
    api.agentFiles.get(slug, selectedFile).then((f) => {
      setFileContent(f.content);
      setOriginalContent(f.content);
    }).catch(console.error);
  }, [slug, selectedFile]);

  const handleSave = async () => {
    if (!selectedFile || fileContent === originalContent) return;
    setSaving(true);
    try {
      await api.agentFiles.write(slug, selectedFile, fileContent);
      setOriginalContent(fileContent);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const hasChanges = fileContent !== originalContent;
  const isMarkdown = selectedFile?.endsWith(".md");

  if (loading) return <Spinner />;
  if (files.length === 0) return <EmptyState text="No agent spec files found" />;

  // Separate spec files and memory files
  const specFiles = files.filter((f) => !f.is_memory);
  const memoryFiles = files.filter((f) => f.is_memory);

  return (
    <div className="space-y-3">
      {/* DB metadata (compact) */}
      <div className="flex gap-4 text-xs">
        <EditableField
          label="Mandate"
          value={agent.role_description || ""}
          onSave={async (val) => { await api.agents.update(agent.id, { role_description: val }); }}
          multiline
        />
        <EditableField
          label="Focus"
          value={agent.current_focus || ""}
          onSave={async (val) => { await api.agents.update(agent.id, { current_focus: val }); }}
        />
      </div>

      {/* File pills */}
      <div className="flex flex-wrap gap-1">
        {specFiles.map((f) => (
          <button
            key={f.name}
            onClick={() => { setSelectedFile(f.name); setShowPreview(false); }}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium transition-fast",
              selectedFile === f.name
                ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)]",
            )}
          >
            {f.name}
          </button>
        ))}
        {memoryFiles.length > 0 && (
          <>
            <span className="text-[10px] self-center px-1" style={{ color: "var(--text-quiet)" }}>|</span>
            {memoryFiles.map((f) => (
              <button
                key={f.name}
                onClick={() => { setSelectedFile(f.name); setShowPreview(false); }}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-fast",
                  selectedFile === f.name
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "text-[color:var(--text-quiet)] hover:bg-[color:var(--surface-muted)]",
                )}
              >
                {f.name.replace("memory/", "📝 ")}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Editor */}
      {selectedFile && (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {/* Trust indicator */}
          <div className="flex items-center gap-2 px-3 py-1 text-[10px] border-b" style={{ borderColor: "var(--border)", color: "var(--text-quiet)", background: "var(--surface-muted)" }}>
            <span>Source: ~/.openclaw/{slug === "main" ? "workspace" : `workspace-${slug}`}/{selectedFile}</span>
            <span className="rounded bg-emerald-100 dark:bg-emerald-900/30 px-1 py-0.5 text-[9px] font-medium text-emerald-700 dark:text-emerald-400">
              Live file
            </span>
            {files.find((f) => f.name === selectedFile)?.last_modified && (
              <span>Modified: {new Date(files.find((f) => f.name === selectedFile)!.last_modified!).toLocaleString()}</span>
            )}
          </div>
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b px-3 py-1.5" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium" style={{ color: "var(--text)" }}>{selectedFile}</span>
              {hasChanges && (
                <span className="rounded bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400">
                  Modified
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {isMarkdown && (
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="rounded px-2 py-0.5 text-[10px] transition-fast" style={{ color: "var(--text-muted)" }}
                >
                  {showPreview ? "Editor" : "Preview"}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="rounded bg-[color:var(--accent)] px-2.5 py-0.5 text-[10px] font-medium text-white disabled:opacity-30 transition-fast"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Content */}
          {showPreview && isMarkdown ? (
            <div className="p-4 prose prose-sm prose-slate dark:prose-invert max-w-none max-h-[500px] overflow-auto">
              <ReactMarkdown>{fileContent}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              className="w-full px-3 py-2 text-xs font-mono min-h-[400px] max-h-[600px] resize-y focus:outline-none"
              style={{ background: "var(--surface-muted)", color: "var(--text)" }}
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
            />
          )}
        </div>
      )}
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

function SchedulesTab({ agentSlug }: { agentSlug: string }) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.schedules.list().then((resp) => {
      const all = resp.jobs || [];
      const mine = all.filter((j) => j.agentId === agentSlug);
      setJobs(mine);
    }).catch(console.error).finally(() => setLoading(false));
  }, [agentSlug]);

  if (loading) return <Spinner />;
  if (jobs.length === 0) return <EmptyState text="No schedules for this agent" />;

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="flex items-center gap-3 rounded-xl border p-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)", opacity: job.enabled ? 1 : 0.5 }}
        >
          <Clock className="h-4 w-4 shrink-0" style={{ color: "var(--text-quiet)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{job.name}</p>
            {job.description && <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{job.description}</p>}
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-quiet)" }}>
              {job.schedule?.expr || job.schedule?.every || "No schedule"}
              {job.schedule?.tz ? ` (${job.schedule.tz})` : ""}
            </p>
          </div>
          <span className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            job.enabled ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-500",
          )}>
            {job.enabled ? "Active" : "Disabled"}
          </span>
        </div>
      ))}
      <Link href="/schedules" className="text-xs" style={{ color: "var(--accent)" }}>
        Manage all schedules →
      </Link>
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
