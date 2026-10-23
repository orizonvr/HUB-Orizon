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
import { cn } from "@/lib/utils";
import { CheckSquare, Bookmark } from "lucide-react";

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
  const isAcompanhamento = t.tipo === "acompanhamento";
  const dimmed = isConcluida || t.status === "cancelada";

  // Verifica atraso para acento de cor
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isAtrasada =
    !isConcluida &&
    !!t.prazo &&
    new Date(t.prazo + "T00:00:00").getTime() < today.getTime();

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
      className={cn(
        "p-3.5 rounded-xl border border-border/80 bg-card shadow-2xs transition-all duration-200 cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between gap-3",
        dimmed && "opacity-60 bg-muted/20",
        isAtrasada && "border-l-[3.5px] border-l-destructive/80",
        !isAtrasada && isAcompanhamento && "border-l-[3.5px] border-l-blue-500/80 bg-blue-50/15 dark:bg-blue-950/10",
        dragging && "shadow-xl ring-2 ring-primary/60 rotate-1",
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-no-card-click]")) return;
        onOpenTask(t);
      }}
    >
      <div className="space-y-2">
        {/* Topo do card: Checkbox + Tipo + Projeto */}
        <div className="flex items-start gap-2">
          <div data-no-card-click onClick={(e) => e.stopPropagation()} className="pt-0.5 shrink-0">
            <Checkbox
              checked={isConcluida}
              onCheckedChange={(c) => handleToggle(c === true)}
              className="cursor-pointer transition-transform active:scale-90"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              {isAcompanhamento ? (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800 shrink-0 gap-1 shadow-2xs"
                >
                  <Bookmark className="h-2.5 w-2.5" />
                  <span>Acompanhamento</span>
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted/60 text-muted-foreground border-border/70 shrink-0 gap-1 shadow-2xs"
                >
                  <CheckSquare className="h-2.5 w-2.5 text-muted-foreground/80" />
                  <span>Padrão</span>
                </Badge>
              )}
              <PrioPill p={t.prioridade} />
            </div>

            <h4
              className={cn(
                "text-xs font-semibold leading-snug line-clamp-2 text-foreground/95 mt-1.5",
                isConcluida && "line-through text-muted-foreground font-normal",
              )}
              title={t.titulo}
            >
              {t.titulo}
            </h4>

            <p className="text-[11px] text-muted-foreground mt-1 truncate flex items-center gap-1 font-medium">
              <span className="truncate">{t.projeto_nome}</span>
              {showTipo && (
                <span className="text-[10px] px-1 py-0 rounded bg-muted/60 border border-border/60 text-muted-foreground shrink-0 font-semibold">
                  {t.projeto_tipo === "ma" ? "M&A" : "NN"}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Indicativo de Subtarefas com micro barra */}
        {t.subtarefas_count && t.subtarefas_count > 0 ? (
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 border border-border/60 text-foreground text-[10px] font-medium"
            title={`${t.subtarefas_concluidas ?? 0} de ${t.subtarefas_count} subtarefas concluídas`}
          >
            <CheckSquare className="h-3 w-3 text-primary shrink-0" />
            <span className="font-semibold text-primary">
              {t.subtarefas_concluidas ?? 0}/{t.subtarefas_count}
            </span>
            <span className="text-muted-foreground">subtarefas</span>
            <div className="ml-auto w-12 h-1.5 bg-muted rounded-full overflow-hidden border border-border/50">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round(((t.subtarefas_concluidas ?? 0) / t.subtarefas_count) * 100)}%`,
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
        <AvatarStack items={t.responsaveis} max={3} size="sm" />
        <span className="text-[11px]">
          <PrazoBadge prazo={t.prazo} concluida={isConcluida} />
        </span>
      </div>
    </Card>
  );
}

function PrioPill({ p }: { p: TarefaPrioridade }) {
  const cls =
    p === "alta"
      ? "border-destructive/35 text-destructive bg-destructive/10 font-semibold"
      : p === "media"
        ? "border-amber-500/35 text-amber-700 dark:text-amber-400 bg-amber-500/10 font-medium"
        : "text-muted-foreground border-border/70 bg-muted/30";
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 rounded", cls)}>
      {PRIORIDADE_LABEL[p]}
    </Badge>
  );
}
