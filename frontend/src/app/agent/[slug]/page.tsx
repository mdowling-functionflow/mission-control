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
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Download,
  FileCode,
  FileText,
  Filter,
  Lightbulb,
  ListTodo,
  MessageSquare,
  Paperclip,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Square,
  Upload,
  Users,
  X,
  XCircle,
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  type SkillDetail,
  type SkillFile,
  type ThreadMessage,
  type DocumentItem,
  type ChatMessage,
  type DailyItemRead,
} from "@/lib/executive-api";

type Tab = "chat" | "docs" | "agent" | "skills" | "schedules" | "improvements" | "approvals" | "review";

const BASE_TABS: Array<{ key: Tab; label: string; icon: typeof Activity }> = [
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "docs", label: "Docs", icon: FileText },
  { key: "agent", label: "Agent", icon: Activity },
  { key: "skills", label: "Skills", icon: FileCode },
  { key: "schedules", label: "Schedules", icon: Clock },
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
          <div className={cn("flex-1", ["chat", "docs", "skills"].includes(activeTab) ? "overflow-hidden" : "overflow-y-auto p-4")}>
            {activeTab === "chat" && <ChatTab agent={agent} />}
            {activeTab === "agent" && <AgentTab agent={agent} slug={slug} />}
            {activeTab === "skills" && <SkillsTab agentId={agent.id} agentSlug={slug} />}
            {activeTab === "schedules" && <SchedulesTab agentSlug={slug} />}
            {activeTab === "docs" && <DocsTab agentId={agent.id} agentSlug={slug} />}
            {activeTab === "improvements" && <ImprovementsTab agentId={agent.id} agent={agent} />}
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
  const [fastPoll, setFastPoll] = useState(false);
  const [stoppedGen, setStoppedGen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dailyItems, setDailyItems] = useState<DailyItemRead[]>([]);
  const [todayCollapsed, setTodayCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load daily items for today
  useEffect(() => {
    api.dailyItems.list(agent.id).then(setDailyItems).catch(() => {});
  }, [agent.id]);

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
    // Adaptive polling: 1s when waiting for response, 3s otherwise
    const iv = setInterval(() => {
      api.chatThreads.messages(activeThreadId).then((msgs) => {
        setMessages(msgs);
        // Auto-stop fast polling when agent responds
        if (fastPoll && msgs.length > 0 && msgs[msgs.length - 1].role !== "user") {
          setFastPoll(false);
        }
      }).catch(console.error);
    }, fastPoll ? 1_000 : 3_000);
    return () => clearInterval(iv);
  }, [activeThreadId, fastPoll]);

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
    if ((!text && !pendingFile) || sending) return;
    setInput("");
    const fileToUpload = pendingFile;
    setPendingFile(null);
    setSending(true);
    setStoppedGen(false);
    try {
      let threadId = activeThreadId;
      // Auto-create thread if none exists
      if (!threadId) {
        const thread = await api.chatThreads.create(agent.id);
        setThreads((prev) => [thread, ...prev]);
        setActiveThreadId(thread.id);
        threadId = thread.id;
      }
      // Upload file if attached
      if (fileToUpload) {
        const uploadMsg = await api.chatThreads.upload(threadId, fileToUpload, text || undefined);
        setMessages((prev) => [...prev, uploadMsg]);
      } else {
        const msg = await api.chatThreads.send(threadId, text);
        setMessages((prev) => [...prev, msg]);
      }
      // Start fast polling to pick up agent response quickly
      setFastPoll(true);
      setTimeout(() => setFastPoll(false), 30_000);
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
          {/* Today panel — proactive daily items */}
          {dailyItems.filter((i) => i.status === "pending").length > 0 && (
            <div className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="max-w-3xl mx-auto px-6 py-2">
                <button
                  onClick={() => setTodayCollapsed(!todayCollapsed)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  {todayCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>
                    Today
                  </span>
                  {agent.goal && (
                    <span className="text-[10px] truncate max-w-[200px]" style={{ color: "var(--text-quiet)" }}>
                      · {agent.goal}
                    </span>
                  )}
                  <span className="text-[10px] rounded-full px-1.5 py-0.5 font-medium" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                    {dailyItems.filter((i) => i.status === "pending").length}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      api.dailyItems.generate(agent.id).then(setDailyItems).catch(console.error);
                    }}
                    className="ml-auto p-1 rounded transition-fast hover:bg-[color:var(--surface-muted)]"
                    title="Refresh"
                  >
                    <RefreshCw className="h-3 w-3" style={{ color: "var(--text-quiet)" }} />
                  </button>
                </button>
                {!todayCollapsed && (
                  <div className="mt-2 space-y-1 pb-1">
                    {dailyItems.filter((i) => i.status === "pending").map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-fast hover:bg-[color:var(--surface-muted)]"
                      >
                        <span className="mt-0.5 shrink-0">
                          {item.urgency === "high" ? "🔴" : item.urgency === "medium" ? "🟡" : "🟢"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium" style={{ color: "var(--text)" }}>{item.title}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-quiet)" }}>{item.description}</p>
                        </div>
                        <button
                          onClick={() => {
                            api.dailyItems.update(item.id, { status: "done" }).then(() => {
                              setDailyItems((prev) => prev.map((i) => i.id === item.id ? { ...i, status: "done" } : i));
                            });
                          }}
                          className="shrink-0 p-1 rounded transition-fast hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                          title="Mark done"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--text-quiet)" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
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
                    {m.attachment_name && (
                      <div className="flex items-center gap-1.5 mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        <Paperclip className="h-3 w-3" />
                        <span>{m.attachment_name}</span>
                        {m.attachment_size && <span>({(m.attachment_size / 1024).toFixed(0)}KB)</span>}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Agent response — clean text with markdown */
                  <div className="group/msg px-1 py-2">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-sm shrink-0">{agent.avatar_emoji || "🤖"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="prose prose-sm prose-slate dark:prose-invert max-w-none [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>h1]:mt-4 [&>h1]:mb-2 [&>h2]:mt-3 [&>h2]:mb-1 [&>h3]:mt-2 [&>h3]:mb-1 [&_li]:my-0.5" style={{ color: "var(--text)", fontSize: "13px" }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                        {/* Save to Docs — visible on hover */}
                        {m.content.length > 100 && (
                          <button
                            onClick={() => {
                              const title = m.content.split("\n")[0].replace(/^[#*\-\s]+/, "").slice(0, 80) || "Untitled";
                              api.documents.create({
                                title,
                                content: m.content,
                                doc_type: "markdown",
                                source_agent_id: agent.id,
                              }).then(() => {
                                setMessages((prev) => [...prev, {
                                  id: `doc-saved-${Date.now()}`,
                                  role: "system",
                                  content: `📄 Saved to Docs: "${title}"`,
                                  created_at: new Date().toISOString(),
                                }]);
                              }).catch(console.error);
                            }}
                            className="opacity-0 group-hover/msg:opacity-100 mt-1 flex items-center gap-1 text-[11px] transition-fast hover:underline"
                            style={{ color: "var(--text-quiet)" }}
                          >
                            <Save className="h-3 w-3" />
                            Save to Docs
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {/* Typing indicator + stop button */}
            {!stoppedGen && messages.length > 0 && messages[messages.length - 1].role === "user" && (
              <div className="flex items-center gap-3 px-1 py-2">
                <span className="text-sm">{agent.avatar_emoji || "🤖"}</span>
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--text-quiet)", animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--text-quiet)", animationDelay: "200ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--text-quiet)", animationDelay: "400ms" }} />
                </div>
                <button
                  onClick={() => {
                    setStoppedGen(true);
                    setFastPoll(false);
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
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setPendingFile(f);
                e.target.value = "";
              }}
            />
            {/* Claude-style: single rounded box with textarea + toolbar inside */}
            <div className="rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
              {/* File attachment chip — inside the box */}
              {pendingFile && (
                <div className="flex items-center gap-2 px-4 pt-3">
                  <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px]" style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}>
                    <Paperclip className="h-3 w-3" style={{ color: "var(--text-quiet)" }} />
                    <span className="truncate max-w-[200px]" style={{ color: "var(--text)" }}>{pendingFile.name}</span>
                    <span style={{ color: "var(--text-quiet)" }}>({(pendingFile.size / 1024).toFixed(0)}KB)</span>
                    <button onClick={() => setPendingFile(null)} className="ml-1" style={{ color: "var(--text-quiet)" }}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
              {/* Textarea */}
              <textarea
                ref={textareaRef}
                className="w-full resize-none px-4 pt-3 pb-1 text-[13px] bg-transparent focus:outline-none"
                style={{ color: "var(--text)", maxHeight: "200px" }}
                rows={1}
                placeholder={`Message ${agent.persona_name || agent.display_name}...`}
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
              {/* Bottom toolbar — inside the box */}
              <div className="flex items-center justify-between px-3 pb-2 pt-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg p-1.5 transition-fast hover:bg-[color:var(--surface-muted)]"
                  style={{ color: "var(--text-quiet)" }}
                  title="Attach file"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  onClick={handleSend}
                  disabled={(!input.trim() && !pendingFile) || sending}
                  className={cn(
                    "rounded-lg p-1.5 transition-fast",
                    (input.trim() || pendingFile) && !sending
                      ? "bg-[color:var(--accent)] text-white"
                      : "text-[color:var(--text-quiet)] opacity-30",
                  )}
                  title="Send (Enter)"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
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
  if (files.length === 0) return (
    <div className="py-12 text-center">
      <FileCode className="mx-auto h-8 w-8 mb-2" style={{ color: "var(--text-quiet)" }} />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>No agent spec files found</p>
      <p className="text-xs mt-1" style={{ color: "var(--text-quiet)" }}>Check that the agent workspace exists at ~/.openclaw/</p>
    </div>
  );

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

      {/* Goal */}
      {agent.goal && (
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-quiet)" }}>Goal</span>
          </div>
          <p className="text-[13px]" style={{ color: "var(--text)" }}>{agent.goal}</p>
        </div>
      )}

      {/* Helper agents — only for primary agents */}
      {agent.agent_type === "primary" && <HelperAgentsSection parentAgentId={agent.id} />}
    </div>
  );
}

function HelperAgentsSection({ parentAgentId }: { parentAgentId: string }) {
  const [helpers, setHelpers] = useState<ExecutiveAgent[]>([]);
  useEffect(() => {
    api.agents.list({ agent_type: "helper", parent_agent_id: parentAgentId }).then(setHelpers).catch(() => {});
  }, [parentAgentId]);

  if (helpers.length === 0) return null;
  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-quiet)" }}>Helper Agents</p>
      <div className="space-y-1.5">
        {helpers.map((h) => (
          <Link
            key={h.id}
            href={`/agent/${h.openclaw_agent_id}`}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-fast hover:bg-[color:var(--surface-muted)]"
          >
            <span className="text-sm">{h.avatar_emoji || "🤖"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium" style={{ color: "var(--text)" }}>{h.display_name}</p>
              <p className="text-[10px]" style={{ color: "var(--text-quiet)" }}>{h.executive_role}</p>
            </div>
            <span className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium",
              h.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500",
            )}>
              {h.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SkillsTab({ agentId, agentSlug }: { agentId: string; agentSlug: string }) {
  const [skills, setSkills] = useState<InstalledSkill[]>([]);
  const [mappings, setMappings] = useState<Array<{ id: string; skill_path: string; relevance: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string>("SKILL.md");
  const [showPreview, setShowPreview] = useState(true);
  const [changeRequest, setChangeRequest] = useState("");
  const [proposing, setProposing] = useState(false);
  const [showAvailable, setShowAvailable] = useState(false);

  useEffect(() => {
    Promise.all([
      api.skills.list().catch(() => []),
      api.skillMappings.list(agentId).catch(() => []),
    ]).then(([s, m]) => {
      setSkills(s);
      setMappings(m);
      // Auto-select first core skill
      const mappedPaths = new Set(m.map((x: any) => x.skill_path));
      const first = s.find((sk: InstalledSkill) => mappedPaths.has(sk.encoded_path));
      if (first) setSelectedPath(first.encoded_path);
    }).finally(() => setLoading(false));
  }, [agentId]);

  // Load skill detail when selected
  useEffect(() => {
    if (!selectedPath) { setSelectedSkill(null); return; }
    api.skills.get(selectedPath).then((s) => {
      setSelectedSkill(s);
      setActiveFile(s.files?.[0]?.name || "SKILL.md");
    }).catch(console.error);
  }, [selectedPath]);

  const mappedPaths = new Set(mappings.map((m) => m.skill_path));
  const coreSkills = skills.filter((s) => mappedPaths.has(s.encoded_path));
  const otherSkills = skills.filter((s) => !mappedPaths.has(s.encoded_path));
  const filteredOther = search.trim()
    ? otherSkills.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : otherSkills;

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

  const handlePropose = async () => {
    if (!changeRequest.trim() || !selectedPath) return;
    setProposing(true);
    try {
      await api.skills.proposeChange(selectedPath, changeRequest);
      setChangeRequest("");
    } catch (e) { console.error(e); }
    finally { setProposing(false); }
  };

  const activeFileContent = selectedSkill?.files?.find((f) => f.name === activeFile);
  const isMarkdown = activeFile.endsWith(".md");

  return (
    <div className="flex h-full">
      {/* ── Sidebar ── */}
      <div className="w-[220px] shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        {/* Search */}
        <div className="p-3 pb-1">
          <input
            className="w-full rounded-lg border px-2.5 py-1.5 text-[11px] focus:outline-none"
            style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text)" }}
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {loading ? <div className="py-4 text-center"><Spinner /></div> : (
            <>
              {/* Core skills */}
              <p className="px-2 pt-2 pb-1 text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--text-quiet)" }}>
                Core ({coreSkills.length})
              </p>
              {coreSkills.map((s) => (
                <div
                  key={s.encoded_path}
                  className={cn(
                    "group flex items-center rounded-lg mb-0.5 transition-fast",
                    selectedPath === s.encoded_path ? "bg-[color:var(--surface-muted)]" : "hover:bg-[color:var(--surface-muted)]",
                  )}
                >
                  <button onClick={() => setSelectedPath(s.encoded_path)} className="flex-1 text-left px-2.5 py-1.5 text-[12px] min-w-0">
                    <p className="font-medium truncate" style={{ color: selectedPath === s.encoded_path ? "var(--text)" : "var(--text-muted)" }}>{s.name}</p>
                  </button>
                  <button
                    onClick={() => handleRemove(s.encoded_path)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-1 mr-1 rounded text-[9px] font-medium transition-fast"
                    style={{ color: "var(--danger)" }}
                    title="Remove from agent"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Available skills */}
              <button
                onClick={() => setShowAvailable(!showAvailable)}
                className="flex items-center gap-1 px-2 pt-3 pb-1 text-[9px] font-bold uppercase tracking-[0.15em]"
                style={{ color: "var(--text-quiet)" }}
              >
                {showAvailable ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Available ({filteredOther.length})
              </button>
              {showAvailable && filteredOther.map((s) => (
                <div
                  key={s.encoded_path}
                  className={cn(
                    "group flex items-center rounded-lg mb-0.5 transition-fast",
                    selectedPath === s.encoded_path ? "bg-[color:var(--surface-muted)]" : "hover:bg-[color:var(--surface-muted)]",
                  )}
                >
                  <button onClick={() => setSelectedPath(s.encoded_path)} className="flex-1 text-left px-2.5 py-1.5 text-[12px] min-w-0">
                    <p className="truncate" style={{ color: "var(--text-quiet)" }}>{s.name}</p>
                  </button>
                  <button
                    onClick={() => handleAdd(s.encoded_path)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-1 mr-1 rounded text-[9px] font-medium transition-fast"
                    style={{ color: "var(--accent)" }}
                    title="Add to agent"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Main pane ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto">
          {!selectedSkill ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <FileCode className="h-10 w-10 mb-3" style={{ color: "var(--text-quiet)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Select a skill</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-quiet)" }}>Choose from the sidebar to preview</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-4">
              {/* Skill header */}
              <div className="mb-4">
                <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{selectedSkill.name}</h3>
                {selectedSkill.summary && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{selectedSkill.summary}</p>}
                <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: "var(--text-quiet)" }}>
                  <span>{selectedSkill.source}</span>
                  <span>{selectedSkill.files?.length || 0} files</span>
                  <Link href={`/skills-editor/${selectedSkill.encoded_path}?from=agent/${agentSlug}`} className="ml-auto" style={{ color: "var(--accent)" }}>
                    Full editor →
                  </Link>
                </div>
              </div>
              {/* File tabs */}
              {selectedSkill.files && selectedSkill.files.length > 0 && (
                <div className="flex gap-1 mb-3 flex-wrap">
                  {selectedSkill.files.map((f) => (
                    <button
                      key={f.name}
                      onClick={() => { setActiveFile(f.name); setShowPreview(f.name.endsWith(".md")); }}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-medium transition-fast",
                        activeFile === f.name
                          ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                          : "text-[color:var(--text-quiet)] hover:text-[color:var(--text)]",
                      )}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
              {/* File content */}
              {activeFileContent && (
                isMarkdown && showPreview ? (
                  <div className="prose prose-sm prose-slate dark:prose-invert max-w-none [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2" style={{ color: "var(--text)", fontSize: "13px" }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeFileContent.content}</ReactMarkdown>
                  </div>
                ) : (
                  <pre className="text-xs font-mono whitespace-pre-wrap rounded-lg border p-3 max-h-[500px] overflow-auto" style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--text)" }}>
                    {activeFileContent.content}
                  </pre>
                )
              )}
            </div>
          )}
        </div>

        {/* Action input — pinned bottom */}
        {selectedSkill && (
          <div className="shrink-0 border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="max-w-3xl mx-auto px-6 py-3">
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                <textarea
                  className="w-full resize-none px-4 py-2.5 text-[13px] bg-transparent focus:outline-none"
                  style={{ color: "var(--text)", maxHeight: "120px" }}
                  rows={2}
                  placeholder="Describe a change to this skill..."
                  value={changeRequest}
                  onChange={(e) => setChangeRequest(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && changeRequest.trim()) { e.preventDefault(); handlePropose(); } }}
                />
                <div className="flex items-center justify-between px-3 pb-2">
                  <Link
                    href={`/skills-editor/${selectedSkill.encoded_path}?from=agent/${agentSlug}`}
                    className="text-[10px]"
                    style={{ color: "var(--text-quiet)" }}
                  >
                    Edit directly →
                  </Link>
                  <button
                    onClick={handlePropose}
                    disabled={!changeRequest.trim() || proposing}
                    className="rounded-lg bg-[color:var(--accent)] px-3 py-1 text-[11px] font-medium text-white disabled:opacity-30"
                  >
                    {proposing ? "Proposing..." : "Propose Change"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SchedulesTab({ agentSlug }: { agentSlug: string }) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.schedules.list().then((resp) => {
      const all = resp.jobs || [];
      const mine = all.filter((j: any) => j.agentId === agentSlug);
      setJobs(mine);
    }).catch(console.error).finally(() => setLoading(false));
  }, [agentSlug]);

  const loadJobs = () => {
    api.schedules.list().then((resp) => {
      const all = resp.jobs || [];
      setJobs(all.filter((j: any) => j.agentId === agentSlug));
    }).catch(console.error).finally(() => setLoading(false));
  };

  if (loading) return <Spinner />;
  if (jobs.length === 0) return (
    <div className="py-12 text-center">
      <Clock className="mx-auto h-8 w-8 mb-2" style={{ color: "var(--text-quiet)" }} />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>No schedules for this agent</p>
      <Link href="/schedules" className="text-xs mt-2 inline-block" style={{ color: "var(--accent)" }}>
        Create one in Schedules →
      </Link>
    </div>
  );

  const relTime = (ms: number) => {
    if (!ms) return "";
    const d = Date.now() - ms;
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
    return `${Math.floor(d / 86_400_000)}d ago`;
  };

  return (
    <div className="space-y-2">
      {jobs.map((job: any) => {
        const state = job.state || {};
        const lastStatus = state.lastStatus;
        const lastRunMs = state.lastRunAtMs;
        const errors = state.consecutiveErrors || 0;
        return (
          <div
            key={job.id}
            className="flex items-center gap-3 rounded-xl border p-3"
            style={{ borderColor: errors > 0 ? "var(--danger)" : "var(--border)", background: "var(--surface)", opacity: job.enabled ? 1 : 0.5 }}
          >
            {/* Health indicator */}
            <span className="shrink-0">
              {!lastStatus ? (
                <Circle className="h-3 w-3" style={{ color: "var(--text-quiet)" }} />
              ) : lastStatus === "ok" || lastStatus === "success" ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{job.name}</p>
              {job.description && <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{job.description}</p>}
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px]" style={{ color: "var(--text-quiet)" }}>
                  {job.schedule?.expr || job.schedule?.every || "No schedule"}
                </span>
                {lastRunMs > 0 && (
                  <span className="text-[10px]" style={{ color: "var(--text-quiet)" }}>
                    · ran {relTime(lastRunMs)}
                  </span>
                )}
                {errors > 0 && (
                  <span className="text-[10px] rounded px-1 font-medium bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {errors} error{errors > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {state.lastError && (
                <p className="text-[10px] mt-0.5 text-red-600 dark:text-red-400 truncate">{state.lastError}</p>
              )}
            </div>
            {/* Inline actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  (job.enabled ? api.schedules.disable(job.id) : api.schedules.enable(job.id)).then(loadJobs).catch(console.error);
                }}
                className="rounded p-1.5 transition-fast hover:bg-[color:var(--surface-muted)]"
                style={{ color: "var(--text-muted)" }}
                title={job.enabled ? "Disable" : "Enable"}
              >
                {job.enabled ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </button>
              <button
                onClick={() => { api.schedules.run(job.id).then(loadJobs).catch(console.error); }}
                className="rounded p-1.5 transition-fast hover:bg-[color:var(--surface-muted)]"
                style={{ color: "var(--accent)" }}
                title="Run now"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      })}
      <Link href="/schedules" className="text-xs" style={{ color: "var(--accent)" }}>
        Manage all schedules →
      </Link>
    </div>
  );
}

type DocFilter = "all" | "generated" | "uploaded";
const DOC_FILTERS: Array<{ key: DocFilter; label: string }> = [
  { key: "generated", label: "Generated" },
  { key: "uploaded", label: "Uploaded" },
  { key: "all", label: "All" },
];

function DocsTab({ agentId, agentSlug }: { agentId: string; agentSlug: string }) {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DocFilter>("all");
  const [search, setSearch] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const loadDocs = () => {
    api.documents.list(agentId).then((d) => {
      setDocs(d);
      if (!selectedDocId && d.length > 0) setSelectedDocId(d[0].id);
    }).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { loadDocs(); }, [agentId]);

  // Load selected doc detail
  useEffect(() => {
    if (!selectedDocId) { setSelectedDoc(null); return; }
    api.documents.get(selectedDocId).then((d) => {
      setSelectedDoc(d);
      setEditContent(d.content || "");
    }).catch(console.error);
  }, [selectedDocId]);

  const filtered = docs.filter((d) => {
    if (filter === "uploaded") return d.doc_type === "uploaded" || (d.file_path && d.doc_type !== "markdown");
    if (filter === "generated") return d.doc_type !== "uploaded";
    return true;
  }).filter((d) => !search.trim() || d.title.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const doc = await api.documents.create({ title: newTitle.trim(), doc_type: "markdown", source_agent_id: agentId });
      setNewTitle("");
      loadDocs();
      setSelectedDocId(doc.id);
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    if (!selectedDoc) return;
    setSaving(true);
    try {
      await api.documents.update(selectedDoc.id, { content: editContent });
      setSelectedDoc({ ...selectedDoc, content: editContent });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (docId: string) => {
    try {
      await api.documents.delete(docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      if (selectedDocId === docId) {
        const remaining = docs.filter((d) => d.id !== docId);
        setSelectedDocId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (e) { console.error(e); }
  };

  const relTime = (iso: string) => {
    const d = Date.now() - new Date(iso).getTime();
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
    if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
    return `${Math.floor(d / 86_400_000)}d`;
  };

  const docIcon = (doc: DocumentItem) => {
    if (doc.doc_type === "uploaded" || doc.file_path) return "📎";
    if (doc.doc_type === "slide") return "📊";
    if (doc.doc_type === "report" || doc.doc_type === "brief") return "📋";
    return "📄";
  };

  const downloadUrl = selectedDoc ? api.documents.downloadUrl(selectedDoc.id) : "";
  const isMarkdown = selectedDoc && !selectedDoc.file_path && selectedDoc.content !== null;
  const hasChanged = selectedDoc && editContent !== (selectedDoc.content || "");

  return (
    <div className="flex h-full">
      {/* ── Sidebar ── */}
      <div className="w-[220px] shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        {/* New doc + search */}
        <div className="p-3 pb-1 space-y-2">
          <div className="flex gap-1">
            <input
              className="flex-1 rounded-lg border px-2.5 py-1.5 text-[11px] focus:outline-none min-w-0"
              style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text)" }}
              placeholder={newTitle ? "Title..." : "Search..."}
              value={newTitle || search}
              onChange={(e) => newTitle ? setNewTitle(e.target.value) : setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newTitle) handleCreate(); }}
            />
            <button
              onClick={() => { if (newTitle) { handleCreate(); } else { setNewTitle("New document"); } }}
              className="shrink-0 rounded-lg p-1.5 transition-fast"
              style={{ color: "var(--accent)" }}
              title="New document"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Filters */}
          <div className="flex gap-0.5">
            {DOC_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded px-2 py-0.5 text-[10px] font-medium transition-fast",
                  filter === f.key
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : "text-[color:var(--text-quiet)] hover:text-[color:var(--text)]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {/* Doc list */}
        <div className="flex-1 overflow-y-auto px-2">
          {loading ? <div className="py-4 text-center"><Spinner /></div> : filtered.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                "group flex items-center rounded-lg mb-0.5 transition-fast",
                selectedDocId === doc.id ? "bg-[color:var(--surface-muted)]" : "hover:bg-[color:var(--surface-muted)]",
              )}
            >
              <button
                onClick={() => setSelectedDocId(doc.id)}
                className="flex-1 text-left px-2.5 py-2 text-[12px] min-w-0"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">{docIcon(doc)}</span>
                  <p className="font-medium truncate" style={{ color: selectedDocId === doc.id ? "var(--text)" : "var(--text-muted)" }}>
                    {doc.title}
                  </p>
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-quiet)" }}>
                  {doc.doc_type} · {relTime(doc.updated_at)}
                </p>
              </button>
              <button
                onClick={() => handleDelete(doc.id)}
                className="opacity-0 group-hover:opacity-100 shrink-0 p-1 mr-1 rounded transition-fast hover:bg-red-50 dark:hover:bg-red-950/20"
                style={{ color: "var(--danger)" }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main pane ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {!selectedDoc ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <FileText className="h-10 w-10 mb-3" style={{ color: "var(--text-quiet)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Select a document</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-quiet)" }}>Choose from the sidebar or create a new one</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-4">
              {/* Doc header */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">{docIcon(selectedDoc)}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{selectedDoc.title}</h3>
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-quiet)" }}>
                    <span>{selectedDoc.doc_type}</span>
                    {selectedDoc.file_size && <span>{(selectedDoc.file_size / 1024).toFixed(0)}KB</span>}
                    <span>{new Date(selectedDoc.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {selectedDoc.file_path && (
                  <a href={downloadUrl} download className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    <Download className="h-3 w-3" /> Download
                  </a>
                )}
              </div>
              {/* Content preview */}
              {isMarkdown ? (
                <div className="prose prose-sm prose-slate dark:prose-invert max-w-none [&>p]:my-2 [&>ul]:my-2 [&>ol]:my-2 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm" style={{ color: "var(--text)", fontSize: "13px" }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedDoc.content || ""}</ReactMarkdown>
                </div>
              ) : selectedDoc.file_path ? (
                (() => {
                  const mime = selectedDoc.mime_type || "";
                  if (mime.startsWith("image/")) return <img src={downloadUrl} alt={selectedDoc.title} className="max-w-full max-h-[500px] rounded-lg border" style={{ borderColor: "var(--border)" }} />;
                  if (mime.includes("pdf")) return <iframe src={downloadUrl} className="w-full rounded-lg border" style={{ height: "600px", borderColor: "var(--border)" }} title={selectedDoc.title} />;
                  const isOffice = ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"].includes(mime);
                  if (isOffice) return <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(downloadUrl)}&embedded=true`} className="w-full rounded-lg border" style={{ height: "600px", borderColor: "var(--border)" }} title={selectedDoc.title} />;
                  return (
                    <div className="py-8 text-center">
                      <FileText className="mx-auto h-12 w-12 mb-3" style={{ color: "var(--text-quiet)" }} />
                      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{selectedDoc.title}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{mime}</p>
                    </div>
                  );
                })()
              ) : (
                <p className="text-sm italic" style={{ color: "var(--text-quiet)" }}>No content yet. Use the editor below to add content.</p>
              )}
            </div>
          )}
        </div>

        {/* Action input — pinned bottom */}
        {selectedDoc && isMarkdown && (
          <div className="shrink-0 border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="max-w-3xl mx-auto px-6 py-3">
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                <textarea
                  className="w-full resize-none px-4 py-2.5 text-[13px] bg-transparent focus:outline-none"
                  style={{ color: "var(--text)", maxHeight: "200px" }}
                  rows={3}
                  placeholder="Edit document content..."
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
                <div className="flex items-center justify-between px-3 pb-2">
                  <span className="text-[10px]" style={{ color: "var(--text-quiet)" }}>
                    {hasChanged ? "Unsaved changes" : "No changes"}
                  </span>
                  <button
                    onClick={handleSave}
                    disabled={!hasChanged || saving}
                    className="rounded-lg bg-[color:var(--accent)] px-3 py-1 text-[11px] font-medium text-white disabled:opacity-30"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ImprovementsTab({ agentId, agent }: { agentId: string; agent: ExecutiveAgent }) {
  const [items, setItems] = useState<AgentImprovement[]>([]);
  const [latestReport, setLatestReport] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);

  useEffect(() => {
    Promise.all([
      api.agents.improvements(agentId),
      api.documents.list(agentId, undefined, "audit").then((docs) => docs[0] || null),
    ]).then(([imps, report]) => {
      setItems(imps);
      setLatestReport(report);
    }).catch(console.error).finally(() => setLoading(false));
  }, [agentId]);

  const handleAudit = async () => {
    setAuditing(true);
    try {
      await api.improvements.audit(agentId);
      const [updated, report] = await Promise.all([
        api.agents.improvements(agentId),
        api.documents.list(agentId, undefined, "audit").then((docs) => docs[0] || null),
      ]);
      setItems(updated);
      setLatestReport(report);
    } catch (e) { console.error(e); }
    finally { setAuditing(false); }
  };

  return (
    <div className="space-y-4">
      {/* Goal banner */}
      {agent.goal && (
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-quiet)" }}>Current Goal</p>
          <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>{agent.goal}</p>
        </div>
      )}

      {/* Latest report card */}
      {latestReport && (
        <Link
          href={`/docs/${latestReport.id}`}
          className="flex items-center gap-3 rounded-xl border p-3 transition-smooth hover:shadow-elevation-2"
          style={{ borderColor: "var(--accent)", background: "var(--surface)" }}
        >
          <span className="text-lg">📊</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>{latestReport.title}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-quiet)" }}>
              {new Date(latestReport.created_at).toLocaleDateString()} · {items.length} improvement{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
        </Link>
      )}

      {/* Audit button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleAudit}
          disabled={auditing}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-fast disabled:opacity-40"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", auditing && "animate-spin")} />
          {auditing ? "Running audit..." : "Run Weekly Audit"}
        </button>
        <Link href="/improvements" className="text-xs" style={{ color: "var(--text-quiet)" }}>
          View all improvements →
        </Link>
      </div>

      {/* Improvements list */}
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState text="No improvements proposed yet. Run an audit to generate suggestions." />
      ) : (
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
              {i.goal_relevance && <p className="text-[11px] mt-1 ml-6 italic" style={{ color: "var(--text-quiet)" }}>{i.goal_relevance}</p>}
            </div>
          ))}
        </div>
      )}
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
      {/* Goal Progress */}
      {review.goal_progress && Object.keys(review.goal_progress).length > 0 && (
        <div>
          <h5 className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-quiet)" }}>Goal Progress</h5>
          <div className="space-y-2">
            {Object.entries(review.goal_progress).map(([name, data]: [string, any]) => (
              <div key={name} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}>
                <p className="text-[12px] font-medium" style={{ color: "var(--text)" }}>{name}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-quiet)" }}>{data.goal}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{data.progress}</p>
                {data.blockers !== "None" && (
                  <p className="text-[11px] mt-0.5 text-amber-600">Blocker: {data.blockers}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
