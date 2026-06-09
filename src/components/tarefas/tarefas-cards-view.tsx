import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { toast } from "sonner";
import { updateTarefa } from "@/lib/tarefas.functions";
import {
  PRIORIDADE_LABEL,
  type TarefaComContexto,
  type TarefaPrioridade,
  type TarefaStatus,
} from "@/lib/tarefas-types";
import { PrazoBadge } from "./tarefas-tab";
import { useSessionCompleted } from "@/hooks/use-session-completed";

type Props = {
  tarefas: TarefaComContexto[];
  showTipo?: boolean;
  onOpenTask: (t: TarefaComContexto) => void;
};

export function TarefasCardsView({ tarefas, showTipo, onOpenTask }: Props) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tarefas.map((t) => (
        <TarefaMiniCard
          key={t.id}
          t={t}
          showTipo={showTipo}
          onOpenTask={onOpenTask}
        />
      ))}
    </div>
  );
}

export function TarefaMiniCard({
  t,
  showTipo,
  onOpenTask,
  dragging,
}: {
  t: TarefaComContexto;
  showTipo?: boolean;
  onOpenTask: (t: TarefaComContexto) => void;
  dragging?: boolean;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateTarefa);
  const session = useSessionCompleted();
  const mut = useMutation({
    mutationFn: (status: TarefaStatus) =>
      updateFn({ data: { id: t.id, patch: { status } } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["tarefas-projeto"] });
      qc.invalidateQueries({ queryKey: ["minhas-tarefas"] });
      qc.invalidateQueries({ queryKey: ["resumo-tarefas-time"] });
      qc.invalidateQueries({ queryKey: ["alertas-tarefas"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const isConcluida = t.status === "concluida";
  const dimmed = isConcluida || t.status === "cancelada";

  const handleToggle = (checked: boolean) => {
    if (checked) {
      const previousStatus = t.status;
      session.markCompleted(t.id, previousStatus);
      mut.mutate("concluida");
      toast.success("Tarefa concluída", {
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: () => {
            session.clear(t.id);
            mut.mutate(previousStatus);
          },
        },
      });
    } else {
      session.clear(t.id);
      mut.mutate("pendente");
      toast.success("Tarefa reaberta");
    }
  };

  return (
    <Card
      className={`p-3 transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${
        dimmed ? "opacity-50" : ""
      } ${dragging ? "shadow-lg ring-2 ring-primary/40" : ""}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-no-card-click]")) return;
        onOpenTask(t);
      }}
    >
      <div className="flex items-start gap-2">
        <div data-no-card-click onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isConcluida}
            onCheckedChange={(c) => handleToggle(c === true)}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium leading-snug line-clamp-2 ${
              isConcluida ? "line-through" : ""
            }`}
            title={t.titulo}
          >
            {t.titulo}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {t.projeto_nome}
            {showTipo && (
              <span className="ml-1">
                · {t.projeto_tipo === "ma" ? "M&A" : "NN"}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <AvatarStack items={t.responsaveis} max={3} size="sm" />
        <div className="flex items-center gap-1.5">
          <PrioPill p={t.prioridade} />
          <span className="text-[11px]">
            <PrazoBadge prazo={t.prazo} concluida={isConcluida} />
          </span>
        </div>
      </div>
    </Card>
  );
}

function PrioPill({ p }: { p: TarefaPrioridade }) {
  const cls =
    p === "alta"
      ? "border-destructive/40 text-destructive"
      : p === "media"
        ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
        : "text-muted-foreground";
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cls}`}>
      {PRIORIDADE_LABEL[p]}
    </Badge>
  );
}
