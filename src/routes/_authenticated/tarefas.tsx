import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
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
} from "@/lib/tarefas-types";
import { avatarBgStyle } from "@/lib/format";
import { initials } from "@/lib/ma-utils";
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
  const [search, setSearch] = useState("");
  const [fTipo, setFTipo] = useState<string>("all");
  const [fResp, setFResp] = useState<string>(initialResp);
  const [fStatus, setFStatus] = useState<string>("ativas");
  const [fPrio, setFPrio] = useState<string>("all");
  const [fPrazo, setFPrazo] = useState<PrazoFilter>("todos");
  const [fOrigem, setFOrigem] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [showRodada, setShowRodada] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const setEscopoUrl = (e: Escopo) => {
    setEscopo(e);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (e === "minhas") url.searchParams.delete("escopo");
    else url.searchParams.set("escopo", e);
    window.history.replaceState(null, "", url.toString());
  };

  const tarefasQ = useQuery({
    queryKey: ["tarefas", "tipo", null],
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



  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const qq = search.trim().toLowerCase();
    return tarefas.filter((t) => {
      if (escopo === "minhas" && !(user?.id && t.responsavel_ids.includes(user.id))) return false;
      if (fTipo !== "all" && t.projeto_tipo !== fTipo) return false;
      if (qq && !`${t.titulo} ${t.projeto_nome}`.toLowerCase().includes(qq))
        return false;
      if (fResp !== "all" && !t.responsavel_ids.includes(fResp)) return false;
      if (fStatus === "ativas") {
        const isActive = t.status === "pendente" || t.status === "em_andamento";
        // Keep just-completed rows visible in "Ativas" until reload.
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
  }, [tarefas, search, fTipo, fResp, fStatus, fPrio, fOrigem, fPrazo, escopo, user?.id, session]);

  const onOpenProjeto = (t: TarefaComContexto) => {
    const dest = t.projeto_tipo === "ma" ? "/ma" : "/novos-negocios";
    navigate({ to: dest });
    // Defer event so the workspace mounts first.
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
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-8 md:py-10 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} tarefa(s) com os filtros atuais
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ToggleGroup
            type="single"
            value={escopo}
            onValueChange={(v) => v && setEscopoUrl(v as Escopo)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="minhas">Minhas</ToggleGroupItem>
            {isAdminLider && (
              <ToggleGroupItem value="time">Do time</ToggleGroupItem>
            )}
            <ToggleGroupItem value="todas">Todas</ToggleGroupItem>
          </ToggleGroup>
          <ViewModoToggle value={modo} onChange={setModo} />
          <Button variant="outline" onClick={() => setShowRodada(true)}>
            <CalendarPlus className="h-4 w-4 mr-1" />
            Reunião de Pipeline
          </Button>
          {profile?.role === "admin" && (
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4 mr-1" />
              Importar do Planner
            </Button>
          )}
          <Button onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nova tarefa
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título ou projeto..."
              className="pl-8"
            />
          </div>
          <FSelect
            value={fTipo}
            onChange={setFTipo}
            placeholder="Tipo"
            options={[
              { value: "ma", label: "M&A" },
              { value: "novos_negocios", label: "Novos Negócios" },
            ]}
            allLabel="Todos os tipos"
          />
          {escopo !== "minhas" && (
            <FSelect
              value={fResp}
              onChange={setFResp}
              placeholder="Responsável"
              options={profiles.map((p) => ({
                value: p.id,
                label: p.nome_completo,
              }))}
            />
          )}
          <FSelect
            value={fStatus}
            onChange={setFStatus}
            placeholder="Status"
            options={[
              { value: "ativas", label: "Ativas" },
              ...Object.entries(STATUS_LABEL).map(([v, l]) => ({
                value: v,
                label: l,
              })),
            ]}
            allLabel="Todos os status"
          />
          <FSelect
            value={fPrio}
            onChange={setFPrio}
            placeholder="Prioridade"
            options={Object.entries(PRIORIDADE_LABEL).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
          <FSelect
            value={fOrigem}
            onChange={setFOrigem}
            placeholder="Origem"
            options={Object.entries(ORIGEM_LABEL).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
          <FSelect
            value={fPrazo}
            onChange={(v) => setFPrazo(v as PrazoFilter)}
            placeholder="Prazo"
            options={[
              { value: "todos", label: "Todos os prazos" },
              { value: "vencidas", label: "Vencidas" },
              { value: "hoje", label: "Hoje" },
              { value: "7d", label: "Próximos 7 dias" },
              { value: "30d", label: "Próximos 30 dias" },
            ]}
            hideAll
          />
        </div>
      </Card>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && modo !== "kanban" && filtered.length === 0 && (
        <Card className="p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma tarefa encontrada.
          </p>
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
      {profile?.role === "admin" && (
        <ImportPlannerDialog
          open={showImport}
          onOpenChange={setShowImport}
          projetos={projetos}
        />
      )}
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
  const dimmed = isConcluida || t.status === "cancelada";
  const hasDescricao = !!(t.descricao && t.descricao.trim().length > 0);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <>
      <TableRow
        className={`cursor-pointer ${dimmed ? "opacity-60" : ""}`}
        onClick={() => openTarefa(t.id)}
      >
        <TableCell className="w-8 p-0 pl-2" onClick={stop}>
          {hasDescricao ? (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-label={expanded ? "Recolher descrição" : "Expandir descrição"}
              className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
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
          />
        </TableCell>
        <TableCell
          className={`font-medium max-w-[320px] truncate ${
            isConcluida ? "line-through" : ""
          }`}
        >
          {t.titulo}
        </TableCell>
        <TableCell onClick={stop}>
          <button
            onClick={() => onOpenProjeto(t)}
            className="text-sm hover:underline text-foreground/80"
          >
            {t.projeto_nome}
            <span className="ml-1 text-[10px] text-muted-foreground">
              {t.projeto_tipo === "ma" ? "M&A" : "NN"}
            </span>
          </button>
        </TableCell>
        <TableCell>
          <AvatarStack items={t.responsaveis} max={3} size="sm" />
        </TableCell>
        <TableCell className="text-xs">
          <PrazoBadge prazo={t.prazo} concluida={isConcluida} />
        </TableCell>
        <TableCell>
          <PrioBadge p={t.prioridade} />
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">
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
          <TableCell colSpan={8} className="py-3">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
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
      ? "border-destructive/40 text-destructive"
      : p === "media"
        ? ""
        : "text-muted-foreground";
  return (
    <Badge variant="outline" className={`text-xs ${cls}`}>
      {PRIORIDADE_LABEL[p]}
    </Badge>
  );
}

function FSelect({
  value,
  onChange,
  placeholder,
  options,
  allLabel,
  hideAll,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
  hideAll?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px] h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {!hideAll && (
          <SelectItem value="all">
            {allLabel ?? `Todos — ${placeholder}`}
          </SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
