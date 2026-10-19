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
    qc.invalidateQueries({ queryKey: [tipo === "ma" ? "ma-projetos" : "nn-projetos"] });
    onEstagiosChanged?.();
  };

  const createMut = useMutation({
    mutationFn: (label: string) =>
      createFn({ data: { tipo, label } }),
    onSuccess: () => {
      setNovoLabel("");
      toast.success("Estágio criado com sucesso");
      invalidate();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      updateFn({ data: { id, label } }),
    onSuccess: () => {
      setEditingId(null);
      toast.success("Estágio atualizado");
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
      toast.success("Estágio removido e cards transferidos");
      invalidate();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorderFn({ data: { ids } }),
    onSuccess: () => {
      toast.success("Ordem salva");
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b">
            <div className="flex items-center gap-2">
              <Columns3 className="h-5 w-5 text-primary" />
              <DialogTitle className="text-base font-semibold">
                Gerenciar Colunas do Kanban ({tipo === "ma" ? "M&A" : "Novos Negócios"})
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Adicione, renomeie, reordene ou remova etapas do pipeline. Ao remover uma etapa, os projetos vinculados serão transferidos com segurança.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Adicionar novo estágio */}
            <div className="flex items-center gap-2 pb-3 border-b">
              <Input
                value={novoLabel}
                onChange={(e) => setNovoLabel(e.target.value)}
                placeholder="Nome da nova etapa (ex: Comitê de Investimento)"
                className="h-9 text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!novoLabel.trim() || createMut.isPending}
                className="h-9 shrink-0 text-xs"
              >
                {createMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                  </>
                )}
              </Button>
            </div>

            {/* Lista dos estágios atuais */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Etapas Ativas ({estagios.length})
              </Label>

              {q.isLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  {estagios.map((s, index) => {
                    const count = projetos.filter((p) => p.estagio === s.key).length;
                    const isEditing = editingId === s.id;

                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-card/60 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="w-5 text-center text-xs font-semibold text-muted-foreground/70">
                            {index + 1}
                          </span>

                          {isEditing ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <Input
                                value={editingLabel}
                                onChange={(e) => setEditingLabel(e.target.value)}
                                className="h-7 text-xs"
                                autoFocus
                                onKeyDown={(e) =>
                                  e.key === "Enter" && handleSaveEdit(s.id)
                                }
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleSaveEdit(s.id)}
                                disabled={updateMut.isPending}
                                className="h-7 text-xs px-2"
                              >
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                                className="h-7 text-xs px-2"
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xs font-medium truncate">
                                {s.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                ({s.key})
                              </span>
                              {count > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                  {count} projeto{count === 1 ? "" : "s"}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={index === 0 || reorderMut.isPending}
                              onClick={() => handleMove(index, "up")}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Mover para cima"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={
                                index === estagios.length - 1 ||
                                reorderMut.isPending
                              }
                              onClick={() => handleMove(index, "down")}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Mover para baixo"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleStartEdit(s.id, s.label)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Renomear etapa"
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
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              title="Remover etapa"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

          <DialogFooter className="p-4 border-t bg-muted/20">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão com transferência segura de projetos */}
      {deleteTarget && (
        <Dialog open={true} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <DialogTitle className="text-base font-semibold">
                  Remover Etapa: {deleteTarget.label}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs pt-1">
                {deleteTarget.count > 0 ? (
                  <>
                    Atenção: existem{" "}
                    <strong className="text-foreground">
                      {deleteTarget.count} projeto(s)
                    </strong>{" "}
                    atualmente nesta etapa. Selecione para qual etapa de destino eles devem ser transferidos:
                  </>
                ) : (
                  "Não há projetos nesta etapa. Confirma a exclusão?"
                )}
              </DialogDescription>
            </DialogHeader>

            {deleteTarget.count > 0 && (
              <div className="space-y-2 py-2">
                <Label className="text-xs font-medium">Etapa de Destino</Label>
                <Select value={transferKey} onValueChange={setTransferKey}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione etapa destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {estagios
                      .filter((e) => e.key !== deleteTarget.key)
                      .map((e) => (
                        <SelectItem key={e.key} value={e.key}>
                          {e.label} ({e.key})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMut.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
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
              >
                {deleteMut.isPending && (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                )}
                Confirmar e Transferir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
