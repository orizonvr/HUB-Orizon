import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AvatarStack } from "@/components/ui/avatar-stack";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  CalendarPlus,
  Search,
  Inbox,
  Loader2,
  ChevronRight,
  ChevronDown,
  Upload,
  Bookmark,
  CheckSquare,
  ListTodo,
  RotateCcw,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  listTarefasByTipo,
  listAllProjetosLite,
  updateTarefa,
} from "@/lib/tarefas.functions";
import { listProfiles } from "@/lib/projetos.functions";
import {
  PRIORIDADE_LABEL,
  STATUS_LABEL,
  ORIGEM_LABEL,
  type TarefaComContexto,
  type TarefaPrioridade,
  type TarefaStatus,
  type TarefaTipo,
} from "@/lib/tarefas-types";
import { NovaTarefaDialog } from "@/components/tarefas/nova-tarefa-dialog";
import { NovaRodadaDrawer } from "@/components/tarefas/nova-rodada-drawer";
import { ImportPlannerDialog } from "@/components/tarefas/import-planner-dialog";
import { PrazoBadge } from "@/components/tarefas/tarefas-tab";
import { useAuth } from "@/hooks/use-auth";
import { useSessionCompleted } from "@/hooks/use-session-completed";
import { ViewModoToggle } from "@/components/tarefas/view-modo-toggle";
import { useViewModo } from "@/hooks/use-view-modo";
import { TarefasCardsView } from "@/components/tarefas/tarefas-cards-view";
import { TarefasKanbanView } from "@/components/tarefas/tarefas-kanban-view";
import { TarefasKpiStrip } from "@/components/tarefas/tarefas-kpi-strip";
import { TarefasFilterBar } from "@/components/tarefas/tarefas-filter-bar";
import { useTarefaDrawer } from "@/hooks/use-tarefa-drawer";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas — OrizonVR | Pipeline Alocação de Capital" },
      {
        name: "description",
        content: "Tarefas atreladas a projetos de M&A e Novos Negócios.",
      },
    ],
  }),
  component: TarefasPage,
});

type Escopo = "minhas" | "time" | "todas";
type PrazoFilter = "todos" | "vencidas" | "hoje" | "7d" | "30d";

function TarefasPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const tarefasFn = useServerFn(listTarefasByTipo);
  const projetosFn = useServerFn(listAllProjetosLite);
  const profilesFn = useServerFn(listProfiles);

  const initialEscopo: Escopo = (() => {
    if (typeof window === "undefined") return "minhas";
    const s = new URLSearchParams(window.location.search).get("escopo");
    return s === "time" || s === "todas" ? s : "minhas";
  })();
  const initialResp = (() => {
    if (typeof window === "undefined") return "all";
    return new URLSearchParams(window.location.search).get("resp") ?? "all";
  })();

  const [escopo, setEscopo] = useState<Escopo>(initialEscopo);
  const [fTipo, setFTipo] = useState<string>("all"); // "ma" | "novos_negocios" | "all"
  const [fClassificacao, setFClassificacao] = useState<string>("all"); // "tarefa" | "acompanhamento" | "all"
  const [fDep, setFDep] = useState<string>("all"); // "com_dep" | "terceiros" | "sem_dep" | "all"
  const [fResp, setFResp] = useState<string>(initialResp);
  const [fStatus, setFStatus] = useState<string>("ativas");
  const [fPrio, setFPrio] = useState<string>("all");
  const [fOrigem, setFOrigem] = useState<string>("all");
  const [fPrazo, setFPrazo] = useState<PrazoFilter>("todos");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showRodada, setShowRodada] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const setEscopoUrl = (val: Escopo) => {
    setEscopo(val);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (val === "minhas") url.searchParams.delete("escopo");
    else url.searchParams.set("escopo", val);
    window.history.replaceState(null, "", url.toString());
  };

  const setRespUrl = (val: string) => {
    setFResp(val);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (val === "all") url.searchParams.delete("resp");
    else url.searchParams.set("resp", val);
    window.history.replaceState(null, "", url.toString());
  };

  const tarefasQ = useQuery({
    queryKey: ["tarefas"],
    queryFn: () => tarefasFn({ data: { tipo: null } }),
  });
  const projsQ = useQuery({
    queryKey: ["projetos-lite"],
    queryFn: () => projetosFn(),
  });
  const profsQ = useQuery({
    queryKey: ["profiles"],
    queryFn: () => profilesFn(),
  });

  const profiles = profsQ.data?.profiles ?? [];
  const projetos = projsQ.data?.projetos ?? [];
  const tarefas = tarefasQ.data?.tarefas ?? [];

  const isAdminLider = profile?.role === "admin" || profile?.role === "lider";
  const session = useSessionCompleted();
  const { modo, setModo } = useViewModo();

  // Controle de exibição de apenas filas com cards no Kanban (Padrão: TRUE)
  const [kanbanApenasComTarefas, setKanbanApenasComTarefas] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      // Remove resquício da chave v1 que gravou false na sessão anterior
      localStorage.removeItem("orizon:kanban-apenas-com-tarefas");
      const saved = localStorage.getItem("orizon:kanban-apenas-com-tarefas:v2");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const handleKanbanApenasComTarefasChange = (checked: boolean) => {
    setKanbanApenasComTarefas(checked);
    try {
      localStorage.setItem("orizon:kanban-apenas-com-tarefas:v2", String(checked));
    } catch {}
  };

  const tarefasNoEscopo = useMemo(() => {
    return tarefas.filter((t) => {
      if (escopo === "minhas" && !(user?.id && t.responsavel_ids.includes(user.id))) return false;
      return true;
    });
  }, [tarefas, escopo, user?.id]);

  const handleQuickFilter = (patch: Partial<{ fStatus: string; fPrazo: string; fClassificacao: string }>) => {
    if (patch.fStatus !== undefined) setFStatus(patch.fStatus);
    if (patch.fPrazo !== undefined) setFPrazo(patch.fPrazo as PrazoFilter);
    if (patch.fClassificacao !== undefined) setFClassificacao(patch.fClassificacao);

    // Se estiver ativando um filtro focado por KPI (ex: atrasadas, 7 dias, acompanhamentos),
    // aciona automaticamente a exibição de apenas filas com tarefas no Kanban
    const isActivatingKpiFilter =
      (patch.fPrazo && patch.fPrazo !== "todos") ||
      (patch.fClassificacao && patch.fClassificacao !== "all");

    if (isActivatingKpiFilter) {
      setKanbanApenasComTarefas(true);
      try {
        localStorage.setItem("orizon:kanban-apenas-com-tarefas:v2", "true");
      } catch {}
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setFTipo("all");
    setFClassificacao("all");
    setFDep("all");
    setRespUrl("all");
    setFStatus("ativas");
    setFPrio("all");
    setFOrigem("all");
    setFPrazo("todos");
  };

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const qq = search.trim().toLowerCase();
    const result = tarefas.filter((t) => {
      if (escopo === "minhas" && !(user?.id && t.responsavel_ids.includes(user.id))) return false;
      if (fTipo !== "all" && t.projeto_tipo !== fTipo) return false;
      if (fClassificacao !== "all" && t.tipo !== fClassificacao) return false;
      if (fDep === "terceiros" && !t.dependencia_terceiro) return false;
      if (fDep === "com_dep" && !t.dependencia_terceiro && !t.dependencia_id) return false;
      if (fDep === "sem_dep" && (t.dependencia_terceiro || t.dependencia_id)) return false;

      if (qq && !`${t.titulo} ${t.projeto_nome}`.toLowerCase().includes(qq))
        return false;
      if (fResp !== "all" && !t.responsavel_ids.includes(fResp)) return false;
      if (fStatus === "ativas") {
        const isActive = t.status === "pendente" || t.status === "em_andamento";
        if (!isActive && !session.isSticky(t.id)) return false;
      } else if (fStatus !== "all" && t.status !== fStatus) return false;
      if (fPrio !== "all" && t.prioridade !== fPrio) return false;
      if (fOrigem !== "all" && t.origem !== fOrigem) return false;
      if (fPrazo !== "todos") {
        if (!t.prazo) return false;
        const p = new Date(t.prazo + "T00:00:00");
        const diff = Math.round(
          (p.getTime() - today.getTime()) / 86_400_000,
        );
        if (fPrazo === "vencidas" && diff >= 0) return false;
        if (fPrazo === "hoje" && diff !== 0) return false;
        if (fPrazo === "7d" && (diff < 0 || diff > 7)) return false;
        if (fPrazo === "30d" && (diff < 0 || diff > 30)) return false;
      }
      return true;
    });

    // Destaca acompanhamentos no topo
    return result.sort((a, b) => {
      if (a.tipo === "acompanhamento" && b.tipo !== "acompanhamento") return -1;
      if (a.tipo !== "acompanhamento" && b.tipo === "acompanhamento") return 1;
      return 0;
    });
  }, [
    tarefas,
    search,
    fTipo,
    fClassificacao,
    fDep,
    fResp,
    fStatus,
    fPrio,
    fOrigem,
    fPrazo,
    escopo,
    user?.id,
    session,
  ]);

  const onOpenProjeto = (t: TarefaComContexto) => {
    const dest = t.projeto_tipo === "ma" ? "/ma" : "/novos-negocios";
    navigate({ to: dest });
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("orizon:open-projeto", {
          detail: { id: t.projeto_id, tab: "tarefas" },
        }),
      );
    }, 150);
  };

  const { openTarefa } = useTarefaDrawer();
  const onOpenTask = (t: TarefaComContexto) => openTarefa(t.id);

  const loading = tarefasQ.isLoading || profsQ.isLoading || projsQ.isLoading;

  return (
    <div className="mx-auto w-full max-w-360 px-4 py-6 md:px-8 space-y-5">
      {/* ======================================================== */}
      {/* 1. HERO BANNER EXECUTIVO INSTITUCIONAL (PADRÃO ORIZONVR)  */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground px-5 py-4 sm:px-6 sm:py-4.5 shadow-xs border border-primary/20">
        {/* Marca d'água circular oficial da Orizon */}
        <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.10] select-none">
          <img
            src="/brand/orizon-symbol.png"
            alt=""
            aria-hidden="true"
            className="h-52 w-52 sm:h-60 sm:w-60 rounded-full object-cover filter contrast-125"
          />
        </div>

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Título & Identidade Institucional */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
              <ListTodo className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight">
                  Gestão de Tarefas
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-medium text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>Execução & Prazos</span>
                </span>
              </div>
              <p className="text-xs text-white/75 font-normal truncate max-w-xl">
                {filtered.length} tarefa{filtered.length === 1 ? "" : "s"} ativa{filtered.length === 1 ? "" : "s"} no escopo selecionado • Governança e entregas
              </p>
            </div>
          </div>

          {/* Controles de Escopo e Ações Rápidas */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Segmented Tabs de Escopo (Minhas / Do Time / Todas) */}
            <Tabs
              value={escopo}
              onValueChange={(v) => v && setEscopoUrl(v as Escopo)}
              className="w-auto"
            >
              <TabsList className="h-8.5 bg-black/30 p-0.5 border border-white/15 rounded-xl text-white/80">
                <TabsTrigger
                  value="minhas"
                  className="text-xs px-3 h-7.5 font-medium text-white/75 hover:text-white hover:bg-white/10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-xs transition-all duration-150 cursor-pointer rounded-lg"
                >
                  Minhas
                </TabsTrigger>
                {isAdminLider && (
                  <TabsTrigger
                    value="time"
                    className="text-xs px-3 h-7.5 font-medium text-white/75 hover:text-white hover:bg-white/10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-xs transition-all duration-150 cursor-pointer rounded-lg"
                  >
                    Do time
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="todas"
                  className="text-xs px-3 h-7.5 font-medium text-white/75 hover:text-white hover:bg-white/10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-xs transition-all duration-150 cursor-pointer rounded-lg"
                >
                  Todas
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="h-5 w-px bg-white/20 hidden sm:block" />

            {/* Ações Rápidas Executivas */}
            {isAdminLider && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowImport(true)}
                className="h-8.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white hover:text-white border border-white/20 hover:border-white/40 px-3 gap-1.5 rounded-xl shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5 text-white" />
                <span className="hidden sm:inline">Importar Planner</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowRodada(true)}
              className="h-8.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white hover:text-white border border-white/20 hover:border-white/40 px-3 gap-1.5 rounded-xl shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer"
            >
              <CalendarPlus className="h-3.5 w-3.5 text-white" />
              <span className="hidden sm:inline">Reunião de Pipeline</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setShowNew(true)}
              className="h-8.5 text-xs font-bold bg-white hover:bg-white/90 text-primary hover:text-primary border border-white/90 hover:border-white px-3.5 rounded-xl shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer gap-1.5"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Nova tarefa</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. BENTO STRIP DE KPIS DE PRODUTIVIDADE COM FILTRO RÁPIDO */}
      {/* ======================================================== */}
      <TarefasKpiStrip
        tarefas={tarefasNoEscopo}
        isLoading={tarefasQ.isLoading}
        filters={{ fStatus, fPrazo, fClassificacao }}
        onFilterChange={handleQuickFilter}
      />

      {/* ======================================================== */}
      {/* 3. COCKPIT INTELIGENTE DE BUSCA & FILTROS (2 CAMADAS)    */}
      {/* ======================================================== */}
      <TarefasFilterBar
        search={search}
        onSearchChange={setSearch}
        fTipo={fTipo}
        onTipoChange={setFTipo}
        fStatus={fStatus}
        onStatusChange={setFStatus}
        fPrazo={fPrazo}
        onPrazoChange={setFPrazo}
        fClassificacao={fClassificacao}
        onClassificacaoChange={setFClassificacao}
        fDep={fDep}
        onDepChange={setFDep}
        fResp={fResp}
        onRespChange={setRespUrl}
        fPrio={fPrio}
        onPrioChange={setFPrio}
        fOrigem={fOrigem}
        onOrigemChange={setFOrigem}
        escopo={escopo}
        profiles={profiles}
        modo={modo}
        onModoChange={setModo}
        totalNoEscopo={tarefasNoEscopo.length}
        totalFiltered={filtered.length}
        onResetFilters={handleResetFilters}
      />

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && modo !== "kanban" && filtered.length === 0 && (
        <Card className="p-12 text-center rounded-2xl border-dashed border-border/80 bg-muted/10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground/70 mb-3">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Nenhuma tarefa encontrada</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            Não foram encontradas tarefas com a combinação atual de filtros no escopo selecionado.
          </p>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="gap-1.5 rounded-xl text-xs font-medium cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Limpar todos os filtros</span>
            </Button>
          </div>
        </Card>
      )}

      {!loading && modo === "tabela" && filtered.length > 0 && (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="w-10" />
                <TableHead>Tarefa</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Dependência</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <GlobalTarefaRow
                  key={t.id}
                  t={t}
                  onOpenProjeto={onOpenProjeto}
                  expanded={expandedId === t.id}
                  onToggleExpand={() =>
                    setExpandedId((prev) => (prev === t.id ? null : t.id))
                  }
                  onMarkCompleted={session.markCompleted}
                  onClearSticky={session.clear}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {!loading && modo === "cards" && filtered.length > 0 && (
        <TarefasCardsView
          tarefas={filtered}
          showTipo
          onOpenTask={onOpenTask}
        />
      )}

      {!loading && modo === "kanban" && (
        <TarefasKanbanView
          tarefas={tarefas.filter(
            (t) => fTipo === "all" || t.projeto_tipo === fTipo,
          )}
          filteredTarefas={filtered}
          projetos={
            fTipo === "all"
              ? projetos
              : projetos.filter((p) => p.tipo === fTipo)
          }
          scopeTipos={
            fTipo === "ma"
              ? ["ma"]
              : fTipo === "novos_negocios"
                ? ["novos_negocios"]
                : ["ma", "novos_negocios"]
          }
          allowCrossTipo={fTipo === "all"}
          showTipoBadge={fTipo === "all"}
          onOpenTask={onOpenTask}
          apenasComTarefas={kanbanApenasComTarefas}
          onApenasComTarefasChange={handleKanbanApenasComTarefasChange}
        />
      )}

      <NovaTarefaDialog
        open={showNew}
        onOpenChange={setShowNew}
        profiles={profiles}
        defaultResponsavelId={user?.id ?? null}
      />
      <NovaRodadaDrawer
        open={showRodada}
        onOpenChange={setShowRodada}
        profiles={profiles}
        defaultResponsavelId={user?.id ?? null}
      />
      <ImportPlannerDialog
        open={showImport}
        onOpenChange={setShowImport}
        projetos={projsQ.data?.projetos ?? []}
      />
    </div>
  );
}

