import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  useQuery,
  queryOptions,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Plus,
  Columns3,
  ListTodo,
  FolderKanban,
  Briefcase,
  Sparkles,
  Smartphone,
  Inbox,
  Scale,
  Edit3,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";

import {
  listProjetosByTipo,
  listProfiles,
  listPipelineEstagios,
  type Profile,
  type Projeto,
} from "@/lib/projetos.functions";
import { formatBRL, healthFor } from "@/lib/ma-utils";
import type { ProjetoConfig } from "@/lib/projetos-config";
import { ProjectSheet } from "@/components/ma/project-sheet";
import { NewProjectDialog } from "@/components/ma/new-project-dialog";
import { CompararTargets } from "@/components/projetos/comparar-targets";
import { EditarEmMassa } from "@/components/projetos/editar-em-massa";
import { GerenciarEstagiosDialog } from "@/components/projetos/gerenciar-estagios-dialog";
import { TarefasWorkspaceView } from "@/components/tarefas/tarefas-workspace-view";
import { NovaTarefaDialog } from "@/components/tarefas/nova-tarefa-dialog";
import { useAuth } from "@/hooks/use-auth";

// Subcomponentes modulares de alta performance
import {
  ProjetosKpiStrip,
  type ProjetosQuickFilters,
} from "@/components/projetos/projetos-kpi-strip";
import {
  ProjetosFilterBar,
  type ProjetosViewMode,
} from "@/components/projetos/projetos-filter-bar";
import { ProjetosKanbanView } from "@/components/projetos/projetos-kanban-view";
import { ProjetosTableView } from "@/components/projetos/projetos-table-view";
import { ProjetosCardsView } from "@/components/projetos/projetos-cards-view";

const ESTAGIOS_AVANCADOS_MA = new Set([
  "nbo_submetida",
  "due_diligence",
  "negociacao",
  "opcao_compra_assinada",
  "assinatura_spa",
  "pos_ma_integracao",
]);

const ESTAGIOS_AVANCADOS_NN = new Set([
  "due_diligence",
  "estruturacao_aprovacao",
  "em_aprovacao_comite",
  "assinatura_contratos",
  "operacao_integracao",
]);

export const projetosQuery = (config: ProjetoConfig) =>
  queryOptions({
    queryKey: [config.queryKey],
    queryFn: () => listProjetosByTipo({ data: { tipo: config.tipo } }),
  });

export const profilesQuery = () =>
  queryOptions({
    queryKey: ["profiles"],
    queryFn: () => listProfiles(),
  });

