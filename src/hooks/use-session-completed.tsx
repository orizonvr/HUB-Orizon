import { useCallback, useState } from "react";
import type { TarefaStatus } from "@/lib/tarefas-types";

/**
 * Tracks tarefas marked as concluida/cancelada in the current session so
 * they stay visible in the active list until a page reload. Maps id →
 * the status the row had BEFORE being toggled, so grouped views can keep
 * the row in its original bucket (e.g. "Pendente") with the concluded
 * visual treatment.
 */
export function useSessionCompleted() {
  const [map, setMap] = useState<Map<string, TarefaStatus>>(new Map());

  const markCompleted = useCallback((id: string, previousStatus: TarefaStatus) => {
    setMap((prev) => {
      if (prev.has(id)) return prev;
      const next = new Map(prev);
      next.set(id, previousStatus);
      return next;
    });
  }, []);

  const clear = useCallback((id: string) => {
    setMap((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return {
    /** Was this row toggled to concluida/cancelada in the current session? */
    isSticky: useCallback((id: string) => map.has(id), [map]),
    /** Status the row had BEFORE the user toggled it. */
    originalStatus: useCallback(
      (id: string): TarefaStatus | undefined => map.get(id),
      [map],
    ),
    markCompleted,
    clear,
  };
}
