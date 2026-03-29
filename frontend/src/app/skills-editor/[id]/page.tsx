"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  FileCode,
  MessageSquare,
  Shield,
  Sparkles,
} from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { cn } from "@/lib/utils";
import {
  api,
  type SkillDetail,
  type SkillFile,
  type ChangeProposal,
  type ValidationResult,
} from "@/lib/executive-api";

type WorkflowStep = "browse" | "request" | "review" | "applied";

export default function SkillDetailPage() {
  const params = useParams();
  const encodedPath = params.id as string;

  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<WorkflowStep>("browse");

  // Request state
  const [changeRequest, setChangeRequest] = useState("");
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<ChangeProposal | null>(null);

  // Edit state
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // Apply state
  const [applying, setApplying] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  useEffect(() => {
    if (encodedPath) {
      api.skills.get(encodedPath).then(setSkill).catch(console.error).finally(() => setLoading(false));
    }
  }, [encodedPath]);

  const handlePropose = async () => {
    if (!changeRequest.trim()) return;
    setProposing(true);
    try {
      const result = await api.skills.proposeChange(encodedPath, changeRequest);
      setProposal(result);
      // Set up editing with the primary file content
      const primaryFile = result.affected_files[0];
      if (primaryFile && result.current_content[primaryFile]) {
        setEditingFile(primaryFile);
        setEditContent(result.current_content[primaryFile]);
      }
      setStep("review");
    } catch (e) {
      console.error(e);
    } finally {
      setProposing(false);
    }
  };

  const handleApply = async () => {
    if (!editingFile || !editContent) return;
    setApplying(true);
    try {
      const result = await api.skills.applyChange(encodedPath, editingFile, editContent);
      setValidation(result);
      setStep("applied");
      // Refresh skill data
      api.skills.get(encodedPath).then(setSkill).catch(console.error);
    } catch (e) {
      console.error(e);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/dashboard" }} title="Skill">
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        </div>
      </DashboardPageLayout>
    );
  }

  if (!skill) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/dashboard" }} title="Skill not found">
        <div className="py-20 text-center text-slate-500">Skill not found.</div>
      </DashboardPageLayout>
    );
  }

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in", forceRedirectUrl: "/dashboard" }}
      title={skill.name}
      description="Skill editor"
      headerActions={
        <Link href="/skills-editor" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Skills
        </Link>
      }
    >
      <SignedOut>
        <div className="py-20 text-center text-slate-500">Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Skill header */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <FileCode className="h-6 w-6 text-slate-400" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{skill.name}</h2>
                {skill.summary && <p className="text-sm text-slate-500">{skill.summary}</p>}
                <p className="text-xs text-slate-400 mt-1">{skill.source} &middot; {skill.all_files.length} files</p>
              </div>
            </div>
          </div>

          {/* Key files */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Files</h3>
            <div className="space-y-2">
              {skill.files.map((file) => (
                <FileViewer key={file.name} file={file} />
              ))}
            </div>
          </section>

          {/* Workflow */}
          {step === "browse" && (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
                <MessageSquare className="h-4 w-4 text-slate-400" />
                Request a Change
              </h3>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={3}
                placeholder="Describe what you'd like to change in plain language..."
                value={changeRequest}
                onChange={(e) => setChangeRequest(e.target.value)}
              />
              <button
                onClick={handlePropose}
                disabled={proposing || !changeRequest.trim()}
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {proposing ? "Preparing..." : "Propose Change"}
              </button>
            </section>
          )}

          {step === "review" && proposal && (
            <section className="space-y-4">
              {/* Proposal summary */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-2">
                  <Shield className="h-4 w-4" />
                  Mario Review
                </h3>
                <p className="text-xs text-blue-800 mb-2">Request: {proposal.request}</p>
                <p className="text-xs text-blue-700">{proposal.rationale}</p>
                {proposal.risks.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-blue-800">Risks:</p>
                    <ul className="mt-1 space-y-0.5">
                      {proposal.risks.map((r, i) => (
                        <li key={i} className="text-xs text-blue-700">• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-blue-600 mt-2">
                  Affected files: {proposal.affected_files.join(", ")}
                </p>
              </div>

              {/* Editor */}
              {editingFile && (
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h4 className="text-xs font-semibold text-slate-500 mb-2">
                    Editing: {editingFile}
                  </h4>
                  <textarea
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono bg-slate-50"
                    rows={20}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleApply}
                      disabled={applying}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {applying ? "Applying..." : "Approve & Apply"}
                    </button>
                    <button
                      onClick={() => { setStep("browse"); setProposal(null); }}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {step === "applied" && validation && (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
                {validation.success ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Shield className="h-4 w-4 text-red-500" />
                )}
                <span className={validation.success ? "text-emerald-900" : "text-red-900"}>
                  {validation.success ? "Change applied successfully" : "Validation issues detected"}
                </span>
              </h3>
              <div className="space-y-1">
                {validation.checks.map((check, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={check.passed ? "text-emerald-500" : "text-red-500"}>
                      {check.passed ? "✓" : "✗"}
                    </span>
                    <span className="text-slate-600">{check.message}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setStep("browse"); setProposal(null); setValidation(null); setChangeRequest(""); }}
                className="mt-4 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                Done
              </button>
            </section>
          )}
        </div>
      </SignedIn>
    </DashboardPageLayout>
  );
}

function FileViewer({ file }: { file: SkillFile }) {
  const [expanded, setExpanded] = useState(file.name === "SKILL.md");

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <FileCode className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-medium">{file.name}</span>
        <span className="text-xs text-slate-400 ml-auto">{file.size} chars</span>
      </button>
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-4">
          <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono max-h-[400px] overflow-auto">
            {file.content}
          </pre>
        </div>
      )}
    </div>
  );
}
