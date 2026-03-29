"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { cn } from "@/lib/utils";
import { api, type ExecutiveAgent } from "@/lib/executive-api";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    bound: "bg-blue-100 text-blue-800",
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

  useEffect(() => {
    api.agents.list().then(setAgents).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <DashboardPageLayout signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/home" }} title="Executive Team" description="Your AI executive agents">
      <SignedOut>
        <div className="py-20 text-center text-slate-500">Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          </div>
        ) : agents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-sm text-slate-500">
              No executive agents bound. Go to <Link href="/dashboard" className="underline">Overview</Link> to seed the team.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-3">
            {agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/executive-agents/${agent.id}`}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
              >
                <span className="text-3xl">{agent.avatar_emoji || "🤖"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">{agent.display_name}</h3>
                    <StatusBadge status={agent.status} />
                  </div>
                  <p className="text-sm text-slate-500">{agent.executive_role}</p>
                  {agent.current_focus && (
                    <p className="mt-1 text-xs text-slate-600 line-clamp-1">{agent.current_focus}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                  {agent.pending_approvals_count > 0 && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                      {agent.pending_approvals_count} pending
                    </span>
                  )}
                  {agent.current_risk && (
                    <span className="flex items-center gap-1 text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Risk
                    </span>
                  )}
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </SignedIn>
    </DashboardPageLayout>
  );
}
