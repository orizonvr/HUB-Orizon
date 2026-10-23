import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Inbox, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatBRL,
  formatMonthYear,
  healthFor,
  HEALTH_BG,
  HEALTH_LABEL,
  initials,
  STATUS_LABEL,
} from "@/lib/ma-utils";
import {
  avatarBgStyle,
  formatPercentOrizon,
  formatTonDia,
} from "@/lib/format";
import { SUBCATEGORIA_LABEL } from "@/lib/projetos-types";
import type { Profile, Projeto } from "@/lib/projetos.functions";
import type { ProjetoConfig } from "@/lib/projetos-config";

const ESTAGIOS_MA_TAREFAS_RAPIDAS = new Set([
  "nbo_submetida",
  "due_diligence",
  "negociacao",
  "opcao_compra_assinada",
  "assinatura_spa",
  "pos_ma_integracao",
]);

interface ProjetosCardsViewProps {
  config: ProjetoConfig;
  projetos: Projeto[];
  profileMap: Map<string, Profile>;
  onOpen: (id: string) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onNovaTarefa?: (p: Projeto) => void;
}

export function ProjetosCardsView({
  config,
  projetos,
  profileMap,
  onOpen,
  selectedIds,
  onToggleSelect,
  onNovaTarefa,
}: ProjetosCardsViewProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  if (projetos.length === 0) {
    return (
      <Card className="rounded-xl border border-border/80 bg-card p-12 text-center shadow-2xs">
        <Inbox className="mx-auto h-9 w-9 text-muted-foreground/40" />
        <h3 className="mt-3 text-sm font-semibold text-foreground">
          Nenhum projeto encontrado
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Tente ajustar os filtros ou a busca para localizar seus projetos.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {projetos.map((p) => {
        const resp = p.responsavel_id
          ? profileMap.get(p.responsavel_id)
          : undefined;
        const h = healthFor(p);
        const canQuickTask =
          p.tipo === "novos_negocios" ||
          ESTAGIOS_MA_TAREFAS_RAPIDAS.has(p.estagio);

        // Acento lateral esquerdo de saúde/urgência
        const borderAccentClass =
          h === "vermelho"
            ? "border-l-destructive"
            : h === "amarelo"
              ? "border-l-amber-500"
              : "border-l-emerald-500/90";

        const isSelected = selectedSet.has(p.id);

        return (
          <Card
            key={p.id}
            onClick={() => onOpen(p.id)}
            className={cn(
              "p-3.5 rounded-xl border border-border/80 bg-card shadow-2xs transition-all duration-200 cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between gap-3 border-l-[3.5px]",
              borderAccentClass,
              isSelected && "ring-2 ring-primary/80 border-primary bg-primary/2",
            )}
          >
            <div className="space-y-2">
              {/* 1. TOPO: CHECKBOX DE SELEÇÃO + BADGES DE METADADOS + SAÚDE */}
              <div className="flex items-start gap-2">
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="pt-0.5 shrink-0"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect(p.id)}
                    aria-label="Selecionar para comparar"
                    className="cursor-pointer rounded transition-transform active:scale-90"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap">
                      {p.setor && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0.2 rounded font-medium border-border/70 bg-muted/40 text-muted-foreground shrink-0 shadow-2xs"
                        >
                          {p.setor}
                        </Badge>
                      )}
                      {p.subcategoria && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-primary/10 text-primary border-primary/20 shrink-0 shadow-2xs"
                        >
                          {SUBCATEGORIA_LABEL[p.subcategoria] ?? p.subcategoria}
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0.2 rounded font-medium shrink-0"
                      >
                        {config.estagioLabels[p.estagio] ?? p.estagio}
                      </Badge>
                    </div>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`h-2.5 w-2.5 rounded-full ring-2 ring-background ${HEALTH_BG[h]} shrink-0`}
                        />
                      </TooltipTrigger>
                      <TooltipContent>{HEALTH_LABEL[h]}</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Título do Projeto */}
                  <h4 className="text-xs font-semibold leading-snug line-clamp-2 text-foreground/95 mt-1.5 group-hover:text-primary transition-colors">
                    {p.nome}
                  </h4>
                  {p.contraparte && (
                    <div className="text-[10px] font-medium text-muted-foreground truncate mt-0.5">
                      {p.contraparte}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. VALOR FINANCEIRO EM DESTAQUE */}
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-muted/25 border border-border/60">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-bold text-primary font-mono tracking-tight">
                    {formatBRL(p.valor_estimado)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {config.valorColLabel}
                  </span>
                </div>

                {p.tipo === "ma" && p.volume_ton_dia != null && (
                  <span className="text-[10px] font-mono font-medium text-muted-foreground">
                    {formatTonDia(p.volume_ton_dia)}
                  </span>
                )}
                {p.tipo === "ma" &&
                  p.percentual_orizon != null &&
                  Number(p.percentual_orizon) !== 100 && (
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      {formatPercentOrizon(p.percentual_orizon)} Orizon
                    </span>
                  )}
              </div>

              {/* Tese estratégica resumida (se houver) */}
              {p.tese && (
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed bg-muted/20 p-2 rounded-md border border-border/40">
                  {p.tese}
                </p>
              )}
            </div>

            {/* 3. RODAPÉ: RESPONSÁVEL + TAREFA RÁPIDA + PREVISÃO */}
            <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                {resp ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-6 w-6 border border-border/70 shrink-0">
                        <AvatarFallback
                          className="text-[9px] font-bold"
                          style={avatarBgStyle(resp.nome_completo)}
                        >
                          {initials(resp.nome_completo)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>{resp.nome_completo}</TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-[10px] text-muted-foreground">—</span>
                )}

                {canQuickTask && onNovaTarefa && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                          onClick={() => onNovaTarefa(p)}
                        >
                          <Plus className="h-3 w-3 mr-0.5" />
                          Tarefa
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Adicionar tarefa para este deal</TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span className="text-[10px] font-mono font-semibold">
                  {formatMonthYear(p.data_fechamento_prevista)}
                </span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
