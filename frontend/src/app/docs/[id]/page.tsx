"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Eye, FileCode, FileText, Pencil } from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { api, type DocumentItem } from "@/lib/executive-api";

export default function DocDetailPage() {
  const params = useParams();
  const docId = params.id as string;

  const [doc, setDoc] = useState<DocumentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (docId) {
      api.documents.get(docId).then((d) => {
        setDoc(d);
        setEditContent(d.content || "");
      }).catch(console.error).finally(() => setLoading(false));
    }
  }, [docId]);

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const updated = await api.documents.update(doc.id, { content: editContent });
      setDoc(updated);
      setEditing(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/home" }} title="Document">
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        </div>
      </DashboardPageLayout>
    );
  }

  if (!doc) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/home" }} title="Not found">
        <div className="py-20 text-center" style={{ color: "var(--text-muted)" }}>Document not found.</div>
      </DashboardPageLayout>
    );
  }

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in", forceRedirectUrl: "/home" }}
      title={doc.title}
      description={doc.doc_type}
      headerActions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-fast"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            {editing ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editing ? "Preview" : "Edit"}
          </button>
          <Link href="/docs" className="flex items-center gap-1 text-sm transition-smooth" style={{ color: "var(--text-quiet)" }}>
            <ArrowLeft className="h-4 w-4" /> Docs
          </Link>
        </div>
      }
    >
      <SignedOut>
        <div className="py-20 text-center" style={{ color: "var(--text-muted)" }}>Sign in to continue.</div>
      </SignedOut>
      <SignedIn>
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-quiet)" }}>
            <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-0.5 font-medium">{doc.doc_type}</span>
            {doc.agent_display_name && <span>{doc.agent_avatar_emoji} {doc.agent_display_name}</span>}
            <span>Updated {new Date(doc.updated_at).toLocaleDateString()}</span>
            <span className={doc.status === "published" ? "text-emerald-600" : "text-amber-600"}>{doc.status}</span>
          </div>

          {/* Content */}
          <div className="rounded-xl border overflow-hidden shadow-elevation-1" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            {editing ? (
              <div className="p-5">
                <textarea
                  className="w-full rounded-lg border px-4 py-3 text-sm font-mono min-h-[400px] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/20"
                  style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--text)" }}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => { setEditing(false); setEditContent(doc.content || ""); }} className="rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="rounded-lg bg-[color:var(--accent)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40">
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                {doc.content ? (
                  <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                    <ReactMarkdown>{doc.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm italic" style={{ color: "var(--text-quiet)" }}>No content yet. Click Edit to add content.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </SignedIn>
    </DashboardPageLayout>
  );
}
