import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  createTarefasBatch,
  listAllProjetosLite,
} from "@/lib/tarefas.functions";
import { PRIORIDADE_LABEL, type TarefaPrioridade } from "@/lib/tarefas-types";
import type { Profile } from "@/lib/projetos.functions";
import { MultiProfileSelect } from "@/components/ui/multi-profile-select";

type ProjetoTipo = "ma" | "novos_negocios";

type Linha = {
  key: string;
  tipo: ProjetoTipo | "";
  projeto_id: string;
  titulo: string;
  responsavel_ids: string[];
  prazo: string;
  prioridade: TarefaPrioridade;
  descricao: string;
  notaAberta: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profiles: Profile[];
  defaultResponsavelId?: string | null;
  /** Pre-selects tipo on every new line and locks (used in scoped workspace views). */
  tipoPadrao?: ProjetoTipo | null;
  /** Pre-selects a single projeto on every new line (overrides tipoPadrao behavior). */
  projetoPadraoId?: string | null;
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

function novaLinha(defaults: Partial<Linha>): Linha {
  return {
    key: crypto.randomUUID(),
    tipo: defaults.tipo ?? "",
    projeto_id: defaults.projeto_id ?? "",
    titulo: "",
    responsavel_ids: defaults.responsavel_ids ?? [],
    prazo: defaults.prazo ?? plus7DaysISO(),
    prioridade: defaults.prioridade ?? "media",
    descricao: "",
    notaAberta: false,
  };
}

export function NovaRodadaDrawer({
  open,
  onOpenChange,
  profiles,
  defaultResponsavelId,
  tipoPadrao,
  projetoPadraoId,
}: Props) {
  const [dataReuniao, setDataReuniao] = useState<string>(todayISO());
  const [linhas, setLinhas] = useState<Linha[]>([]);

  const projetosFn = useServerFn(listAllProjetosLite);
  const projsQ = useQuery({
    queryKey: ["projetos-lite"],
    queryFn: () => projetosFn(),
    enabled: open,
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
    setDataReuniao(todayISO());
    const tipoInicial: ProjetoTipo | "" =
      tipoPadrao ??
      (projetoPadraoId
        ? projetoTipoMap.get(projetoPadraoId) ?? ""
        : "");
    const base: Partial<Linha> = {
      tipo: tipoInicial,
      projeto_id: projetoPadraoId ?? "",
      responsavel_ids: defaultResponsavelId ? [defaultResponsavelId] : [],
    };
    setLinhas([novaLinha(base), novaLinha(base), novaLinha(base)]);
  }, [open, tipoPadrao, projetoPadraoId, defaultResponsavelId, projetoTipoMap]);

  const updateLinha = (key: string, patch: Partial<Linha>) => {
    setLinhas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };
  const onChangeTipo = (key: string, tipo: ProjetoTipo | "") => {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        // Limpa projeto se mudou de tipo
        const keepProj =
          l.projeto_id && projetoTipoMap.get(l.projeto_id) === tipo;
        return { ...l, tipo, projeto_id: keepProj ? l.projeto_id : "" };
      }),
    );
  };
  const addLinha = () => {
    setLinhas((prev) => [
      ...prev,
      novaLinha({
        tipo: tipoPadrao ?? "",
        projeto_id: projetoPadraoId ?? "",
        responsavel_ids: defaultResponsavelId ? [defaultResponsavelId] : [],
      }),
    ]);
  };
  const removeLinha = (key: string) => {
    setLinhas((prev) =>
      prev.length === 1 ? prev : prev.filter((l) => l.key !== key),
    );
  };

  const qc = useQueryClient();
  const batchFn = useServerFn(createTarefasBatch);
  const mut = useMutation({
    mutationFn: () => {
      const validas = linhas.filter(
        (l) =>
          l.tipo &&
          l.projeto_id &&
          l.titulo.trim().length > 0 &&
          l.responsavel_ids.length > 0 &&
          l.prazo.length === 10,
      );
      if (validas.length === 0) {
        throw new Error("Preencha ao menos uma linha completa.");
      }
      return batchFn({
        data: {
          data_reuniao: dataReuniao,
          tarefas: validas.map((l) => ({
            projeto_id: l.projeto_id,
            titulo: l.titulo.trim(),
            responsavel_ids: l.responsavel_ids,
            prazo: l.prazo,
            prioridade: l.prioridade,
            descricao: l.descricao.trim() ? l.descricao.trim() : null,
          })),
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`${res.count} tarefa(s) criada(s) na rodada.`);
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["tarefas-projeto"] });
      qc.invalidateQueries({ queryKey: ["minhas-tarefas"] });
      qc.invalidateQueries({ queryKey: ["resumo-tarefas-time"] });
      qc.invalidateQueries({ queryKey: ["alertas-tarefas"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const validas = linhas.filter(
    (l) =>
      l.tipo &&
      l.projeto_id &&
      l.titulo.trim().length > 0 &&
      l.responsavel_ids.length > 0 &&
      l.prazo.length === 10,
  ).length;

  const handleLastEnter = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter" && !e.shiftKey && idx === linhas.length - 1) {
      e.preventDefault();
      addLinha();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-none md:w-[95vw] lg:w-[1200px] flex flex-col gap-0 p-0"
      >
        <SheetHeader className="p-6 border-b">
          <SheetTitle>Reunião de Pipeline</SheetTitle>
          <SheetDescription>
            Registre as tarefas decididas na reunião e atribua aos responsáveis.
            Enter na última linha cria uma nova. Tudo é salvo em lote com
            origem <span className="font-medium">Reunião de pipeline</span>.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-4 px-6 py-4 border-b bg-muted/30">
          <div className="space-y-1">
            <Label className="text-xs">Data da reunião</Label>
            <Input
              type="date"
              value={dataReuniao}
              onChange={(e) => setDataReuniao(e.target.value)}
              className="w-[180px] h-9"
            />
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            {validas} de {linhas.length} linha(s) prontas para salvar
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4 space-y-2">
          <div className="grid grid-cols-[130px_1.2fr_2fr_1.3fr_140px_120px_36px_36px] gap-2 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <div>Tipo</div>
            <div>Projeto</div>
            <div>Título</div>
            <div>Responsável</div>
            <div>Prazo</div>
            <div>Prioridade</div>
            <div />
            <div />
          </div>

          {linhas.map((l, idx) => {
            const projetosDisponiveis = l.tipo
              ? projetosByTipo[l.tipo]
              : [];
            return (
              <div key={l.key} className="space-y-1">
                <div className="grid grid-cols-[130px_1.2fr_2fr_1.3fr_140px_120px_36px_36px] gap-2 items-center">
                  <Select
                    value={l.tipo || undefined}
                    onValueChange={(v) =>
                      onChangeTipo(l.key, v as ProjetoTipo)
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ma">M&amp;A</SelectItem>
                      <SelectItem value="novos_negocios">
                        Novos Negócios
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={l.projeto_id || undefined}
                    onValueChange={(v) =>
                      updateLinha(l.key, { projeto_id: v })
                    }
                    disabled={!l.tipo}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue
                        placeholder={l.tipo ? "Projeto" : "Selecione o tipo"}
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

                  <Input
                    placeholder="Ex.: Revisar NBO com jurídico"
                    value={l.titulo}
                    onChange={(e) =>
                      updateLinha(l.key, { titulo: e.target.value })
                    }
                    onKeyDown={(e) => handleLastEnter(e, idx)}
                    className="h-9"
                  />

                  <MultiProfileSelect
                    options={profiles.map((p) => ({
                      id: p.id,
                      label: p.nome_completo,
                    }))}
                    value={l.responsavel_ids}
                    onChange={(ids: string[]) =>
                      updateLinha(l.key, { responsavel_ids: ids })
                    }
                    placeholder="Responsáveis"
                    triggerClassName="h-9"
                    compact
                  />

                  <Input
                    type="date"
                    value={l.prazo}
                    onChange={(e) =>
                      updateLinha(l.key, { prazo: e.target.value })
                    }
                    className="h-9"
                  />

                  <Select
                    value={l.prioridade}
                    onValueChange={(v) =>
                      updateLinha(l.key, {
                        prioridade: v as TarefaPrioridade,
                      })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORIDADE_LABEL).map(([k, lbl]) => (
                        <SelectItem key={k} value={k}>
                          {lbl}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 ${
                      l.descricao.trim()
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                    onClick={() =>
                      updateLinha(l.key, { notaAberta: !l.notaAberta })
                    }
                    title={
                      l.notaAberta ? "Recolher observação" : "Adicionar observação"
                    }
                  >
                    {l.notaAberta ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground"
                    onClick={() => removeLinha(l.key)}
                    disabled={linhas.length === 1}
                    title="Remover linha"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {l.notaAberta && (
                  <div className="pl-[138px] pr-[80px]">
                    <Textarea
                      value={l.descricao}
                      onChange={(e) =>
                        updateLinha(l.key, { descricao: e.target.value })
                      }
                      placeholder="Observação para o responsável (opcional)"
                      rows={2}
                      className="text-sm resize-y"
                    />
                  </div>
                )}
              </div>
            );
          })}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLinha}
            className="mt-2"
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar linha
          </Button>
        </div>

        <div className="border-t p-4 flex items-center justify-end gap-2 bg-background">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={validas === 0 || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending && (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            )}
            Salvar {validas > 0 ? `${validas} tarefa(s)` : "rodada"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
