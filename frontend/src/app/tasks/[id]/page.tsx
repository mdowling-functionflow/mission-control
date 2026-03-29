"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  MessageSquare,
  Users,
  XCircle,
} from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { cn } from "@/lib/utils";
import { api, type ComposedTask, type TaskAssignmentRead } from "@/lib/executive-api";

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;
  const [task, setTask] = useState<ComposedTask | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (taskId) {
      api.tasks.get(taskId).then(setTask).catch(console.error).finally(() => setLoading(false));
    }
  }, [taskId]);

  if (loading) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/dashboard" }} title="Task">
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        </div>
      </DashboardPageLayout>
    );
  }

  if (!task) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/dashboard" }} title="Task not found">
        <div className="py-20 text-center text-slate-500">Task not found.</div>
      </DashboardPageLayout>
    );
  }

  const primary = task.assignments.find((a) => a.role === "primary");
  const collaborators = task.assignments.filter((a) => a.role !== "primary");

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in", forceRedirectUrl: "/dashboard" }}
      title={task.title}
      description={task.task_type === "multi_agent" ? `${task.collaboration_mode} collaboration` : "Single agent task"}
      headerActions={
        <Link href="/tasks" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Tasks
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
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">{task.title}</h2>
                  <StatusBadge status={task.status} />
                </div>
                {task.original_request && task.original_request !== task.title && (
                  <p className="text-sm text-slate-500 mt-1">{task.original_request}</p>
                )}
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>Created {new Date(task.created_at).toLocaleDateString()}</p>
                {task.collaboration_mode && (
                  <p className="flex items-center gap-1 mt-1 text-purple-600">
                    <Users className="h-3 w-3" />
                    {task.collaboration_mode}
                  </p>
                )}
              </div>
            </div>
            {task.description && (
              <p className="text-sm text-slate-600 mt-3">{task.description}</p>
            )}
          </div>

          {/* Collaboration view */}
          {task.collaboration_mode === "sequential" ? (
            <SequentialView assignments={task.assignments} />
          ) : task.collaboration_mode === "review" ? (
            <ReviewView assignments={task.assignments} />
          ) : (
            <ParallelView assignments={task.assignments} />
          )}

          {/* Status actions */}
          <div className="flex gap-2">
            {task.status === "active" && (
              <button
                onClick={async () => {
                  const updated = await api.tasks.update(task.id, { status: "in_progress" });
                  setTask(updated);
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Mark In Progress
              </button>
            )}
            {(task.status === "active" || task.status === "in_progress") && (
              <>
                <button
                  onClick={async () => {
                    const updated = await api.tasks.update(task.id, { status: "completed" });
                    setTask(updated);
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  Complete
                </button>
                <button
                  onClick={async () => {
                    const updated = await api.tasks.update(task.id, { status: "cancelled" });
                    setTask(updated);
                  }}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </SignedIn>
    </DashboardPageLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-blue-100 text-blue-800",
    in_progress: "bg-amber-100 text-amber-800",
    completed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-slate-100 text-slate-500",
    draft: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", styles[status] ?? "bg-slate-100 text-slate-600")}>
      {status === "in_progress" ? "In Progress" : status}
    </span>
  );
}

function AssignmentCard({ assignment: a }: { assignment: TaskAssignmentRead }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{a.agent_avatar_emoji || "🤖"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">{a.agent_display_name}</h4>
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              a.role === "primary" && "bg-blue-100 text-blue-800",
              a.role === "collaborator" && "bg-purple-100 text-purple-800",
              a.role === "reviewer" && "bg-amber-100 text-amber-800",
            )}>
              {a.role}
            </span>
            <span className={cn(
              "h-2 w-2 rounded-full",
              a.status === "active" && "bg-emerald-500",
              a.status === "pending" && "bg-slate-300",
              a.status === "completed" && "bg-blue-500",
              a.status === "blocked" && "bg-red-500",
            )} />
          </div>
          <p className="text-xs text-slate-500">{a.agent_executive_role}</p>
        </div>
        <span className="text-[10px] text-slate-400">{a.status}</span>
      </div>
      {a.last_update && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
            <MessageSquare className="h-3 w-3" />
            {a.last_update_at && new Date(a.last_update_at).toLocaleString()}
          </div>
          <p className="text-xs text-slate-700">{a.last_update}</p>
        </div>
      )}
    </div>
  );
}

function ParallelView({ assignments }: { assignments: TaskAssignmentRead[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        Team ({assignments.length} agents — parallel)
      </h3>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {assignments.map((a) => <AssignmentCard key={a.id} assignment={a} />)}
      </div>
    </div>
  );
}

function SequentialView({ assignments }: { assignments: TaskAssignmentRead[] }) {
  const sorted = [...assignments].sort((a, b) => a.order_index - b.order_index);
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        Pipeline ({sorted.length} agents — sequential)
      </h3>
      <div className="space-y-2">
        {sorted.map((a, i) => (
          <div key={a.id}>
            <AssignmentCard assignment={a} />
            {i < sorted.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowRight className="h-4 w-4 text-slate-300 rotate-90" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewView({ assignments }: { assignments: TaskAssignmentRead[] }) {
  const creator = assignments.find((a) => a.role === "primary");
  const reviewers = assignments.filter((a) => a.role !== "primary");
  return (
    <div className="space-y-4">
      {creator && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Creator</h3>
          <AssignmentCard assignment={creator} />
        </div>
      )}
      {reviewers.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Reviewer{reviewers.length > 1 ? "s" : ""}
          </h3>
          <div className="space-y-2">
            {reviewers.map((a) => <AssignmentCard key={a.id} assignment={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}
