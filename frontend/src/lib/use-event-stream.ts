"use client";

import { useEffect, useRef, useCallback } from "react";
import { getLocalAuthToken, isLocalAuthMode } from "@/auth/localAuth";
import { getApiBaseUrl } from "@/lib/api-base";

export type SSEEvent = {
  type: string;
  data: Record<string, unknown>;
};

type EventHandler = (event: SSEEvent) => void;

/**
 * Hook that connects to the SSE event stream and dispatches events to a handler.
 * Automatically reconnects on disconnect.
 */
export function useEventStream(handler: EventHandler, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const base = getApiBaseUrl();
      let url = `${base}/api/v1/events/stream`;

      // Add auth token as query param for SSE (can't set headers on EventSource)
      if (isLocalAuthMode()) {
        const token = getLocalAuthToken();
        if (token) {
          url += `?token=${encodeURIComponent(token)}`;
        }
      }

      es = new EventSource(url);

      const eventTypes = [
        "task.updated",
        "agent.message",
        "approval.updated",
        "agent.status",
      ];

      for (const type of eventTypes) {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handlerRef.current({ type, data });
          } catch {
            // Ignore parse errors
          }
        });
      }

      es.onerror = () => {
        es?.close();
        // Reconnect after 5 seconds
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [enabled]);
}
