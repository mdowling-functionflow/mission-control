"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { cn } from "@/lib/utils";
import { api, type GlobalApproval } from "@/lib/executive-api";

const STATUS_TABS = ["all", "pending", "approved", "rejected"] as const;

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<GlobalApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("pending");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = (status?: string) => {
    const filter = status === "all" ? undefined : status;
    api.approvals
      .global(filter)
      .then(setApprovals)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData(activeTab);
    intervalRef.current = setInterval(() => loadData(activeTab), 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setLoading(true);
  };

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/dashboard" }}
      title="Approvals"
      description="Review and decide on pending requests"
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
                onClick={() => handleTabChange(tab)}
                className={cn(
                  "px-4 py-2 text-sm capitalize transition border-b-2",
                  activeTab === tab
                    ? "border-slate-900 text-slate-900 font-medium"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                )}
              >
                {tab}
                {tab === "pending" && approvals.length > 0 && activeTab === "pending" && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    {approvals.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            </div>
          ) : approvals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm text-slate-500">
                {activeTab === "pending"
                  ? "No pending approvals. All clear."
                  : `No ${activeTab} approvals.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvals.map((a) => (
                <ApprovalCard key={a.id} approval={a} />
              ))}
            </div>
          )}
        </div>
      </SignedIn>
    </DashboardPageLayout>
  );
}

function ApprovalCard({ approval: a }: { approval: GlobalApproval }) {
  const StatusIcon =
    a.status === "pending" ? Clock :
    a.status === "approved" ? CheckCircle2 : XCircle;
  const statusColor =
    a.status === "pending" ? "text-amber-500" :
    a.status === "approved" ? "text-emerald-500" : "text-red-500";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <StatusIcon className={cn("h-5 w-5 mt-0.5 shrink-0", statusColor)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {a.agent_emoji && <span className="text-lg">{a.agent_emoji}</span>}
            <h3 className="text-sm font-semibold text-slate-900">{a.action_type}</h3>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              a.status === "pending" && "bg-amber-100 text-amber-800",
              a.status === "approved" && "bg-emerald-100 text-emerald-800",
              a.status === "rejected" && "bg-red-100 text-red-800",
            )}>
              {a.status}
            </span>
          </div>

          {a.rationale && (
            <p className="text-xs text-slate-600 mt-1">{a.rationale}</p>
          )}

          <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-400">
            {a.agent_name && <span>{a.agent_name}</span>}
            <span>{a.board_name}</span>
            <span>Confidence: {Math.round(a.confidence)}%</span>
            <span>{new Date(a.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
