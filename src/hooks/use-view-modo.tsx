import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPreferencias, updatePreferencias } from "@/lib/preferencias.functions";
import type { ViewTarefasModo } from "@/lib/notificacoes-types";

export function useViewModo() {
  const qc = useQueryClient();
  const getFn = useServerFn(getPreferencias);
  const setFn = useServerFn(updatePreferencias);
  const q = useQuery({
    queryKey: ["preferencias"],
    queryFn: () => getFn(),
    staleTime: 60_000,
  });
  const modo: ViewTarefasModo = q.data?.preferencias.view_tarefas_modo ?? "kanban";
  const mut = useMutation({
    mutationFn: (m: ViewTarefasModo) =>
      setFn({ data: { view_tarefas_modo: m } }),
    onSuccess: (res) => {
      qc.setQueryData(["preferencias"], res);
    },
  });
  return {
    modo,
    setModo: (m: ViewTarefasModo) => mut.mutate(m),
    ready: !q.isLoading,
  };
}
