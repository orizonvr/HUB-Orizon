import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ListTodo,
  Calendar,
  Users,
  Plus,
  Briefcase,
  AlertCircle,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createTarefa, listAllProjetosLite } from "@/lib/tarefas.functions";
import {
  PRIORIDADE_LABEL,
  TIPO_LABEL,
  type TarefaPrioridade,
  type TarefaTipo,
} from "@/lib/tarefas-types";
import type { Profile } from "@/lib/projetos.functions";
import { MultiProfileSelect } from "@/components/ui/multi-profile-select";
import { useSuspendParentModal } from "@/components/ma/nested-modal-context";
import { isResponsavelElegivel } from "@/lib/projetos-config";

type ProjetoTipo = "ma" | "novos_negocios";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profiles: Profile[];
  /** When provided, both Tipo and Projeto fields are locked. */
  projetoFixo?: { id: string; nome: string } | null;
  /** Pre-selects (but doesn't lock) Tipo when no projetoFixo is given. */
  tipoPadrao?: ProjetoTipo | null;
  /** @deprecated kept for backward-compat; projetos are now fetched internally. */
  projetos?: Array<{ id: string; nome: string }>;
  defaultResponsavelId?: string | null;
  onCreated?: () => void;
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

const PRIORIDADE_COLOR: Record<TarefaPrioridade, { dot: string; text: string }> = {
  baixa: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  media: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  alta: { dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-400" },
};

export function NovaTarefaDialog({
  open,
  onOpenChange,
  profiles,
  projetoFixo,
  tipoPadrao,
  defaultResponsavelId,
  onCreated,
}: Props) {
  useSuspendParentModal(open);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoProjeto, setTipoProjeto] = useState<ProjetoTipo | "">("");
  const [tarefaTipo, setTarefaTipo] = useState<TarefaTipo>("tarefa");
  const [projetoId, setProjetoId] = useState<string>("");
  const [responsavelIds, setResponsavelIds] = useState<string[]>(
    defaultResponsavelId ? [defaultResponsavelId] : [],
  );
  const [dependenciaValue, setDependenciaValue] = useState<string>("nenhuma");
  const [prazo, setPrazo] = useState<string>(plus7DaysISO());
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>("media");

  const qc = useQueryClient();
  const listProjetosFn = useServerFn(listAllProjetosLite);

  const { data: projetosData } = useQuery({
    queryKey: ["projetos-lite-all"],
    queryFn: () => listProjetosFn(),
    staleTime: 60_000,
  });

  const allProjetos = useMemo(
    () => projetosData?.projetos ?? [],
    [projetosData],
  );

  const projetosByTipo = useMemo(() => {
    const ma = allProjetos.filter((p) => p.tipo === "ma");
    const nn = allProjetos.filter((p) => p.tipo === "novos_negocios");
    return { ma, novos_negocios: nn };
  }, [allProjetos]);

  useEffect(() => {
    if (!open) return;
    if (projetoFixo) {
      setProjetoId(projetoFixo.id);
      const match = allProjetos.find((p) => p.id === projetoFixo.id);
      if (match) setTipoProjeto(match.tipo as ProjetoTipo);
    } else {
      setTipoProjeto(tipoPadrao ?? "");
      setProjetoId("");
    }
    setTitulo("");
    setDescricao("");
    setTarefaTipo("tarefa");
    setResponsavelIds(defaultResponsavelId ? [defaultResponsavelId] : []);
    setDependenciaValue("nenhuma");
    setPrazo(plus7DaysISO());
    setPrioridade("media");
  }, [open, projetoFixo, tipoPadrao, defaultResponsavelId, allProjetos]);

  const handleTipoProjetoChange = (nextTipo: ProjetoTipo) => {
    setTipoProjeto(nextTipo);
    setProjetoId("");
  };

  const createFn = useServerFn(createTarefa);
  const mut = useMutation({
    mutationFn: () => {
      const depTipo: "nenhum" | "terceiros" | "usuario" =
        dependenciaValue === "nenhuma"
          ? "nenhum"
          : dependenciaValue === "terceiros"
            ? "terceiros"
            : "usuario";
      const depUserId = depTipo === "usuario" ? dependenciaValue : null;

      return createFn({
        data: {
          projeto_id: projetoId,
          tipo: tarefaTipo,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          prazo: tarefaTipo === "acompanhamento" ? prazo || null : prazo,
          prioridade,
          responsavel_id: responsavelIds[0] ?? null,
          responsavel_ids: responsavelIds,
          dependencia_tipo: depTipo,
          dependencia_user_id: depUserId,
        },
      });
    },
    onSuccess: () => {
      toast.success("Tarefa criada com sucesso!");
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["tarefas-projeto", projetoId] });
      qc.invalidateQueries({ queryKey: ["minhas-tarefas"] });
      qc.invalidateQueries({ queryKey: ["resumo-tarefas-time"] });
      qc.invalidateQueries({ queryKey: ["alertas-tarefas"] });
      onOpenChange(false);
      onCreated?.();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const isAcompanhamento = tarefaTipo === "acompanhamento";
  const canSubmit =
    titulo.trim().length > 0 &&
    projetoId.length > 0 &&
    responsavelIds.length > 0 &&
    (isAcompanhamento || prazo.length === 10) &&
    !mut.isPending;

  const projetosDisponiveis = tipoProjeto ? projetosByTipo[tipoProjeto] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* ========================================================= */}
        {/* HERO BANNER DO MODAL (PADRÃO BANNER EXECUTIVO DO DASHBOARD) */}
        {/* ========================================================= */}
        <div className="relative overflow-hidden bg-primary text-primary-foreground px-6 py-4.5 border-b border-primary/20 shrink-0">
          {/* Marca d'água circular oficial da Orizon */}
          <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.10] select-none">
            <img
              src="/brand/orizon-symbol.png"
              alt=""
              aria-hidden="true"
              className="h-44 w-44 rounded-full object-cover filter contrast-125"
            />
          </div>

          <div className="relative z-10 flex items-start gap-3.5 pr-12">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
              <ListTodo className="h-5 w-5" />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                  Nova Tarefa
                </DialogTitle>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-semibold tracking-wide text-white/90 uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>{isAcompanhamento ? "Acompanhamento" : "Execução"}</span>
                </span>
              </div>
              <DialogDescription className="text-xs text-white/75 font-normal leading-relaxed truncate max-w-lg">
                {projetoFixo
                  ? `Vinculada diretamente ao projeto ${projetoFixo.nome}.`
                  : "Defina o escopo, responsáveis e prazos alinhados ao projeto."}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Corpo Scrollável com Seções Agrupadas */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Seção 1: Enquadramento & Projeto */}
          <div className="rounded-xl border border-border/70 bg-secondary/25 p-4 space-y-3.5">
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-primary/80" />
              Vinculação de Pipeline
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Classificação</Label>
                <Select
                  value={tarefaTipo}
                  onValueChange={(v) => setTarefaTipo(v as TarefaTipo)}
                >
                  <SelectTrigger className="rounded-xl bg-background border-border/80 focus:ring-primary/25">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(TIPO_LABEL).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Pipeline</Label>
                <Select
                  value={tipoProjeto || undefined}
                  onValueChange={(v) => handleTipoProjetoChange(v as ProjetoTipo)}
                  disabled={!!projetoFixo}
                >
                  <SelectTrigger className="rounded-xl bg-background border-border/80 focus:ring-primary/25">
                    <SelectValue placeholder="Selecione o pipeline" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="ma">M&amp;A</SelectItem>
                    <SelectItem value="novos_negocios">Novos Negócios</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium text-foreground">
                  Projeto <span className="text-destructive">*</span>
                </Label>
                {projetoFixo ? (
                  <Input
                    value={projetoFixo.nome}
                    disabled
                    className="rounded-xl bg-muted/50 border-border/80 font-medium"
                  />
                ) : (
                  <Select
                    value={projetoId || undefined}
                    onValueChange={setProjetoId}
                    disabled={!tipoProjeto}
                  >
                    <SelectTrigger className="rounded-xl bg-background border-border/80 focus:ring-primary/25">
                      <SelectValue
                        placeholder={
                          tipoProjeto ? "Selecione o projeto" : "Selecione o pipeline primeiro"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {projetosDisponiveis.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>

          {/* Seção 2: Escopo da Tarefa */}
          <div className="rounded-xl border border-border/70 bg-secondary/25 p-4 space-y-3.5">
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              Definição do Escopo
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Título da tarefa <span className="text-destructive">*</span>
                </Label>
                <Input
                  autoFocus
                  className="rounded-xl bg-background border-border/80 focus-visible:ring-primary/25"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Revisar NBO e premissas jurídicas com time tributário"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Contexto / Primeiro comentário (opcional)</Label>
                <Textarea
                  className="rounded-xl bg-background border-border/80 focus-visible:ring-primary/25 text-xs resize-none"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Links de documentos, orientações ou pontos de atenção para o responsável…"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Atribuição, Prazos & Prioridade */}
          <div className="rounded-xl border border-border/70 bg-secondary/25 p-4 space-y-3.5">
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary/80" />
              Atribuição & Governança
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Responsáveis <span className="text-destructive">*</span>
                </Label>
                <MultiProfileSelect
                  options={profiles
                    .filter(isResponsavelElegivel)
                    .map((p) => ({ id: p.id, label: p.nome_completo }))}
                  value={responsavelIds}
                  onChange={setResponsavelIds}
                  placeholder="Selecione os membros"
                  compact
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Dependência</Label>
                <Select
                  value={dependenciaValue}
                  onValueChange={setDependenciaValue}
                >
                  <SelectTrigger className="rounded-xl bg-background border-border/80 focus:ring-primary/25">
                    <SelectValue placeholder="Selecione dependência" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="nenhuma">Nenhuma</SelectItem>
                    <SelectItem value="terceiros">
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        Terceiros (Consultoria / Auditoria)
                      </span>
                    </SelectItem>
                    {profiles.filter(isResponsavelElegivel).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    Prazo {!isAcompanhamento && <span className="text-destructive">*</span>}
                  </Label>
                  {isAcompanhamento && (
                    <span className="text-[10px] text-muted-foreground">Opcional</span>
                  )}
                </div>
                <Input
                  type="date"
                  className="rounded-xl bg-background border-border/80 focus-visible:ring-primary/25"
                  value={prazo}
                  min={todayISO()}
                  onChange={(e) => setPrazo(e.target.value)}
                  placeholder={isAcompanhamento ? "Sem prazo" : undefined}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>Prioridade</span>
                  <span className={cn("text-[11px] font-semibold flex items-center gap-1", PRIORIDADE_COLOR[prioridade].text)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", PRIORIDADE_COLOR[prioridade].dot)} />
                    {PRIORIDADE_LABEL[prioridade]}
                  </span>
                </Label>
                <Select
                  value={prioridade}
                  onValueChange={(v) => setPrioridade(v as TarefaPrioridade)}
                >
                  <SelectTrigger className="rounded-xl bg-background border-border/80 focus:ring-primary/25">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(PRIORIDADE_LABEL).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", PRIORIDADE_COLOR[k as TarefaPrioridade].dot)} />
                          <span>{l}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Fixo */}
        <div className="p-4 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-border/80 hover:bg-secondary/60 cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="rounded-xl font-medium shadow-xs cursor-pointer gap-2"
            disabled={!canSubmit || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Criar tarefa
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
