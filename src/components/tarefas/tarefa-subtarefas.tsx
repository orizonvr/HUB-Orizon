import { useState, type KeyboardEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  listSubtarefasByTarefa,
  createSubtarefa,
  toggleSubtarefa,
  deleteSubtarefa,
} from "@/lib/tarefas.functions";
import type { TarefaSubtarefa } from "@/lib/tarefas-types";

type Props = {
  tarefaId: string;
};

export function TarefaSubtarefas({ tarefaId }: Props) {
  const qc = useQueryClient();
  const [novoTitulo, setNovoTitulo] = useState("");

  const listFn = useServerFn(listSubtarefasByTarefa);
  const createFn = useServerFn(createSubtarefa);
  const toggleFn = useServerFn(toggleSubtarefa);
  const deleteFn = useServerFn(deleteSubtarefa);

  const { data, isLoading } = useQuery({
    queryKey: ["tarefa-subtarefas", tarefaId],
    queryFn: () => listFn({ data: { tarefa_id: tarefaId } }),
  });

  const subtarefas = (data?.subtarefas ?? []) as TarefaSubtarefa[];
  const total = subtarefas.length;
  const concluidas = subtarefas.filter((s) => s.concluida).length;
  const percent = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["tarefa-subtarefas", tarefaId] });
    qc.invalidateQueries({ queryKey: ["tarefa", tarefaId] });
    qc.invalidateQueries({ queryKey: ["tarefas"] });
  };

  const createMut = useMutation({
    mutationFn: (titulo: string) =>
      createFn({ data: { tarefa_id: tarefaId, titulo } }),
    onSuccess: () => {
      setNovoTitulo("");
      invalidate();
    },
    onError: (err) => {
      toast.error((err as Error).message || "Erro ao adicionar subtarefa");
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, concluida }: { id: string; concluida: boolean }) =>
      toggleFn({ data: { id, concluida } }),
    onSuccess: invalidate,
    onError: (err) => {
      toast.error((err as Error).message || "Erro ao atualizar subtarefa");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: invalidate,
    onError: (err) => {
      toast.error((err as Error).message || "Erro ao excluir subtarefa");
    },
  });

  const handleAdd = () => {
    const clean = novoTitulo.trim();
    if (!clean || createMut.isPending) return;
    createMut.mutate(clean);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2.5 rounded-lg border bg-card/60 p-3.5 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <CheckSquare className="h-3.5 w-3.5 text-primary" />
          <span>Subtarefas (Checklist)</span>
        </div>
        {total > 0 && (
          <span className="text-[11px] font-medium text-muted-foreground">
            {concluidas} de {total} ({percent}%)
          </span>
        )}
      </div>

      {total > 0 && (
        <Progress value={percent} className="h-1.5 w-full bg-muted/60" />
      )}

      {/* Lista de Subtarefas */}
      <div className="space-y-1.5 pt-1">
        {isLoading ? (
          <div className="py-2 flex justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : subtarefas.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/80 italic py-1">
            Nenhuma subtarefa cadastrada.
          </p>
        ) : (
          subtarefas.map((s) => (
            <div
              key={s.id}
              className="group flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/50 transition-colors"
            >
              <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                <Checkbox
                  checked={s.concluida}
                  onCheckedChange={(checked) =>
                    toggleMut.mutate({ id: s.id, concluida: !!checked })
                  }
                  className="data-[state=checked]:bg-primary shrink-0"
                />
                <span
                  className={cn(
                    "truncate select-text",
                    s.concluida && "line-through text-muted-foreground",
                  )}
                >
                  {s.titulo}
                </span>
              </label>

              <button
                type="button"
                onClick={() => deleteMut.mutate(s.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                title="Excluir subtarefa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Input para adicionar nova subtarefa */}
      <div className="flex items-center gap-2 pt-1">
        <Input
          value={novoTitulo}
          onChange={(e) => setNovoTitulo(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Adicionar subtarefa... (Enter)"
          className="h-8 text-xs px-2.5"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={handleAdd}
          disabled={!novoTitulo.trim() || createMut.isPending}
          className="h-8 px-2.5 text-xs shrink-0"
        >
          {createMut.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
