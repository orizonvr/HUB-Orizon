import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Handshake, Sprout, Briefcase, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import {
  createProjeto,
  type Profile,
} from "@/lib/projetos.functions";
import { SUBCATEGORIAS } from "@/lib/projetos-types";
import {
  type ProjetoConfig,
  TIPO_INICIATIVA,
  buildDescricaoComTipo,
  isResponsavelElegivel,
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
    valor_estimado: null as number | null,
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
          contraparte: form.contraparte.trim() || null,
          setor: form.setor,
          subcategoria: isNN ? form.subcategoria || null : null,
          estagio: form.estagio,
          responsavel_id:
            form.responsavel_id === "__nenhum__" || !form.responsavel_id
              ? null
              : form.responsavel_id,
          valor_estimado: isNN ? null : form.valor_estimado,
          data_inicio: isNN ? form.data_inicio || null : null,
          data_fechamento_prevista: isNN
            ? null
            : form.data_fechamento_prevista || null,
          descricao: config.showTipoIniciativa
            ? buildDescricaoComTipo(form.tipo_iniciativa, form.descricao)
            : form.descricao || null,
          tese: form.tese || null,
        },
      }),
    onSuccess: (res) => {
      toast.success("Projeto criado com sucesso!");
      qc.invalidateQueries({ queryKey: ["projetos", config.tipo] });
      setForm(empty());
      onOpenChange(false);
      onCreated(res.projeto.id);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSubmit =
    Boolean(form.nome.trim()) &&
    Boolean(form.setor) &&
    Boolean(form.estagio) &&
    (isNN ? Boolean(form.subcategoria && form.data_inicio) : true) &&
    (!config.showTipoIniciativa || Boolean(form.tipo_iniciativa));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* ========================================================= */}
        {/* HERO BANNER DO MODAL (PADRÃO BANNER EXECUTIVO DO DASHBOARD) */}
        {/* ========================================================= */}
        <div className="relative overflow-hidden bg-primary text-primary-foreground px-6 py-4.5 border-b border-primary/20 shrink-0">
          {/* Marca d'água circular oficial da Orizon */}
          <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.10] select-none">
            <img
              src="/brand/orizon-symbol.png"
              alt=""
              aria-hidden="true"
              className="h-44 w-44 rounded-full object-cover filter contrast-125"
            />
          </div>

          <div className="relative z-10 flex items-start gap-3.5 pr-12">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
              {isNN ? (
                <Sprout className="h-5 w-5" />
              ) : (
                <Handshake className="h-5 w-5" />
              )}
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                  Novo projeto de {config.titulo}
                </DialogTitle>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-semibold tracking-wide text-white/90 uppercase">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full animate-pulse",
                      isNN ? "bg-amber-300" : "bg-emerald-300",
                    )}
                  />
                  <span>{isNN ? "Novos Negócios" : "M&A Pipeline"}</span>
                </span>
              </div>
              <DialogDescription className="text-xs text-white/75 font-normal leading-relaxed truncate max-w-lg">
                Cadastre as informações preliminares para inclusão no funil de alocação de capital.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Corpo Scrollável com Seções Agrupadas em Cards */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Seção 1: Identificação do Projeto */}
          <div className="rounded-xl border border-border/70 bg-secondary/25 p-4 space-y-3.5">
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-primary/80" />
              Identificação & Enquadramento
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium text-foreground">
                  {config.nomeLabel} <span className="text-destructive">*</span>
                </Label>
                <Input
                  className="rounded-xl bg-background border-border/80 focus-visible:ring-primary/25"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder={
                    isNN ? "Ex.: Aterro Município X" : "Ex.: Projeto Atlas"
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Contraparte (opcional)</Label>
                <Input
                  className="rounded-xl bg-background border-border/80 focus-visible:ring-primary/25"
                  value={form.contraparte}
                  placeholder="Ex.: Grupo Vendedor"
                  onChange={(e) =>
                    setForm({ ...form, contraparte: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Setor <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.setor}
                  onValueChange={(v) => setForm({ ...form, setor: v })}
                >
                  <SelectTrigger className="rounded-xl bg-background border-border/80 focus:ring-primary/25">
                    <SelectValue placeholder="Selecionar setor" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {config.setores.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isNN && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium text-foreground">
                    Subcategoria <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.subcategoria}
                    onValueChange={(v) => setForm({ ...form, subcategoria: v })}
                  >
                    <SelectTrigger className="rounded-xl bg-background border-border/80 focus:ring-primary/25">
                      <SelectValue placeholder="Selecionar subcategoria" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {SUBCATEGORIAS.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Seção 2: Governança, Prazos e Valores */}
          <div className="rounded-xl border border-border/70 bg-secondary/25 p-4 space-y-3.5">
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              Governança & Parâmetros
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Estágio inicial <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.estagio}
                  onValueChange={(v) => setForm({ ...form, estagio: v })}
                >
                  <SelectTrigger className="rounded-xl bg-background border-border/80 focus:ring-primary/25">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {config.estagios.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Responsável (opcional)</Label>
                <Select
                  value={form.responsavel_id}
                  onValueChange={(v) =>
                    setForm({ ...form, responsavel_id: v })
                  }
                >
                  <SelectTrigger className="rounded-xl bg-background border-border/80 focus:ring-primary/25">
                    <SelectValue placeholder="Selecionar responsável" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="__nenhum__">Sem responsável</SelectItem>
                    {profiles.filter(isResponsavelElegivel).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {config.showTipoIniciativa && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Tipo de iniciativa <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={form.tipo_iniciativa}
                    onValueChange={(v) =>
                      setForm({ ...form, tipo_iniciativa: v })
                    }
                  >
                    <SelectTrigger className="rounded-xl bg-background border-border/80 focus:ring-primary/25">
                      <SelectValue placeholder="Selecionar tipo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {TIPO_INICIATIVA.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!isNN && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    {config.valorInputLabel} (opcional)
                  </Label>
                  <FormattedNumberInput
                    prefix="R$"
                    className="rounded-xl bg-background border-border/80 focus-visible:ring-primary/25"
                    value={form.valor_estimado}
                    placeholder="0"
                    onChangeValue={(val) =>
                      setForm({ ...form, valor_estimado: val })
                    }
                  />
                </div>
              )}

              {isNN ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Data de Inclusão <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    className="rounded-xl bg-background border-border/80 focus-visible:ring-primary/25"
                    value={form.data_inicio}
                    onChange={(e) =>
                      setForm({ ...form, data_inicio: e.target.value })
                    }
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    {config.tipo === "ma"
                      ? "Fechamento previsto (opcional)"
                      : "Previsão de implementação (opcional)"}
                  </Label>
                  <Input
                    type="date"
                    className="rounded-xl bg-background border-border/80 focus-visible:ring-primary/25"
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
            </div>
          </div>

          {/* Seção 3: Descrição e Tese */}
          <div className="rounded-xl border border-border/70 bg-secondary/25 p-4 space-y-3.5">
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
              Contexto Estratégico
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Descrição / Resumo do Deal</Label>
                <Textarea
                  className="rounded-xl bg-background border-border/80 focus-visible:ring-primary/25 text-xs resize-none"
                  value={form.descricao}
                  onChange={(e) =>
                    setForm({ ...form, descricao: e.target.value })
                  }
                  rows={2}
                  placeholder="Breve resumo sobre a oportunidade, sinergia ou localização..."
                />
              </div>

              {config.showTeseNoForm && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">Tese estratégica (opcional)</Label>
                  <Textarea
                    className="rounded-xl bg-background border-border/80 focus-visible:ring-primary/25 text-xs resize-none"
                    value={form.tese}
                    onChange={(e) => setForm({ ...form, tese: e.target.value })}
                    rows={2}
                    placeholder="Racional de investimento, valuation preliminar ou diferenciais competitivos..."
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Fixo com Botões Encorpados */}
        <div className="p-4 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-border/80 hover:bg-secondary/60 cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="rounded-xl font-medium shadow-xs cursor-pointer gap-2"
            disabled={!canSubmit || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Criar projeto
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
