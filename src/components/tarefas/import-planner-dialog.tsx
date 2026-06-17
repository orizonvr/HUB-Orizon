import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  previewImportPlannerXlsx,
  commitImportPlannerXlsx,
} from "@/lib/import-planner-xlsx.functions";

type PreviewResult = Awaited<ReturnType<typeof previewImportPlannerXlsx>>;
type CommitResult = Awaited<ReturnType<typeof commitImportPlannerXlsx>>;

type Projeto = { id: string; nome: string; tipo: "ma" | "novos_negocios" };

type BucketChoice =
  | { kind: "existente"; projeto_id: string }
  | {
      kind: "novo";
      nome: string;
      tipo: "ma" | "novos_negocios";
      status: "ativo" | "pausado" | "concluido" | "arquivado" | "perdido";
    }
  | { kind: "pular" };

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function ImportPlannerDialog({
  open,
  onOpenChange,
  projetos,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projetos: Projeto[];
}) {
  const qc = useQueryClient();
  const previewFn = useServerFn(previewImportPlannerXlsx);
  const commitFn = useServerFn(commitImportPlannerXlsx);

  const [base64, setBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [choices, setChoices] = useState<Record<string, BucketChoice>>({});

  const reset = () => {
    setBase64(null);
    setFileName("");
    setPreview(null);
    setResult(null);
    setChoices({});
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    setBase64(btoa(bin));
  };

  const analyze = async () => {
    if (!base64) return;
    setAnalyzing(true);
    try {
      const r = await previewFn({ data: { arquivo_base64: base64 } });
      setPreview(r);
      // default choices: sem match → pular
      const initial: Record<string, BucketChoice> = {};
      for (const b of r.buckets_sem_match) {
        initial[norm(b.bucket)] = { kind: "pular" };
      }
      setChoices(initial);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  const setChoice = (bucketNorm: string, c: BucketChoice) =>
    setChoices((prev) => ({ ...prev, [bucketNorm]: c }));

  const doImport = async () => {
    if (!base64 || !preview) return;
    setImporting(true);
    try {
      // build mapeamento
      const mapeamento: Record<string, string> = {};
      for (const m of preview.buckets_match) {
        mapeamento[norm(m.bucket)] = m.projeto_id;
      }
      const novos_projetos: Array<{
        bucket: string;
        nome: string;
        tipo: "ma" | "novos_negocios";
        status: "ativo" | "pausado" | "concluido" | "arquivado" | "perdido";
      }> = [];
      for (const b of preview.buckets_sem_match) {
        const k = norm(b.bucket);
        const c = choices[k];
        if (!c || c.kind === "pular") {
          mapeamento[k] = "PULAR";
        } else if (c.kind === "existente") {
          mapeamento[k] = c.projeto_id;
        } else {
          mapeamento[k] = "NOVO";
          novos_projetos.push({
            bucket: b.bucket,
            nome: c.nome.trim() || b.bucket,
            tipo: c.tipo,
            status: c.status,
          });
        }
      }
      const r = await commitFn({
        data: {
          arquivo_base64: base64,
          mapeamento,
          novos_projetos,
          confirmar: "IMPORTAR_AGORA",
        },
      });
      setResult(r);
      if (r.ok) {
        toast.success(`Importação concluída: ${r.tarefas_inseridas} tarefas`);
        qc.invalidateQueries({ queryKey: ["tarefas"] });
        qc.invalidateQueries({ queryKey: ["tarefas-projeto"] });
        qc.invalidateQueries({ queryKey: ["minhas-tarefas"] });
        qc.invalidateQueries({ queryKey: ["resumo-tarefas-time"] });
        qc.invalidateQueries({ queryKey: ["alertas-tarefas"] });
        qc.invalidateQueries({ queryKey: ["projetos-lite"] });
      } else {
        toast.warning(r.razao ?? "Importação não concluída");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar tarefas do Planner (.xlsx)</DialogTitle>
          <DialogDescription>
            Importação ÚNICA das tarefas históricas. Só funciona se a tabela de
            tarefas estiver vazia.
          </DialogDescription>
        </DialogHeader>

        {/* RESULT */}
        {result && (
          <Card className="p-4 space-y-2">
            {result.ok ? (
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Importação concluída</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">
                  {result.razao ?? "Sem alterações"}
                </span>
              </div>
            )}
            {result.ok && (
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>Tarefas inseridas: {result.tarefas_inseridas}</li>
                <li>Projetos criados: {result.projetos_criados}</li>
                <li>Tarefas puladas: {result.puladas}</li>
                <li>Sem responsável: {result.sem_responsavel}</li>
                <li>
                  Status:{" "}
                  {Object.entries(result.breakdown_por_status)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(" · ")}
                </li>
              </ul>
            )}
          </Card>
        )}

        {/* PASSO 1: UPLOAD */}
        {!preview && !result && (
          <div className="space-y-3">
            <Input
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {fileName && (
              <p className="text-xs text-muted-foreground">
                Arquivo: {fileName}
              </p>
            )}
            <Button onClick={analyze} disabled={!base64 || analyzing}>
              {analyzing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Analisar arquivo
            </Button>
          </div>
        )}

        {/* PASSO 2: PREVIEW */}
        {preview && !result && (
          <div className="space-y-4">
            <Card className="p-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <strong>Total de linhas:</strong> {preview.total_linhas}
              </div>
              <div>
                <strong>Tarefas no banco hoje:</strong>{" "}
                <Badge
                  variant={preview.pode_prosseguir ? "outline" : "destructive"}
                >
                  {preview.tarefas_ja_no_banco}
                </Badge>
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">
                Status: {Object.entries(preview.por_status).map(([k, v]) => `${k}=${v}`).join(" · ")}
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">
                Prioridade: {Object.entries(preview.por_prioridade).map(([k, v]) => `${k}=${v}`).join(" · ")}
              </div>
            </Card>

            {!preview.pode_prosseguir && (
              <Card className="p-3 border-destructive">
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Tabela tarefas não está vazia. Importação bloqueada.
                </div>
              </Card>
            )}

            <div>
              <h4 className="text-sm font-semibold mb-1">
                Buckets com match ({preview.buckets_match.length})
              </h4>
              <Card className="p-3 max-h-40 overflow-y-auto text-xs space-y-1">
                {preview.buckets_match.length === 0 ? (
                  <span className="text-muted-foreground">Nenhum.</span>
                ) : (
                  preview.buckets_match.map((m) => (
                    <div key={m.bucket} className="flex justify-between">
                      <span>{m.bucket}</span>
                      <span className="text-muted-foreground">
                        → {m.projeto_nome}{" "}
                        <Badge variant="outline" className="text-[10px]">
                          {m.como}
                        </Badge>
                      </span>
                    </div>
                  ))
                )}
              </Card>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-1">
                Buckets sem match ({preview.buckets_sem_match.length})
              </h4>
              <div className="space-y-2">
                {preview.buckets_sem_match.map((b) => {
                  const k = norm(b.bucket);
                  const c = choices[k] ?? { kind: "pular" };
                  return (
                    <Card key={b.bucket} className="p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{b.bucket}</span>
                        <span className="text-muted-foreground">
                          {b.tarefas} tarefa(s)
                        </span>
                      </div>
                      <Select
                        value={
                          c.kind === "existente"
                            ? `exist:${c.projeto_id}`
                            : c.kind === "novo"
                              ? "novo"
                              : "pular"
                        }
                        onValueChange={(v) => {
                          if (v === "pular") setChoice(k, { kind: "pular" });
                          else if (v === "novo")
                            setChoice(k, {
                              kind: "novo",
                              nome: b.bucket,
                              tipo: "novos_negocios",
                              status: "ativo",
                            });
                          else if (v.startsWith("exist:"))
                            setChoice(k, {
                              kind: "existente",
                              projeto_id: v.slice(6),
                            });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pular">Pular tarefas</SelectItem>
                          <SelectItem value="novo">Criar novo projeto</SelectItem>
                          {projetos.map((p) => (
                            <SelectItem key={p.id} value={`exist:${p.id}`}>
                              Existente: {p.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {c.kind === "novo" && (
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            placeholder="Nome"
                            value={c.nome}
                            onChange={(e) =>
                              setChoice(k, { ...c, nome: e.target.value })
                            }
                            className="h-8 text-xs col-span-3"
                          />
                          <Select
                            value={c.tipo}
                            onValueChange={(v) =>
                              setChoice(k, {
                                ...c,
                                tipo: v as "ma" | "novos_negocios",
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ma">M&A</SelectItem>
                              <SelectItem value="novos_negocios">
                                Novos Negócios
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={c.status}
                            onValueChange={(v) =>
                              setChoice(k, {
                                ...c,
                                status: v as typeof c.status,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs col-span-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ativo">Ativo</SelectItem>
                              <SelectItem value="pausado">Pausado</SelectItem>
                              <SelectItem value="concluido">Concluído</SelectItem>
                              <SelectItem value="arquivado">Arquivado</SelectItem>
                              <SelectItem value="perdido">Perdido</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>

            {preview.nomes_sem_profile.length > 0 && (
              <Card className="p-3">
                <h4 className="text-sm font-semibold mb-1">
                  Pessoas sem profile ({preview.nomes_sem_profile.length})
                </h4>
                <p className="text-xs text-muted-foreground">
                  Vão para o campo "[Também: ...]" da descrição:{" "}
                  {preview.nomes_sem_profile.join(", ")}
                </p>
              </Card>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          ) : preview ? (
            <Button
              onClick={doImport}
              disabled={importing || !preview.pode_prosseguir}
            >
              {importing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Upload className="h-4 w-4 mr-1" />
              Importar agora
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
