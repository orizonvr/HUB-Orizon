import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Calendar,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  FileText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  createTarefasBatch,
  listAllProjetosLite,
} from "@/lib/tarefas.functions";
import { PRIORIDADE_LABEL, type TarefaPrioridade } from "@/lib/tarefas-types";
import type { Profile } from "@/lib/projetos.functions";
import { MultiProfileSelect } from "@/components/ui/multi-profile-select";
import { cn } from "@/lib/utils";

type ProjetoTipo = "ma" | "novos_negocios";

type Linha = {
  key: string;
  tipo: ProjetoTipo | "";
  projeto_id: string;
  titulo: string;
  responsavel_ids: string[];
  prazo: string;
  prioridade: TarefaPrioridade;
  descricao: string;
  notaAberta: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profiles: Profile[];
  defaultResponsavelId?: string | null;
  /** Pre-selects tipo on every new line and locks (used in scoped workspace views). */
  tipoPadrao?: ProjetoTipo | null;
  /** Pre-selects a single projeto on every new line (overrides tipoPadrao behavior). */
  projetoPadraoId?: string | null;
};

function todayISO(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function plus7DaysISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function novaLinha(defaults: Partial<Linha>): Linha {
  return {
    key: crypto.randomUUID(),
    tipo: defaults.tipo ?? "",
    projeto_id: defaults.projeto_id ?? "",
    titulo: "",
    responsavel_ids: defaults.responsavel_ids ?? [],
    prazo: defaults.prazo ?? plus7DaysISO(),
    prioridade: defaults.prioridade ?? "media",
    descricao: "",
    notaAberta: false,
  };
}

export function NovaRodadaDrawer({
  open,
  onOpenChange,
  profiles,
  defaultResponsavelId,
  tipoPadrao,
  projetoPadraoId,
}: Props) {
  const [dataReuniao, setDataReuniao] = useState<string>(todayISO());
  const [linhas, setLinhas] = useState<Linha[]>([]);

  const projetosFn = useServerFn(listAllProjetosLite);
  const projsQ = useQuery({
    queryKey: ["projetos-lite"],
    queryFn: () => projetosFn(),
    enabled: open,
  });
  const projetos = projsQ.data?.projetos ?? [];
  const projetosByTipo = useMemo(() => {
    const map: Record<ProjetoTipo, typeof projetos> = {
      ma: [],
      novos_negocios: [],
    };
    for (const p of projetos) map[p.tipo].push(p);
    return map;
  }, [projetos]);
  const projetoTipoMap = useMemo(() => {
    const m = new Map<string, ProjetoTipo>();
    for (const p of projetos) m.set(p.id, p.tipo);
    return m;
  }, [projetos]);

  useEffect(() => {
    if (!open) return;
    setDataReuniao(todayISO());
    const tipoInicial: ProjetoTipo | "" =
      tipoPadrao ??
      (projetoPadraoId
        ? projetoTipoMap.get(projetoPadraoId) ?? ""
        : "");
    const base: Partial<Linha> = {
      tipo: tipoInicial,
      projeto_id: projetoPadraoId ?? "",
      responsavel_ids: defaultResponsavelId ? [defaultResponsavelId] : [],
    };
    setLinhas([novaLinha(base), novaLinha(base), novaLinha(base)]);
  }, [open, tipoPadrao, projetoPadraoId, defaultResponsavelId, projetoTipoMap]);

  const updateLinha = (key: string, patch: Partial<Linha>) => {
    setLinhas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };
  const onChangeTipo = (key: string, tipo: ProjetoTipo | "") => {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        // Limpa projeto se mudou de tipo
        const keepProj =
          l.projeto_id && projetoTipoMap.get(l.projeto_id) === tipo;
        return { ...l, tipo, projeto_id: keepProj ? l.projeto_id : "" };
      }),
    );
  };
  const addLinha = () => {
    setLinhas((prev) => [
      ...prev,
      novaLinha({
        tipo: tipoPadrao ?? "",
        projeto_id: projetoPadraoId ?? "",
        responsavel_ids: defaultResponsavelId ? [defaultResponsavelId] : [],
      }),
    ]);
  };
  const removeLinha = (key: string) => {
    setLinhas((prev) =>
      prev.length === 1 ? prev : prev.filter((l) => l.key !== key),
    );
  };

  const qc = useQueryClient();
  const batchFn = useServerFn(createTarefasBatch);
  const mut = useMutation({
    mutationFn: () => {
      const validas = linhas.filter(
        (l) =>
          l.tipo &&
          l.projeto_id &&
          l.titulo.trim().length > 0 &&
          l.responsavel_ids.length > 0 &&
          l.prazo.length === 10,
      );
      if (validas.length === 0) {
        throw new Error("Preencha ao menos uma linha completa.");
      }
      return batchFn({
        data: {
          data_reuniao: dataReuniao,
          tarefas: validas.map((l) => ({
            projeto_id: l.projeto_id,
            titulo: l.titulo.trim(),
            responsavel_ids: l.responsavel_ids,
            prazo: l.prazo,
            prioridade: l.prioridade,
            descricao: l.descricao.trim() ? l.descricao.trim() : null,
          })),
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`${res.count} tarefa(s) criada(s) na rodada.`);
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["tarefas-projeto"] });
      qc.invalidateQueries({ queryKey: ["minhas-tarefas"] });
      qc.invalidateQueries({ queryKey: ["resumo-tarefas-time"] });
      qc.invalidateQueries({ queryKey: ["alertas-tarefas"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const validas = linhas.filter(
    (l) =>
      l.tipo &&
      l.projeto_id &&
      l.titulo.trim().length > 0 &&
      l.responsavel_ids.length > 0 &&
      l.prazo.length === 10,
  ).length;

  const handleLastEnter = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter" && !e.shiftKey && idx === linhas.length - 1) {
      e.preventDefault();
      addLinha();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl h-[92vh] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl">
        {/* ========================================================= */}
        {/* 1. HERO BANNER EXECUTIVO INSTITUCIONAL (PADRÃO ORIZONVR)  */}
        {/* ========================================================= */}
        <div className="relative overflow-hidden bg-primary text-primary-foreground px-6 py-4.5 border-b border-primary/20 shrink-0 select-none">
          {/* Marca d'água circular oficial da Orizon */}
          <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.10]">
            <img
              src="/brand/orizon-symbol.png"
              alt=""
              aria-hidden="true"
              className="h-56 w-56 rounded-full object-cover filter contrast-125"
            />
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pr-12">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
                <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-white leading-tight">
                    Reunião de Pipeline
                  </DialogTitle>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-semibold tracking-wide text-white uppercase backdrop-blur-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Lançamento em Lote
                  </span>
                </div>
                <DialogDescription className="text-xs text-white/80 font-normal leading-relaxed truncate max-w-2xl">
                  Registre deliberações e atribua tarefas decididas na reunião semanal com origem institucional e rastreabilidade.
                </DialogDescription>
              </div>
            </div>

            {/* Controle de Data da Reunião no Header */}
            <div className="flex items-center gap-2.5 shrink-0 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 backdrop-blur-xs">
              <Calendar className="h-4 w-4 text-white/80" />
              <div className="flex flex-col">
                <span className="text-[10px] font-medium text-white/70 uppercase tracking-wider">
                  Data da Reunião
                </span>
                <input
                  type="date"
                  value={dataReuniao}
                  onChange={(e) => setDataReuniao(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer scheme-dark"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. SUB-BARRA DE STATUS & ATALHOS                          */}
        {/* ========================================================= */}
        <div className="px-6 py-2.5 border-b border-border/70 bg-muted/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                validas > 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
              )}
            >
              {validas > 0 ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              <span>
                {validas} de {linhas.length} tarefa{linhas.length === 1 ? "" : "s"} preenchida{validas === 1 ? "" : "s"}
              </span>
            </span>
            <span className="hidden sm:inline text-xs text-muted-foreground">
              · Pressione <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/80 text-[10px] font-mono">Enter</kbd> no último título para nova linha
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLinha}
            className="h-7.5 px-3 text-xs font-medium rounded-lg gap-1.5 shadow-2xs cursor-pointer hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5 text-primary" />
            Adicionar Linha
          </Button>
        </div>

        {/* ========================================================= */}
        {/* 3. GRID EXECUTIVO DE TAREFAS                              */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {/* Cabeçalho de Colunas */}
          <div className="grid grid-cols-[120px_1.1fr_1.8fr_1.3fr_160px_125px_36px_36px] gap-2.5 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground select-none">
            <div className="flex items-center gap-1">
              <Briefcase className="h-3 w-3 text-primary/70" />
              Pipeline
            </div>
            <div>Projeto Vinculado</div>
            <div>Título da Tarefa</div>
            <div>Responsáveis</div>
            <div>Prazo</div>
            <div>Prioridade</div>
            <div className="text-center" title="Observações">Obs</div>
            <div className="text-center" title="Remover">Ação</div>
          </div>

          {/* Linhas de Entrada em Lote */}
          <div className="space-y-2">
            {linhas.map((l, idx) => {
              const projetosDisponiveis = l.tipo
                ? projetosByTipo[l.tipo]
                : [];
              const isValida =
                l.tipo &&
                l.projeto_id &&
                l.titulo.trim().length > 0 &&
                l.responsavel_ids.length > 0 &&
                l.prazo.length === 10;

              return (
                <div
                  key={l.key}
                  className={cn(
                    "rounded-xl border p-2.5 space-y-2 transition-all duration-150",
                    isValida
                      ? "bg-card border-border/80 hover:border-border shadow-2xs"
                      : "bg-muted/15 border-border/60 hover:border-border/90",
                  )}
                >
                  <div className="grid grid-cols-[120px_1.1fr_1.8fr_1.3fr_160px_125px_36px_36px] gap-2.5 items-center">
                    {/* 1. Tipo do Pipeline */}
                    <Select
                      value={l.tipo || undefined}
                      onValueChange={(v) =>
                        onChangeTipo(l.key, v as ProjetoTipo)
                      }
                    >
                      <SelectTrigger className="h-9 rounded-lg text-xs bg-background border-border/80">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="ma" className="text-xs">
                          M&amp;A
                        </SelectItem>
                        <SelectItem value="novos_negocios" className="text-xs">
                          Novos Negócios
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {/* 2. Projeto do Pipeline */}
                    <Select
                      value={l.projeto_id || undefined}
                      onValueChange={(v) =>
                        updateLinha(l.key, { projeto_id: v })
                      }
                      disabled={!l.tipo}
                    >
                      <SelectTrigger className="h-9 rounded-lg text-xs bg-background border-border/80">
                        <SelectValue
                          placeholder={l.tipo ? "Projeto" : "Aguardando tipo"}
                        />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl max-h-60">
                        {projetosDisponiveis.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* 3. Título da Tarefa */}
                    <Input
                      placeholder="Ex.: Revisar NBO com o jurídico..."
                      value={l.titulo}
                      onChange={(e) =>
                        updateLinha(l.key, { titulo: e.target.value })
                      }
                      onKeyDown={(e) => handleLastEnter(e, idx)}
                      className="h-9 rounded-lg text-xs bg-background border-border/80 focus-visible:ring-primary/25"
                    />

                    {/* 4. Múltiplos Responsáveis */}
                    <MultiProfileSelect
                      options={profiles.map((p) => ({
                        id: p.id,
                        label: p.nome_completo,
                      }))}
                      value={l.responsavel_ids}
                      onChange={(ids: string[]) =>
                        updateLinha(l.key, { responsavel_ids: ids })
                      }
                      placeholder="Atribuir..."
                      triggerClassName="h-9 rounded-lg text-xs bg-background border-border/80"
                      compact
                    />

                    {/* 5. Prazo */}
                    <Input
                      type="date"
                      value={l.prazo}
                      onChange={(e) =>
                        updateLinha(l.key, { prazo: e.target.value })
                      }
                      className="h-9 w-full rounded-lg text-xs bg-background border-border/80 px-2.5 cursor-pointer tabular-nums [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-75 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                    />

                    {/* 6. Prioridade */}
                    <Select
                      value={l.prioridade}
                      onValueChange={(v) =>
                        updateLinha(l.key, {
                          prioridade: v as TarefaPrioridade,
                        })
                      }
                    >
                      <SelectTrigger className="h-9 rounded-lg text-xs bg-background border-border/80 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {Object.entries(PRIORIDADE_LABEL).map(([k, lbl]) => (
                          <SelectItem key={k} value={k} className="text-xs">
                            {lbl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* 7. Observação Toggle */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-9 w-9 rounded-lg transition-colors cursor-pointer",
                        l.descricao.trim()
                          ? "text-primary bg-primary/10 hover:bg-primary/15"
                          : l.notaAberta
                            ? "text-foreground bg-muted hover:bg-muted/80"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      )}
                      onClick={() =>
                        updateLinha(l.key, { notaAberta: !l.notaAberta })
                      }
                      title={
                        l.notaAberta ? "Recolher observação" : "Adicionar observação detalhada"
                      }
                    >
                      {l.notaAberta ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </Button>

                    {/* 8. Remover Linha */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer disabled:opacity-30"
                      onClick={() => removeLinha(l.key)}
                      disabled={linhas.length === 1}
                      title="Remover linha"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Campo de Observação Expandido */}
                  {l.notaAberta && (
                    <div className="pt-2 pl-34.5 pr-20">
                      <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5 space-y-1.5">
                        <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                          <FileText className="h-3 w-3 text-primary" />
                          Instruções / Contexto para os Responsáveis (opcional)
                        </Label>
                        <Textarea
                          value={l.descricao}
                          onChange={(e) =>
                            updateLinha(l.key, { descricao: e.target.value })
                          }
                          placeholder="Detalhes adicionais, links de documentos, requisitos alinhados na reunião..."
                          rows={2}
                          className="text-xs rounded-lg bg-background resize-y"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Botão de Adicionar Linha ao Fim da Lista */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLinha}
            className="w-full h-9 rounded-xl border border-dashed border-border/80 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 cursor-pointer gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar outra linha de tarefa
          </Button>
        </div>

        {/* ========================================================= */}
        {/* 4. FOOTER EXECUTIVO COM AÇÕES                             */}
        {/* ========================================================= */}
        <DialogFooter className="px-6 py-3.5 border-t border-border/70 bg-card/95 backdrop-blur-xs flex flex-row items-center justify-between sm:justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="font-medium">
              Origem vinculada:{" "}
              <strong className="text-foreground font-semibold">
                Reunião de pipeline
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8.5 px-3.5 text-xs font-medium rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={validas === 0 || mut.isPending}
              onClick={() => mut.mutate()}
              className="h-8.5 px-4 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer disabled:opacity-50 gap-1.5"
            >
              {mut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Salvar {validas > 0 ? `${validas} Tarefa${validas === 1 ? "" : "s"}` : "Rodada"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

