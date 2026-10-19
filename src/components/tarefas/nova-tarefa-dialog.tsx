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
import { Loader2, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { createTarefa, listAllProjetosLite } from "@/lib/tarefas.functions";
import {
  PRIORIDADE_LABEL,
  TIPO_LABEL,
  type TarefaPrioridade,
  type TarefaTipo,
} from "@/lib/tarefas-types";
import type { Profile } from "@/lib/projetos.functions";
import { MultiProfileSelect } from "@/components/ui/multi-profile-select";
import { useSuspendParentModal } from "@/components/ma/nested-modal-context";
import { isResponsavelElegivel } from "@/lib/projetos-config";

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
  useSuspendParentModal(open);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoProjeto, setTipoProjeto] = useState<ProjetoTipo | "">("");
  const [tarefaTipo, setTarefaTipo] = useState<TarefaTipo>("tarefa");
  const [projetoId, setProjetoId] = useState<string>("");
  const [responsavelIds, setResponsavelIds] = useState<string[]>(
    defaultResponsavelId ? [defaultResponsavelId] : [],
  );
  const [dependenciaValue, setDependenciaValue] = useState<string>("nenhuma");
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
    setTarefaTipo("tarefa");
    setDependenciaValue("nenhuma");
    setResponsavelIds(defaultResponsavelId ? [defaultResponsavelId] : []);
    setPrazo(plus7DaysISO());
    setPrioridade("media");
    if (projetoFixo) {
      setProjetoId(projetoFixo.id);
      setTipoProjeto(tipoPadrao ?? projetoTipoMap.get(projetoFixo.id) ?? "");
    } else {
      setProjetoId("");
      setTipoProjeto(tipoPadrao ?? "");
    }
  }, [open, projetoFixo?.id, tipoPadrao, defaultResponsavelId, projetoTipoMap]);

  const handleTipoProjetoChange = (v: ProjetoTipo) => {
    setTipoProjeto(v);
    if (projetoId && projetoTipoMap.get(projetoId) !== v) {
      setProjetoId("");
    }
  };

  const qc = useQueryClient();
  const createFn = useServerFn(createTarefa);
  const mut = useMutation({
    mutationFn: () => {
      const depTerceiro = dependenciaValue === "terceiros";
      const depId =
        !depTerceiro && dependenciaValue !== "nenhuma"
          ? dependenciaValue
          : null;

      return createFn({
        data: {
          projeto_id: projetoId,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          responsavel_ids: responsavelIds,
          prazo: prazo ? prazo : null,
          prioridade,
          origem: "ad_hoc",
          tipo: tarefaTipo,
          dependencia_id: depId,
          dependencia_terceiro: depTerceiro,
        },
      });
    },
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

  const isAcompanhamento = tarefaTipo === "acompanhamento";
  const canSubmit =
    titulo.trim().length > 0 &&
    projetoId.length > 0 &&
    responsavelIds.length > 0 &&
    (isAcompanhamento || prazo.length === 10) &&
    !mut.isPending;

  const projetosDisponiveis = tipoProjeto ? projetosByTipo[tipoProjeto] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>
            {projetoFixo
              ? `Atrelada ao projeto ${projetoFixo.nome}.`
              : "Atrele a tarefa a um projeto."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5">
          {/* Tipo de Tarefa (Padrão vs Acompanhamento) + Tipo de Projeto */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Classificação</Label>
              <Select
                value={tarefaTipo}
                onValueChange={(v) => setTarefaTipo(v as TarefaTipo)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABEL).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Pipeline</Label>
              <Select
                value={tipoProjeto || undefined}
                onValueChange={(v) => handleTipoProjetoChange(v as ProjetoTipo)}
                disabled={!!projetoFixo}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o pipeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ma">M&amp;A</SelectItem>
                  <SelectItem value="novos_negocios">Novos Negócios</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Projeto */}
          <div className="space-y-1.5">
            <Label>Projeto</Label>
            {projetoFixo ? (
              <Input value={projetoFixo.nome} disabled className="bg-muted/40" />
            ) : (
              <Select
                value={projetoId || undefined}
                onValueChange={setProjetoId}
                disabled={!tipoProjeto}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      tipoProjeto ? "Selecione o projeto" : "Selecione o pipeline primeiro"
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

          {/* Título */}
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Revisar NBO com jurídico"
            />
          </div>

          {/* Responsáveis e Dependência */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Responsáveis</Label>
              <MultiProfileSelect
                options={profiles
                  .filter(isResponsavelElegivel)
                  .map((p) => ({ id: p.id, label: p.nome_completo }))}
                value={responsavelIds}
                onChange={setResponsavelIds}
                placeholder="Selecione responsáveis"
                compact
              />
            </div>

            <div className="space-y-1.5">
              <Label>Dependência</Label>
              <Select
                value={dependenciaValue}
                onValueChange={setDependenciaValue}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione dependência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  <SelectItem value="terceiros">
                    <span className="font-medium text-amber-600">Terceiros (Consultoria/Regulatório)</span>
                  </SelectItem>
                  {profiles.filter(isResponsavelElegivel).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prazo e Prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Prazo</Label>
                {isAcompanhamento && (
                  <span className="text-[10px] text-muted-foreground">Opcional</span>
                )}
              </div>
              <Input
                type="date"
                value={prazo}
                min={todayISO()}
                onChange={(e) => setPrazo(e.target.value)}
                placeholder={isAcompanhamento ? "Sem prazo" : undefined}
              />
            </div>

            <div className="space-y-1.5">
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

          {/* Descrição / Primeiro comentário */}
          <div className="space-y-1.5">
            <Label>Observação inicial (opcional)</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Contexto, links ou primeiro comentário…"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
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
