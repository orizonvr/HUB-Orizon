// TEMPORÁRIO — página de importação one-shot das tarefas do Planner.
// Apagar este arquivo + src/lib/import-planner.functions.ts após concluir.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  diagnosticarImportacao,
  importarTarefasPlanner,
} from "@/lib/import-planner.functions";

export const Route = createFileRoute("/_authenticated/admin-import")({
  head: () => ({ meta: [{ title: "Admin Import — temporário" }] }),
  component: AdminImportPage,
});

function AdminImportPage() {
  const diag = useServerFn(diagnosticarImportacao);
  const imp = useServerFn(importarTarefasPlanner);
  const [out, setOut] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<string>(
    JSON.stringify(
      {
        confirmar: "IMPORTAR_AGORA",
        mapeamento: {
          "exemplo bucket normalizado": "uuid-do-projeto-existente",
        },
        novos_projetos: [
          {
            bucket: "Holymiles",
            nome: "Holymiles",
            tipo: "ma",
            status: "arquivado",
          },
        ],
      },
      null,
      2,
    ),
  );

  async function runDiag() {
    setLoading(true);
    setOut("Rodando diagnóstico…");
    try {
      const res = await diag();
      setOut(JSON.stringify(res, null, 2));
    } catch (e) {
      setOut("ERRO: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runImport() {
    setLoading(true);
    setOut("Importando…");
    try {
      const parsed = JSON.parse(payload);
      const res = await imp({ data: parsed });
      setOut(JSON.stringify(res, null, 2));
    } catch (e) {
      setOut("ERRO: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Importação Planner (temporário)</h1>
      <div className="flex gap-2">
        <Button onClick={runDiag} disabled={loading}>
          1. Rodar diagnóstico
        </Button>
        <Button onClick={runImport} disabled={loading} variant="destructive">
          2. Executar importação
        </Button>
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-1">
          Payload da importação (cole o JSON aprovado):
        </p>
        <Textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          className="font-mono text-xs h-64"
        />
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-1">Resultado:</p>
        <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-[600px] whitespace-pre-wrap">
          {out}
        </pre>
      </div>
    </div>
  );
}
