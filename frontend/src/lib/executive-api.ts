/**
 * Direct API helpers for the executive endpoints.
 * Uses the same auth pattern as the generated Orval hooks.
 */

import { getLocalAuthToken, isLocalAuthMode } from "@/auth/localAuth";
import { getApiBaseUrl } from "@/lib/api-base";

async function execFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (isLocalAuthMode() && !headers.has("Authorization")) {
    const token = getLocalAuthToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface ExecutiveAgent {
  id: string;
  organization_id: string;
  openclaw_agent_id: string;
  openclaw_workspace: string | null;
  display_name: string;
  executive_role: string;
  role_description: string | null;
  avatar_emoji: string | null;
  status: string;
  current_focus: string | null;
  last_seen_at: string | null;
  pending_approvals_count: number;
  active_tasks_count: number;
  current_risk: string | null;
  created_at: string;
  updated_at: string;
}

export interface OverviewItem {
  title: string;
  agent?: string | null;
  agent_emoji?: string | null;
  why?: string | null;
  action?: string | null;
  needs_michael: boolean;
  urgency: string; // high / medium / low
  link?: string | null;
}

export interface OverviewApproval {
  id: string;
  action_type: string;
  status: string;
  confidence: number;
  rationale?: string | null;
  agent_name?: string | null;
  agent_emoji?: string | null;
  created_at: string;
}

export interface OverviewActivity {
  event_type: string;
  label: string;
  message?: string | null;
  agent_name?: string | null;
  created_at: string;
}

export interface OverviewData {
  what_matters_now: OverviewItem[];
  waiting_on_michael: OverviewApproval[];
  agent_snapshots: ExecutiveAgent[];
  risks_and_alerts: OverviewItem[];
  what_changed: OverviewActivity[];
  pending_approvals_count: number;
  active_improvements_count: number;
}

export interface WeeklyReview {
  id: string;
  organization_id: string;
  week_start: string;
  week_end: string;
  status: string;
  wins: Array<{ text: string }> | null;
  risks: Array<{ text: string }> | null;
  friction_points: Array<{ text: string }> | null;
  improvements: Array<{ text: string }> | null;
  next_week_priorities: Array<{ text: string }> | null;
  agent_summaries: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface Improvement {
  id: string;
  organization_id: string;
  executive_agent_id: string | null;
  agent_display_name: string | null;
  agent_avatar_emoji: string | null;
  title: string;
  description: string | null;
  rationale: string | null;
  status: string;
  priority: string;
  category: string;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImprovementStats {
  proposed: number;
  reviewing: number;
  testing: number;
  adopted: number;
  rejected: number;
  total: number;
}

export interface GlobalApproval {
  id: string;
  board_id: string;
  board_name: string;
  agent_id: string | null;
  agent_name: string | null;
  agent_emoji: string | null;
  action_type: string;
  status: string;
  confidence: number;
  rationale: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AgentActivity {
  id: string;
  event_type: string;
  message: string | null;
  created_at: string;
}

export interface AgentApproval {
  id: string;
  action_type: string;
  status: string;
  confidence: number;
  rationale: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AgentImprovement {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  created_at: string;
}

// ─── Schedule/Cron Types ─────────────────────────────────────────────

export interface CronJob {
  id: string;
  agentId: string | null;
  name: string;
  description: string | null;
  enabled: boolean;
  schedule: { kind: string; expr?: string; tz?: string; every?: string } | null;
  payload: { kind: string; message?: string; model?: string; timeoutSeconds?: number; thinking?: string } | null;
  delivery: { mode: string; channel?: string } | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CronListResponse {
  jobs: CronJob[];
}

export interface ScheduleCreate {
  name: string;
  agent_id?: string;
  cron_expr?: string;
  every?: string;
  message?: string;
  description?: string;
  tz?: string;
  session?: string;
  model?: string;
  timeout_seconds?: number;
  thinking?: string;
}

// ─── Agent Files Types ───────────────────────────────────────────────

export interface AgentFileInfo {
  name: string;
  size: number;
  last_modified: string | null;
  is_memory: boolean;
}

export interface AgentFileContent {
  name: string;
  content: string;
  size: number;
  last_modified: string | null;
}

// ─── Skills Editor Types ─────────────────────────────────────────────

export interface InstalledSkill {
  name: string;
  path: string;
  encoded_path: string;
  summary: string | null;
  source: string;
  last_modified: string | null;
  file_count: number;
}

export interface SkillFile {
  name: string;
  content: string;
  size: number;
}

export interface SkillDetail {
  name: string;
  path: string;
  encoded_path: string;
  summary: string | null;
  source: string;
  files: SkillFile[];
  all_files: string[];
}

export interface ChangeProposal {
  request: string;
  affected_files: string[];
  current_content: Record<string, string>;
  rationale: string;
  risks: string[];
}

export interface ValidationResult {
  success: boolean;
  checks: Array<{ name: string; passed: boolean; message: string }>;
}

// ─── Agent Chat Types ────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

// ─── Document Types ──────────────────────────────────────────────────

export interface DocumentItem {
  id: string;
  organization_id: string;
  title: string;
  content: string | null;
  doc_type: string;
  source_agent_id: string | null;
  agent_display_name: string | null;
  agent_avatar_emoji: string | null;
  file_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DiscoveredFile {
  path: string;
  name: string;
  mime_type: string;
  size: number;
  last_modified: string | null;
}

// ─── Task Composer Types ─────────────────────────────────────────────

export interface TaskAssignmentInput {
  executive_agent_id: string;
  role: string;
  order_index?: number;
}

export interface TaskAssignmentRead {
  id: string;
  task_id: string;
  executive_agent_id: string;
  agent_display_name: string | null;
  agent_avatar_emoji: string | null;
  agent_executive_role: string | null;
  role: string;
  status: string;
  order_index: number;
  last_update: string | null;
  last_update_at: string | null;
  created_at: string;
}

export interface ComposedTask {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  original_request: string | null;
  task_type: string;
  collaboration_mode: string | null;
  status: string;
  assignments: TaskAssignmentRead[];
  created_at: string;
  updated_at: string;
}

export interface AgentSuggestion {
  executive_agent_id: string;
  display_name: string;
  avatar_emoji: string | null;
  reason: string;
}

export interface SuggestAgentsResponse {
  suggestions: AgentSuggestion[];
  recommended_mode: string | null;
  reason: string;
}

// ─── API Calls ───────────────────────────────────────────────────────

export const api = {
  overview: () => execFetch<OverviewData>("/api/v1/overview"),

  agents: {
    list: () => execFetch<ExecutiveAgent[]>("/api/v1/executive-agents"),
    get: (id: string) => execFetch<ExecutiveAgent>(`/api/v1/executive-agents/${id}`),
    seed: () => execFetch<ExecutiveAgent[]>("/api/v1/executive-agents/seed", { method: "POST" }),
    refreshAll: () =>
      execFetch<ExecutiveAgent[]>("/api/v1/executive-agents/refresh-all", { method: "POST" }),
    update: (id: string, data: Partial<ExecutiveAgent>) =>
      execFetch<ExecutiveAgent>(`/api/v1/executive-agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    activity: (id: string, limit = 30) =>
      execFetch<AgentActivity[]>(`/api/v1/executive-agents/${id}/activity?limit=${limit}`),
    approvals: (id: string, status?: string) =>
      execFetch<AgentApproval[]>(
        `/api/v1/executive-agents/${id}/approvals${status ? `?status=${status}` : ""}`,
      ),
    improvements: (id: string) =>
      execFetch<AgentImprovement[]>(`/api/v1/executive-agents/${id}/improvements`),
  },

  approvals: {
    global: (status?: string) =>
      execFetch<GlobalApproval[]>(
        `/api/v1/approvals/global${status ? `?status=${status}` : ""}`,
      ),
  },

  tasks: {
    list: (status?: string) =>
      execFetch<ComposedTask[]>(
        `/api/v1/composed-tasks${status ? `?status=${status}` : ""}`,
      ),
    get: (id: string) => execFetch<ComposedTask>(`/api/v1/composed-tasks/${id}`),
    create: (data: {
      title: string;
      description?: string;
      original_request?: string;
      task_type?: string;
      collaboration_mode?: string | null;
      assignments?: TaskAssignmentInput[];
    }) =>
      execFetch<ComposedTask>("/api/v1/composed-tasks", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { status?: string; title?: string; description?: string }) =>
      execFetch<ComposedTask>(`/api/v1/composed-tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    addAgentUpdate: (id: string, agentId: string, message: string) =>
      execFetch<ComposedTask>(`/api/v1/composed-tasks/${id}/agent-update`, {
        method: "POST",
        body: JSON.stringify({ executive_agent_id: agentId, message }),
      }),
    suggestAgents: (description: string) =>
      execFetch<SuggestAgentsResponse>(
        `/api/v1/composed-tasks/suggest-agents?description=${encodeURIComponent(description)}`,
      ),
  },

  weeklyReviews: {
    list: () => execFetch<WeeklyReview[]>("/api/v1/weekly-reviews"),
    current: () => execFetch<WeeklyReview>("/api/v1/weekly-reviews/current", { method: "POST" }),
    get: (id: string) => execFetch<WeeklyReview>(`/api/v1/weekly-reviews/${id}`),
    update: (id: string, data: Partial<WeeklyReview>) =>
      execFetch<WeeklyReview>(`/api/v1/weekly-reviews/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    generate: (id: string) =>
      execFetch<WeeklyReview>(`/api/v1/weekly-reviews/${id}/generate`, { method: "POST" }),
  },

  improvements: {
    list: (status?: string) =>
      execFetch<Improvement[]>(`/api/v1/improvements${status ? `?status=${status}` : ""}`),
    stats: () => execFetch<ImprovementStats>("/api/v1/improvements/stats"),
    create: (data: Partial<Improvement>) =>
      execFetch<Improvement>("/api/v1/improvements", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Improvement>) =>
      execFetch<Improvement>(`/api/v1/improvements/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    audit: (agentId: string) =>
      execFetch<{ document_id: string | null; document_title: string | null; improvements_created: number; agent_response: string | null }>(
        `/api/v1/improvements/audit/${agentId}`,
        { method: "POST" },
      ),
  },

  schedules: {
    list: () => execFetch<CronListResponse>("/api/v1/schedules"),
    status: () => execFetch<Record<string, unknown>>("/api/v1/schedules/status"),
    create: (data: ScheduleCreate) =>
      execFetch<Record<string, unknown>>("/api/v1/schedules", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    edit: (jobId: string, data: Record<string, unknown>) =>
      execFetch<Record<string, unknown>>(`/api/v1/schedules/${jobId}/edit`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    remove: (jobId: string) =>
      execFetch<void>(`/api/v1/schedules/${jobId}`, { method: "DELETE" }),
    run: (jobId: string) =>
      execFetch<Record<string, unknown>>(`/api/v1/schedules/${jobId}/run`, { method: "POST" }),
    enable: (jobId: string) =>
      execFetch<Record<string, unknown>>(`/api/v1/schedules/${jobId}/enable`, { method: "POST" }),
    disable: (jobId: string) =>
      execFetch<Record<string, unknown>>(`/api/v1/schedules/${jobId}/disable`, { method: "POST" }),
  },

  agentFiles: {
    list: (agentSlug: string) =>
      execFetch<AgentFileInfo[]>(`/api/v1/agent-files/${agentSlug}`),
    get: (agentSlug: string, filename: string) =>
      execFetch<AgentFileContent>(`/api/v1/agent-files/${agentSlug}/${filename}`),
    write: (agentSlug: string, filename: string, content: string) =>
      execFetch<AgentFileContent>(`/api/v1/agent-files/${agentSlug}/${filename}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      }),
  },

  skillMappings: {
    list: (agentId: string) =>
      execFetch<Array<{ id: string; skill_path: string; relevance: string }>>(
        `/api/v1/executive-agents/${agentId}/skill-mappings`,
      ),
    add: (agentId: string, skillPath: string, relevance = "core") =>
      execFetch<{ id: string }>(`/api/v1/executive-agents/${agentId}/skill-mappings`, {
        method: "POST",
        body: JSON.stringify({ skill_path: skillPath, relevance }),
      }),
    remove: (agentId: string, mappingId: string) =>
      execFetch<void>(`/api/v1/executive-agents/${agentId}/skill-mappings/${mappingId}`, {
        method: "DELETE",
      }),
  },

  chat: {
    messages: (agentId: string, limit = 50) =>
      execFetch<ChatMessage[]>(`/api/v1/agent-chat/${agentId}/messages?limit=${limit}`),
    send: (agentId: string, content: string) =>
      execFetch<ChatMessage>(`/api/v1/agent-chat/${agentId}/send`, {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
  },

  documents: {
    list: (agentId?: string, docType?: string) => {
      const params = new URLSearchParams();
      if (agentId) params.set("source_agent_id", agentId);
      if (docType) params.set("doc_type", docType);
      const qs = params.toString();
      return execFetch<DocumentItem[]>(`/api/v1/documents${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => execFetch<DocumentItem>(`/api/v1/documents/${id}`),
    create: (data: { title: string; content?: string; doc_type?: string; source_agent_id?: string }) =>
      execFetch<DocumentItem>("/api/v1/documents", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { title?: string; content?: string; status?: string }) =>
      execFetch<DocumentItem>(`/api/v1/documents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    discover: () => execFetch<DiscoveredFile[]>("/api/v1/documents/discover"),
    import: (data: { file_path: string; title?: string; doc_type?: string; source_agent_id?: string }) =>
      execFetch<DocumentItem>("/api/v1/documents/import", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    downloadUrl: (id: string) => `${getApiBaseUrl()}/api/v1/documents/${id}/download`,
  },

  skills: {
    list: () => execFetch<InstalledSkill[]>("/api/v1/installed-skills"),
    get: (encodedPath: string) =>
      execFetch<SkillDetail>(`/api/v1/installed-skills/${encodedPath}`),
    proposeChange: (encodedPath: string, request: string) =>
      execFetch<ChangeProposal>(`/api/v1/installed-skills/${encodedPath}/propose-change`, {
        method: "POST",
        body: JSON.stringify({ request }),
      }),
    applyChange: (encodedPath: string, filePath: string, newContent: string) =>
      execFetch<ValidationResult>(`/api/v1/installed-skills/${encodedPath}/apply-change`, {
        method: "POST",
        body: JSON.stringify({ file_path: filePath, new_content: newContent }),
      }),
  },
};
