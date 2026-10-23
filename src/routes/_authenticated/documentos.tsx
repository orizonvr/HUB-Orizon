import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText,
  Search,
  Download,
  ExternalLink,
  Files,
  HardDrive,
  Briefcase,
  Layers,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
} from "lucide-react";

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
import { TIPO_DOCUMENTO, TIPO_DOCUMENTO_NN } from "@/lib/ma-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({
    meta: [
      { title: "Repositório de Documentos — OrizonVR | Pipeline" },
      {
        name: "description",
        content: "Repositório consolidado de NDAs, materiais, laudos e contratos do pipeline Orizon.",
      },
    ],
  }),
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
  const [projetoTipo, setProjetoTipo] = useState<"all" | "ma" | "novos_negocios">("all");

  const documentos = data?.documentos ?? [];

  // Lista unificada de tipos para filtro
  const todosTipos = useMemo(() => {
    const set = new Set<string>();
    TIPO_DOCUMENTO.forEach((t) => set.add(t));
    TIPO_DOCUMENTO_NN.forEach((t) => set.add(t));
    documentos.forEach((d) => {
      if (d.tipo) set.add(d.tipo);
    });
    return Array.from(set).sort();
  }, [documentos]);

  // Lista de projetos únicos
  const projetos = useMemo(() => {
    const seen = new Map<string, { id: string; nome: string; tipo: "ma" | "novos_negocios" }>();
    for (const d of documentos) {
      if (!seen.has(d.projeto_id)) {
        seen.set(d.projeto_id, { id: d.projeto_id, nome: d.projeto_nome, tipo: d.projeto_tipo });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [documentos]);

  // Métricas para a Faixa de KPIs (Bento Strip)
  const totalDocumentos = documentos.length;
  const totalBytesTotal = documentos.reduce((s, d) => s + (d.tamanho_bytes ?? 0), 0);
  const totalProjetosComDocs = projetos.length;
  const totalDocsMa = documentos.filter((d) => d.projeto_tipo === "ma").length;
  const totalDocsNn = documentos.filter((d) => d.projeto_tipo === "novos_negocios").length;

  // Filtragem composta
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return documentos.filter((d) => {
      if (qq && !`${d.nome} ${d.projeto_nome} ${d.enviado_por_nome}`.toLowerCase().includes(qq)) {
        return false;
      }
      if (tipo !== "all" && d.tipo !== tipo) return false;
      if (projeto !== "all" && d.projeto_id !== projeto) return false;
      if (projetoTipo !== "all" && d.projeto_tipo !== projetoTipo) return false;
      return true;
    });
  }, [documentos, q, tipo, projeto, projetoTipo]);

  const filteredBytes = filtered.reduce((s, d) => s + (d.tamanho_bytes ?? 0), 0);

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
    setProjetoTipo("all");
  };

  const hasActiveFilters = q || tipo !== "all" || projeto !== "all" || projetoTipo !== "all";

  return (
    <div className="mx-auto w-full max-w-360 px-4 py-6 md:px-8 space-y-5">
      {/* ======================================================== */}
      {/* 1. HERO BANNER EXECUTIVO INSTITUCIONAL (PADRÃO ORIZONVR)  */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground px-5 py-4 sm:px-6 sm:py-4.5 shadow-xs border border-primary/20">
        {/* Marca d'água circular oficial da Orizon */}
        <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.10] select-none">
          <img
            src="/brand/orizon-symbol.png"
            alt=""
            aria-hidden="true"
            className="h-52 w-52 sm:h-60 sm:w-60 rounded-full object-cover filter contrast-125"
          />
        </div>

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Identidade Institucional & Resumo */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
              <Files className="h-6 w-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                  Repositório de Documentos
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-medium text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>Due Diligence & Contratos</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/80 font-normal truncate max-w-2xl">
                {totalDocumentos} arquivos corporativos • {formatBytes(totalBytesTotal)} armazenados • Rastreabilidade completa de M&amp;A e Novos Negócios
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. BENTO STRIP DE KPIS (PADRÃO TAREFAS / DASHBOARD)      */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total de Documentos */}
        <Card
          onClick={() => {
            setProjetoTipo("all");
            setTipo("all");
            setProjeto("all");
          }}
          className={cn(
            "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
            projetoTipo === "all" && !hasActiveFilters && "ring-2 ring-primary/80 border-primary bg-primary/2",
          )}
        >
          <div className="bg-primary/[0.07] dark:bg-primary/[0.14] border-b border-primary/15 px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-foreground tracking-tight">
                Repositório Geral
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                Total
              </span>
            </div>
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-primary/20 bg-background text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-200 shadow-2xs">
              <Files className="h-3 w-3" />
            </div>
          </div>
          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
              ) : (
                <div className="flex items-baseline tracking-tight">
                  <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                    {totalDocumentos}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                    arquivos
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80 truncate">
                {formatBytes(totalBytesTotal)} alocados
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
                {projetoTipo === "all" && !hasActiveFilters ? "Ativo" : "Ver Todos"}
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: Documentos M&A */}
        <Card
          onClick={() => setProjetoTipo((prev) => (prev === "ma" ? "all" : "ma"))}
          className={cn(
            "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-amber-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
            projetoTipo === "ma" && "ring-2 ring-amber-500/80 border-amber-500 bg-amber-500/3",
          )}
        >
          <div className="bg-amber-500/[0.07] dark:bg-amber-500/[0.14] border-b border-amber-500/20 px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-foreground tracking-tight">
                M&amp;A Corporativo
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                Aquisições
              </span>
            </div>
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-amber-500/25 bg-background text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-all duration-200 shadow-2xs">
              <Briefcase className="h-3 w-3" />
            </div>
          </div>
          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
              ) : (
                <div className="flex items-baseline tracking-tight">
                  <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                    {totalDocsMa}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                    documentos
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80 truncate">
                NDAs, IIMs, SPAs e laudos
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
                {projetoTipo === "ma" ? "Filtrando" : "Filtrar"}
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </Card>

        {/* Card 3: Novos Negócios */}
        <Card
          onClick={() => setProjetoTipo((prev) => (prev === "novos_negocios" ? "all" : "novos_negocios"))}
          className={cn(
            "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
            projetoTipo === "novos_negocios" && "ring-2 ring-emerald-500/80 border-emerald-500 bg-emerald-500/3",
          )}
        >
          <div className="bg-emerald-500/[0.07] dark:bg-emerald-500/[0.14] border-b border-emerald-500/20 px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-foreground tracking-tight">
                Novos Negócios
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                Expansão
              </span>
            </div>
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-emerald-500/25 bg-background text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-all duration-200 shadow-2xs">
              <Layers className="h-3 w-3" />
            </div>
          </div>
          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
              ) : (
                <div className="flex items-baseline tracking-tight">
                  <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                    {totalDocsNn}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                    documentos
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80 truncate">
                Offtakers e contratos
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
                {projetoTipo === "novos_negocios" ? "Filtrando" : "Filtrar"}
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </Card>

        {/* Card 4: Cobertura de Projetos */}
        <Card
          className="group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-sky-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col"
        >
          <div className="bg-sky-500/[0.07] dark:bg-sky-500/[0.14] border-b border-sky-500/20 px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-foreground tracking-tight">
                Cobertura do Pipeline
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                Projetos
              </span>
            </div>
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-sky-500/25 bg-background text-sky-600 dark:text-sky-400 group-hover:bg-sky-500 group-hover:text-white group-hover:border-sky-500 transition-all duration-200 shadow-2xs">
              <HardDrive className="h-3 w-3" />
            </div>
          </div>
          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
              ) : (
                <div className="flex items-baseline tracking-tight">
                  <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                    {totalProjetosComDocs}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                    com documentação
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80 truncate">
                Média de {(totalDocumentos / Math.max(1, totalProjetosComDocs)).toFixed(1)} docs/projeto
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-600 dark:text-sky-400 font-medium shrink-0">
                OrizonVR
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ======================================================== */}
      {/* 3. COCKPIT DE FILTROS & BUSCA UNIFICADA                 */}
      {/* ======================================================== */}
      <div className="flex flex-col gap-3.5 bg-card p-3 rounded-xl border border-border/80">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Campo de Busca Textual */}
          <div className="relative flex-1 min-w-65">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome do arquivo, projeto ou remetente..."
              className="h-9 pl-8.5 pr-3 text-xs rounded-lg bg-background border-border/80 focus-visible:ring-primary/20"
            />
          </div>

          {/* Filtro por Categoria de Projeto */}
          <Select
            value={projetoTipo}
            onValueChange={(v) => setProjetoTipo(v as "all" | "ma" | "novos_negocios")}
          >
            <SelectTrigger className="w-40 h-9 text-xs rounded-lg border-border/80 bg-background">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              <SelectItem value="ma">M&amp;A Corporativo</SelectItem>
              <SelectItem value="novos_negocios">Novos Negócios</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro por Tipo de Documento */}
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-45 h-9 text-xs rounded-lg border-border/80 bg-background">
              <SelectValue placeholder="Tipo de documento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {todosTipos.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro por Projeto Específico */}
          <Select value={projeto} onValueChange={setProjeto}>
            <SelectTrigger className="w-52.5 h-9 text-xs rounded-lg border-border/80 bg-background">
              <SelectValue placeholder="Filtrar por projeto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os projetos</SelectItem>
              {projetos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} ({p.tipo === "ma" ? "M&A" : "NN"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Botão de Limpar Filtros */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2.5 rounded-lg"
              title="Redefinir filtros"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Limpar</span>
            </Button>
          )}
        </div>

        {/* Barra de Status e Subtotal dos Filtros */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 border-t border-border/50 pt-2.5">
          <span>
            Mostrando <strong className="text-foreground font-semibold">{filtered.length}</strong> de{" "}
            {documentos.length} documento(s)
          </span>
          <span>
            Volume filtrado: <strong className="text-foreground font-semibold">{formatBytes(filteredBytes)}</strong>
          </span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. TABELA EXECUTIVA DE DOCUMENTOS                        */}
      {/* ======================================================== */}
      <Card className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-b border-border/80 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-foreground">Documento</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Classificação</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Projeto Associado</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Enviado por</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Data de Upload</TableHead>
                <TableHead className="text-xs font-bold text-foreground text-right">Tamanho</TableHead>
                <TableHead className="w-25 text-right text-xs font-bold text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="py-4">
                      <Skeleton className="h-6 w-full rounded-md" />
                    </TableCell>
                  </TableRow>
                ))}

              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-accent/50 text-muted-foreground mb-3">
                      <FileText className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {documentos.length === 0
                        ? "Nenhum documento anexado ainda no repositório."
                        : "Nenhum documento encontrado com os filtros selecionados."}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {documentos.length === 0
                        ? "Os documentos são enviados diretamente através das abas de cada projeto."
                        : "Tente remover os filtros de busca para visualizar outros arquivos."}
                    </p>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clear}
                        className="mt-3 rounded-xl text-xs gap-1.5"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Limpar Filtros
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )}

              {filtered.map((d) => (
                <TableRow
                  key={d.id}
                  className="hover:bg-muted/30 transition-colors border-b border-border/60 group"
                >
                  {/* Nome do Documento */}
                  <TableCell className="font-semibold text-xs text-foreground py-3">
                    <div className="flex items-center gap-2.5 max-w-[320px]">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <FileCheck2 className="h-4 w-4" />
                      </div>
                      <span className="truncate" title={d.nome}>
                        {d.nome}
                      </span>
                    </div>
                  </TableCell>

                  {/* Tipo / Classificação */}
                  <TableCell className="py-3">
                    {d.tipo ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-medium bg-secondary text-secondary-foreground border border-border/70"
                      >
                        {d.tipo}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Projeto */}
                  <TableCell className="py-3">
                    <button
                      onClick={() =>
                        navigate({ to: d.projeto_tipo === "ma" ? "/ma" : "/novos-negocios" })
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline group-hover:text-primary/90 cursor-pointer"
                      title={`Ir para ${d.projeto_nome}`}
                    >
                      <span className="truncate max-w-50">{d.projeto_nome}</span>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 border-border/80 text-muted-foreground shrink-0"
                      >
                        {d.projeto_tipo === "ma" ? "M&A" : "NN"}
                      </Badge>
                    </button>
                  </TableCell>

                  {/* Enviado por */}
                  <TableCell className="text-xs text-muted-foreground py-3">
                    <span className="truncate max-w-37.5 inline-block font-medium text-foreground/80">
                      {d.enviado_por_nome}
                    </span>
                  </TableCell>

                  {/* Data de Upload */}
                  <TableCell
                    className="text-xs text-muted-foreground py-3"
                    title={formatAbsolute(d.criado_em)}
                  >
                    {new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(d.criado_em))}
                  </TableCell>

                  {/* Tamanho */}
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground font-mono py-3">
                    {formatBytes(d.tamanho_bytes ?? 0)}
                  </TableCell>

                  {/* Ações */}
                  <TableCell className="text-right py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openDoc(d.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                        title="Visualizar documento em nova aba"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openDoc(d.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                        title="Baixar documento"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

