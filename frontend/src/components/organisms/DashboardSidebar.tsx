"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  Compass,
  FileCode,
  Lightbulb,
  ListTodo,
  Moon,
  Settings,
  Sun,
  Users,
  CalendarCheck,
} from "lucide-react";

import { useTheme } from "@/components/providers/ThemeProvider";

import {
  type healthzHealthzGetResponse,
  useHealthzHealthzGet,
} from "@/api/generated/default/default";
import { ApiError } from "@/api/mutator";
import { cn } from "@/lib/utils";

const NAV_ITEMS: ReadonlyArray<{
  href: string;
  label: string;
  icon: typeof Compass;
  matchExact?: boolean;
}> = [
  { href: "/dashboard", label: "Overview", icon: Compass, matchExact: true },
  { href: "/executive-agents", label: "Agents", icon: Users },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/approvals", label: "Approvals", icon: CheckCircle2 },
  { href: "/weekly-review", label: "Weekly Review", icon: CalendarCheck },
  { href: "/improvements", label: "Improvements", icon: Lightbulb },
  { href: "/skills-editor", label: "Skills", icon: FileCode },
  { href: "/ops", label: "Ops", icon: Activity },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { resolved, setTheme } = useTheme();
  const healthQuery = useHealthzHealthzGet<healthzHealthzGetResponse, ApiError>(
    {
      query: {
        refetchInterval: 30_000,
        refetchOnMount: "always",
        retry: false,
      },
      request: { cache: "no-store" },
    },
  );

  const okValue = healthQuery.data?.data?.ok;
  const systemStatus: "unknown" | "operational" | "degraded" =
    okValue === true
      ? "operational"
      : okValue === false
        ? "degraded"
        : healthQuery.isError
          ? "degraded"
          : "unknown";
  const statusLabel =
    systemStatus === "operational"
      ? "All systems operational"
      : systemStatus === "unknown"
        ? "Checking status..."
        : "System degraded";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[280px] -translate-x-full flex-col border-r bg-[color:var(--surface)] pt-16 transition-transform duration-200 ease-in-out [[data-sidebar=open]_&]:translate-x-0 md:relative md:inset-auto md:z-auto md:w-[240px] md:translate-x-0 md:pt-0 md:transition-none" style={{ borderColor: 'var(--border)' }}>
      <div className="flex-1 px-3 py-6">
        <nav className="space-y-0.5 text-sm">
          {NAV_ITEMS.map(({ href, label, icon: Icon, matchExact }) => {
            const isActive = matchExact
              ? pathname === href
              : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-smooth",
                  isActive
                    ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)] font-medium"
                    : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text)]",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t p-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-quiet)' }}>
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              systemStatus === "operational" && "bg-emerald-500",
              systemStatus === "degraded" && "bg-rose-500",
              systemStatus === "unknown" && "bg-slate-300",
            )}
          />
          {statusLabel}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Link
            href="/settings"
            className="flex items-center gap-2 text-xs transition-smooth"
            style={{ color: 'var(--text-quiet)' }}
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
          <button
            onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
            className="ml-auto flex items-center justify-center rounded-lg p-1.5 transition-smooth hover:bg-[color:var(--surface-muted)]"
            style={{ color: 'var(--text-quiet)' }}
            title={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {resolved === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
