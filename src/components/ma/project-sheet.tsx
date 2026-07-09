import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MoreHorizontal,
  Upload,
  Download,
  Trash2,
  Send,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { avatarBgStyle, formatAbsolute } from "@/lib/format";

import {
  getProjetoDetail,
  updateProjeto,
  deleteProjeto,
  addComentario,
  uploadDocumento,
  getDocumentoUrl,
  deleteDocumento,
  type Profile,
} from "@/lib/projetos.functions";
import {
  formatBRLFull,
  formatRelative,
  initials,
  MA_ESTAGIO_LABEL,
  STATUS_LABEL,
  TIPO_DOCUMENTO,
  TIPO_DOCUMENTO_NN,
} from "@/lib/ma-utils";
import {
  type ProjetoConfig,
} from "@/lib/projetos-config";
import { SUBCATEGORIAS } from "@/lib/projetos-types";
import { TarefasTab } from "@/components/tarefas/tarefas-tab";
import { listTarefasByProjeto } from "@/lib/tarefas.functions";
import { useAuth } from "@/hooks/use-auth";

type Props = {
  config: ProjetoConfig;
  projectId: string | null;
  initialTab?: string | null;
  profiles: Profile[];
  onClose: () => void;
};

export function ProjectSheet({ config, projectId, initialTab, profiles, onClose }: Props) {
  const open = projectId !== null;
  const fetchDetail = useServerFn(getProjetoDetail);
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ["projeto", projectId],
    queryFn: () => fetchDetail({ data: { id: projectId! } }),
    enabled: open,
  });

  const updateFn = useServerFn(updateProjeto);
  const updateMut = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      updateFn({ data: { id: projectId!, patch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projeto", projectId] });
      qc.invalidateQueries({ queryKey: [config.queryKey] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const save = (patch: Record<string, unknown>) => updateMut.mutate(patch);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col p-0 gap-0"
      >
        {detail.isLoading || !detail.data ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <SheetBody
            config={config}
            data={detail.data}
            initialTab={initialTab}
            profiles={profiles}
            save={save}
            onDeleted={() => {
              onClose();
              qc.invalidateQueries({ queryKey: [config.queryKey] });
            }}
          />

        )}
      </SheetContent>
    </Sheet>
  );
}

type DetailData = Awaited<ReturnType<typeof getProjetoDetail>>;

function SheetBody({
  config,
  data,
  initialTab,
  profiles,
  save,
  onDeleted,
}: {
  config: ProjetoConfig;
  data: DetailData;
  initialTab?: string | null;
  profiles: Profile[];
  save: (p: Record<string, unknown>) => void;
  onDeleted: () => void;
}) {
  const { projeto, comentarios, documentos, atividades } = data;
  const deleteFn = useServerFn(deleteProjeto);
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <InlineText
              value={projeto.nome}
              className="text-xl font-bold"
              onSave={(v) => save({ nome: v })}
            />
            <InlineText
              value={projeto.contraparte ?? ""}
              placeholder="Contraparte"
              className="text-sm text-muted-foreground"
              onSave={(v) => save({ contraparte: v })}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({ to: "/projetos/$id", params: { id: projeto.id } })
            }
          >
            Abrir dossiê
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => save({ status: "arquivado" })}
              >
                Arquivar
              </DropdownMenuItem>
              <ConfirmDialog
                title="Excluir este projeto?"
                description="Essa ação não pode ser desfeita. Todos os comentários, documentos e atividades vinculados também serão removidos."
                confirmLabel="Excluir"
                destructive
                onConfirm={async () => {
                  try {
                    await deleteFn({ data: { id: projeto.id } });
                    toast.success("Projeto excluído");
                    onDeleted();
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
                trigger={
                  <DropdownMenuItem
                    onSelect={(e) => e.preventDefault()}
                    className="text-destructive focus:text-destructive"
                  >
                    Excluir
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="uppercase">
            {projeto.tipo === "ma" ? "M&A" : "Novos Negócios"}
          </Badge>
          <Select
            value={projeto.estagio}
            onValueChange={(v) => save({ estagio: v })}
          >
            <SelectTrigger className="h-7 w-auto text-xs bg-primary/10 border-primary/20 text-primary">
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
          <Select
            value={projeto.status}
            onValueChange={(v) => save({ status: v })}
          >
            <SelectTrigger className="h-7 w-auto text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DebouncedInlineText
          value={projeto.status_detalhado ?? ""}
          placeholder="Status detalhado (ex.: NBO em revisão jurídica)"
          className="text-sm text-muted-foreground"
          onSave={(v) => save({ status_detalhado: v || null })}
        />
      </SheetHeader>

      <Tabs defaultValue={initialTab === "tarefas" ? "tarefas" : "overview"} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-6 mt-3 justify-start overflow-x-auto h-auto flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
          <TabsTrigger value="tese">Tese</TabsTrigger>
          <TabsTrigger value="fin">Financeiro</TabsTrigger>
          <TabsTrigger value="crono">Cronograma</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          {config.showComentarios && (
            <TabsTrigger value="coms">Comentários</TabsTrigger>
          )}
          <TabsTrigger value="ativ">Atividade</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4">
            <TabsContent value="overview" className="mt-0 space-y-4">
              <Field label="Setor">
                <Select
                  value={projeto.setor ?? ""}
                  onValueChange={(v) => save({ setor: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {config.setores.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {projeto.tipo === "novos_negocios" && (
                <Field label="Subcategoria">
                  <Select
                    value={projeto.subcategoria ?? ""}
                    onValueChange={(v) => save({ subcategoria: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar subcategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBCATEGORIAS.map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Descrição">
                <InlineTextarea
                  value={projeto.descricao ?? ""}
                  onSave={(v) => save({ descricao: v })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Responsável">
                  <ProfileSelect
                    value={projeto.responsavel_id}
                    profiles={profiles}
                    onChange={(v) => save({ responsavel_id: v })}
                  />
                </Field>
                <Field label="Líder">
                  <ProfileSelect
                    value={projeto.lider_id}
                    profiles={profiles}
                    onChange={(v) => save({ lider_id: v })}
                  />
                </Field>
                <Field label="Data início">
                  <Input
                    type="date"
                    defaultValue={projeto.data_inicio ?? ""}
                    onBlur={(e) =>
                      e.target.value !== (projeto.data_inicio ?? "") &&
                      save({ data_inicio: e.target.value || null })
                    }
                  />
                </Field>
                <Field label="Fechamento previsto">
                  <Input
                    type="date"
                    defaultValue={projeto.data_fechamento_prevista ?? ""}
                    onBlur={(e) =>
                      e.target.value !==
                        (projeto.data_fechamento_prevista ?? "") &&
                      save({
                        data_fechamento_prevista: e.target.value || null,
                      })
                    }
                  />
                </Field>
                <Field label="Fechamento real">
                  <Input
                    type="date"
                    defaultValue={projeto.data_fechamento_real ?? ""}
                    onBlur={(e) =>
                      e.target.value !==
                        (projeto.data_fechamento_real ?? "") &&
                      save({ data_fechamento_real: e.target.value || null })
                    }
                  />
                </Field>
              </div>
              <Field label="Próximos Passos">
                <ProximosPassosReadOnly projetoId={projeto.id} />
              </Field>
            </TabsContent>

            <TabsContent value="tarefas" className="mt-0">
              <TarefasTab
                projetoId={projeto.id}
                projetoNome={projeto.nome}
                profiles={profiles}
                currentUserId={user?.id ?? null}
              />
            </TabsContent>



            <TabsContent value="tese" className="mt-0 space-y-4">
              <Field label="Tese estratégica">
                <InlineTextarea
                  value={projeto.tese ?? ""}
                  onSave={(v) => save({ tese: v })}
                  rows={6}
                />
              </Field>
              <Field label="Riscos identificados">
                <InlineTextarea
                  value={projeto.riscos ?? ""}
                  onSave={(v) => save({ riscos: v })}
                  rows={4}
                />
              </Field>
              {config.tipo === "novos_negocios" ? (
                <Field label="Notas">
                  <InlineTextarea
                    value={projeto.notas_estrategicas ?? ""}
                    onSave={(v) => save({ notas_estrategicas: v })}
                    rows={6}
                  />
                </Field>
              ) : (
                <>
                  <Field label="Próximos passos">
                    <InlineTextarea
                      value={projeto.proximos_passos ?? ""}
                      onSave={(v) => save({ proximos_passos: v })}
                      rows={4}
                    />
                  </Field>
                  <Field label="Notas estratégicas">
                    <InlineTextarea
                      value={projeto.notas_estrategicas ?? ""}
                      onSave={(v) => save({ notas_estrategicas: v })}
                      rows={6}
                    />
                  </Field>
                </>
              )}
            </TabsContent>

            <TabsContent value="fin" className="mt-0 space-y-4">
              <FinTab config={config} projeto={projeto} save={save} />
            </TabsContent>

            <TabsContent value="crono" className="mt-0">
              <Timeline
                config={config}
                currentStage={projeto.estagio}
                atividades={atividades}
              />
            </TabsContent>

            <TabsContent value="docs" className="mt-0">
              <DocsTab
                projetoId={projeto.id}
                documentos={documentos}
                tipo={config.tipo}
              />
            </TabsContent>

            {config.showComentarios && (
              <TabsContent value="coms" className="mt-0">
                <CommentsTab
                  projetoId={projeto.id}
                  comentarios={comentarios}
                />
              </TabsContent>
            )}

            <TabsContent value="ativ" className="mt-0">
              <ActivityTab atividades={atividades} />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function InlineText({
  value,
  onSave,
  className,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      placeholder={placeholder}
      onBlur={() => v !== value && onSave(v)}
      className={`w-full bg-transparent outline-none focus:bg-accent/40 rounded px-1 -mx-1 ${className ?? ""}`}
    />
  );
}

function DebouncedInlineText({
  value,
  onSave,
  className,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [v, setV] = useState(value);
  const lastSaved = useRef(value);
  useEffect(() => {
    setV(value);
    lastSaved.current = value;
  }, [value]);
  useEffect(() => {
    if (v === lastSaved.current) return;
    const t = setTimeout(() => {
      lastSaved.current = v;
      onSave(v);
    }, 600);
    return () => clearTimeout(t);
  }, [v, onSave]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-transparent outline-none focus:bg-accent/40 rounded px-1 -mx-1 ${className ?? ""}`}
    />
  );
}

function InlineTextarea({
  value,
  onSave,
  rows = 3,
}: {
  value: string;
  onSave: (v: string) => void;
  rows?: number;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <Textarea
      value={v}
      rows={rows}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
    />
  );
}

function ProfileSelect({
  value,
  profiles,
  onChange,
}: {
  value: string | null;
  profiles: Profile[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
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
  );
}

function NumberField({
  label,
  value,
  onSave,
  hint,
}: {
  label: string;
  value: number | null;
  onSave: (v: number | null) => void;
  hint?: string;
}) {
  const [v, setV] = useState<string>(value?.toString() ?? "");
  useEffect(() => setV(value?.toString() ?? ""), [value]);
  return (
    <div className="space-y-1.5">
      <Label
        className="text-xs uppercase tracking-wide text-muted-foreground"
        title={hint}
      >
        {label}
        {hint && <span className="ml-1 text-muted-foreground/60">ⓘ</span>}
      </Label>
      <Input
        type="number"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = v === "" ? null : Number(v);
          if (n !== value) onSave(n);
        }}
      />
    </div>
  );
}

function OperationalMetrics({
  projeto,
  save,
}: {
  projeto: DetailData["projeto"];
  save: (p: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Métricas operacionais
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Volume (ton/dia)"
          value={projeto.volume_ton_dia}
          onSave={(v) => save({ volume_ton_dia: v })}
        />
        <NumberField
          label="% Orizon no Deal"
          value={projeto.percentual_orizon}
          onSave={(v) => save({ percentual_orizon: v })}
        />
        <NumberField
          label="Valor da Transação (R$ MM)"
          value={projeto.valor_transacao_mm}
          onSave={(v) => save({ valor_transacao_mm: v })}
        />
      </div>
    </div>
  );
}

function FinTab({
  config,
  projeto,
  save,
}: {
  config: ProjetoConfig;
  projeto: DetailData["projeto"];
  save: (p: Record<string, unknown>) => void;
}) {
  if (config.finVariant === "nn") {
    return (
      <div className="space-y-5">
        <OperationalMetrics projeto={projeto} save={save} />
        <Separator />
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Valuation
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Investimento estimado (R$)"
              value={projeto.valor_estimado}
              onSave={(v) => save({ valor_estimado: v })}
            />
            <NumberField
              label="Capex estimado (R$)"
              value={projeto.capex_estimado}
              onSave={(v) => save({ capex_estimado: v })}
            />
            <NumberField
              label="Receita projetada ano 3 (R$)"
              value={projeto.receita_projetada_ano3}
              onSave={(v) => save({ receita_projetada_ano3: v })}
            />
            <NumberField
              label="TIR estimada (%)"
              value={projeto.tir_estimada}
              onSave={(v) => save({ tir_estimada: v })}
            />
            <NumberField
              label="Payback (anos)"
              value={projeto.payback_anos}
              onSave={(v) => save({ payback_anos: v })}
            />
            <NumberField
              label="TAM — Mercado endereçável (R$)"
              value={projeto.tam}
              onSave={(v) => save({ tam: v })}
            />
          </div>
        </div>
        {projeto.tam && projeto.receita_projetada_ano3 ? (
          <>
            <Separator />
            <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Share de TAM (ano 3)
                </span>
                <span className="font-semibold">
                  {(
                    (Number(projeto.receita_projetada_ano3) /
                      Number(projeto.tam)) *
                    100
                  ).toFixed(2)}
                  %
                </span>
              </div>
            </div>
          </>
        ) : null}
      </div>
    );
  }
  const ev =
    (projeto.ebitda_alvo ?? 0) * (projeto.multiplo_ev_ebitda ?? 0);
  const evSinergias = ev + (projeto.sinergias_estimadas ?? 0);
  return (
    <div className="space-y-5">
      <OperationalMetrics projeto={projeto} save={save} />
      <Separator />
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Valuation
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Valor estimado (R$)"
            value={projeto.valor_estimado}
            onSave={(v) => save({ valor_estimado: v })}
          />
          <NumberField
            label="EBITDA 2025 (R$ MM)"
            hint="EBITDA realizado de 2025 (histórico)"
            value={projeto.ebitda_2025}
            onSave={(v) => save({ ebitda_2025: v })}
          />
          <NumberField
            label="EBITDA Alvo (R$)"
            value={projeto.ebitda_alvo}
            onSave={(v) => save({ ebitda_alvo: v })}
          />
          <NumberField
            label="Múltiplo EV/EBITDA"
            value={projeto.multiplo_ev_ebitda}
            onSave={(v) => save({ multiplo_ev_ebitda: v })}
          />
          <NumberField
            label="Sinergias estimadas (R$)"
            value={projeto.sinergias_estimadas}
            onSave={(v) => save({ sinergias_estimadas: v })}
          />
        </div>
      </div>
      <Separator />
      <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">EV implícito</span>
          <span className="font-semibold">{formatBRLFull(ev)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">EV com sinergias</span>
          <span className="font-semibold">{formatBRLFull(evSinergias)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Múltiplo implícito vs EBITDA 2025</span>
          <span className="font-semibold">
            {projeto.valor_transacao_mm != null && projeto.ebitda_2025 != null && Number(projeto.ebitda_2025) !== 0
              ? `${(Number(projeto.valor_transacao_mm) / Number(projeto.ebitda_2025)).toFixed(1).replace(".", ",")}x`
              : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function Timeline({
  config,
  currentStage,
  atividades,
}: {
  config: ProjetoConfig;
  currentStage: string;
  atividades: DetailData["atividades"];
}) {
  const currentIdx = config.estagios.findIndex((s) => s.key === currentStage);
  const stageDates = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of [...atividades].reverse()) {
      if (a.acao === "mudou_estagio") {
        const para = (a.detalhes as { para?: string }).para;
        if (para && !map[para]) map[para] = a.criado_em;
      }
      if (a.acao === "criou_projeto") {
        const est = (a.detalhes as { estagio?: string }).estagio;
        if (est && !map[est]) map[est] = a.criado_em;
      }
    }
    return map;
  }, [atividades]);

  return (
    <ol className="space-y-3">
      {config.estagios.map((s, idx) => {
        const past = idx < currentIdx;
        const current = idx === currentIdx;
        const date = stageDates[s.key];
        return (
          <li key={s.key} className="flex items-start gap-3">
            <div className="mt-0.5">
              {past ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : current ? (
                <div className="h-5 w-5 rounded-full bg-primary ring-4 ring-primary/20" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1">
              <div
                className={`text-sm ${current ? "font-semibold text-primary" : past ? "text-foreground" : "text-muted-foreground"}`}
              >
                {s.label}
              </div>
              {date && (
                <div className="text-xs text-muted-foreground">
                  Entrou em{" "}
                  {new Date(date).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DocsTab({
  projetoId,
  documentos,
  tipo: projetoTipo,
}: {
  projetoId: string;
  documentos: DetailData["documentos"];
  tipo: "ma" | "novos_negocios";
}) {
  const qc = useQueryClient();
  const uploadFn = useServerFn(uploadDocumento);
  const urlFn = useServerFn(getDocumentoUrl);
  const delFn = useServerFn(deleteDocumento);
  const tipoOptions =
    projetoTipo === "novos_negocios" ? TIPO_DOCUMENTO_NN : TIPO_DOCUMENTO;
  const [tipo, setTipo] = useState(tipoOptions[0] ?? "Outro");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(
        String.fromCharCode(...new Uint8Array(buf)),
      );
      await uploadFn({
        data: {
          projeto_id: projetoId,
          nome: file.name,
          tipo,
          mime: file.type,
          size_bytes: file.size,
          content_base64: b64,
        },
      });
      toast.success("Documento enviado");
      qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPO_DOCUMENTO.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <Button
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          size="sm"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          Upload
        </Button>
      </div>
      <div className="divide-y rounded-md border">
        {documentos.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum documento ainda.
          </div>
        )}
        {documentos.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-3 p-3 text-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{d.nome}</div>
              <div className="text-xs text-muted-foreground">
                {d.tipo} · {formatBytes(d.tamanho_bytes ?? 0)} ·{" "}
                {d.enviado_por_nome} ·{" "}
                {new Date(d.criado_em).toLocaleDateString("pt-BR")}
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={async () => {
                try {
                  const { url } = await urlFn({ data: { id: d.id } });
                  window.open(url, "_blank");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
            <ConfirmDialog
              title={`Excluir "${d.nome}"?`}
              description="O arquivo será removido permanentemente."
              confirmLabel="Excluir"
              destructive
              onConfirm={async () => {
                await delFn({ data: { id: d.id } });
                qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
                toast.success("Documento removido");
              }}
              trigger={
                <Button size="icon" variant="ghost">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function CommentsTab({
  projetoId,
  comentarios,
}: {
  projetoId: string;
  comentarios: DetailData["comentarios"];
}) {
  const qc = useQueryClient();
  const addFn = useServerFn(addComentario);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {comentarios.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum comentário ainda.
          </p>
        )}
        {comentarios.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs" style={avatarBgStyle(c.autor_nome)}>
                {initials(c.autor_nome)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{c.autor_nome}</span>
                <span className="text-xs text-muted-foreground" title={formatAbsolute(c.criado_em)}>
                  {formatRelative(c.criado_em)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.conteudo}</p>
            </div>
          </div>
        ))}
      </div>
      <Separator />
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva um comentário..."
          rows={2}
        />
        <Button
          disabled={!text.trim() || sending}
          onClick={async () => {
            setSending(true);
            try {
              await addFn({
                data: { projeto_id: projetoId, conteudo: text.trim() },
              });
              setText("");
              qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setSending(false);
            }
          }}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ActivityTab({
  atividades,
}: {
  atividades: DetailData["atividades"];
}) {
  if (atividades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem atividade registrada.
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {atividades.map((a) => (
        <li key={a.id} className="flex gap-3 text-sm">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs" style={avatarBgStyle(a.autor_nome)}>
              {initials(a.autor_nome)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div>
              <span className="font-medium">{a.autor_nome}</span>{" "}
              <span className="text-muted-foreground">
                {describeAcao(a.acao, a.detalhes)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground" title={formatAbsolute(a.criado_em)}>
              há {formatRelative(a.criado_em)}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function describeAcao(
  acao: string,
  detalhes: Record<string, unknown>,
): string {
  switch (acao) {
    case "criou_projeto":
      return "criou este projeto";
    case "mudou_estagio": {
      const de = String(detalhes.de ?? "");
      const para = String(detalhes.para ?? "");
      return `moveu de ${MA_ESTAGIO_LABEL[de] ?? de} para ${MA_ESTAGIO_LABEL[para] ?? para}`;
    }
    case "editou": {
      const campos = Array.isArray(detalhes.campos)
        ? (detalhes.campos as string[]).join(", ")
        : "";
      return `editou ${campos}`;
    }
    case "comentou":
      return "comentou";
    case "subiu_documento":
      return `enviou documento "${detalhes.nome ?? ""}"`;
    case "removeu_documento":
      return `removeu documento "${detalhes.nome ?? ""}"`;
    default:
      return acao;
  }
}
