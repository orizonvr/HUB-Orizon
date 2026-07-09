import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";

import {
  createProjeto,
  type Profile,
} from "@/lib/projetos.functions";
import { SUBCATEGORIAS } from "@/lib/projetos-types";
import {
  type ProjetoConfig,
  TIPO_INICIATIVA,
  buildDescricaoComTipo,
} from "@/lib/projetos-config";

export function NewProjectDialog({
  config,
  open,
  onOpenChange,
  profiles,
  onCreated,
}: {
  config: ProjetoConfig;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profiles: Profile[];
  onCreated: (id: string) => void;
}) {
  const createFn = useServerFn(createProjeto);
  const qc = useQueryClient();
  const isNN = config.tipo === "novos_negocios";

  const empty = () => ({
    nome: "",
    contraparte: "",
    setor: "",
    subcategoria: "",
    estagio: config.estagioInicial,
    responsavel_id: "",
    valor_estimado: "",
    data_inicio: "",
    data_fechamento_prevista: "",
    descricao: "",
    tese: "",
    tipo_iniciativa: "",
  });

  const [form, setForm] = useState(empty);

  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          tipo: config.tipo,
          nome: form.nome.trim(),
          contraparte: form.contraparte.trim(),
          setor: form.setor,
          subcategoria: isNN ? form.subcategoria || null : null,
          estagio: form.estagio,
          responsavel_id: form.responsavel_id,
          valor_estimado: isNN
            ? null
            : Number(form.valor_estimado || 0),
          data_inicio: isNN ? form.data_inicio || null : null,
          data_fechamento_prevista: isNN
            ? null
            : form.data_fechamento_prevista || null,
          descricao: config.showTipoIniciativa
            ? buildDescricaoComTipo(form.tipo_iniciativa, form.descricao)
            : form.descricao || null,
          tese: config.showTeseNoForm ? form.tese || null : null,
        },
      }),
    onSuccess: (res) => {
      toast.success("Projeto criado");
      qc.invalidateQueries({ queryKey: [config.queryKey] });
      setForm(empty());
      onOpenChange(false);
      onCreated(res.projeto.id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSubmit =
    form.nome.trim() &&
    form.contraparte.trim() &&
    form.setor &&
    form.estagio &&
    form.responsavel_id &&
    (isNN
      ? form.subcategoria && form.data_inicio
      : form.valor_estimado && form.data_fechamento_prevista) &&
    (!config.showTipoIniciativa || form.tipo_iniciativa);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo projeto de {config.titulo}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5 col-span-2">
            <Label>{config.nomeLabel} *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder={
                isNN ? "Ex.: Aterro Município X" : "Ex.: Projeto Atlas"
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Contraparte *</Label>
            <Input
              value={form.contraparte}
              onChange={(e) =>
                setForm({ ...form, contraparte: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Setor *</Label>
            <Select
              value={form.setor}
              onValueChange={(v) => setForm({ ...form, setor: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                {config.setores.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isNN && (
            <div className="space-y-1.5">
              <Label>Subcategoria *</Label>
              <Select
                value={form.subcategoria}
                onValueChange={(v) => setForm({ ...form, subcategoria: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {SUBCATEGORIAS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Estágio inicial *</Label>
            <Select
              value={form.estagio}
              onValueChange={(v) => setForm({ ...form, estagio: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.estagios.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {config.showTipoIniciativa && (
            <div className="space-y-1.5">
              <Label>Tipo de iniciativa *</Label>
              <Select
                value={form.tipo_iniciativa}
                onValueChange={(v) =>
                  setForm({ ...form, tipo_iniciativa: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_INICIATIVA.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Responsável *</Label>
            <Select
              value={form.responsavel_id}
              onValueChange={(v) =>
                setForm({ ...form, responsavel_id: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isNN && (
            <div className="space-y-1.5">
              <Label>{config.valorInputLabel} *</Label>
              <Input
                type="number"
                value={form.valor_estimado}
                onChange={(e) =>
                  setForm({ ...form, valor_estimado: e.target.value })
                }
              />
            </div>
          )}
          {isNN ? (
            <div className="space-y-1.5">
              <Label>Data de Inclusão do Projeto *</Label>
              <Input
                type="date"
                value={form.data_inicio}
                onChange={(e) =>
                  setForm({ ...form, data_inicio: e.target.value })
                }
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>
                {config.tipo === "ma"
                  ? "Fechamento previsto *"
                  : "Previsão de implementação *"}
              </Label>
              <Input
                type="date"
                value={form.data_fechamento_prevista}
                onChange={(e) =>
                  setForm({
                    ...form,
                    data_fechamento_prevista: e.target.value,
                  })
                }
              />
            </div>
          )}
          <div className="space-y-1.5 col-span-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={form.descricao}
              onChange={(e) =>
                setForm({ ...form, descricao: e.target.value })
              }
              rows={2}
            />
          </div>
          {config.showTeseNoForm && (
            <div className="space-y-1.5 col-span-2">
              <Label>Tese estratégica (opcional)</Label>
              <Textarea
                value={form.tese}
                onChange={(e) => setForm({ ...form, tese: e.target.value })}
                rows={3}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!canSubmit || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? "Criando..." : "Criar projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
