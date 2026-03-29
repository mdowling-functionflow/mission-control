"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { cn } from "@/lib/utils";
import { api, type WeeklyReview } from "@/lib/executive-api";

export default function WeeklyReviewPage() {
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.weeklyReviews.list(), api.weeklyReviews.current().catch(() => null)])
      .then(([all, current]) => {
        const sorted = all.sort((a, b) => b.week_start.localeCompare(a.week_start));
        setReviews(sorted);
        if (current) {
          const idx = sorted.findIndex((r) => r.id === current.id);
          setCurrentIdx(idx >= 0 ? idx : 0);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const review = reviews[currentIdx] ?? null;

  const handleGenerate = async () => {
    if (!review) return;
    setGenerating(true);
    try {
      const updated = await api.weeklyReviews.generate(review.id);
      setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const handleFinalize = async () => {
    if (!review) return;
    setSaving(true);
    try {
      const updated = await api.weeklyReviews.update(review.id, { status: "finalized" });
      setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSection = async (field: string, items: Array<{ text: string }>) => {
    if (!review) return;
    try {
      const updated = await api.weeklyReviews.update(review.id, { [field]: items });
      setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in to access Mission Control", forceRedirectUrl: "/home" }}
      title="Weekly Review"
      description="Executive operating review"
    >
      <SignedOut>
        <div className="py-20 text-center text-slate-500">Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          </div>
        ) : !review ? (
          <div className="mx-auto max-w-3xl rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <CalendarCheck className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 text-sm font-medium text-slate-700">No weekly review yet</h3>
            <p className="mt-1 text-xs text-slate-500">
              The weekly review will appear once created.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Week header with navigation */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
              <button
                onClick={() => setCurrentIdx((i) => Math.min(i + 1, reviews.length - 1))}
                disabled={currentIdx >= reviews.length - 1}
                className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-900">
                  Week of{" "}
                  {new Date(review.week_start).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  –{" "}
                  {new Date(review.week_end).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h2>
                <span
                  className={cn(
                    "text-xs font-medium",
                    review.status === "finalized"
                      ? "text-emerald-600"
                      : "text-amber-600",
                  )}
                >
                  {review.status === "finalized" ? "Finalized" : "Draft"}
                </span>
              </div>
              <button
                onClick={() => setCurrentIdx((i) => Math.max(i - 1, 0))}
                disabled={currentIdx <= 0}
                className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {generating ? "Generating..." : "Generate Draft"}
              </button>
              {review.status === "draft" && (
                <button
                  onClick={handleFinalize}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Finalize"}
                </button>
              )}
            </div>

            {/* Review sections */}
            <div className="space-y-6">
              <EditableSection title="Wins" field="wins" items={review.wins} onSave={handleSaveSection} />
              <EditableSection title="Key Risks" field="risks" items={review.risks} onSave={handleSaveSection} />
              <EditableSection title="Recurring Friction" field="friction_points" items={review.friction_points} onSave={handleSaveSection} />
              <EditableSection title="Improvements Proposed" field="improvements" items={review.improvements} onSave={handleSaveSection} />
              <EditableSection title="Next Week Priorities" field="next_week_priorities" items={review.next_week_priorities} onSave={handleSaveSection} />
            </div>

            {/* Agent Summaries */}
            {review.agent_summaries && Object.keys(review.agent_summaries).length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
                  <Users className="h-3.5 w-3.5" />
                  Agent Summaries
                </h3>
                <div className="space-y-3">
                  {Object.entries(review.agent_summaries).map(([name, summary]) => (
                    <div key={name} className="rounded-lg bg-slate-50 p-3">
                      <h4 className="text-sm font-medium text-slate-900">{name}</h4>
                      <p className="text-xs text-slate-600 mt-1">{summary}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </SignedIn>
    </DashboardPageLayout>
  );
}

function EditableSection({
  title,
  field,
  items,
  onSave,
}: {
  title: string;
  field: string;
  items: Array<{ text: string }> | null;
  onSave: (field: string, items: Array<{ text: string }>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localItems, setLocalItems] = useState<Array<{ text: string }>>(items ?? []);
  const [newText, setNewText] = useState("");

  useEffect(() => {
    setLocalItems(items ?? []);
  }, [items]);

  const handleAdd = () => {
    if (!newText.trim()) return;
    const updated = [...localItems, { text: newText.trim() }];
    setLocalItems(updated);
    setNewText("");
    onSave(field, updated);
  };

  const handleRemove = (idx: number) => {
    const updated = localItems.filter((_, i) => i !== idx);
    setLocalItems(updated);
    onSave(field, updated);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
        <button
          onClick={() => setEditing(!editing)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>
      {localItems.length === 0 && !editing ? (
        <p className="text-sm text-slate-400 italic">No items yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {localItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
              <span className="flex-1">{item.text}</span>
              {editing && (
                <button onClick={() => handleRemove(i)} className="text-slate-400 hover:text-red-500 shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm"
            placeholder={`Add ${title.toLowerCase()} item...`}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={!newText.trim()}
            className="rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}
