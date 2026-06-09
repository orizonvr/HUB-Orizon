import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarStack } from "@/components/ui/avatar-stack";
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
  type ComiteStatus,
} from "@/lib/comites.functions";
import { listAllProjetosLite } from "@/lib/tarefas.functions";
import { listProfiles } from "@/lib/projetos.functions";
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
  const role = profile?.role;
  const canEdit =
    !!comite &&
    isPreparacao &&
    (role === "admin" ||
      role === "lider" ||
      comite.criado_por_id === profile?.id);
  const canCancel =
    !!comite &&
    isPreparacao &&
    (role === "admin" ||
      role === "lider" ||
      comite.criado_por_id === profile?.id);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["comite", id] });

  const addFn = useServerFn(addProjetoToPauta);
  const removeFn = useServerFn(removeProjetoFromPauta);
  const updateItemFn = useServerFn(updatePautaItem);
  const updateComiteFn = useServerFn(updateComite);

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

  const relatorM = useMutation({
    mutationFn: (input: { id: string; relator_id: string | null }) =>
      updateItemFn({ data: input }),
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

  const [addOpen, setAddOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

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
        <div className="flex items-start justify-between gap-4">
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
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelOpen(true)}
            >
              Cancelar comitê
            </Button>
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
          <h2 className="text-sm font-semibold">Pauta</h2>
          {canEdit && (
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
        ) : (
          <ul className="mt-4 space-y-2">
            {comite.pauta.map((item, idx) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-md border border-border p-3"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.projeto_nome}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {TIPO_LABEL[item.projeto_tipo]}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {item.projeto_estagio}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Relator:
                    </span>
                    <Select
                      value={item.relator_id ?? "none"}
                      onValueChange={(v) =>
                        relatorM.mutate({
                          id: item.id,
                          relator_id: v === "none" ? null : v,
                        })
                      }
                      disabled={!canEdit || relatorM.isPending}
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
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeM.mutate(item.id)}
                    disabled={removeM.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

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
    </div>
  );
}

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
                      className={
                        projetoId === p.id ? "bg-accent" : ""
                      }
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
