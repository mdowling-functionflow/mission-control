"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  Compass,
  FileCode,
  Lightbulb,
  Settings,
  Users,
  CalendarCheck,
} from "lucide-react";

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
  { href: "/approvals", label: "Approvals", icon: CheckCircle2 },
  { href: "/weekly-review", label: "Weekly Review", icon: CalendarCheck },
  { href: "/improvements", label: "Improvements", icon: Lightbulb },
  { href: "/skills-editor", label: "Skills", icon: FileCode },
  { href: "/ops", label: "Ops", icon: Activity },
];

export function DashboardSidebar() {
  const pathname = usePathname();
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
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[280px] -translate-x-full flex-col border-r border-slate-200 bg-white pt-16 transition-transform duration-200 ease-in-out [[data-sidebar=open]_&]:translate-x-0 md:relative md:inset-auto md:z-auto md:w-[240px] md:translate-x-0 md:pt-0 md:transition-none">
      <div className="flex-1 px-3 py-6">
        <nav className="space-y-1 text-sm">
          {NAV_ITEMS.map(({ href, label, icon: Icon, matchExact }) => {
            const isActive = matchExact
              ? pathname === href
              : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-600 transition",
                  isActive
                    ? "bg-slate-900 text-white font-medium"
                    : "hover:bg-slate-50",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
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
        <Link
          href="/settings"
          className="mt-3 flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
