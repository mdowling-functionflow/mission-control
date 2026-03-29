"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileCode, Folder } from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { api, type InstalledSkill } from "@/lib/executive-api";

export default function SkillsEditorPage() {
  const [skills, setSkills] = useState<InstalledSkill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.skills.list().then(setSkills).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/dashboard" }}
      title="Skills"
      description="Browse and edit installed OpenClaw skills"
    >
      <SignedOut>
        <div className="py-20 text-center text-slate-500">Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-4xl space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
            </div>
          ) : skills.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <FileCode className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm text-slate-500">No installed skills found.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">{skills.length} installed skills</p>
              <div className="space-y-2">
                {skills.map((skill) => (
                  <Link
                    key={skill.path}
                    href={`/skills-editor/${skill.encoded_path}`}
                    className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <FileCode className="h-5 w-5 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-900">{skill.name}</h3>
                      {skill.summary && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{skill.summary}</p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Folder className="h-3 w-3" />
                          {skill.source}
                        </span>
                        {skill.last_modified && (
                          <span>Modified {new Date(skill.last_modified).toLocaleDateString()}</span>
                        )}
                        <span>{skill.file_count} files</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 shrink-0" />
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </SignedIn>
    </DashboardPageLayout>
  );
}
