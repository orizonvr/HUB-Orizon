import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { TarefaDrawer } from "@/components/tarefas/tarefa-drawer";

type Ctx = {
  tarefaId: string | null;
  openTarefa: (id: string) => void;
  closeTarefa: () => void;
};

const TarefaDrawerCtx = createContext<Ctx | null>(null);

export function TarefaDrawerProvider({ children }: { children: ReactNode }) {
  const [tarefaId, setTarefaId] = useState<string | null>(null);
  const openTarefa = useCallback((id: string) => setTarefaId(id), []);
  const closeTarefa = useCallback(() => setTarefaId(null), []);
  return (
    <TarefaDrawerCtx.Provider value={{ tarefaId, openTarefa, closeTarefa }}>
      {children}
      <TarefaDrawer
        tarefaId={tarefaId}
        onOpenChange={(o) => !o && closeTarefa()}
      />
    </TarefaDrawerCtx.Provider>
  );
}

export function useTarefaDrawer(): Ctx {
  const ctx = useContext(TarefaDrawerCtx);
  if (!ctx) {
    // Fallback no-op when provider missing (e.g. SSR).
    return {
      tarefaId: null,
      openTarefa: () => {},
      closeTarefa: () => {},
    };
  }
  return ctx;
}
