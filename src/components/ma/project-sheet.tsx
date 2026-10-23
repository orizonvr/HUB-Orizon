import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NestedModalContext } from "@/components/ma/nested-modal-context";

import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
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
  Briefcase,
  Sparkles,
  ExternalLink,
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
  STATUS_POR_TIPO,
  TIPO_DOCUMENTO,
  TIPO_DOCUMENTO_NN,
} from "@/lib/ma-utils";
import {
  type ProjetoConfig,
  isResponsavelElegivel,
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

  const [nestedCount, setNestedCount] = useState(0);
  const registerNested = useCallback(
    (delta: number) => setNestedCount((c) => Math.max(0, c + delta)),
    [],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      modal={nestedCount === 0}
    >
      <DialogContent className="w-full sm:max-w-4xl md:max-w-5xl h-[92vh] max-h-[92vh] p-0 flex flex-col gap-0 overflow-hidden rounded-2xl">
        <DialogTitle className="sr-only">
          {detail.data?.projeto.nome ?? "Detalhes do Projeto"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Informações completas, documentos, tese estratégica e tarefas do projeto
        </DialogDescription>
        {detail.isLoading || !detail.data ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : (
          <NestedModalContext.Provider value={registerNested}>
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
          </NestedModalContext.Provider>
        )}
      </DialogContent>
    </Dialog>
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
      {/* Top Hero Banner Header (Padrão Banner Executivo Dashboard) */}
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

        <div className="relative z-10 space-y-3 pr-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
                {projeto.tipo === "ma" ? (
                  <Briefcase className="h-5 w-5" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <InlineText
                  value={projeto.nome}
                  className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight"
                  onSave={(v) => save({ nome: v })}
                />
                <InlineText
                  value={projeto.contraparte ?? ""}
                  placeholder="Contraparte (clique para editar)"
                  className="text-xs text-white/75 font-normal mt-0.5"
                  onSave={(v) => save({ contraparte: v })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigate({ to: "/projetos/$id", params: { id: projeto.id } })
                }
                className="h-8.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white hover:text-white border border-white/20 px-3 gap-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5 text-white" />
                <span className="hidden sm:inline">Abrir dossiê</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8.5 w-8.5 text-white hover:bg-white/15 rounded-xl border border-white/20"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem
                    onClick={() => save({ status: "arquivado" })}
                  >
                    Arquivar deal
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
                        Excluir projeto
                      </DropdownMenuItem>
                    }
                  />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-white/10 text-white border-white/20 uppercase shadow-2xs"
            >
              {projeto.tipo === "ma" ? "M&A" : "Novos Negócios"}
            </Badge>

            <Select
              value={projeto.estagio}
              onValueChange={(v) => save({ estagio: v })}
            >
              <SelectTrigger className="h-7 w-auto text-xs font-semibold bg-white/15 border-white/25 text-white hover:bg-white/20 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.estagios.map((s) => (
                  <SelectItem key={s.key} value={s.key} className="text-xs">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={projeto.status}
              onValueChange={(v) => save({ status: v })}
            >
              <SelectTrigger className="h-7 w-auto text-xs font-medium bg-white/15 border-white/25 text-white hover:bg-white/20 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_POR_TIPO[projeto.tipo].map((k) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {STATUS_LABEL[k] ?? k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1 min-w-48">
              <DebouncedInlineText
                value={projeto.status_detalhado ?? ""}
                placeholder="Status detalhado (ex.: NBO em revisão jurídica)"
                className="text-xs text-white/80 font-normal italic placeholder:text-white/50"
                onSave={(v) => save({ status_detalhado: v || null })}
              />
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue={initialTab === "tarefas" ? "tarefas" : "overview"} className="flex-1 flex flex-col min-h-0 bg-background">
        <div className="px-6 py-2.5 border-b border-border/70 bg-muted/20 shrink-0 overflow-hidden">
          <TabsList className="h-9 bg-muted/50 p-1 border border-border/80 rounded-xl justify-start inline-flex w-auto max-w-full overflow-x-auto overflow-y-hidden scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="overview" className="text-xs font-medium px-3 h-7 rounded-lg shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">Visão geral</TabsTrigger>
            <TabsTrigger value="tarefas" className="text-xs font-medium px-3 h-7 rounded-lg shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">Tarefas</TabsTrigger>
            <TabsTrigger value="tese" className="text-xs font-medium px-3 h-7 rounded-lg shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">Tese</TabsTrigger>
            <TabsTrigger value="fin" className="text-xs font-medium px-3 h-7 rounded-lg shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">Financeiro</TabsTrigger>
            <TabsTrigger value="crono" className="text-xs font-medium px-3 h-7 rounded-lg shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">Cronograma</TabsTrigger>
            <TabsTrigger value="docs" className="text-xs font-medium px-3 h-7 rounded-lg shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">Documentos</TabsTrigger>
            {config.showComentarios && (
              <TabsTrigger value="coms" className="text-xs font-medium px-3 h-7 rounded-lg shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">Comentários</TabsTrigger>
            )}
            <TabsTrigger value="ativ" className="text-xs font-medium px-3 h-7 rounded-lg shrink-0 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">Atividade</TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5">
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
                <Field label="Fechamento Realizado">
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
        {profiles
          .filter((p) => p.id === value || isResponsavelElegivel(p))
          .map((p) => (
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
  prefix,
  suffix,
  allowDecimals = true,
  maxDecimals = 2,
}: {
  label: string;
  value: number | null;
  onSave: (v: number | null) => void;
  hint?: string;
  prefix?: string;
  suffix?: string;
  allowDecimals?: boolean;
  maxDecimals?: number;
}) {
  const [val, setVal] = useState<number | null>(value);
  useEffect(() => setVal(value), [value]);

  return (
    <div className="space-y-1.5">
      <Label
        className="text-xs uppercase tracking-wide text-muted-foreground"
        title={hint}
      >
        {label}
        {hint && <span className="ml-1 text-muted-foreground/60">ⓘ</span>}
      </Label>
      <FormattedNumberInput
        value={val}
        prefix={prefix}
        suffix={suffix}
        allowDecimals={allowDecimals}
        maxDecimals={maxDecimals}
        onChangeValue={setVal}
        onBlur={() => {
          if (val !== value) onSave(val);
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
          allowDecimals={false}
          suffix="ton/dia"
          onSave={(v) => save({ volume_ton_dia: v })}
        />
        <NumberField
          label="% Orizon no Deal"
          value={projeto.percentual_orizon}
          suffix="%"
          onSave={(v) => save({ percentual_orizon: v })}
        />
        <NumberField
          label="Valor da Transação (R$ MM)"
          value={projeto.valor_transacao_mm}
          prefix="R$"
          suffix="MM"
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
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Métricas Operacionais
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Qualidade das Informações">
              <Select
                value={projeto.qualidade_informacoes ?? ""}
                onValueChange={(v) => save({ qualidade_informacoes: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <NumberField
              label="Volume Total (unid.)"
              value={projeto.volume_ano3}
              allowDecimals={false}
              onSave={(v) => save({ volume_ano3: v })}
            />
            <NumberField
              label="Receita Líquida Total (R$)"
              value={projeto.receita_projetada_ano3}
              prefix="R$"
              onSave={(v) => save({ receita_projetada_ano3: v })}
            />
            <NumberField
              label="EBITDA Total (R$)"
              value={projeto.ebitda_ano3}
              prefix="R$"
              onSave={(v) => save({ ebitda_ano3: v })}
            />
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Valuation
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="CAPEX Total Projeto (R$)"
              value={projeto.capex_total_nominal}
              prefix="R$"
              onSave={(v) => save({ capex_total_nominal: v })}
            />
            <NumberField
              label="TIR Real Projeto (IPCA + %)"
              value={projeto.tir_real_projeto}
              suffix="%"
              onSave={(v) => save({ tir_real_projeto: v })}
            />
            <NumberField
              label="TIR Real Acionista (IPCA + %)"
              value={projeto.tir_real_acionista}
              suffix="%"
              onSave={(v) => save({ tir_real_acionista: v })}
            />
            <NumberField
              label="Valor Presente — Taxa (IPCA + %)"
              value={projeto.vpl_taxa}
              suffix="%"
              onSave={(v) => save({ vpl_taxa: v })}
            />
            <NumberField
              label="Valor Presente — Valor (R$)"
              value={projeto.vpl_valor}
              prefix="R$"
              onSave={(v) => save({ vpl_valor: v })}
            />
            <NumberField
              label="Payback (Anos)"
              value={projeto.payback_anos}
              suffix="anos"
              onSave={(v) => save({ payback_anos: v })}
            />
            <NumberField
              label="Período Total do Projeto (anos)"
              value={projeto.periodo_total_anos}
              suffix="anos"
              allowDecimals={false}
              onSave={(v) => save({ periodo_total_anos: v })}
            />
          </div>
        </div>
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
            prefix="R$"
            onSave={(v) => save({ valor_estimado: v })}
          />
          <NumberField
            label="EBITDA 2025 (R$ MM)"
            hint="EBITDA realizado de 2025 (histórico)"
            value={projeto.ebitda_2025}
            prefix="R$"
            suffix="MM"
            onSave={(v) => save({ ebitda_2025: v })}
          />
          <NumberField
            label="EBITDA Alvo (R$)"
            value={projeto.ebitda_alvo}
            prefix="R$"
            onSave={(v) => save({ ebitda_alvo: v })}
          />
          <NumberField
            label="Múltiplo EV/EBITDA"
            value={projeto.multiplo_ev_ebitda}
            suffix="x"
            onSave={(v) => save({ multiplo_ev_ebitda: v })}
          />
          <NumberField
            label="Sinergias estimadas (R$)"
            value={projeto.sinergias_estimadas}
            prefix="R$"
            onSave={(v) => save({ sinergias_estimadas: v })}
          />
          <NumberField
            label="CAPEX estimado (R$)"
            value={projeto.capex_estimado}
            prefix="R$"
            onSave={(v) => save({ capex_estimado: v })}
          />
          <NumberField
            label="TIR estimada (%)"
            value={projeto.tir_estimada}
            suffix="%"
            onSave={(v) => save({ tir_estimada: v })}
          />
          <NumberField
            label="Payback estimado (anos)"
            value={projeto.payback_anos}
            suffix="anos"
            onSave={(v) => save({ payback_anos: v })}
          />
          <NumberField
            label="Receita Projetada (R$)"
            value={projeto.receita_projetada_ano3}
            prefix="R$"
            onSave={(v) => save({ receita_projetada_ano3: v })}
          />
          <NumberField
            label="TAM Mercado Endereçável (R$)"
            value={projeto.tam}
            prefix="R$"
            onSave={(v) => save({ tam: v })}
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
            {tipoOptions.map((t) => (
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

function ProximosPassosReadOnly({ projetoId }: { projetoId: string }) {
  const listFn = useServerFn(listTarefasByProjeto);
  const q = useQuery({
    queryKey: ["tarefas-projeto", projetoId],
    queryFn: () => listFn({ data: { projeto_id: projetoId } }),
  });
  const abertas = (q.data?.tarefas ?? []).filter(
    (t) => t.status !== "concluida" && t.status !== "cancelada",
  );
  if (q.isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }
  if (abertas.length === 0) {
    return <div className="text-sm text-muted-foreground">—</div>;
  }
  return (
    <ul className="space-y-1">
      {abertas.map((t) => (
        <li
          key={t.id}
          className="flex items-start justify-between gap-2 text-sm"
        >
          <span className="text-foreground">{t.titulo}</span>
          {t.prazo && t.prazo !== "2099-12-31" && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {new Date(t.prazo + "T12:00:00").toLocaleDateString("pt-BR")}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
