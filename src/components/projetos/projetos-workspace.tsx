import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  useSuspenseQuery,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Plus,
  Search,
  LayoutGrid,
  Table as TableIcon,
  KanbanSquare,
  Download as DownloadIcon,
  ArrowUpDown,
  Smartphone,
  Inbox,
  Columns3,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarBgStyle, formatTonDia, formatPercentOrizon, formatValorTransacaoMM } from "@/lib/format";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import { toast } from "sonner";

import {
  listProjetosByTipo,
  listProfiles,
  updateProjeto,
  type Profile,
  type Projeto,
} from "@/lib/projetos.functions";
import {
  formatBRL,
  formatBRLFull,
  formatMonthYear,
  healthFor,
  HEALTH_BG,
  HEALTH_LABEL,
  initials,
  SETORES,
  STATUS_LABEL,
} from "@/lib/ma-utils";
import {
  formatExtra,
  type ProjetoConfig,
} from "@/lib/projetos-config";
import { SUBCATEGORIAS, SUBCATEGORIA_LABEL } from "@/lib/projetos-types";
import { ProjectSheet } from "@/components/ma/project-sheet";
import { NewProjectDialog } from "@/components/ma/new-project-dialog";
import { CompararTargets } from "@/components/projetos/comparar-targets";
import { TarefasWorkspaceView } from "@/components/tarefas/tarefas-workspace-view";
import { useAuth } from "@/hooks/use-auth";
import { ListTodo, FolderKanban } from "lucide-react";

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

type View = "kanban" | "table" | "cards";

