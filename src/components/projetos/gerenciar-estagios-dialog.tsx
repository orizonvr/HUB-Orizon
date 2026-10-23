import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown,
  ArrowUp,
  Columns3,
  Edit2,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  FolderKanban,
  Check,
  X,
  Layers,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  listPipelineEstagios,
  createPipelineEstagio,
  updatePipelineEstagio,
  deletePipelineEstagio,
  reorderPipelineEstagios,
  type Projeto,
} from "@/lib/projetos.functions";
import type { ProjetoTipo } from "@/lib/projetos-types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: ProjetoTipo;
  projetos: Projeto[];
  onEstagiosChanged?: () => void;
};

export function GerenciarEstagiosDialog({
  open,
  onOpenChange,
  tipo,
  projetos,
  onEstagiosChanged,
}: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPipelineEstagios);
  const createFn = useServerFn(createPipelineEstagio);
  const updateFn = useServerFn(updatePipelineEstagio);
  const deleteFn = useServerFn(deletePipelineEstagio);
  const reorderFn = useServerFn(reorderPipelineEstagios);

  const [novoLabel, setNovoLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  // Diálogo de confirmação para exclusão com transferência de projetos
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    key: string;
    label: string;
    count: number;
  } | null>(null);
  const [transferKey, setTransferKey] = useState<string>("");

  const q = useQuery({
    queryKey: ["pipeline-estagios", tipo],
    queryFn: () => listFn({ data: { tipo } }),
    enabled: open,
  });

  const estagios = q.data?.estagios ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pipeline-estagios", tipo] });
    qc.invalidateQueries({
      queryKey: [tipo === "ma" ? "ma-projetos" : "nn-projetos"],
    });
    onEstagiosChanged?.();
  };

  const createMut = useMutation({
    mutationFn: (label: string) => createFn({ data: { tipo, label } }),
    onSuccess: () => {
      setNovoLabel("");
      toast.success("Coluna criada com sucesso no pipeline");
      invalidate();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      updateFn({ data: { id, label } }),
    onSuccess: () => {
      setEditingId(null);
      toast.success("Coluna renomeada com sucesso");
      invalidate();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: ({
      id,
      transferirParaChave,
    }: {
      id: string;
      transferirParaChave: string;
    }) => deleteFn({ data: { id, transferirParaChave } }),
    onSuccess: () => {
      setDeleteTarget(null);
      setTransferKey("");
      toast.success("Coluna removida e projetos transferidos com sucesso");
      invalidate();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorderFn({ data: { ids } }),
    onSuccess: () => {
      toast.success("Ordem das colunas salva");
      invalidate();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const handleCreate = () => {
    const clean = novoLabel.trim();
    if (!clean) return;
    createMut.mutate(clean);
  };

  const handleStartEdit = (id: string, label: string) => {
    setEditingId(id);
    setEditingLabel(label);
  };

  const handleSaveEdit = (id: string) => {
    const clean = editingLabel.trim();
    if (!clean) return;
    updateMut.mutate({ id, label: clean });
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= estagios.length) return;
    const newEstagios = [...estagios];
    const temp = newEstagios[index];
    newEstagios[index] = newEstagios[targetIndex];
    newEstagios[targetIndex] = temp;

    const ids = newEstagios
      .map((e) => e.id)
      .filter((id) => !id.startsWith("default-"));
    if (ids.length > 0) {
      reorderMut.mutate(ids);
    }
  };

  const handleRequestDelete = (id: string, key: string, label: string) => {
    const count = projetos.filter((p) => p.estagio === key).length;
    const remaining = estagios.filter((e) => e.key !== key);
    const defaultTransfer = remaining[0]?.key ?? "";
    setTransferKey(defaultTransfer);
    setDeleteTarget({ id, key, label, count });
  };

  const isMA = tipo === "ma";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl">
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
                className="h-48 w-48 rounded-full object-cover filter contrast-125"
              />
            </div>

            <div className="relative z-10 flex items-start gap-3.5 pr-12">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
                <Columns3 className="h-5 w-5" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                    Gerenciar Colunas do Kanban
                  </DialogTitle>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-semibold tracking-wide text-white uppercase backdrop-blur-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{isMA ? "Pipeline M&A" : "Novos Negócios"}</span>
                  </span>
                </div>
                <DialogDescription className="text-xs text-white/80 font-normal leading-relaxed truncate max-w-xl">
                  Configure a esteira de estágios do pipeline. Reordene a sequência de trabalho, adicione novas etapas ou renomeie conforme a governança.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. CORPO SCROLLÁVEL COM SEÇÕES ESTRUTURADAS              */}
          {/* ========================================================= */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Card para Adicionar Nova Coluna */}
            <div className="rounded-xl border border-border/80 bg-secondary/25 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  Nova Coluna de Pipeline
                </Label>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Pressione <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/80 text-[10px] font-mono">Enter</kbd> para salvar
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={novoLabel}
                  onChange={(e) => setNovoLabel(e.target.value)}
                  placeholder="Nome do estágio (ex: Comitê de Investimento, Due Diligence Técnica...)"
                  className="h-9.5 text-xs rounded-xl bg-background border-border/80 focus-visible:ring-primary/25"
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <Button
                  size="sm"
                  onClick={handleCreate}
                  disabled={!novoLabel.trim() || createMut.isPending}
                  className="h-9.5 px-4 shrink-0 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {createMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" /> Adicionar Coluna
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Lista dos Estágios Atuais */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Sequência das Colunas Ativas
                  </Label>
                </div>
                <span className="text-xs font-semibold text-foreground/80 bg-muted/60 px-2 py-0.5 rounded-full border border-border/60">
                  {estagios.length} {estagios.length === 1 ? "coluna" : "colunas"}
                </span>
              </div>

              {q.isLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs">Carregando esteira do pipeline…</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {estagios.map((s, index) => {
                    const count = projetos.filter((p) => p.estagio === s.key).length;
                    const isEditing = editingId === s.id;

                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "group flex items-center justify-between gap-3 p-3 rounded-xl border bg-card transition-all duration-150",
                          isEditing
                            ? "border-primary/50 ring-2 ring-primary/10 shadow-xs"
                            : "border-border/70 hover:border-border hover:shadow-2xs",
                        )}
                      >
                        {/* Identificador & Conteúdo */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-foreground/80 border border-border/60 select-none">
                            {index + 1}
                          </span>

                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={editingLabel}
                                onChange={(e) => setEditingLabel(e.target.value)}
                                className="h-8 text-xs rounded-lg bg-background"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit(s.id);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(s.id)}
                                disabled={updateMut.isPending || !editingLabel.trim()}
                                className="h-8 px-2.5 text-xs rounded-lg gap-1 font-semibold cursor-pointer"
                              >
                                {updateMut.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                                className="h-8 px-2 text-xs rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap">
                              <span className="text-xs sm:text-sm font-semibold text-foreground tracking-tight truncate max-w-sm">
                                {s.label}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground/75 px-1.5 py-0.5 rounded bg-muted/60 border border-border/40 select-none">
                                {s.key}
                              </span>
                              {count > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 select-none">
                                  <FolderKanban className="h-3 w-3" />
                                  {count} {count === 1 ? "projeto" : "projetos"}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/60 select-none italic">
                                  sem projetos
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Ações de Reordenação e Edição */}
                        {!isEditing && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={index === 0 || reorderMut.isPending}
                              onClick={() => handleMove(index, "up")}
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer disabled:opacity-30"
                              title="Mover coluna para a esquerda (anterior)"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={
                                index === estagios.length - 1 || reorderMut.isPending
                              }
                              onClick={() => handleMove(index, "down")}
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer disabled:opacity-30"
                              title="Mover coluna para a direita (próxima)"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleStartEdit(s.id, s.label)}
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                              title="Renomear coluna"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={estagios.length <= 1}
                              onClick={() =>
                                handleRequestDelete(s.id, s.key, s.label)
                              }
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer disabled:opacity-30"
                              title="Remover coluna do pipeline"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. FOOTER DO MODAL                                       */}
          {/* ========================================================= */}
          <DialogFooter className="px-6 py-3.5 border-t border-border/70 bg-muted/20 flex flex-row items-center justify-between sm:justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span>Use as setas para definir a ordem sequencial no Kanban</span>
            </div>
            <Button
              variant="default"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8.5 px-4 font-semibold rounded-xl cursor-pointer"
            >
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* 4. MODAL DE EXCLUSÃO COM TRANSFERÊNCIA SEGURA DE PROJETOS */}
      {/* ========================================================= */}
      {deleteTarget && (
        <Dialog open={true} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl p-0 gap-0 overflow-hidden border border-border/80 shadow-2xl">
            {/* Header com Alerta de Risco Semântico */}
            <div className="bg-destructive/10 border-b border-destructive/20 p-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive border border-destructive/25 shadow-xs">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-base font-bold text-destructive">
                  Remover Coluna: {deleteTarget.label}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  {deleteTarget.count > 0 ? (
                    <>
                      Existem{" "}
                      <strong className="text-foreground font-semibold">
                        {deleteTarget.count} {deleteTarget.count === 1 ? "projeto ativo" : "projetos ativos"}
                      </strong>{" "}
                      nesta etapa. Para não perder o histórico, selecione para qual coluna de destino eles devem ser movidos:
                    </>
                  ) : (
                    "Não há nenhum projeto vinculado a esta etapa. A coluna será removida permanentemente do pipeline."
                  )}
                </DialogDescription>
              </div>
            </div>

            <div className="p-5 space-y-3.5">
              {deleteTarget.count > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Nova Coluna de Destino
                  </Label>
                  <Select value={transferKey} onValueChange={setTransferKey}>
                    <SelectTrigger className="h-9.5 rounded-xl border-border/80 text-xs">
                      <SelectValue placeholder="Selecione a etapa de destino" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {estagios
                        .filter((e) => e.key !== deleteTarget.key)
                        .map((e) => (
                          <SelectItem key={e.key} value={e.key} className="text-xs">
                            {e.label}{" "}
                            <span className="font-mono text-[10px] text-muted-foreground ml-1">
                              ({e.key})
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter className="pt-2 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteMut.isPending}
                  className="text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    deleteMut.mutate({
                      id: deleteTarget.id,
                      transferirParaChave: transferKey,
                    })
                  }
                  disabled={
                    deleteMut.isPending ||
                    (deleteTarget.count > 0 && !transferKey)
                  }
                  className="text-xs font-semibold rounded-xl cursor-pointer gap-1.5"
                >
                  {deleteMut.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  {deleteTarget.count > 0
                    ? "Transferir e Remover"
                    : "Confirmar Exclusão"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

