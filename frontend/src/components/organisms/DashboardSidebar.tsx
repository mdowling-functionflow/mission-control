"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Clock,
  FileCode,
  FileText,
  Lightbulb,
  Moon,
  Settings,
  Sun,
  Users,
} from "lucide-react";

import {
  type healthzHealthzGetResponse,
  useHealthzHealthzGet,
} from "@/api/generated/default/default";
import { ApiError } from "@/api/mutator";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { api, type ExecutiveAgent } from "@/lib/executive-api";

export function DashboardSidebar() {
  const pathname = usePathname();
  const { resolved, setTheme } = useTheme();
  const [agents, setAgents] = useState<ExecutiveAgent[]>([]);

  useEffect(() => {
    api.agents.list().then(setAgents).catch(() => {});
  }, []);

  const healthQuery = useHealthzHealthzGet<healthzHealthzGetResponse, ApiError>({
    query: { refetchInterval: 30_000, refetchOnMount: "always", retry: false },
    request: { cache: "no-store" },
  });
  const okValue = healthQuery.data?.data?.ok;
  const systemStatus =
    okValue === true ? "operational" : okValue === false || healthQuery.isError ? "degraded" : "unknown";

  const workspaceOrder = ["main", "sales", "fundraising", "people", "strategy", "dcu", "life-admin"];
  const sortedAgents = [...agents]
    .filter((a) => a.sidebar_visible !== false)
    .sort((a, b) => {
      const ai = workspaceOrder.indexOf(a.openclaw_agent_id);
      const bi = workspaceOrder.indexOf(b.openclaw_agent_id);
      const ar = ai === -1 ? 999 : ai;
      const br = bi === -1 ? 999 : bi;
      return ar - br || a.display_name.localeCompare(b.display_name);
    });

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex w-[280px] -translate-x-full flex-col border-r pt-16 transition-transform duration-200 ease-in-out [[data-sidebar=open]_&]:translate-x-0 md:relative md:inset-auto md:z-auto md:w-[200px] md:translate-x-0 md:pt-0 md:transition-none"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {/* Workspaces — PRIMARY */}
        <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--text-quiet)" }}>
          Workspaces
        </p>
        <nav className="space-y-0.5">
          {agents.length > 0 ? sortedAgents.map((agent) => (
            <NavItem
              key={agent.id}
              href={`/agent/${agent.openclaw_agent_id}`}
              icon={<span className="text-sm leading-none">{agent.avatar_emoji || "🤖"}</span>}
              label={agent.display_name}
              active={pathname === `/agent/${agent.openclaw_agent_id}`}
            />
          )) : (
            // Skeleton while loading
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 rounded-lg animate-pulse mx-1" style={{ background: "var(--surface-muted)" }} />
            ))
          )}
        </nav>

        {/* Manage — SECONDARY */}
        <div className="mt-5">
          <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--text-quiet)" }}>
            Manage
          </p>
          <nav className="space-y-0.5">
            <NavItem href="/executive-agents" icon={<Users className="h-3.5 w-3.5" />} label="Agents" active={pathname.startsWith("/executive-agents")} />
            <NavItem href="/docs" icon={<FileText className="h-3.5 w-3.5" />} label="Docs" active={pathname.startsWith("/docs")} />
            <NavItem href="/schedules" icon={<Clock className="h-3.5 w-3.5" />} label="Schedules" active={pathname.startsWith("/schedules")} />
            <NavItem href="/skills-editor" icon={<FileCode className="h-3.5 w-3.5" />} label="Skills" active={pathname.startsWith("/skills-editor")} />
            <NavItem href="/improvements" icon={<Lightbulb className="h-3.5 w-3.5" />} label="Improvements" active={pathname.startsWith("/improvements")} />
            <NavItem href="/ops" icon={<Activity className="h-3.5 w-3.5" />} label="Ops" active={pathname.startsWith("/ops")} muted />
          </nav>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-quiet)" }}>
            <span className={cn("h-1.5 w-1.5 rounded-full", systemStatus === "operational" && "bg-emerald-500", systemStatus === "degraded" && "bg-rose-500", systemStatus === "unknown" && "bg-slate-300")} />
            {systemStatus === "operational" ? "OK" : systemStatus === "degraded" ? "!" : "…"}
          </div>
          <div className="flex items-center gap-1">
            <Link href="/settings" className="rounded p-1 transition-smooth hover:bg-[color:var(--surface-muted)]" style={{ color: "var(--text-quiet)" }}>
              <Settings className="h-3 w-3" />
            </Link>
            <button
              onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
              className="rounded p-1 transition-smooth hover:bg-[color:var(--surface-muted)]"
              style={{ color: "var(--text-quiet)" }}
            >
              {resolved === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label, active, muted }: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] transition-smooth",
        active
          ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)] font-medium"
          : muted
            ? "text-[color:var(--text-quiet)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text-muted)]"
            : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)]",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
