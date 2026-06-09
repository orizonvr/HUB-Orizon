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
  Search,
  Inbox,
  Loader2,
  CalendarPlus,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { listTarefasByTipo, updateTarefa } from "@/lib/tarefas.functions";
import {
  PRIORIDADE_LABEL,
  STATUS_LABEL,
  ORIGEM_LABEL,
  type TarefaComContexto,
  type TarefaStatus,
  type TarefaPrioridade,
  type TarefaOrigem,
} from "@/lib/tarefas-types";
import type { Profile } from "@/lib/projetos.functions";
import type { ProjetoConfig } from "@/lib/projetos-config";
import { avatarBgStyle } from "@/lib/format";
import { initials } from "@/lib/ma-utils";
import { NovaTarefaDialog } from "./nova-tarefa-dialog";
import { NovaRodadaDrawer } from "./nova-rodada-drawer";
import { PrazoBadge } from "./tarefas-tab";
import { useSessionCompleted } from "@/hooks/use-session-completed";
import { ViewModoToggle } from "./view-modo-toggle";
import { useViewModo } from "@/hooks/use-view-modo";
import { TarefasCardsView } from "./tarefas-cards-view";
import { TarefasKanbanView } from "./tarefas-kanban-view";
import { useTarefaDrawer } from "@/hooks/use-tarefa-drawer";

type PrazoFilter = "todos" | "vencidas" | "hoje" | "7d" | "30d";

type Props = {
  config: ProjetoConfig;
  profiles: Profile[];
  projetos?: Array<{ id: string; nome: string; tipo: "ma" | "novos_negocios" }>;
  currentUserId: string | null;
  onOpenProjeto: (id: string) => void;
};

export function TarefasWorkspaceView({
  config,
  profiles,
  projetos,
  currentUserId,
  onOpenProjeto,
}: Props) {
  const fetchFn = useServerFn(listTarefasByTipo);
  const q = useQuery({
    queryKey: ["tarefas", "tipo", config.tipo],
    queryFn: () => fetchFn({ data: { tipo: config.tipo } }),
  });

  const [showNew, setShowNew] = useState(false);
  const [showRodada, setShowRodada] = useState(false);
  const [search, setSearch] = useState("");
  const [fResp, setFResp] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("ativas");
  const [fPrio, setFPrio] = useState<string>("all");
  const [fPrazo, setFPrazo] = useState<PrazoFilter>("todos");
  const [fOrigem, setFOrigem] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const tarefas = q.data?.tarefas ?? [];
  const session = useSessionCompleted();
  const { modo, setModo } = useViewModo();
  const { openTarefa } = useTarefaDrawer();

  const handleOpenTask = (t: TarefaComContexto) => openTarefa(t.id);


  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const qq = search.trim().toLowerCase();
    return tarefas.filter((t) => {
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
  }, [tarefas, search, fResp, fStatus, fPrio, fOrigem, fPrazo, session]);

  const vencidas = tarefas.filter((t) => {
    if (t.status !== "pendente" && t.status !== "em_andamento") return false;
    return new Date(t.prazo + "T00:00:00") < new Date(new Date().toDateString());
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {tarefas.length} tarefas no total
          {vencidas > 0 && (
            <>
              {" · "}
              <span className="text-destructive font-medium">
                {vencidas} vencida{vencidas === 1 ? "" : "s"}
              </span>
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          <ViewModoToggle value={modo} onChange={setModo} />
          <Button variant="outline" onClick={() => setShowRodada(true)}>
            <CalendarPlus className="h-4 w-4 mr-1" />
            Reunião de Pipeline
          </Button>
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
            value={fResp}
            onChange={setFResp}
            placeholder="Responsável"
            options={profiles.map((p) => ({
              value: p.id,
              label: p.nome_completo,
            }))}
          />
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
          <FSelect
            value={fOrigem}
            onChange={setFOrigem}
            placeholder="Origem"
            options={Object.entries(ORIGEM_LABEL).map(([v, l]) => ({
              value: v,
              label: l,
            }))}
          />
        </div>
      </Card>

      {q.isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!q.isLoading && modo !== "kanban" && filtered.length === 0 && (
        <Card className="p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma tarefa encontrada com esses filtros.
          </p>
        </Card>
      )}

      {!q.isLoading && modo === "tabela" && filtered.length > 0 && (
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
                <TarefaTableRow
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

      {!q.isLoading && modo === "cards" && filtered.length > 0 && (
        <TarefasCardsView tarefas={filtered} onOpenTask={handleOpenTask} />
      )}

      {!q.isLoading && modo === "kanban" && (
        <TarefasKanbanView
          tarefas={tarefas}
          filteredTarefas={filtered}
          projetos={projetos ?? []}
          scopeTipos={[config.tipo]}
          allowCrossTipo={false}
          showTipoBadge={false}
          onOpenTask={handleOpenTask}
        />
      )}


      <NovaTarefaDialog
        open={showNew}
        onOpenChange={setShowNew}
        profiles={profiles}
        tipoPadrao={config.tipo}
        defaultResponsavelId={currentUserId}
      />
      <NovaRodadaDrawer
        open={showRodada}
        onOpenChange={setShowRodada}
        profiles={profiles}
        defaultResponsavelId={currentUserId}
        tipoPadrao={config.tipo}
      />
    </div>
  );
}

function TarefaTableRow({
  t,
  onOpenProjeto,
  expanded,
  onToggleExpand,
  onMarkCompleted,
  onClearSticky,
}: {
  t: TarefaComContexto;
  onOpenProjeto: (id: string) => void;
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
            onClick={() => onOpenProjeto(t.projeto_id)}
            className="text-sm hover:underline text-foreground/80"
          >
            {t.projeto_nome}
          </button>
        </TableCell>
        <TableCell>
          <AvatarStack items={t.responsaveis} max={3} size="sm" />
        </TableCell>
        <TableCell className="text-xs">
          <PrazoBadge prazo={t.prazo} concluida={t.status === "concluida"} />
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
          {ORIGEM_LABEL[t.origem as TarefaOrigem]}
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

// Re-export so consumers don't need a separate import path.
export type { TarefaStatus };
