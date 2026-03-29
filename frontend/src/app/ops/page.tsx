"use client";

export const dynamic = "force-dynamic";

import { Activity, Network, Server, Timer } from "lucide-react";
import Link from "next/link";

import { SignedIn, SignedOut, useAuth } from "@/auth/clerk";
import { useOrganizationMembership } from "@/lib/use-organization-membership";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";

export default function OpsPage() {
  const { isSignedIn } = useAuth();
  const { isAdmin } = useOrganizationMembership(isSignedIn);

  const opsLinks = [
    {
      href: "/gateways",
      icon: Network,
      title: "Gateways",
      description: "Runtime gateway connections and health",
    },
    {
      href: "/agents",
      icon: Server,
      title: "Board Agents",
      description: "Low-level agent provisioning and lifecycle",
    },
    {
      href: "/activity",
      icon: Activity,
      title: "Activity Feed",
      description: "Real-time event stream and audit log",
    },
    {
      href: "/boards",
      icon: Timer,
      title: "Boards",
      description: "Task boards and work orchestration",
    },
  ];

  return (
    <DashboardPageLayout signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/dashboard" }} title="Ops" description="Runtime operations and system health">
      <SignedOut>
        <div className="py-20 text-center text-slate-500">Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-sm text-slate-500 mb-6">
            System-level views for debugging, monitoring, and runtime inspection.
            These are secondary to the executive control plane.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {opsLinks.map(({ href, icon: Icon, title, description }) => (
              <Link
                key={href}
                href={href}
                className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
              >
                <Icon className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Quick Links
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { href: "/organization", label: "Organization" },
                { href: "/tags", label: "Tags" },
                { href: "/custom-fields", label: "Custom Fields" },
                { href: "/board-groups", label: "Board Groups" },
                { href: "/skills/marketplace", label: "Skills" },
                { href: "/settings", label: "Settings" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-300 transition"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </SignedIn>
    </DashboardPageLayout>
  );
}
