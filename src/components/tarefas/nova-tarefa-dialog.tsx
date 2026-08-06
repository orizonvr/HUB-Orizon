import { useEffect, useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createTarefa, listAllProjetosLite } from "@/lib/tarefas.functions";
import { PRIORIDADE_LABEL, type TarefaPrioridade } from "@/lib/tarefas-types";
import type { Profile } from "@/lib/projetos.functions";
import { MultiProfileSelect } from "@/components/ui/multi-profile-select";
import { useSuspendParentModal } from "@/components/ma/nested-modal-context";


type ProjetoTipo = "ma" | "novos_negocios";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profiles: Profile[];
  /** When provided, both Tipo and Projeto fields are locked. */
  projetoFixo?: { id: string; nome: string } | null;
  /** Pre-selects (but doesn't lock) Tipo when no projetoFixo is given. */
  tipoPadrao?: ProjetoTipo | null;
  /** @deprecated kept for backward-compat; projetos are now fetched internally. */
  projetos?: Array<{ id: string; nome: string }>;
  defaultResponsavelId?: string | null;
  onCreated?: () => void;
};

function todayISO(): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function plus7DaysISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function NovaTarefaDialog({
  open,
  onOpenChange,
  profiles,
  projetoFixo,
  tipoPadrao,
  defaultResponsavelId,
  onCreated,
}: Props) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<ProjetoTipo | "">("");
  const [projetoId, setProjetoId] = useState<string>("");
  const [responsavelIds, setResponsavelIds] = useState<string[]>(
    defaultResponsavelId ? [defaultResponsavelId] : [],
  );
  const [prazo, setPrazo] = useState<string>(plus7DaysISO());
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>("media");

  const projetosFn = useServerFn(listAllProjetosLite);
  const projsQ = useQuery({
    queryKey: ["projetos-lite"],
    queryFn: () => projetosFn(),
    enabled: open && !projetoFixo,
  });
  const projetos = projsQ.data?.projetos ?? [];
  const projetosByTipo = useMemo(() => {
    const map: Record<ProjetoTipo, typeof projetos> = {
      ma: [],
      novos_negocios: [],
    };
    for (const p of projetos) map[p.tipo].push(p);
    return map;
  }, [projetos]);
  const projetoTipoMap = useMemo(() => {
    const m = new Map<string, ProjetoTipo>();
    for (const p of projetos) m.set(p.id, p.tipo);
    return m;
  }, [projetos]);

  useEffect(() => {
    if (!open) return;
    setTitulo("");
    setDescricao("");
    setResponsavelIds(defaultResponsavelId ? [defaultResponsavelId] : []);
    setPrazo(plus7DaysISO());
    setPrioridade("media");
    if (projetoFixo) {
      setProjetoId(projetoFixo.id);
      // tipo will be derived once projetos load; if absent, leave empty (it's locked anyway).
      setTipo(projetoTipoMap.get(projetoFixo.id) ?? "");
    } else {
      setProjetoId("");
      setTipo(tipoPadrao ?? "");
    }
  }, [open, projetoFixo?.id, tipoPadrao, defaultResponsavelId, projetoTipoMap]);

  const handleTipoChange = (v: ProjetoTipo) => {
    setTipo(v);
    // se já tinha um projeto e ele não é desse tipo, limpa
    if (projetoId && projetoTipoMap.get(projetoId) !== v) {
      setProjetoId("");
    }
  };

  const qc = useQueryClient();
  const createFn = useServerFn(createTarefa);
  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          projeto_id: projetoId,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          responsavel_ids: responsavelIds,
          prazo,
          prioridade,
          origem: "ad_hoc",
        },
      }),
    onSuccess: () => {
      toast.success("Tarefa criada");
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["tarefas-projeto", projetoId] });
      qc.invalidateQueries({ queryKey: ["minhas-tarefas"] });
      qc.invalidateQueries({ queryKey: ["resumo-tarefas-time"] });
      qc.invalidateQueries({ queryKey: ["alertas-tarefas"] });
      onOpenChange(false);
      onCreated?.();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSubmit =
    titulo.trim().length > 0 &&
    projetoId.length > 0 &&
    responsavelIds.length > 0 &&
    prazo.length === 10 &&
    !mut.isPending;

  const projetosDisponiveis = tipo ? projetosByTipo[tipo] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>
            {projetoFixo
              ? `Atrelada ao projeto ${projetoFixo.nome}.`
              : "Atrele a tarefa a um projeto."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={tipo || undefined}
                onValueChange={(v) => handleTipoChange(v as ProjetoTipo)}
                disabled={!!projetoFixo}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ma">M&amp;A</SelectItem>
                  <SelectItem value="novos_negocios">Novos Negócios</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Projeto</Label>
              {projetoFixo ? (
                <Input value={projetoFixo.nome} disabled />
              ) : (
                <Select
                  value={projetoId || undefined}
                  onValueChange={setProjetoId}
                  disabled={!tipo}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        tipo ? "Selecione o projeto" : "Selecione o tipo primeiro"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {projetosDisponiveis.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Revisar NBO com jurídico"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Contexto, links, decisões…"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Responsáveis</Label>
              <MultiProfileSelect
                options={profiles.map((p) => ({ id: p.id, label: p.nome_completo }))}
                value={responsavelIds}
                onChange={setResponsavelIds}
                placeholder="Selecione"
                compact
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo</Label>
              <Input
                type="date"
                value={prazo}
                min={todayISO()}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Prioridade</Label>
              <Select
                value={prioridade}
                onValueChange={(v) => setPrioridade(v as TarefaPrioridade)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORIDADE_LABEL).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSubmit} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Criar tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
