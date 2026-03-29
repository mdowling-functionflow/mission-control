"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  FileCode,
  FileText,
  MessageSquare,
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

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex w-[280px] -translate-x-full flex-col border-r pt-16 transition-transform duration-200 ease-in-out [[data-sidebar=open]_&]:translate-x-0 md:relative md:inset-auto md:z-auto md:w-[220px] md:translate-x-0 md:pt-0 md:transition-none"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {/* Primary */}
        <nav className="space-y-0.5">
          <NavItem href="/home" icon={<MessageSquare className="h-4 w-4" />} label="Home" active={pathname === "/home"} />
          <NavItem href="/docs" icon={<FileText className="h-4 w-4" />} label="Docs" active={pathname.startsWith("/docs")} />
        </nav>

        {/* Agent Workspaces */}
        {agents.length > 0 && (
          <div className="mt-5">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-quiet)" }}>
              Workspaces
            </p>
            <nav className="space-y-0.5">
              {agents.map((agent) => (
                <NavItem
                  key={agent.id}
                  href={`/agent/${agent.openclaw_agent_id}`}
                  icon={<span className="text-sm leading-none">{agent.avatar_emoji || "🤖"}</span>}
                  label={agent.display_name}
                  active={pathname === `/agent/${agent.openclaw_agent_id}`}
                />
              ))}
            </nav>
          </div>
        )}

        {/* Management */}
        <div className="mt-5">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-quiet)" }}>
            Manage
          </p>
          <nav className="space-y-0.5">
            <NavItem href="/executive-agents" icon={<Users className="h-4 w-4" />} label="Agents" active={pathname.startsWith("/executive-agents")} />
            <NavItem href="/skills-editor" icon={<FileCode className="h-4 w-4" />} label="Skills" active={pathname.startsWith("/skills-editor")} />
            <NavItem href="/ops" icon={<Activity className="h-4 w-4" />} label="Ops" active={pathname.startsWith("/ops")} muted />
          </nav>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-quiet)" }}>
          <span className={cn("h-1.5 w-1.5 rounded-full", systemStatus === "operational" && "bg-emerald-500", systemStatus === "degraded" && "bg-rose-500", systemStatus === "unknown" && "bg-slate-300")} />
          {systemStatus === "operational" ? "Systems OK" : systemStatus === "degraded" ? "Degraded" : "..."}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Link href="/settings" className="text-[11px] transition-smooth" style={{ color: "var(--text-quiet)" }}>
            <Settings className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
            className="ml-auto rounded p-1 transition-smooth hover:bg-[color:var(--surface-muted)]"
            style={{ color: "var(--text-quiet)" }}
          >
            {resolved === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
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
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-smooth",
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