export function ProjetosWorkspace({ config }: { config: ProjetoConfig }) {
  const projQ = useQuery(projetosQuery(config));
  const profQ = useQuery(profilesQuery());
  const projetos = projQ.data?.projetos ?? [];
  const profiles = profQ.data?.profiles ?? [];
  const isLoading = projQ.isLoading || profQ.isLoading;
  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  const [view, setView] = useState<ProjetosViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [filterEstagio, setFilterEstagio] = useState<string>("all");
  const [filterResp, setFilterResp] = useState<string>("all");
  const [filterSetor, setFilterSetor] = useState<string>("all");
  const [filterSubcategoria, setFilterSubcategoria] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterHealth, setFilterHealth] = useState<"all" | "atencao">("all");
  const [filterFaseAvancada, setFilterFaseAvancada] = useState(false);
  const [filterMinVal, setFilterMinVal] = useState<string>("");
  const [filterMaxVal, setFilterMaxVal] = useState<string>("");

  // Controle de colunas vazias no Kanban (Persistido no localStorage)
  const [kanbanApenasComProjetos, setKanbanApenasComProjetos] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem(`orizon:kanban-apenas-com-projetos:${config.tipo}`);
      return saved === "true";
    } catch {
      return false;
    }
  });

  const handleKanbanApenasComProjetosChange = (checked: boolean) => {
    setKanbanApenasComProjetos(checked);
    try {
      localStorage.setItem(`orizon:kanban-apenas-com-projetos:${config.tipo}`, String(checked));
    } catch {}
  };

  const [openId, setOpenId] = useState<string | null>(null);
  const [initialSheetTab, setInitialSheetTab] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [tarefaProjeto, setTarefaProjeto] = useState<Projeto | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const qc = useQueryClient();

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) {
        toast.info("Compare no máximo 4 projetos por vez.");
        return prev;
      }
      return [...prev, id];
    });
  };
  const clearCompare = () => setCompareIds([]);

  const { user, profile } = useAuth();
  const isAdminLider = profile?.role === "admin" || profile?.role === "lider";
  const [showEstagiosModal, setShowEstagiosModal] = useState(false);

  const listEstagiosFn = useServerFn(listPipelineEstagios);
  const estagiosQ = useQuery({
    queryKey: ["pipeline-estagios", config.tipo],
    queryFn: () => listEstagiosFn({ data: { tipo: config.tipo } }),
  });
  const dynamicEstagios = useMemo(() => {
    if (estagiosQ.data?.estagios && estagiosQ.data.estagios.length > 0) {
      return estagiosQ.data.estagios;
    }
    return config.estagios;
  }, [estagiosQ.data, config.estagios]);

  const activeConfig: ProjetoConfig = useMemo(() => {
    return {
      ...config,
      estagios: dynamicEstagios,
      estagioLabels: Object.fromEntries(
        dynamicEstagios.map((s: { key: string; label: string }) => [s.key, s.label]),
      ),
    };
  }, [config, dynamicEstagios]);

  const [mainView, setMainView] = useState<"projetos" | "tarefas">(() => {
    if (typeof window === "undefined") return "projetos";
    return new URLSearchParams(window.location.search).get("view") === "tarefas"
      ? "tarefas"
      : "projetos";
  });
  const switchMainView = (v: "projetos" | "tarefas") => {
    setMainView(v);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (v === "tarefas") url.searchParams.set("view", "tarefas");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url.toString());
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const projetoId = params.get("projeto");
    const tab = params.get("tab");
    if (projetoId) {
      setOpenId(projetoId);
      setInitialSheetTab(tab);
    }
  }, []);

  // Eventos globais da CommandPalette
  useEffect(() => {
    const openHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; tab?: string }>).detail;
      if (detail?.id) {
        setOpenId(detail.id);
        if (detail.tab) setInitialSheetTab(detail.tab);
      }
    };
    const newHandler = () => setShowNew(true);
    window.addEventListener("orizon:open-projeto", openHandler as EventListener);
    window.addEventListener("orizon:new-project", newHandler);
    return () => {
      window.removeEventListener("orizon:open-projeto", openHandler as EventListener);
      window.removeEventListener("orizon:new-project", newHandler);
    };
  }, []);

  const handleQuickFilter = (patch: Partial<ProjetosQuickFilters>) => {
    if (patch.filterStatus !== undefined) setFilterStatus(patch.filterStatus);
    if (patch.filterHealth !== undefined) setFilterHealth(patch.filterHealth);
    if (patch.filterFaseAvancada !== undefined)
      setFilterFaseAvancada(patch.filterFaseAvancada);

    // Se estiver filtrando por hot deals ou atenção, ativa visualização focada no kanban
    if (patch.filterFaseAvancada || patch.filterHealth === "atencao") {
      setKanbanApenasComProjetos(true);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setFilterEstagio("all");
    setFilterResp("all");
    setFilterSetor("all");
    setFilterSubcategoria("all");
    setFilterStatus("all");
    setFilterHealth("all");
    setFilterFaseAvancada(false);
    setFilterMinVal("");
    setFilterMaxVal("");
  };

  const avancadosSet =
    config.tipo === "ma" ? ESTAGIOS_AVANCADOS_MA : ESTAGIOS_AVANCADOS_NN;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = filterMinVal ? Number(filterMinVal) : -Infinity;
    const max = filterMaxVal ? Number(filterMaxVal) : Infinity;

    return projetos.filter((p) => {
      if (q && !`${p.nome} ${p.contraparte ?? ""}`.toLowerCase().includes(q))
        return false;
      if (filterEstagio !== "all" && p.estagio !== filterEstagio) return false;
      if (filterResp !== "all" && p.responsavel_id !== filterResp) return false;
      if (filterSetor !== "all" && p.setor !== filterSetor) return false;
      if (
        filterSubcategoria !== "all" &&
        p.subcategoria !== filterSubcategoria
      )
        return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (filterFaseAvancada && !avancadosSet.has(p.estagio)) return false;
      if (filterHealth === "atencao") {
        const h = healthFor(p);
        if (h !== "vermelho" && h !== "amarelo") return false;
      }
      const v = Number(p.valor_estimado ?? 0);
      if (v < min || v > max) return false;
      return true;
    });
  }, [
    projetos,
    search,
    filterEstagio,
    filterResp,
    filterSetor,
    filterSubcategoria,
    filterStatus,
    filterHealth,
    filterFaseAvancada,
    filterMinVal,
    filterMaxVal,
    avancadosSet,
  ]);

  const ativos = projetos.filter((p) => p.status === "ativo");
  const totalValor = ativos.reduce(
    (s, p) => s + Number(p.valor_estimado ?? 0),
    0,
  );

  const isMA = config.tipo === "ma";

  return (
    <TooltipProvider>
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
                {isMA ? (
                  <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : (
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight">
                    {config.titulo}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-medium text-white/90">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    <span>
                      {isMA ? "Pipeline M&A • Alocação" : "Novos Verticais • Expansão"}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-white/75 font-normal truncate max-w-xl">
                  {ativos.length} projetos ativos · {formatBRL(totalValor)}{" "}
                  {config.subtituloSuffix} • Governança e Comitês
                </p>
              </div>
            </div>

            {/* Alternador Executivo Projetos vs Tarefas & Ações Rápidas */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Tabs
                value={mainView}
                onValueChange={(v) => v && switchMainView(v as "projetos" | "tarefas")}
                className="w-auto"
              >
                <TabsList className="h-8.5 bg-black/30 p-0.5 border border-white/15 rounded-xl text-white/80">
                  <TabsTrigger
                    value="projetos"
                    className="text-xs px-3 h-7.5 font-medium text-white/75 hover:text-white hover:bg-white/10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-xs transition-all duration-150 cursor-pointer rounded-lg gap-1.5"
                  >
                    <FolderKanban className="h-3.5 w-3.5" />
                    <span>Projetos</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="tarefas"
                    className="text-xs px-3 h-7.5 font-medium text-white/75 hover:text-white hover:bg-white/10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:font-semibold data-[state=active]:shadow-xs transition-all duration-150 cursor-pointer rounded-lg gap-1.5"
                  >
                    <ListTodo className="h-3.5 w-3.5" />
                    <span>Tarefas</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="h-5 w-px bg-white/20 hidden sm:block" />

              {mainView === "projetos" && (
                <>
                  {isAdminLider && view === "kanban" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowEstagiosModal(true)}
                      className="h-8.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white hover:text-white border border-white/20 hover:border-white/40 px-3 gap-1.5 rounded-xl shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer"
                    >
                      <Columns3 className="h-3.5 w-3.5 text-white" />
                      <span className="hidden sm:inline">Colunas do Kanban</span>
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={() => setShowNew(true)}
                    className="h-8.5 text-xs font-bold bg-white hover:bg-white/90 text-primary hover:text-primary border border-white/90 hover:border-white px-3.5 rounded-xl shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer gap-1.5"
                  >
                    <Plus className="h-4 w-4 stroke-[2.5]" />
                    <span>Novo projeto</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* ABA 1: VISÃO DE TAREFAS VINCULADAS AO WORKSPACE          */}
        {/* ======================================================== */}
        {mainView === "tarefas" && (
          <TarefasWorkspaceView
            config={activeConfig}
            profiles={profiles}
            projetos={projetos.map((p) => ({ id: p.id, nome: p.nome, tipo: p.tipo }))}
            currentUserId={user?.id ?? null}
            onOpenProjeto={(id) => {
              switchMainView("projetos");
              setOpenId(id);
            }}
          />
        )}

        {/* ======================================================== */}
        {/* ABA 2: PIPELINE EXECUTIVO DE PROJETOS                    */}
        {/* ======================================================== */}
        {mainView === "projetos" && (
          <>
            {/* 2. BENTO STRIP DE KPIS EXECUTIVOS COM FILTROS RÁPIDOS */}
            <ProjetosKpiStrip
              config={activeConfig}
              projetos={projetos}
              filters={{
                filterStatus,
                filterHealth,
                filterFaseAvancada,
              }}
              onFilterChange={handleQuickFilter}
            />

            {/* 3. COCKPIT INTELIGENTE DE BUSCA & FILTROS (2 CAMADAS) */}
            <ProjetosFilterBar
              config={activeConfig}
              search={search}
              onSearchChange={setSearch}
              filterEstagio={filterEstagio}
              onEstagioChange={setFilterEstagio}
              filterResp={filterResp}
              onRespChange={setFilterResp}
              filterSetor={filterSetor}
              onSetorChange={setFilterSetor}
              filterSubcategoria={filterSubcategoria}
              onSubcategoriaChange={setFilterSubcategoria}
              filterStatus={filterStatus}
              onStatusChange={setFilterStatus}
              filterMinVal={filterMinVal}
              onMinValChange={setFilterMinVal}
              filterMaxVal={filterMaxVal}
              onMaxValChange={setFilterMaxVal}
              profiles={profiles}
              viewMode={view}
              onViewModeChange={setView}
              totalProjetos={projetos.length}
              totalFiltered={filtered.length}
              onResetFilters={handleResetFilters}
              kanbanApenasComProjetos={kanbanApenasComProjetos}
              onKanbanApenasComProjetosChange={handleKanbanApenasComProjetosChange}
            />

            {/* 4. VISUALIZAÇÕES DO PIPELINE (KANBAN, TABELA, CARDS) */}
            {isLoading && projetos.length === 0 ? (
              <div className="space-y-4 py-2 animate-pulse">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-80 rounded-2xl bg-muted/30 border border-border/60 flex flex-col p-4 space-y-3"
                    >
                      <div className="h-5 w-28 rounded-md bg-muted/70" />
                      <div className="h-24 rounded-xl bg-muted/50 border border-border/40" />
                      <div className="h-24 rounded-xl bg-muted/50 border border-border/40" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {filtered.length === 0 && view !== "kanban" && (
                  <Card className="p-12 text-center rounded-2xl border border-border/80 bg-card shadow-2xs">
                    <Inbox className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <h3 className="mt-3 text-sm font-semibold text-foreground">
                      Nenhum projeto encontrado
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nenhum projeto corresponde aos critérios de busca e filtros selecionados.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetFilters}
                      className="mt-3 text-xs"
                    >
                      Limpar todos os filtros
                    </Button>
                  </Card>
                )}

                {view === "kanban" && (
                  <>
                    <div className="md:hidden rounded-xl border border-border bg-secondary/40 p-4 text-xs text-muted-foreground flex items-start gap-3">
                      <Smartphone className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      <span>
                        O Kanban funciona melhor em telas maiores. Experimente a visão{" "}
                        <button
                          onClick={() => setView("cards")}
                          className="font-semibold text-primary underline"
                        >
                          Cards
                        </button>{" "}
                        ou{" "}
                        <button
                          onClick={() => setView("table")}
                          className="font-semibold text-primary underline"
                        >
                          Tabela
                        </button>{" "}
                        no celular.
                      </span>
                    </div>
                    <div className="hidden md:block">
                      <ProjetosKanbanView
                        config={activeConfig}
                        projetos={filtered}
                        profileMap={profileMap}
                        onOpen={setOpenId}
                        onNovaTarefa={setTarefaProjeto}
                        selectedIds={compareIds}
                        onToggleSelect={toggleCompare}
                        apenasComProjetos={kanbanApenasComProjetos}
                        onApenasComProjetosChange={handleKanbanApenasComProjetosChange}
                      />
                    </div>
                  </>
                )}

                {view === "table" && filtered.length > 0 && (
                  <ProjetosTableView
                    config={activeConfig}
                    projetos={filtered}
                    profileMap={profileMap}
                    onOpen={setOpenId}
                    selectedIds={compareIds}
                    onToggleSelect={toggleCompare}
                  />
                )}

                {view === "cards" && filtered.length > 0 && (
                  <ProjetosCardsView
                    config={activeConfig}
                    projetos={filtered}
                    profileMap={profileMap}
                    onOpen={setOpenId}
                    selectedIds={compareIds}
                    onToggleSelect={toggleCompare}
                    onNovaTarefa={setTarefaProjeto}
                  />
                )}
              </>
            )}

            {/* 5. BARRA FLUTUANTE EXECUTIVA DE COMPARAÇÃO & EDIÇÃO EM MASSA */}
            {compareIds.length >= 1 && (
              <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
                <Card className="px-4 py-2.5 flex items-center gap-3 shadow-2xl border-primary/30 bg-background/95 backdrop-blur-md rounded-2xl border">
                  <Badge
                    variant="secondary"
                    className="h-6 px-2 text-xs font-semibold bg-primary/10 text-primary border-primary/20"
                  >
                    {compareIds.length} selecionado{compareIds.length > 1 ? "s" : ""}
                  </Badge>
                  <div className="h-4 w-px bg-border/70" />
                  <Button
                    size="sm"
                    disabled={compareIds.length < 2}
                    onClick={() => setShowCompare(true)}
                    className="h-8 text-xs gap-1.5 font-semibold"
                  >
                    <Scale className="h-3.5 w-3.5" />
                    <span>Comparar</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowBulkEdit(true)}
                    className="h-8 text-xs gap-1.5 border-border/80 font-semibold"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Editar em massa</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearCompare}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Limpar</span>
                  </Button>
                </Card>
              </div>
            )}

            {/* Modais de Ação */}
            <CompararTargets
              open={showCompare}
              onOpenChange={setShowCompare}
              projetos={filtered.filter((p) => compareIds.includes(p.id))}
              profilesById={profileMap}
              config={activeConfig}
            />
            <EditarEmMassa
              open={showBulkEdit}
              onOpenChange={setShowBulkEdit}
              ids={compareIds}
              profiles={profiles}
              config={activeConfig}
              onApplied={() => {
                qc.invalidateQueries({ queryKey: [config.queryKey] });
                clearCompare();
              }}
            />
          </>
        )}

        {/* Detalhes do Projeto (Drawer / Sheet) */}
        <ProjectSheet
          config={activeConfig}
          projectId={openId}
          initialTab={initialSheetTab}
          profiles={profiles}
          onClose={() => {
            setOpenId(null);
            setInitialSheetTab(null);
          }}
        />

        {/* Modal de Novo Projeto */}
        <NewProjectDialog
          config={activeConfig}
          open={showNew}
          onOpenChange={setShowNew}
          profiles={profiles}
          onCreated={(id) => setOpenId(id)}
        />

        {/* Modal de Criação Rápida de Tarefa Vinculada */}
        <NovaTarefaDialog
          open={tarefaProjeto !== null}
          onOpenChange={(o) => !o && setTarefaProjeto(null)}
          profiles={profiles}
          projetoFixo={
            tarefaProjeto
              ? { id: tarefaProjeto.id, nome: tarefaProjeto.nome }
              : null
          }
          tipoPadrao={tarefaProjeto?.tipo ?? config.tipo}
          defaultResponsavelId={tarefaProjeto?.responsavel_id}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["tarefas"] });
            qc.invalidateQueries({ queryKey: [config.queryKey] });
          }}
        />

        {/* Modal de Gerenciamento de Estágios do Kanban */}
        <GerenciarEstagiosDialog
          open={showEstagiosModal}
          onOpenChange={setShowEstagiosModal}
          tipo={config.tipo}
          projetos={projetos}
          onEstagiosChanged={() => {
            estagiosQ.refetch();
            qc.invalidateQueries({ queryKey: [config.queryKey] });
          }}
        />
      </div>
    </TooltipProvider>
  );
}
