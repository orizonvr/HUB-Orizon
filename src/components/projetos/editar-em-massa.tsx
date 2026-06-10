import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { updateProjeto, type Profile } from "@/lib/projetos.functions";
import { STATUS_LABEL } from "@/lib/ma-utils";
import type { ProjetoConfig } from "@/lib/projetos-config";

const KEEP = "__keep__";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ids: string[];
  profiles: Profile[];
  config: ProjetoConfig;
  onApplied: () => void;
};

export function EditarEmMassa({
  open,
  onOpenChange,
  ids,
  profiles,
  config,
  onApplied,
}: Props) {
  const updateFn = useServerFn(updateProjeto);
  const [responsavel, setResponsavel] = useState<string>(KEEP);
  const [lider, setLider] = useState<string>(KEEP);
  const [estagio, setEstagio] = useState<string>(KEEP);
  const [status, setStatus] = useState<string>(KEEP);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setResponsavel(KEEP);
    setLider(KEEP);
    setEstagio(KEEP);
    setStatus(KEEP);
  };

  const patch = useMemo(() => {
    const p: Record<string, unknown> = {};
    if (responsavel !== KEEP) p.responsavel_id = responsavel;
    if (lider !== KEEP) p.lider_id = lider;
    if (estagio !== KEEP) p.estagio = estagio;
    if (status !== KEEP) p.status = status;
    return p;
  }, [responsavel, lider, estagio, status]);

  const resumo = useMemo(() => {
    const parts: string[] = [];
    const nome = (id: string) =>
      profiles.find((p) => p.id === id)?.nome_completo ?? "—";
    if (responsavel !== KEEP) parts.push(`Responsável → ${nome(responsavel)}`);
    if (lider !== KEEP) parts.push(`Líder → ${nome(lider)}`);
    if (estagio !== KEEP) {
      const lbl = config.estagios.find((s) => s.key === estagio)?.label ?? estagio;
      parts.push(`Estágio → ${lbl}`);
    }
    if (status !== KEEP) parts.push(`Status → ${STATUS_LABEL[status] ?? status}`);
    return parts.join("; ");
  }, [responsavel, lider, estagio, status, profiles, config]);

  const hasChanges = Object.keys(patch).length > 0;

  const handleClose = (v: boolean) => {
    if (loading) return;
    if (!v) reset();
    onOpenChange(v);
  };

  const handleApply = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => updateFn({ data: { id, patch } })),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      if (fail === 0) {
        toast.success(`${ok} projeto${ok > 1 ? "s" : ""} atualizado${ok > 1 ? "s" : ""}.`);
      } else {
        toast.warning(
          `${ok} atualizado${ok !== 1 ? "s" : ""} · ${fail} sem permissão ou com erro.`,
        );
      }
      onApplied();
      reset();
      setConfirmOpen(false);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Editar {ids.length} projeto{ids.length > 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Os campos marcados como "Manter" não serão alterados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={responsavel} onValueChange={setResponsavel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Manter</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Líder</Label>
              <Select value={lider} onValueChange={setLider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Manter</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Estágio</Label>
              <Select value={estagio} onValueChange={setEstagio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Manter</SelectItem>
                  {config.estagios.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Manter</SelectItem>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => handleClose(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!hasChanges || loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={(v) => !loading && setConfirmOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar edição em massa</AlertDialogTitle>
            <AlertDialogDescription>
              Aplicar <span className="font-medium text-foreground">{resumo}</span> a{" "}
              {ids.length} projeto{ids.length > 1 ? "s" : ""}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApply} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
