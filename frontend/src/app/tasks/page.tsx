"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ListTodo, Plus, Users } from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { TaskComposer } from "@/components/executive/TaskComposer";
import { cn } from "@/lib/utils";
import { api, type ComposedTask } from "@/lib/executive-api";

const STATUS_TABS = ["all", "active", "in_progress", "completed", "cancelled"] as const;

export default function TasksPage() {
  const [tasks, setTasks] = useState<ComposedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [composerOpen, setComposerOpen] = useState(false);

  const loadData = (status?: string) => {
    setLoading(true);
    api.tasks
      .list(status === "all" ? undefined : status)
      .then(setTasks)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/dashboard" }}
      title="Tasks"
      description="Track work across your executive team"
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
        <div className="py-20 text-center text-slate-500">Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); loadData(tab); }}
                className={cn(
                  "px-3 py-2 text-sm capitalize transition border-b-2",
                  activeTab === tab
                    ? "border-slate-900 text-slate-900 font-medium"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                )}
              >
                {tab === "in_progress" ? "In Progress" : tab}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <ListTodo className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm text-slate-500">
                {activeTab === "all" ? "No tasks yet. Create one to get started." : `No ${activeTab} tasks.`}
              </p>
              <button
                onClick={() => setComposerOpen(true)}
                className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Create Task
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        task.status === "active" && "bg-blue-100 text-blue-800",
                        task.status === "in_progress" && "bg-amber-100 text-amber-800",
                        task.status === "completed" && "bg-emerald-100 text-emerald-800",
                        task.status === "cancelled" && "bg-slate-100 text-slate-500",
                      )}>
                        {task.status === "in_progress" ? "In Progress" : task.status}
                      </span>
                      {task.task_type === "multi_agent" && (
                        <span className="flex items-center gap-1 text-[10px] text-purple-600">
                          <Users className="h-3 w-3" />
                          {task.collaboration_mode}
                        </span>
                      )}
                    </div>
                    {task.original_request && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">{task.original_request}</p>
                    )}
                    {/* Agent chips */}
                    {task.assignments.length > 0 && (
                      <div className="mt-2 flex gap-1.5">
                        {task.assignments.map((a) => (
                          <span
                            key={a.id}
                            className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600"
                          >
                            {a.agent_avatar_emoji && <span>{a.agent_avatar_emoji}</span>}
                            {a.agent_display_name}
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              a.status === "active" && "bg-emerald-500",
                              a.status === "pending" && "bg-slate-300",
                              a.status === "completed" && "bg-blue-500",
                              a.status === "blocked" && "bg-red-500",
                            )} />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-slate-400">
                      {new Date(task.created_at).toLocaleDateString()}
                    </p>
                    <ArrowRight className="h-4 w-4 text-slate-300 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <TaskComposer
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          onCreated={() => loadData(activeTab)}
        />
      </SignedIn>
    </DashboardPageLayout>
  );
}
