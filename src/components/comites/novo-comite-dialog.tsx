import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MultiProfileSelect } from "@/components/ui/multi-profile-select";
import { listProfiles } from "@/lib/projetos.functions";
import { createComite } from "@/lib/comites.functions";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

function defaultDateTime(): string {
  // Next Tuesday at 14:00 local time, formatted for datetime-local input
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 2=Tue
  const diff = (2 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(14, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NovoComiteDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const profilesFn = useServerFn(listProfiles);
  const profilesQ = useQuery({
    queryKey: ["profiles-all"],
    queryFn: () => profilesFn(),
    enabled: open,
  });
  const profileOptions = useMemo(
    () =>
      (profilesQ.data?.profiles ?? []).map((p) => ({
        id: p.id,
        label: p.nome_completo,
      })),
    [profilesQ.data],
  );

  const [titulo, setTitulo] = useState("");
  const [dataStr, setDataStr] = useState(defaultDateTime());
  const [participantes, setParticipantes] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTitulo("");
      setDataStr(defaultDateTime());
      setParticipantes([]);
    }
  }, [open]);

  const createFn = useServerFn(createComite);
  const m = useMutation({
    mutationFn: (input: { titulo: string; data: string; participante_ids: string[] }) =>
      createFn({ data: input }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["comites"] });
      onOpenChange(false);
      toast.success("Comitê criado.");
      navigate({ to: "/comites/$id", params: { id: res.comite.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (titulo.trim().length < 3) {
      toast.error("Título precisa de ao menos 3 caracteres.");
      return;
    }
    if (!dataStr) {
      toast.error("Informe a data do comitê.");
      return;
    }
    const when = new Date(dataStr);
    const limit = new Date();
    limit.setDate(limit.getDate() - 1);
    if (when < limit) {
      toast.error("Data não pode ser mais de 1 dia no passado.");
      return;
    }
    if (participantes.length === 0) {
      toast.error("Selecione ao menos um participante.");
      return;
    }
    m.mutate({
      titulo: titulo.trim(),
      data: when.toISOString(),
      participante_ids: participantes,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo comitê</DialogTitle>
          <DialogDescription>
            Defina o título, a data e os participantes. Você adiciona projetos à
            pauta na próxima tela.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Comitê de Investimentos - Maio"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="data">Data e hora</Label>
            <Input
              id="data"
              type="datetime-local"
              value={dataStr}
              onChange={(e) => setDataStr(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Participantes</Label>
            <MultiProfileSelect
              options={profileOptions}
              value={participantes}
              onChange={setParticipantes}
              placeholder={
                profilesQ.isLoading ? "Carregando..." : "Selecione participantes"
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={m.isPending}>
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar comitê
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
