import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Search, Download, ExternalLink } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAllDocumentos } from "@/lib/documentos.functions";
import { getDocumentoUrl } from "@/lib/projetos.functions";
import { formatBytes, formatAbsolute } from "@/lib/format";
import { TIPO_DOCUMENTO } from "@/lib/ma-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({ meta: [{ title: "Documentos — OrizonVR | Pipeline Alocação de Capital" }] }),
  component: DocumentosPage,
});

function DocumentosPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["all-documentos"],
    queryFn: () => listAllDocumentos(),
  });

  const navigate = useNavigate();
  const urlFn = useServerFn(getDocumentoUrl);

  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("all");
  const [projeto, setProjeto] = useState("all");

  const documentos = data?.documentos ?? [];

  const projetos = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of documentos) {
      if (!seen.has(d.projeto_id)) seen.set(d.projeto_id, d.projeto_nome);
    }
    return Array.from(seen.entries()).map(([id, nome]) => ({ id, nome }));
  }, [documentos]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return documentos.filter((d) => {
      if (qq && !d.nome.toLowerCase().includes(qq)) return false;
      if (tipo !== "all" && d.tipo !== tipo) return false;
      if (projeto !== "all" && d.projeto_id !== projeto) return false;
      return true;
    });
  }, [documentos, q, tipo, projeto]);

  const totalBytes = filtered.reduce((s, d) => s + (d.tamanho_bytes ?? 0), 0);

  const openDoc = async (id: string) => {
    try {
      const { url } = await urlFn({ data: { id } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const clear = () => {
    setQ("");
    setTipo("all");
    setProjeto("all");
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-8 md:py-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
            Documentos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} de {documentos.length} documento(s) · {formatBytes(totalBytes)} no total
          </p>
        </div>
      </div>

      <Card className="mt-6 p-3 border-border/80 shadow-none">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome do documento..."
              className="pl-8"
            />
          </div>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TIPO_DOCUMENTO.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={projeto} onValueChange={setProjeto}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue placeholder="Projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projetos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(q || tipo !== "all" || projeto !== "all") && (
            <Button variant="ghost" size="sm" onClick={clear}>
              Limpar filtros
            </Button>
          )}
        </div>
      </Card>

      <Card className="mt-4 border-border/80 shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead>Enviado por</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Tamanho</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {documentos.length === 0
                      ? "Nenhum documento enviado ainda."
                      : "Nenhum documento encontrado com esses filtros."}
                  </p>
                  {documentos.length > 0 && (
                    <Button variant="link" size="sm" onClick={clear} className="mt-1">
                      Limpar filtros
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.nome}</TableCell>
                <TableCell>
                  {d.tipo ? <Badge variant="secondary">{d.tipo}</Badge> : "—"}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() =>
                      navigate({ to: d.projeto_tipo === "ma" ? "/ma" : "/novos-negocios" })
                    }
                    className="text-sm text-primary hover:underline"
                  >
                    {d.projeto_nome}
                  </button>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.enviado_por_nome}</TableCell>
                <TableCell className="text-sm text-muted-foreground" title={formatAbsolute(d.criado_em)}>
                  {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d.criado_em))}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                  {formatBytes(d.tamanho_bytes ?? 0)}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openDoc(d.id)} title="Abrir">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openDoc(d.id)} title="Baixar">
                    <Download className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
