import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ClipboardList,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  getComiteDetail,
  addProjetoToPauta,
  removeProjetoFromPauta,
  updatePautaItem,
  updateComite,
  realizarComite,
  type ComiteStatus,
  type PautaItem,
} from "@/lib/comites.functions";
import { BriefingDrawer } from "@/components/comites/briefing-drawer";
import { listAllProjetosLite, createTarefasBatch } from "@/lib/tarefas.functions";
import { listProfiles } from "@/lib/projetos.functions";
import { MA_CONFIG, NN_CONFIG } from "@/lib/projetos-config";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/comites/$id")({
  head: () => ({
    meta: [{ title: "Comitê — OrizonVR | Pipeline" }],
  }),
  component: ComiteDetailPage,
});

const STATUS_META: Record<
  ComiteStatus,
  { label: string; className: string }
> = {
  preparacao: {
    label: "Em preparação",
    className: "bg-accent/60 text-accent-foreground",
  },
  realizado: {
    label: "Realizado",
    className: "bg-primary/15 text-primary",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
  },
};

const TIPO_LABEL: Record<"ma" | "novos_negocios", string> = {
  ma: "M&A",
  novos_negocios: "Novos Negócios",
};

type DecisaoKey =
  | "pendente"
  | "aprovado"
  | "aprovado_com_ressalvas"
  | "reprovado"
  | "adiado";

const DECISAO_LABEL: Record<DecisaoKey, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  aprovado_com_ressalvas: "Aprovado com ressalvas",
  reprovado: "Reprovado",
  adiado: "Adiado",
};

function decisaoBadgeClass(d: DecisaoKey): string {
  switch (d) {
    case "aprovado":
      return "bg-primary/15 text-primary border-transparent";
    case "aprovado_com_ressalvas":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border-transparent";
    case "reprovado":
      return "bg-destructive/15 text-destructive border-transparent";
    case "adiado":
      return "bg-muted text-muted-foreground border-transparent";
    default:
      return "";
  }
}

function estagioLabelsFor(tipo: "ma" | "novos_negocios"): Record<string, string> {
  return tipo === "ma" ? MA_CONFIG.estagioLabels : NN_CONFIG.estagioLabels;
}

function formatDataBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDataShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildAtaMarkdown(comite: {
  titulo: string;
  data: string;
  participantes: { nome_completo: string }[];
  pauta: PautaItem[];
}): string {
  const lines: string[] = [];
  lines.push(`# Ata — ${comite.titulo}`);
  lines.push(
    `${formatDataShort(comite.data)} · ${comite.participantes.length} participantes`,
  );
  lines.push("");
  for (const item of comite.pauta) {
    const tipoLabel = TIPO_LABEL[item.projeto_tipo];
    const decisaoLabel =
      DECISAO_LABEL[(item.decisao as DecisaoKey) ?? "pendente"];
    const estagioLabel = item.estagio_sugerido
      ? estagioLabelsFor(item.projeto_tipo)[item.estagio_sugerido] ??
        item.estagio_sugerido
      : "—";
    lines.push(`## ${item.projeto_nome} (${tipoLabel})`);
    lines.push(`**Decisão:** ${decisaoLabel}`);
    lines.push(`**Justificativa:** ${item.justificativa?.trim() || "—"}`);
    lines.push(`**Condicionantes:** ${item.condicionantes?.trim() || "—"}`);
    lines.push(`**Estágio sugerido:** ${estagioLabel}`);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

function ComiteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();

  const detailFn = useServerFn(getComiteDetail);
  const projetosFn = useServerFn(listAllProjetosLite);
  const profilesFn = useServerFn(listProfiles);

  const detailQ = useQuery({
    queryKey: ["comite", id],
    queryFn: () => detailFn({ data: { id } }),
  });
  const projetosQ = useQuery({
    queryKey: ["projetos-lite"],
    queryFn: () => projetosFn(),
  });
  const profilesQ = useQuery({
    queryKey: ["profiles-all"],
    queryFn: () => profilesFn(),
  });

  const comite = detailQ.data?.comite;
  const isPreparacao = comite?.status === "preparacao";
  const isRealizado = comite?.status === "realizado";
  const role = profile?.role;
  const isPrivileged =
    !!comite &&
    (role === "admin" ||
      role === "lider" ||
      comite.criado_por_id === profile?.id);
  const canEdit = !!comite && isPreparacao && isPrivileged;
  const canCancel = canEdit;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["comite", id] });

  const addFn = useServerFn(addProjetoToPauta);
  const removeFn = useServerFn(removeProjetoFromPauta);
  const updateItemFn = useServerFn(updatePautaItem);
  const updateComiteFn = useServerFn(updateComite);
  const realizarFn = useServerFn(realizarComite);
  const createTarefasFn = useServerFn(createTarefasBatch);

  const addM = useMutation({
    mutationFn: (input: { projeto_id: string; relator_id: string | null }) =>
      addFn({ data: { comite_id: id, ...input } }),
    onSuccess: () => {
      toast.success("Projeto adicionado à pauta.");
      invalidate();
      qc.invalidateQueries({ queryKey: ["comites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeM = useMutation({
    mutationFn: (pautaId: string) => removeFn({ data: { id: pautaId } }),
    onSuccess: () => {
      toast.success("Projeto removido da pauta.");
      invalidate();
      qc.invalidateQueries({ queryKey: ["comites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pautaItemM = useMutation({
    mutationFn: (input: {
      id: string;
      relator_id?: string | null;
      decisao?: DecisaoKey;
      justificativa?: string | null;
      condicionantes?: string | null;
      estagio_sugerido?: string | null;
    }) => updateItemFn({ data: input }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelM = useMutation({
    mutationFn: () =>
      updateComiteFn({ data: { id, status: "cancelado" as const } }),
    onSuccess: () => {
      toast.success("Comitê cancelado.");
      invalidate();
      qc.invalidateQueries({ queryKey: ["comites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const realizarM = useMutation({
    mutationFn: (ata: string) =>
      realizarFn({ data: { id, ata_consolidada: ata } }),
    onSuccess: () => {
      toast.success("Comitê realizado.");
      invalidate();
      qc.invalidateQueries({ queryKey: ["comites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "registro">("view");
  const [concluirOpen, setConcluirOpen] = useState(false);
  const [ataDraft, setAtaDraft] = useState<string>("");
  const [followupOpen, setFollowupOpen] = useState(false);

  if (detailQ.isLoading || !comite) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const meta = STATUS_META[comite.status];
  const projetosInPauta = new Set(comite.pauta.map((p) => p.projeto_id));
  const projetosDisponiveis = (projetosQ.data?.projetos ?? []).filter(
    (p) => !projetosInPauta.has(p.id),
  );
  const profileOptions = profilesQ.data?.profiles ?? [];

  const hasCondicionantes = comite.pauta.some(
    (p) => (p.condicionantes ?? "").trim().length > 0,
  );

  const openConcluir = () => {
    const pendentes = comite.pauta.filter(
      (p) => !p.decisao || p.decisao === "pendente",
    );
    if (comite.pauta.length === 0) {
      toast.error("Adicione ao menos um projeto à pauta antes de realizar.");
      return;
    }
    if (pendentes.length > 0) {
      toast.error(
        "Registre a decisão de todos os projetos antes de realizar o comitê.",
      );
      return;
    }
    setAtaDraft(buildAtaMarkdown(comite));
    setConcluirOpen(true);
  };

  const handleConcluir = () => {
    realizarM.mutate(ataDraft, {
      onSuccess: () => {
        setConcluirOpen(false);
        setMode("view");
        if (hasCondicionantes) setFollowupOpen(true);
      },
    });
  };

  const copyAta = async () => {
    if (!comite.ata_consolidada) return;
    await navigator.clipboard.writeText(comite.ata_consolidada);
    toast.success("Ata copiada.");
  };

  const downloadAta = () => {
    if (!comite.ata_consolidada) return;
    const blob = new Blob([comite.ata_consolidada], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ata-${slugify(comite.titulo) || "comite"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          onClick={() => navigate({ to: "/comites" })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Comitês
        </Button>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {comite.titulo}
              </h1>
              <Badge
                variant="secondary"
                className={`${meta.className} text-[10px]`}
              >
                {meta.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDataBR(comite.data)}
            </p>
          </div>
          {canEdit && mode === "view" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelOpen(true)}
              >
                Cancelar comitê
              </Button>
              <Button size="sm" onClick={() => setMode("registro")}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Realizar comitê
              </Button>
            </div>
          )}
        </div>
      </div>

      {!isPreparacao && (
        <Card className="flex items-center gap-3 border-amber-400/50 bg-amber-50/40 p-4 text-sm dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span>
            Este comitê já foi {meta.label.toLowerCase()}. Pauta apenas em leitura.
          </span>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="text-sm font-semibold">Participantes</h2>
        <div className="mt-3">
          <AvatarStack
            items={comite.participantes.map((p) => ({
              id: p.id,
              nome: p.nome_completo,
              avatar_url: p.avatar_url,
            }))}
            max={10}
            size="md"
          />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {mode === "registro" ? "Registrar decisões" : "Pauta"}
          </h2>
          {canEdit && mode === "view" && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar projeto
            </Button>
          )}
        </div>

        {comite.pauta.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Nenhum projeto na pauta ainda.
          </p>
        ) : mode === "registro" && canEdit ? (
          <ul className="mt-4 space-y-4">
            {comite.pauta.map((item, idx) => (
              <PautaRegistroItem
                key={item.id}
                idx={idx}
                item={item}
                pending={pautaItemM.isPending}
                onPatch={(patch) => pautaItemM.mutate({ id: item.id, ...patch })}
              />
            ))}
          </ul>
        ) : (
          <ul className="mt-4 space-y-2">
            {comite.pauta.map((item, idx) => (
              <PautaViewItem
                key={item.id}
                idx={idx}
                item={item}
                showDecisoes={!isPreparacao}
                canEdit={canEdit}
                profileOptions={profileOptions}
                removing={removeM.isPending}
                onRelator={(relator_id) =>
                  pautaItemM.mutate({ id: item.id, relator_id })
                }
                onRemove={() => removeM.mutate(item.id)}
              />
            ))}
          </ul>
        )}

        {mode === "registro" && canEdit && (
          <div className="mt-6 flex justify-end gap-2 border-t pt-4">
            <Button variant="ghost" onClick={() => setMode("view")}>
              Voltar
            </Button>
            <Button onClick={openConcluir}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Concluir comitê
            </Button>
          </div>
        )}
      </Card>

      {!isPreparacao && comite.ata_consolidada && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Ata consolidada</h2>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyAta}>
                <Copy className="mr-2 h-4 w-4" />
                Copiar ata
              </Button>
              <Button variant="outline" size="sm" onClick={downloadAta}>
                <Download className="mr-2 h-4 w-4" />
                Baixar .md
              </Button>
              {isRealizado && isPrivileged && hasCondicionantes && (
                <Button size="sm" onClick={() => setFollowupOpen(true)}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Gerar tarefas de condicionantes
                </Button>
              )}
            </div>
          </div>
          <pre className="mt-4 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-4 font-mono text-xs">
            {comite.ata_consolidada}
          </pre>
        </Card>
      )}

      <AddProjetoDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        projetos={projetosDisponiveis}
        profiles={profileOptions}
        pending={addM.isPending}
        onSubmit={(projeto_id, relator_id) =>
          addM.mutate({ projeto_id, relator_id }, { onSuccess: () => setAddOpen(false) })
        }
      />

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar comitê?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A pauta será preservada apenas
              para consulta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelM.mutate()}
              disabled={cancelM.isPending}
            >
              {cancelM.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Cancelar comitê
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={concluirOpen} onOpenChange={setConcluirOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Concluir comitê</DialogTitle>
            <DialogDescription>
              Revise a ata antes de confirmar. Você poderá editá-la abaixo.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={ataDraft}
            onChange={(e) => setAtaDraft(e.target.value)}
            className="min-h-[320px] font-mono text-xs"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConcluirOpen(false)}>
              Voltar
            </Button>
            <Button onClick={handleConcluir} disabled={realizarM.isPending}>
              {realizarM.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar e realizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FollowupsDialog
        open={followupOpen}
        onOpenChange={setFollowupOpen}
        pauta={comite.pauta}
        dataReuniao={comite.data.slice(0, 10)}
        profiles={profileOptions}
        onSubmit={async (tarefas) => {
          const res = await createTarefasFn({
            data: {
              data_reuniao: comite.data.slice(0, 10),
              tarefas,
            },
          });
          toast.success(`${res.count} tarefas criadas.`);
          setFollowupOpen(false);
        }}
      />
    </div>
  );
}

// ============ Pauta item: view mode ============
type PautaViewProps = {
  idx: number;
  item: PautaItem;
  showDecisoes: boolean;
  canEdit: boolean;
  profileOptions: Array<{ id: string; nome_completo: string }>;
  removing: boolean;
  onRelator: (id: string | null) => void;
  onRemove: () => void;
};

function PautaViewItem({
  idx,
  item,
  showDecisoes,
  canEdit,
  profileOptions,
  removing,
  onRelator,
  onRemove,
}: PautaViewProps) {
  const decisao = (item.decisao as DecisaoKey) ?? "pendente";
  const estagioLabel = item.estagio_sugerido
    ? estagioLabelsFor(item.projeto_tipo)[item.estagio_sugerido] ??
      item.estagio_sugerido
    : null;
  return (
    <li className="flex items-start gap-3 rounded-md border border-border p-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
        {idx + 1}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.projeto_nome}</span>
          <Badge variant="outline" className="text-[10px]">
            {TIPO_LABEL[item.projeto_tipo]}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {item.projeto_estagio}
          </Badge>
          {showDecisoes && (
            <Badge
              variant={decisao === "pendente" ? "outline" : "default"}
              className={`text-[10px] ${decisaoBadgeClass(decisao)}`}
            >
              {DECISAO_LABEL[decisao]}
            </Badge>
          )}
        </div>

        {!showDecisoes && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Relator:</span>
            <Select
              value={item.relator_id ?? "none"}
              onValueChange={(v) => onRelator(v === "none" ? null : v)}
              disabled={!canEdit}
            >
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue placeholder="Sem relator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem relator</SelectItem>
                {profileOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showDecisoes && (
          <div className="space-y-1.5 text-xs">
            {item.justificativa && (
              <div>
                <span className="font-medium text-muted-foreground">
                  Justificativa:{" "}
                </span>
                <span className="whitespace-pre-wrap">{item.justificativa}</span>
              </div>
            )}
            {item.condicionantes && (
              <div>
                <span className="font-medium text-muted-foreground">
                  Condicionantes:{" "}
                </span>
                <span className="whitespace-pre-wrap">{item.condicionantes}</span>
              </div>
            )}
            {estagioLabel && (
              <div>
                <span className="font-medium text-muted-foreground">
                  Estágio sugerido:{" "}
                </span>
                <span>{estagioLabel}</span>
              </div>
            )}
          </div>
        )}
      </div>
      {canEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          disabled={removing}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </li>
  );
}

// ============ Pauta item: registro (editable) ============
type RegistroProps = {
  idx: number;
  item: PautaItem;
  pending: boolean;
  onPatch: (patch: {
    decisao?: DecisaoKey;
    justificativa?: string | null;
    condicionantes?: string | null;
    estagio_sugerido?: string | null;
  }) => void;
};

function PautaRegistroItem({ idx, item, pending, onPatch }: RegistroProps) {
  const initialDecisao = (item.decisao as DecisaoKey) ?? "pendente";
  const [decisao, setDecisao] = useState<DecisaoKey>(initialDecisao);
  const [justificativa, setJustificativa] = useState(item.justificativa ?? "");
  const [condicionantes, setCondicionantes] = useState(item.condicionantes ?? "");
  const [estagio, setEstagio] = useState<string>(item.estagio_sugerido ?? "none");

  // Keep in sync if data refetches
  useEffect(() => {
    setDecisao(((item.decisao as DecisaoKey) ?? "pendente"));
    setJustificativa(item.justificativa ?? "");
    setCondicionantes(item.condicionantes ?? "");
    setEstagio(item.estagio_sugerido ?? "none");
  }, [item.id, item.decisao, item.justificativa, item.condicionantes, item.estagio_sugerido]);

  const estagioLabels = estagioLabelsFor(item.projeto_tipo);

  return (
    <li className="rounded-md border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {idx + 1}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.projeto_nome}</span>
            <Badge variant="outline" className="text-[10px]">
              {TIPO_LABEL[item.projeto_tipo]}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {item.projeto_estagio}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium">Decisão</p>
              <Select
                value={decisao}
                onValueChange={(v) => {
                  const next = v as DecisaoKey;
                  setDecisao(next);
                  onPatch({ decisao: next });
                }}
                disabled={pending}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DECISAO_LABEL) as DecisaoKey[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {DECISAO_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium">Estágio sugerido</p>
              <Select
                value={estagio}
                onValueChange={(v) => {
                  setEstagio(v);
                  onPatch({ estagio_sugerido: v === "none" ? null : v });
                }}
                disabled={pending}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manter estágio atual</SelectItem>
                  {Object.entries(estagioLabels).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium">Justificativa</p>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              onBlur={() => {
                if ((item.justificativa ?? "") !== justificativa) {
                  onPatch({ justificativa: justificativa || null });
                }
              }}
              className="min-h-[72px] text-sm"
            />
          </div>

          <div>
            <p className="mb-1 text-xs font-medium">Condicionantes</p>
            <Textarea
              value={condicionantes}
              onChange={(e) => setCondicionantes(e.target.value)}
              onBlur={() => {
                if ((item.condicionantes ?? "") !== condicionantes) {
                  onPatch({ condicionantes: condicionantes || null });
                }
              }}
              placeholder="Uma condicionante por linha — viram tarefas depois."
              className="min-h-[72px] text-sm"
            />
          </div>
        </div>
      </div>
    </li>
  );
}

// ============ Add projeto dialog ============
type AddProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projetos: Array<{ id: string; nome: string; tipo: "ma" | "novos_negocios" }>;
  profiles: Array<{ id: string; nome_completo: string }>;
  pending: boolean;
  onSubmit: (projeto_id: string, relator_id: string | null) => void;
};

function AddProjetoDialog({
  open,
  onOpenChange,
  projetos,
  profiles,
  pending,
  onSubmit,
}: AddProps) {
  const [projetoId, setProjetoId] = useState<string>("");
  const [relatorId, setRelatorId] = useState<string>("none");

  const selected = useMemo(
    () => projetos.find((p) => p.id === projetoId),
    [projetoId, projetos],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setProjetoId("");
          setRelatorId("none");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar projeto à pauta</DialogTitle>
          <DialogDescription>
            Escolha um projeto e, opcionalmente, defina um relator.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="mb-1.5 text-sm font-medium">Projeto</p>
            <Command className="rounded-md border">
              <CommandInput placeholder="Buscar projeto..." />
              <CommandList className="max-h-56">
                <CommandEmpty>Nenhum projeto disponível.</CommandEmpty>
                <CommandGroup>
                  {projetos.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.nome}
                      onSelect={() => setProjetoId(p.id)}
                      className={projetoId === p.id ? "bg-accent" : ""}
                    >
                      <span className="flex-1 truncate">{p.nome}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        {p.tipo === "ma" ? "M&A" : "NN"}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            {selected && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Selecionado: <span className="font-medium">{selected.nome}</span>
              </p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Relator (opcional)</p>
            <Select value={relatorId} onValueChange={setRelatorId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem relator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem relator</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!projetoId || pending}
            onClick={() =>
              onSubmit(projetoId, relatorId === "none" ? null : relatorId)
            }
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Followups dialog ============
type FollowupCandidate = {
  uid: string;
  projeto_id: string;
  projeto_nome: string;
  titulo: string;
  incluir: boolean;
  responsavel_id: string;
  prazo: string;
  prioridade: "baixa" | "media" | "alta";
};

type FollowupTarefa = {
  projeto_id: string;
  titulo: string;
  responsavel_ids: string[];
  prazo: string;
  prioridade: "baixa" | "media" | "alta";
};

type FollowupProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pauta: PautaItem[];
  dataReuniao: string;
  profiles: Array<{ id: string; nome_completo: string }>;
  onSubmit: (tarefas: FollowupTarefa[]) => Promise<void>;
};

function FollowupsDialog({
  open,
  onOpenChange,
  pauta,
  profiles,
  onSubmit,
}: FollowupProps) {
  const [items, setItems] = useState<FollowupCandidate[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next: FollowupCandidate[] = [];
    for (const p of pauta) {
      const lines = (p.condicionantes ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of lines) {
        next.push({
          uid: `${p.id}-${next.length}`,
          projeto_id: p.projeto_id,
          projeto_nome: p.projeto_nome,
          titulo: line,
          incluir: true,
          responsavel_id: "",
          prazo: "",
          prioridade: "media",
        });
      }
    }
    setItems(next);
  }, [open, pauta]);

  const includedItems = items.filter((i) => i.incluir);
  const canSubmit =
    includedItems.length > 0 &&
    includedItems.every(
      (i) => i.responsavel_id && i.prazo && i.titulo.trim().length > 0,
    );

  const update = (uid: string, patch: Partial<FollowupCandidate>) => {
    setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(
        includedItems.map((i) => ({
          projeto_id: i.projeto_id,
          titulo: i.titulo.trim(),
          responsavel_ids: [i.responsavel_id],
          prazo: i.prazo,
          prioridade: i.prioridade,
        })),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Transformar condicionantes em tarefas</DialogTitle>
          <DialogDescription>
            Selecione, ajuste e atribua os follow-ups. Eles serão criados como
            tarefas vinculadas aos respectivos projetos.
          </DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma condicionante registrada.
          </p>
        ) : (
          <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
            {items.map((i) => (
              <div
                key={i.uid}
                className="rounded-md border border-border p-3 text-sm"
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={i.incluir}
                    onCheckedChange={(c) =>
                      update(i.uid, { incluir: c === true })
                    }
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      {i.projeto_nome}
                    </p>
                    <Input
                      value={i.titulo}
                      onChange={(e) => update(i.uid, { titulo: e.target.value })}
                      disabled={!i.incluir}
                      placeholder="Título da tarefa"
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Select
                        value={i.responsavel_id || undefined}
                        onValueChange={(v) =>
                          update(i.uid, { responsavel_id: v })
                        }
                        disabled={!i.incluir}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue placeholder="Responsável" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome_completo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="date"
                        value={i.prazo}
                        onChange={(e) => update(i.uid, { prazo: e.target.value })}
                        disabled={!i.incluir}
                        className="h-9 text-xs"
                      />
                      <Select
                        value={i.prioridade}
                        onValueChange={(v) =>
                          update(i.uid, {
                            prioridade: v as "baixa" | "media" | "alta",
                          })
                        }
                        disabled={!i.incluir}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baixa">Baixa</SelectItem>
                          <SelectItem value="media">Média</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar {includedItems.length} tarefas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