function GlobalTarefaRow({
  t,
  onOpenProjeto,
  expanded,
  onToggleExpand,
  onMarkCompleted,
  onClearSticky,
}: {
  t: TarefaComContexto;
  onOpenProjeto: (t: TarefaComContexto) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  onMarkCompleted: (id: string, previousStatus: TarefaStatus) => void;
  onClearSticky: (id: string) => void;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateTarefa);
  const { openTarefa } = useTarefaDrawer();
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

  const handleToggleConcluida = (checked: boolean) => {
    if (checked) {
      const previousStatus = t.status;
      onMarkCompleted(t.id, previousStatus);
      mut.mutate("concluida");
      toast.success("Tarefa concluída", {
        duration: 5000,
        action: {
          label: "Desfazer",
          onClick: () => {
            onClearSticky(t.id);
            mut.mutate(previousStatus);
          },
        },
      });
    } else {
      onClearSticky(t.id);
      mut.mutate("pendente");
      toast.success("Tarefa reaberta");
    }
  };

  const isConcluida = t.status === "concluida";
  const isAcompanhamento = t.tipo === "acompanhamento";
  const dimmed = isConcluida || t.status === "cancelada";
  const hasDescricao = !!(t.descricao && t.descricao.trim().length > 0);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer transition-colors duration-150 hover:bg-muted/40",
          dimmed && "opacity-60 bg-muted/10",
          isAcompanhamento && "bg-blue-50/25 dark:bg-blue-950/15 hover:bg-blue-50/40 dark:hover:bg-blue-950/25",
        )}
        onClick={() => openTarefa(t.id)}
      >
        <TableCell className="w-8 p-0 pl-2.5" onClick={stop}>
          {hasDescricao ? (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-label={expanded ? "Recolher descrição" : "Expandir descrição"}
              className="h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground transition-colors cursor-pointer"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : null}
        </TableCell>
        <TableCell className="w-10" onClick={stop}>
          <Checkbox
            checked={isConcluida}
            onCheckedChange={(c) => handleToggleConcluida(c === true)}
            className="cursor-pointer transition-transform active:scale-90"
          />
        </TableCell>
        <TableCell
          className={cn(
            "font-medium max-w-85 truncate",
            isConcluida && "line-through text-muted-foreground",
          )}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {isAcompanhamento ? (
              <Badge
                variant="secondary"
                className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-medium shrink-0"
              >
                <Bookmark className="h-2.5 w-2.5 mr-1 inline" /> Acompanhamento
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/70 font-medium shrink-0"
              >
                <CheckSquare className="h-2.5 w-2.5 mr-1 inline text-muted-foreground/80" /> Padrão
              </Badge>
            )}
            <span className="truncate">{t.titulo}</span>
            {t.subtarefas_count && t.subtarefas_count > 0 ? (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 rounded-md text-muted-foreground gap-1 border-border/70 bg-background/80 shrink-0 font-medium"
                title={`${t.subtarefas_concluidas} de ${t.subtarefas_count} subtarefas concluídas`}
              >
                <CheckSquare className="h-2.5 w-2.5 text-primary" />
                {t.subtarefas_concluidas}/{t.subtarefas_count}
              </Badge>
            ) : null}
          </div>
        </TableCell>
        <TableCell onClick={stop}>
          <button
            onClick={() => onOpenProjeto(t)}
            className="text-xs hover:text-primary transition-colors text-foreground font-semibold inline-flex items-center gap-1.5 cursor-pointer group"
          >
            <span className="group-hover:underline truncate">{t.projeto_nome}</span>
            <span className="text-[10px] font-semibold px-1 py-0.2 rounded bg-muted/60 text-muted-foreground border border-border/70 shrink-0">
              {t.projeto_tipo === "ma" ? "M&A" : "NN"}
            </span>
          </button>
        </TableCell>
        <TableCell>
          <AvatarStack items={t.responsaveis} max={3} size="sm" />
        </TableCell>
        <TableCell>
          {t.dependencia_terceiro ? (
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 font-medium"
            >
              Terceiros
            </Badge>
          ) : t.dependencia_nome ? (
            <span className="text-xs text-foreground/85 font-medium truncate block max-w-44" title={t.dependencia_nome}>
              {t.dependencia_nome}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/60">—</span>
          )}
        </TableCell>
        <TableCell className="text-xs">
          {isAcompanhamento && !t.prazo ? (
            <span className="text-[11px] text-muted-foreground italic">Sem prazo</span>
          ) : (
            <PrazoBadge prazo={t.prazo} concluida={isConcluida} />
          )}
        </TableCell>
        <TableCell>
          <PrioBadge p={t.prioridade} />
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn(
              "text-[11px] px-2 py-0.5 rounded-md font-medium",
              t.status === "concluida" && "border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10",
              t.status === "em_andamento" && "border-primary/30 text-primary bg-primary/10 font-semibold",
              t.status === "cancelada" && "border-border/60 text-muted-foreground line-through opacity-70",
            )}
          >
            {STATUS_LABEL[t.status]}
          </Badge>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {ORIGEM_LABEL[t.origem]}
        </TableCell>
      </TableRow>
      {expanded && hasDescricao && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell />
          <TableCell colSpan={9} className="py-3 px-4">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-w-3xl">
              {t.descricao}
            </p>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function PrioBadge({ p }: { p: TarefaPrioridade }) {
  const cls =
    p === "alta"
      ? "border-destructive/35 text-destructive bg-destructive/10 font-semibold"
      : p === "media"
        ? "border-amber-500/35 text-amber-700 dark:text-amber-400 bg-amber-500/10 font-medium"
        : "text-muted-foreground border-border/70 bg-muted/30";
  return (
    <Badge variant="outline" className={cn("text-[11px] px-2 py-0.5 rounded-md", cls)}>
      {PRIORIDADE_LABEL[p]}
    </Badge>
  );
}
