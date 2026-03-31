"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Download, Eye, FileCode, FileText, Pencil } from "lucide-react";

import { SignedIn, SignedOut } from "@/auth/clerk";
import { DashboardPageLayout } from "@/components/templates/DashboardPageLayout";
import { api, type DocumentItem } from "@/lib/executive-api";
import { getApiBaseUrl } from "@/lib/api-base";

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
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/agent/main" }} title="Document">
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        </div>
      </DashboardPageLayout>
    );
  }

  if (!doc) {
    return (
      <DashboardPageLayout signedOut={{ message: "Sign in", forceRedirectUrl: "/agent/main" }} title="Not found">
        <div className="py-20 text-center" style={{ color: "var(--text-muted)" }}>Document not found.</div>
      </DashboardPageLayout>
    );
  }

  return (
    <DashboardPageLayout
      signedOut={{ message: "Sign in", forceRedirectUrl: "/agent/main" }}
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
            ) : doc.file_path ? (
              /* File preview — inline for popular types, download fallback */
              <div className="p-4">
                {(() => {
                  const mime = doc.mime_type || "";
                  const name = (doc.title || "").toLowerCase();
                  const downloadUrl = api.documents.downloadUrl(doc.id);
                  const isImage = mime.startsWith("image/");
                  const isPdf = mime.includes("pdf");
                  const isVideo = mime.startsWith("video/");
                  const isAudio = mime.startsWith("audio/");
                  const isText = mime.startsWith("text/") || mime.includes("json") || mime.includes("xml") || mime.includes("csv");
                  // Office docs / Google-viewable via Google Docs Viewer
                  const isOffice = [
                    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                  ].includes(mime) || /\.(docx?|xlsx?|pptx?|csv)$/i.test(name);

                  if (isImage) {
                    return (
                      <div className="flex flex-col items-center gap-3">
                        <img src={downloadUrl} alt={doc.title} className="max-w-full max-h-[600px] rounded-lg border" style={{ borderColor: "var(--border)" }} />
                      </div>
                    );
                  }
                  if (isPdf) {
                    return (
                      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                        <iframe src={downloadUrl} className="w-full" style={{ height: "700px" }} title={doc.title} />
                      </div>
                    );
                  }
                  if (isOffice) {
                    return (
                      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                        <iframe
                          src={`https://docs.google.com/gview?url=${encodeURIComponent(downloadUrl)}&embedded=true`}
                          className="w-full"
                          style={{ height: "700px" }}
                          title={doc.title}
                        />
                      </div>
                    );
                  }
                  if (isVideo) {
                    return (
                      <video controls className="w-full max-h-[600px] rounded-lg">
                        <source src={downloadUrl} type={mime} />
                        Your browser does not support video playback.
                      </video>
                    );
                  }
                  if (isAudio) {
                    return (
                      <div className="flex flex-col items-center gap-3 py-8">
                        <FileText className="h-12 w-12" style={{ color: "var(--text-quiet)" }} />
                        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{doc.title}</p>
                        <audio controls className="w-full max-w-md">
                          <source src={downloadUrl} type={mime} />
                        </audio>
                      </div>
                    );
                  }
                  if (isText) {
                    return <TextFilePreview url={downloadUrl} />;
                  }
                  // Fallback — download only
                  return (
                    <div className="py-8 text-center">
                      <FileText className="mx-auto h-12 w-12 mb-3" style={{ color: "var(--text-quiet)" }} />
                      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{doc.title}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        {doc.mime_type} {doc.file_size ? `· ${(doc.file_size / 1024).toFixed(0)}KB` : ""}
                      </p>
                    </div>
                  );
                })()}
                <a
                  href={api.documents.downloadUrl(doc.id)}
                  download
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-fast"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
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

/** Fetches and renders plain text/CSV/JSON files inline. */
function TextFilePreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    fetch(url).then((r) => r.text()).then(setText).catch(() => setText("(Could not load file)"));
  }, [url]);
  if (text === null) return <div className="p-4 text-sm" style={{ color: "var(--text-quiet)" }}>Loading...</div>;
  return (
    <pre
      className="overflow-auto rounded-lg border p-4 text-xs font-mono whitespace-pre-wrap max-h-[600px]"
      style={{ borderColor: "var(--border)", background: "var(--surface-muted)", color: "var(--text)" }}
    >
      {text}
    </pre>
  );
}
