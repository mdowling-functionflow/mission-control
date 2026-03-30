"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  FileCode,
  FileText,
  MessageSquare,
  Pencil,
  Shield,
  Sparkles,
  X,
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

type WorkflowStep = "browse" | "direct-edit" | "request" | "review" | "applied";

const STEPS: Array<{ key: WorkflowStep; label: string; icon: typeof FileCode }> = [
  { key: "browse", label: "Browse", icon: FileCode },
  { key: "direct-edit", label: "Edit", icon: Pencil },
  { key: "applied", label: "Saved", icon: Check },
];

export default function SkillDetailPage() {
  const params = useParams();
  const encodedPath = params.id as string;

  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<WorkflowStep>("browse");
  const [activeFileTab, setActiveFileTab] = useState<string>("SKILL.md");

  // Request state
  const [changeRequest, setChangeRequest] = useState("");
  const [proposing, setProposing] = useState(false);
  const [proposal, setProposal] = useState<ChangeProposal | null>(null);

  // Edit state
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Apply state
  const [applying, setApplying] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  useEffect(() => {
    if (encodedPath) {
      api.skills.get(encodedPath).then((s) => {
        setSkill(s);
        if (s.files.length > 0) setActiveFileTab(s.files[0].name);
      }).catch(console.error).finally(() => setLoading(false));
    }
  }, [encodedPath]);

  const handlePropose = async () => {
    if (!changeRequest.trim()) return;
    setProposing(true);
    try {
      const result = await api.skills.proposeChange(encodedPath, changeRequest);
      setProposal(result);
      const primaryFile = result.affected_files[0];
      if (primaryFile && result.current_content[primaryFile]) {
        setEditingFile(primaryFile);
        setOriginalContent(result.current_content[primaryFile]);
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
      api.skills.get(encodedPath).then(setSkill).catch(console.error);
    } catch (e) {
      console.error(e);
    } finally {
      setApplying(false);
    }
  };

  const handleReset = () => {
    setStep("browse");
    setProposal(null);
    setValidation(null);
    setChangeRequest("");
    setEditingFile(null);
    setEditContent("");
    setOriginalContent("");
    setShowPreview(false);
  };

  if (loading) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/agent/main" }} title="Skill">
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        </div>
      </DashboardPageLayout>
    );
  }

  if (!skill) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/agent/main" }} title="Skill not found">
        <div className="py-20 text-center text-slate-500">Skill not found.</div>
      </DashboardPageLayout>
    );
  }

  const activeFile = skill.files.find((f) => f.name === activeFileTab);
  const isMarkdown = activeFileTab.endsWith(".md");
  const hasChanges = editContent !== originalContent;

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in", forceRedirectUrl: "/agent/main" }}
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
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {STEPS.map(({ key, label, icon: Icon }, i) => {
              const stepIdx = STEPS.findIndex((s) => s.key === step);
              const thisIdx = i;
              const isActive = key === step;
              const isDone = thisIdx < stepIdx;
              return (
                <div key={key} className="flex items-center gap-1">
                  {i > 0 && <div className={cn("h-px w-6", isDone || isActive ? "bg-slate-900" : "bg-slate-200")} />}
                  <div className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-smooth",
                    isActive && "bg-slate-900 text-white",
                    isDone && "bg-slate-100 text-slate-600",
                    !isActive && !isDone && "text-slate-400",
                  )}>
                    <Icon className="h-3 w-3" />
                    {label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Skill header */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-elevation-1">
            <div className="flex items-center gap-3">
              <FileCode className="h-6 w-6 text-slate-400" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{skill.name}</h2>
                {skill.summary && <p className="text-sm text-slate-500">{skill.summary}</p>}
                <p className="text-xs text-slate-400 mt-1">{skill.source} &middot; {skill.all_files.length} files</p>
              </div>
            </div>
          </div>

          {/* File tabs */}
          <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
            {skill.files.map((file) => (
              <button
                key={file.name}
                onClick={() => setActiveFileTab(file.name)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-fast",
                  activeFileTab === file.name
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                )}
              >
                {file.name.endsWith(".md") ? <FileText className="h-3 w-3" /> : <FileCode className="h-3 w-3" />}
                {file.name}
                <span className="text-[10px] text-slate-400">{file.size}</span>
              </button>
            ))}
          </div>

          {/* File content — browse mode */}
          {step === "browse" && activeFile && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-elevation-1">
              {/* Toolbar */}
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
                <span className="text-xs text-slate-500">{activeFile.name} &middot; {activeFile.size} chars</span>
                <div className="flex items-center gap-2">
                  {isMarkdown && (
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                    >
                      {showPreview ? <FileCode className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showPreview ? "Source" : "Preview"}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingFile(activeFileTab);
                      setEditContent(activeFile.content);
                      setOriginalContent(activeFile.content);
                      setStep("direct-edit");
                    }}
                    className="flex items-center gap-1 rounded-lg bg-[color:var(--accent)] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 transition-fast"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                </div>
              </div>
              <div className="p-4 max-h-[500px] overflow-auto">
                {showPreview && isMarkdown ? (
                  <div className="prose prose-sm prose-slate max-w-none">
                    <ReactMarkdown>{activeFile.content}</ReactMarkdown>
                  </div>
                ) : (
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">
                    {activeFile.content}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Direct edit mode */}
          {step === "direct-edit" && editingFile && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-elevation-1 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
                <span className="text-xs font-medium text-slate-700">Editing: {editingFile}</span>
                <div className="flex items-center gap-2">
                  {hasChanges && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Modified
                    </span>
                  )}
                  {editingFile.endsWith(".md") && (
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                    >
                      {showPreview ? <FileCode className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {showPreview ? "Editor" : "Preview"}
                    </button>
                  )}
                </div>
              </div>
              {showPreview && editingFile.endsWith(".md") ? (
                <div className="p-6">
                  <div className="prose prose-sm prose-slate max-w-none max-h-[500px] overflow-auto">
                    <ReactMarkdown>{editContent}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <textarea
                  className="w-full px-4 py-3 text-xs font-mono bg-slate-50 min-h-[500px] focus:outline-none resize-none"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              )}
              <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
                <button
                  onClick={handleReset}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-fast"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  disabled={applying || !hasChanges}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40 transition-fast"
                >
                  <Check className="h-3.5 w-3.5" />
                  {applying ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* AI Review — request a change */}
          {step === "browse" && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-elevation-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
                <MessageSquare className="h-4 w-4 text-slate-400" />
                AI-Assisted Change
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                Describe what you want to improve in plain language. The change will go through review before being applied.
              </p>
              <textarea
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                rows={3}
                placeholder="e.g. 'Make this skill stricter about duplicate tasks' or 'Add a check for empty responses'"
                value={changeRequest}
                onChange={(e) => setChangeRequest(e.target.value)}
              />
              <button
                onClick={handlePropose}
                disabled={proposing || !changeRequest.trim()}
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-fast"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {proposing ? "Preparing..." : "Propose Change"}
              </button>
            </section>
          )}

          {/* Review & Edit step */}
          {step === "review" && proposal && (
            <section className="space-y-4">
              {/* Mario review panel */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 shadow-elevation-1">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-3">
                  <Shield className="h-4 w-4" />
                  Mario Review
                </h3>
                <div className="space-y-2">
                  <div className="rounded-lg bg-white/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-1">Request</p>
                    <p className="text-sm text-blue-900">{proposal.request}</p>
                  </div>
                  <div className="rounded-lg bg-white/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-1">Affected Files</p>
                    <div className="flex gap-2">
                      {proposal.affected_files.map((f) => (
                        <button
                          key={f}
                          onClick={() => {
                            setEditingFile(f);
                            setOriginalContent(proposal.current_content[f] || "");
                            setEditContent(proposal.current_content[f] || "");
                          }}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-fast",
                            editingFile === f
                              ? "border-blue-400 bg-blue-100 text-blue-800"
                              : "border-blue-200 text-blue-700 hover:bg-blue-100/50",
                          )}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  {proposal.risks.length > 0 && (
                    <div className="rounded-lg bg-amber-50/80 border border-amber-200/50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Risks
                      </p>
                      <ul className="space-y-0.5">
                        {proposal.risks.map((r, i) => (
                          <li key={i} className="text-xs text-amber-800">• {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Side-by-side editor */}
              {editingFile && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-elevation-1 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
                    <span className="text-xs font-medium text-slate-700">Editing: {editingFile}</span>
                    <div className="flex items-center gap-2">
                      {hasChanges && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Modified
                        </span>
                      )}
                      {editingFile.endsWith(".md") && (
                        <button
                          onClick={() => setShowPreview(!showPreview)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                        >
                          {showPreview ? <FileCode className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {showPreview ? "Editor" : "Preview"}
                        </button>
                      )}
                    </div>
                  </div>

                  {showPreview && editingFile.endsWith(".md") ? (
                    <div className="grid grid-cols-2 divide-x divide-slate-100">
                      <div className="p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Current</p>
                        <div className="prose prose-sm prose-slate max-w-none max-h-[500px] overflow-auto">
                          <ReactMarkdown>{originalContent}</ReactMarkdown>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Proposed</p>
                        <div className="prose prose-sm prose-slate max-w-none max-h-[500px] overflow-auto">
                          <ReactMarkdown>{editContent}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 divide-x divide-slate-100">
                      <div className="p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Current</p>
                        <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono max-h-[500px] overflow-auto bg-slate-50 rounded-lg p-3">
                          {originalContent}
                        </pre>
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Proposed</p>
                        <textarea
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono bg-slate-50 min-h-[500px] focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
                    <button
                      onClick={handleReset}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 hover:bg-slate-50 transition-fast"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApply}
                      disabled={applying || !hasChanges}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40 transition-fast"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {applying ? "Applying..." : "Approve & Apply"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Applied step */}
          {step === "applied" && validation && (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-elevation-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold mb-4">
                {validation.success ? (
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100">
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-red-100">
                    <X className="h-3.5 w-3.5 text-red-600" />
                  </div>
                )}
                <span className={validation.success ? "text-emerald-900" : "text-red-900"}>
                  {validation.success ? "Change applied successfully" : "Validation issues detected"}
                </span>
              </h3>
              <div className="space-y-2 rounded-lg bg-slate-50 p-4">
                {validation.checks.map((check, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className={cn(
                      "flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold",
                      check.passed ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600",
                    )}>
                      {check.passed ? "✓" : "✗"}
                    </span>
                    <span className="text-slate-700">{check.message}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleReset}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-fast"
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