export function ProjetosWorkspace({ config }: { config: ProjetoConfig }) {
  const { data: projData } = useSuspenseQuery(projetosQuery(config));
  const { data: profData } = useSuspenseQuery(profilesQuery());
  const projetos = projData.projetos;
  const profiles = profData.profiles;
  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  const [view, setView] = useState<View>("kanban");
  const [search, setSearch] = useState("");
  const [filterEstagio, setFilterEstagio] = useState<string>("all");
  const [filterResp, setFilterResp] = useState<string>("all");
  const [filterSetor, setFilterSetor] = useState<string>("all");
  const [filterSubcategoria, setFilterSubcategoria] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMinVal, setFilterMinVal] = useState<string>("");
  const [filterMaxVal, setFilterMaxVal] = useState<string>("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [initialSheetTab, setInitialSheetTab] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

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

  const { user } = useAuth();
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

  // Listen for global events from CommandPalette (Cmd+K + N shortcut).
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

  const hasActiveFilters =
    search.trim() !== "" ||
    filterEstagio !== "all" ||
    filterResp !== "all" ||
    filterSetor !== "all" ||
    filterSubcategoria !== "all" ||
    filterStatus !== "all" ||
    filterMinVal !== "" ||
    filterMaxVal !== "";

  const clearFilters = () => {
    setSearch("");
    setFilterEstagio("all");
    setFilterResp("all");
    setFilterSetor("all");
    setFilterSubcategoria("all");
    setFilterStatus("all");
    setFilterMinVal("");
    setFilterMaxVal("");
  };

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
      if (filterSubcategoria !== "all" && p.subcategoria !== filterSubcategoria) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
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
    filterMinVal,
    filterMaxVal,
  ]);

  const ativos = filtered.filter((p) => p.status === "ativo");
  const totalValor = ativos.reduce(
    (s, p) => s + Number(p.valor_estimado ?? 0),
    0,
  );

  return (
    <TooltipProvider>
      <div className="flex-1 p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {config.titulo}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {ativos.length} projetos ativos · {formatBRL(totalValor)}{" "}
              {config.subtituloSuffix}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <ToggleGroup
              type="single"
              value={mainView}
              onValueChange={(v) =>
                v && switchMainView(v as "projetos" | "tarefas")
              }
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="projetos" aria-label="Projetos">
                <FolderKanban className="h-4 w-4 mr-1" />
                Projetos
              </ToggleGroupItem>
              <ToggleGroupItem value="tarefas" aria-label="Tarefas">
                <ListTodo className="h-4 w-4 mr-1" />
                Tarefas
              </ToggleGroupItem>
            </ToggleGroup>
            {mainView === "projetos" && (
              <ToggleGroup
                type="single"
                value={view}
                onValueChange={(v) => v && setView(v as View)}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="kanban" aria-label="Kanban">
                  <KanbanSquare className="h-4 w-4 mr-1" />
                  Kanban
                </ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Tabela">
                  <TableIcon className="h-4 w-4 mr-1" />
                  Tabela
                </ToggleGroupItem>
                <ToggleGroupItem value="cards" aria-label="Cards">
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Cards
                </ToggleGroupItem>
              </ToggleGroup>
            )}
            {mainView === "projetos" && (
              <Button onClick={() => setShowNew(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Novo projeto
              </Button>
            )}
          </div>
        </div>

        {mainView === "tarefas" && (
          <TarefasWorkspaceView
            config={config}
            profiles={profiles}
            projetos={projetos.map((p) => ({ id: p.id, nome: p.nome, tipo: p.tipo }))}
            currentUserId={user?.id ?? null}
            onOpenProjeto={(id) => {
              switchMainView("projetos");
              setOpenId(id);
            }}
          />
        )}

        {mainView === "projetos" && (
        <>


        {/* Filters */}
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou contraparte..."
                className="pl-8"
              />
            </div>
            <FilterSelect
              value={filterEstagio}
              onChange={setFilterEstagio}
              placeholder="Estágio"
              options={config.estagios.map((s) => ({
                value: s.key,
                label: s.label,
              }))}
            />
            <FilterSelect
              value={filterResp}
              onChange={setFilterResp}
              placeholder="Responsável"
              options={profiles.map((p) => ({
                value: p.id,
                label: p.nome_completo,
              }))}
            />
            <FilterSelect
              value={filterSetor}
              onChange={setFilterSetor}
              placeholder="Setor"
              options={SETORES.map((s) => ({ value: s, label: s }))}
            />
            {config.tipo === "novos_negocios" && (
              <FilterSelect
                value={filterSubcategoria}
                onChange={setFilterSubcategoria}
                placeholder="Subcategoria"
                options={SUBCATEGORIAS.map((s) => ({ value: s.key, label: s.label }))}
              />
            )}
            <FilterSelect
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="Status"
              options={Object.entries(STATUS_LABEL).map(([v, l]) => ({
                value: v,
                label: l,
              }))}
            />
            <div className="flex items-center gap-1">
              <Input
                placeholder="Min R$"
                value={filterMinVal}
                onChange={(e) => setFilterMinVal(e.target.value)}
                className="w-28"
                type="number"
              />
              <span className="text-muted-foreground text-sm">–</span>
              <Input
                placeholder="Max R$"
                value={filterMaxVal}
                onChange={(e) => setFilterMaxVal(e.target.value)}
                className="w-28"
                type="number"
              />
            </div>
          </div>
        </Card>

        {/* Views */}
        {filtered.length === 0 && view !== "kanban" && (
          <Card className="p-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Nenhum projeto encontrado com esses filtros."
                : "Nenhum projeto cadastrado ainda."}
            </p>
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={clearFilters} className="mt-1">
                Limpar filtros
              </Button>
            )}
          </Card>
        )}
        {view === "kanban" && (
          <>
            <div className="md:hidden rounded-md border border-border bg-secondary/40 p-4 text-sm text-muted-foreground flex items-start gap-3">
              <Smartphone className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                O Kanban funciona melhor em telas maiores. Use a visão{" "}
                <button onClick={() => setView("cards")} className="font-medium text-foreground underline">
                  Cards
                </button>{" "}
                ou{" "}
                <button onClick={() => setView("table")} className="font-medium text-foreground underline">
                  Tabela
                </button>{" "}
                neste tamanho.
              </span>
            </div>
            <div className="hidden md:block">
              <KanbanView
                config={config}
                projetos={filtered}
                profileMap={profileMap}
                onOpen={setOpenId}
              />
            </div>
          </>
        )}
        {view === "table" && filtered.length > 0 && (
          <TableView
            config={config}
            projetos={filtered}
            profileMap={profileMap}
            onOpen={setOpenId}
            selectedIds={compareIds}
            onToggleSelect={toggleCompare}
          />
        )}
        {view === "cards" && filtered.length > 0 && (
          <CardsView
            config={config}
            projetos={filtered}
            profileMap={profileMap}
            onOpen={setOpenId}
            selectedIds={compareIds}
            onToggleSelect={toggleCompare}
          />
        )}
        {compareIds.length >= 1 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <Card className="px-4 py-2 flex items-center gap-3 shadow-lg border-border">
              <span className="text-sm font-medium">
                {compareIds.length} selecionado{compareIds.length > 1 ? "s" : ""}
              </span>
              <Button
                size="sm"
                disabled={compareIds.length < 2}
                onClick={() => setShowCompare(true)}
              >
                Comparar
              </Button>
              <Button size="sm" variant="ghost" onClick={clearCompare}>
                Limpar
              </Button>
            </Card>
          </div>
        )}
        <CompararTargets
          open={showCompare}
          onOpenChange={setShowCompare}
          projetos={filtered.filter((p) => compareIds.includes(p.id))}
          profilesById={profileMap}
          config={config}
        />
        </>
        )}



        <ProjectSheet
          config={config}
          projectId={openId}
          initialTab={initialSheetTab}
          profiles={profiles}
          onClose={() => {
            setOpenId(null);
            setInitialSheetTab(null);
          }}
        />
        <NewProjectDialog
          config={config}
          open={showNew}
          onOpenChange={setShowNew}
          profiles={profiles}
          onCreated={(id) => setOpenId(id)}
        />
      </div>
    </TooltipProvider>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px] h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos — {placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------- KANBAN ----------
function KanbanView({
  config,
  projetos,
  profileMap,
  onOpen,
}: {
  config: ProjetoConfig;
  projetos: Projeto[];
  profileMap: Map<string, Profile>;
  onOpen: (id: string) => void;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateProjeto);
  const moveMut = useMutation({
    mutationFn: ({ id, estagio }: { id: string; estagio: string }) =>
      updateFn({ data: { id, patch: { estagio } } }),
    onMutate: async ({ id, estagio }) => {
      await qc.cancelQueries({ queryKey: [config.queryKey] });
      const prev = qc.getQueryData([config.queryKey]) as
        | { projetos: Projeto[] }
        | undefined;
      if (prev) {
        qc.setQueryData([config.queryKey], {
          projetos: prev.projetos.map((p) =>
            p.id === id ? { ...p, estagio } : p,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData([config.queryKey], ctx.prev);
      toast.error("Falha ao mover");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: [config.queryKey] }),
  });

  const byStage = useMemo(() => {
    const map: Record<string, Projeto[]> = {};
    for (const s of config.estagios) map[s.key] = [];
    for (const p of projetos) {
      if (map[p.estagio]) map[p.estagio].push(p);
    }
    return map;
  }, [projetos, config.estagios]);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {config.estagios.map((s) => {
          const items = byStage[s.key] ?? [];
          const sum = items.reduce(
            (acc, p) => acc + Number(p.valor_estimado ?? 0),
            0,
          );
          return (
            <div
              key={s.key}
              className="w-72 flex-shrink-0 bg-muted/30 rounded-lg p-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/projeto-id");
                const from = e.dataTransfer.getData("text/projeto-estagio");
                if (id && from !== s.key) {
                  moveMut.mutate({ id, estagio: s.key });
                }
              }}
            >
              <div className="px-2 py-1.5 mb-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{s.label}</div>
                  <Badge variant="secondary" className="text-xs">
                    {items.length}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatBRL(sum)}
                </div>
              </div>
              <div className="space-y-2">
                {items.map((p) => (
                  <KanbanCard
                    key={p.id}
                    projeto={p}
                    profile={
                      p.responsavel_id
                        ? profileMap.get(p.responsavel_id)
                        : undefined
                    }
                    onOpen={() => onOpen(p.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({
  projeto,
  profile,
  onOpen,
}: {
  projeto: Projeto;
  profile?: Profile;
  onOpen: () => void;
}) {
  const h = healthFor(projeto);
  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/projeto-id", projeto.id);
        e.dataTransfer.setData("text/projeto-estagio", projeto.estagio);
      }}
      onClick={onOpen}
      className="p-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm leading-tight">
          {projeto.nome}
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-shrink-0">
          {projeto.tipo === "ma" &&
            projeto.percentual_orizon != null &&
            Number(projeto.percentual_orizon) !== 100 && (
              <Badge
                variant="outline"
                className="text-[9px] py-0 px-1.5 leading-tight bg-gold/10 text-gold border-gold/30"
              >
                {formatPercentOrizon(projeto.percentual_orizon)} Orizon
              </Badge>
            )}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`h-2.5 w-2.5 rounded-full ${HEALTH_BG[h]}`}
              />
            </TooltipTrigger>
            <TooltipContent>{HEALTH_LABEL[h]}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {projeto.subcategoria && (
        <Badge variant="secondary" className="mt-1.5 mr-1 text-[10px] py-0 bg-primary/10 text-primary border-primary/20">
          {SUBCATEGORIA_LABEL[projeto.subcategoria] ?? projeto.subcategoria}
        </Badge>
      )}
      {projeto.setor && (
        <Badge variant="outline" className="mt-1.5 text-[10px] py-0">
          {projeto.setor}
        </Badge>
      )}
      <div className="mt-2 text-sm font-semibold text-primary">
        {formatBRL(projeto.valor_estimado)}
      </div>
      {projeto.tipo === "ma" && projeto.volume_ton_dia != null && (
        <div className="text-xs text-muted-foreground mt-0.5">
          {formatTonDia(projeto.volume_ton_dia)}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        {profile ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]" style={avatarBgStyle(profile.nome_completo)}>
                  {initials(profile.nome_completo)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{profile.nome_completo}</TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        <span className="text-xs text-muted-foreground font-medium">
          {formatMonthYear(projeto.data_fechamento_prevista)}
        </span>
      </div>
    </Card>
  );
}

// ---------- TABLE ----------
type SortKey =
  | "nome"
  | "setor"
  | "estagio"
  | "valor_estimado"
  | "volume_ton_dia"
  | "percentual_orizon"
  | "valor_transacao_mm"
  | "ebitda_2025"
  | "ebitda_alvo"
  | "multiplo_ev_ebitda"
  | "tir_estimada"
  | "payback_anos"
  | "data_fechamento_prevista"
  | "status";

function TableView({
  config,
  projetos,
  profileMap,
  onOpen,
  selectedIds,
  onToggleSelect,
}: {
  config: ProjetoConfig;
  projetos: Projeto[];
  profileMap: Map<string, Profile>;
  onOpen: (id: string) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("data_fechamento_prevista");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const showMaCols = config.tipo === "ma";
  const [colVolume, setColVolume] = useState(true);
  const [colOrizon, setColOrizon] = useState(true);
  const [colTransacao, setColTransacao] = useState(true);
  const [colEbitda2025, setColEbitda2025] = useState(true);
  const pageSize = 20;

  const sorted = useMemo(() => {
    const arr = [...projetos];
    arr.sort((a, b) => {
      const av = (a[sortKey] ?? "") as string | number;
      const bv = (b[sortKey] ?? "") as string | number;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [projetos, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageItems = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const showSubcat = config.tipo === "novos_negocios";

  const exportCsv = () => {
    const maCols: Array<[boolean, string, (p: Projeto) => string]> = [
      [showMaCols && colVolume, "Volume (ton/dia)", (p) => String(p.volume_ton_dia ?? "")],
      [showMaCols && colOrizon, "% Orizon", (p) => String(p.percentual_orizon ?? "")],
      [showMaCols && colTransacao, "Valor Transação (R$ MM)", (p) => String(p.valor_transacao_mm ?? "")],
      [showMaCols && colEbitda2025, "EBITDA 2025 (R$ MM)", (p) => String(p.ebitda_2025 ?? "")],
    ];
    const header = [
      "Nome",
      "Contraparte",
      "Setor",
      ...(showSubcat ? ["Subcategoria"] : []),
      "Estágio",
      config.valorColLabel,
      ...maCols.filter(([on]) => on).map(([, lbl]) => lbl),
      ...config.extraColumns.map((c) => c.label),
      "Responsável",
      "Data prevista",
      "Status",
    ];
    const rows = [
      header,
      ...sorted.map((p) => [
        p.nome,
        p.contraparte ?? "",
        p.setor ?? "",
        ...(showSubcat ? [SUBCATEGORIA_LABEL[p.subcategoria ?? ""] ?? p.subcategoria ?? ""] : []),
        config.estagioLabels[p.estagio] ?? p.estagio,
        String(p.valor_estimado ?? ""),
        ...maCols.filter(([on]) => on).map(([, , fn]) => fn(p)),
        ...config.extraColumns.map((c) =>
          String((p[c.key] as number | null | undefined) ?? ""),
        ),
        p.responsavel_id
          ? profileMap.get(p.responsavel_id)?.nome_completo ?? ""
          : "",
        p.data_fechamento_prevista ?? "",
        STATUS_LABEL[p.status] ?? p.status,
      ]),
    ];
    const csv = rows
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.csvPrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleMaCols =
    (showMaCols ? Number(colVolume) + Number(colOrizon) + Number(colTransacao) + Number(colEbitda2025) : 0);
  const colSpan =
    6 + config.extraColumns.length + 4 + (showSubcat ? 1 : 0) + visibleMaCols;

  return (
    <Card>
      <div className="flex items-center justify-between p-3 border-b">
        <div className="text-sm text-muted-foreground">
          {sorted.length} projetos
          {selectedSet.size > 0 ? ` · ${selectedSet.size} selecionado(s)` : ""}
        </div>
        <div className="flex items-center gap-2">
          {showMaCols && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="h-4 w-4 mr-1" />
                  Colunas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Colunas opcionais</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={colVolume}
                  onCheckedChange={(v) => setColVolume(!!v)}
                >
                  Volume (ton/dia)
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={colOrizon}
                  onCheckedChange={(v) => setColOrizon(!!v)}
                >
                  % Orizon
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={colTransacao}
                  onCheckedChange={(v) => setColTransacao(!!v)}
                >
                  Valor Transação
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={colEbitda2025}
                  onCheckedChange={(v) => setColEbitda2025(!!v)}
                >
                  EBITDA 2025
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <DownloadIcon className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />

            <SortHead k="nome" sk={sortKey} sd={sortDir} onSort={toggleSort}>
              Nome
            </SortHead>
            <SortHead k="setor" sk={sortKey} sd={sortDir} onSort={toggleSort}>
              Setor
            </SortHead>
            {showSubcat && <TableHead>Subcategoria</TableHead>}
            <SortHead k="estagio" sk={sortKey} sd={sortDir} onSort={toggleSort}>
              Estágio
            </SortHead>
            <SortHead
              k="valor_estimado"
              sk={sortKey}
              sd={sortDir}
              onSort={toggleSort}
              className="text-right"
            >
              {config.valorColLabel}
            </SortHead>
            {showMaCols && colVolume && (
              <SortHead k="volume_ton_dia" sk={sortKey} sd={sortDir} onSort={toggleSort} className="text-right">
                Volume
              </SortHead>
            )}
            {showMaCols && colOrizon && (
              <SortHead k="percentual_orizon" sk={sortKey} sd={sortDir} onSort={toggleSort} className="text-right">
                % Orizon
              </SortHead>
            )}
            {showMaCols && colTransacao && (
              <SortHead k="valor_transacao_mm" sk={sortKey} sd={sortDir} onSort={toggleSort} className="text-right">
                Valor Transação
              </SortHead>
            )}
            {showMaCols && colEbitda2025 && (
              <SortHead k="ebitda_2025" sk={sortKey} sd={sortDir} onSort={toggleSort} className="text-right">
                EBITDA 2025
              </SortHead>
            )}
            {config.extraColumns.map((c) => (
              <SortHead
                key={c.key}
                k={c.key as SortKey}
                sk={sortKey}
                sd={sortDir}
                onSort={toggleSort}
                className="text-right"
              >
                {c.label}
              </SortHead>
            ))}
            <TableHead>Responsável</TableHead>
            <SortHead
              k="data_fechamento_prevista"
              sk={sortKey}
              sd={sortDir}
              onSort={toggleSort}
            >
              Previsão
            </SortHead>
            <SortHead k="status" sk={sortKey} sd={sortDir} onSort={toggleSort}>
              Status
            </SortHead>
            <TableHead>Saúde</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((p) => {
            const resp = p.responsavel_id
              ? profileMap.get(p.responsavel_id)
              : undefined;
            const h = healthFor(p);
            return (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("[data-no-row]")) return;
                  onOpen(p.id);
                }}
              >
                <TableCell data-no-row onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedSet.has(p.id)}
                    onCheckedChange={() => onToggleSelect(p.id)}
                    aria-label="Selecionar para comparar"
                  />
                </TableCell>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.setor ?? "—"}
                </TableCell>
                {showSubcat && (
                  <TableCell>
                    {p.subcategoria ? (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        {SUBCATEGORIA_LABEL[p.subcategoria] ?? p.subcategoria}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant="secondary">
                    {config.estagioLabels[p.estagio] ?? p.estagio}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatBRLFull(p.valor_estimado)}
                </TableCell>
                {showMaCols && colVolume && (
                  <TableCell className="text-right text-sm">
                    {formatTonDia(p.volume_ton_dia) ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                )}
                {showMaCols && colOrizon && (
                  <TableCell className="text-right text-sm">
                    {formatPercentOrizon(p.percentual_orizon) ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                )}
                {showMaCols && colTransacao && (
                  <TableCell className="text-right text-sm">
                    {formatValorTransacaoMM(p.valor_transacao_mm) ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                )}
                {showMaCols && colEbitda2025 && (
                  <TableCell className="text-right text-sm">
                    {formatValorTransacaoMM(p.ebitda_2025) ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                )}
                {config.extraColumns.map((c) => (
                  <TableCell key={c.key} className="text-right">
                    {formatExtra(
                      p[c.key] as number | null | undefined,
                      c.format,
                    )}
                  </TableCell>
                ))}
                <TableCell>
                  {resp ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]" style={avatarBgStyle(resp.nome_completo)}>
                          {initials(resp.nome_completo)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{resp.nome_completo}</span>
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {formatMonthYear(p.data_fechamento_prevista)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {STATUS_LABEL[p.status] ?? p.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${HEALTH_BG[h]}`}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {pageItems.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={colSpan}
                className="text-center text-muted-foreground py-10"
              >
                Nenhum projeto encontrado.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="p-3 border-t">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
              </PaginationItem>
              <PaginationItem>
                <span className="text-sm px-3">
                  Página {page + 1} de {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                >
                  Próxima
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </Card>
  );
}

function SortHead({
  k,
  sk,
  sd,
  onSort,
  children,
  className,
}: {
  k: SortKey;
  sk: SortKey;
  sd: "asc" | "desc";
  onSort: (k: SortKey) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {children}
        <ArrowUpDown
          className={`h-3 w-3 ${sk === k ? "text-foreground" : "text-muted-foreground/40"}`}
        />
        {sk === k && <span className="text-xs">{sd === "asc" ? "↑" : "↓"}</span>}
      </button>
    </TableHead>
  );
}

// ---------- CARDS ----------
function CardsView({
  config,
  projetos,
  profileMap,
  onOpen,
  selectedIds,
  onToggleSelect,
}: {
  config: ProjetoConfig;
  projetos: Projeto[];
  profileMap: Map<string, Profile>;
  onOpen: (id: string) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
}) {
  if (projetos.length === 0) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        Nenhum projeto encontrado.
      </Card>
    );
  }
  const selectedSet = new Set(selectedIds);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {projetos.map((p) => {
        const resp = p.responsavel_id
          ? profileMap.get(p.responsavel_id)
          : undefined;
        const h = healthFor(p);
        return (
          <Card
            key={p.id}
            onClick={() => onOpen(p.id)}
            className="relative p-4 pt-9 cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-3"
          >
            <div
              className="absolute top-2 right-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={selectedSet.has(p.id)}
                onCheckedChange={() => onToggleSelect(p.id)}
                aria-label="Selecionar para comparar"
              />
            </div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base truncate">
                  {p.nome}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {p.contraparte ?? "—"}
                </div>
              </div>
              <div className={`h-2.5 w-2.5 rounded-full ${HEALTH_BG[h]} mt-1.5`} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.setor && <Badge variant="outline">{p.setor}</Badge>}
              {p.subcategoria && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                  {SUBCATEGORIA_LABEL[p.subcategoria] ?? p.subcategoria}
                </Badge>
              )}
              <Badge variant="secondary">
                {config.estagioLabels[p.estagio] ?? p.estagio}
              </Badge>
            </div>
            <div className="text-2xl font-bold text-primary">
              {formatBRL(p.valor_estimado)}
            </div>
            {p.tese && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {p.tese}
              </p>
            )}
            <div className="flex items-center justify-between pt-2 border-t">
              {resp ? (
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]" style={avatarBgStyle(resp.nome_completo)}>
                      {initials(resp.nome_completo)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs">{resp.nome_completo}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
              <span className="text-xs text-muted-foreground font-medium">
                {formatMonthYear(p.data_fechamento_prevista)}
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
