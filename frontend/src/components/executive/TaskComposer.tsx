"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  api,
  type ExecutiveAgent,
  type AgentSuggestion,
  type TaskAssignmentInput,
} from "@/lib/executive-api";

interface TaskComposerProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const COLLABORATION_MODES = [
  { value: "parallel", label: "Parallel", desc: "Agents work simultaneously on different aspects" },
  { value: "sequential", label: "Sequential", desc: "Agents hand off to each other in order" },
  { value: "review", label: "Review", desc: "One creates, another reviews" },
] as const;

export function TaskComposer({ open, onClose, onCreated }: TaskComposerProps) {
  const [agents, setAgents] = useState<ExecutiveAgent[]>([]);
  const [request, setRequest] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [collaborationMode, setCollaborationMode] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AgentSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    if (open) {
      api.agents.list().then(setAgents).catch(console.error);
    }
  }, [open]);

  const handleSuggest = async () => {
    if (!request.trim()) return;
    setSuggesting(true);
    try {
      const result = await api.tasks.suggestAgents(request);
      setSuggestions(result.suggestions);
      const ids = new Set(result.suggestions.map((s) => s.executive_agent_id));
      setSelectedAgents(ids);
      if (result.recommended_mode) setCollaborationMode(result.recommended_mode);
    } catch (e) {
      console.error(e);
    } finally {
      setSuggesting(false);
    }
  };

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!request.trim() || selectedAgents.size === 0) return;
    setCreating(true);
    try {
      const assignments: TaskAssignmentInput[] = Array.from(selectedAgents).map(
        (id, i) => ({
          executive_agent_id: id,
          role: i === 0 ? "primary" : "collaborator",
          order_index: i,
        }),
      );
      await api.tasks.create({
        title: request.slice(0, 100),
        original_request: request,
        task_type: selectedAgents.size > 1 ? "multi_agent" : "single_agent",
        collaboration_mode: selectedAgents.size > 1 ? collaborationMode : null,
        assignments,
      });
      setCreated(true);
      onCreated?.();
      setTimeout(() => {
        reset();
        onClose();
      }, 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const reset = () => {
    setRequest("");
    setSelectedAgents(new Set());
    setCollaborationMode(null);
    setSuggestions([]);
    setCreated(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">New Task</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {created ? (
            <div className="py-8 text-center">
              <Check className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-medium text-slate-900">Task created</p>
            </div>
          ) : (
            <>
              {/* Request input */}
              <div>
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  rows={3}
                  placeholder="What do you need done? e.g. 'Prepare investor deck with sales traction data'"
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                />
              </div>

              {/* Auto-suggest button */}
              <button
                onClick={handleSuggest}
                disabled={!request.trim() || suggesting}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {suggesting ? "Suggesting..." : "Suggest agents"}
              </button>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
                  {suggestions.map((s) => (
                    <div key={s.executive_agent_id} className="flex items-center gap-2">
                      <span>{s.avatar_emoji}</span>
                      <span className="font-medium">{s.display_name}</span>
                      <span className="text-blue-600">{s.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Agent selection */}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-2 block">
                  Assign agents
                </label>
                <div className="flex flex-wrap gap-2">
                  {agents.map((agent) => {
                    const selected = selectedAgents.has(agent.id);
                    return (
                      <button
                        key={agent.id}
                        onClick={() => toggleAgent(agent.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 text-slate-600 hover:border-slate-300",
                        )}
                      >
                        <span>{agent.avatar_emoji}</span>
                        {agent.display_name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Collaboration mode (only for multi-agent) */}
              {selectedAgents.size > 1 && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-2 block">
                    Collaboration mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {COLLABORATION_MODES.map((mode) => (
                      <button
                        key={mode.value}
                        onClick={() => setCollaborationMode(mode.value)}
                        className={cn(
                          "rounded-lg border p-2 text-left transition",
                          collaborationMode === mode.value
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 hover:border-slate-300",
                        )}
                      >
                        <p className="text-xs font-medium text-slate-900">{mode.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{mode.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!created && (
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!request.trim() || selectedAgents.size === 0 || creating}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            >
              <Zap className="h-3.5 w-3.5" />
              {creating ? "Creating..." : "Create Task"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
