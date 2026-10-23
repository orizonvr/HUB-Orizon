import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, Columns3, Download as DownloadIcon } from "lucide-react";
import {
  formatBRLFull,
  formatMonthYear,
  healthFor,
  HEALTH_BG,
  initials,
  STATUS_LABEL,
} from "@/lib/ma-utils";
import {
  avatarBgStyle,
  formatPercentOrizon,
  formatTonDia,
  formatValorTransacaoMM,
} from "@/lib/format";
import { formatExtra, type ProjetoConfig } from "@/lib/projetos-config";
import { SUBCATEGORIA_LABEL } from "@/lib/projetos-types";
import type { Profile, Projeto } from "@/lib/projetos.functions";

export type SortKey =
  | "nome"
  | "setor"
  | "estagio"
  | "valor_estimado"
  | "volume_ton_dia"
  | "percentual_orizon"
  | "valor_transacao_mm"
  | "ebitda_2025"
  | "sinergias_estimadas"
  | "capex_estimado"
  | "ebitda_alvo"
  | "multiplo_ev_ebitda"
  | "tir_estimada"
  | "payback_anos"
  | "data_fechamento_prevista"
  | "status";

interface ProjetosTableViewProps {
  config: ProjetoConfig;
  projetos: Projeto[];
  profileMap: Map<string, Profile>;
  onOpen: (id: string) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
}

export function ProjetosTableView({
  config,
  projetos,
  profileMap,
  onOpen,
  selectedIds,
  onToggleSelect,
}: ProjetosTableViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("data_fechamento_prevista");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const showMaCols = config.tipo === "ma";
  const [colVolume, setColVolume] = useState(true);
  const [colOrizon, setColOrizon] = useState(true);
  const [colTransacao, setColTransacao] = useState(true);
  const [colEbitda2025, setColEbitda2025] = useState(true);
  const [colSinergias, setColSinergias] = useState(false);
  const [colCapex, setColCapex] = useState(false);

  const pageSize = 20;

  const sorted = useMemo(() => {
    const arr = [...projetos];
    arr.sort((a, b) => {
      const aRaw = a[sortKey];
      const bRaw = b[sortKey];
      const aEmpty = aRaw === null || aRaw === undefined || aRaw === "";
      const bEmpty = bRaw === null || bRaw === undefined || bRaw === "";

      // Valores nulos/vazios sempre no final (nulls last)
      if (aEmpty && !bEmpty) return 1;
      if (!aEmpty && bEmpty) return -1;
      if (aEmpty && bEmpty) return 0;

      const av = aRaw as string | number;
      const bv = bRaw as string | number;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [projetos, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageItems = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const showSubcat = config.tipo === "novos_negocios";

  const exportCsv = () => {
    const maCols: Array<[boolean, string, (p: Projeto) => string]> = [
      [showMaCols && colVolume, "Volume (ton/dia)", (p) => String(p.volume_ton_dia ?? "")],
      [showMaCols && colOrizon, "% Orizon", (p) => String(p.percentual_orizon ?? "")],
      [showMaCols && colTransacao, "Valor Transação (R$ MM)", (p) => String(p.valor_transacao_mm ?? "")],
      [showMaCols && colEbitda2025, "EBITDA 2025 (R$ MM)", (p) => String(p.ebitda_2025 ?? "")],
      [showMaCols && colSinergias, "Sinergias (R$)", (p) => String(p.sinergias_estimadas ?? "")],
      [showMaCols && colCapex, "CAPEX Estimado (R$)", (p) => String(p.capex_estimado ?? "")],
    ];
    const header = [
      "Nome",
      "Contraparte",
      "Setor",
      ...(showSubcat ? ["Subcategoria"] : []),
      "Estágio",
      config.valorColLabel,
      ...maCols.filter(([on]) => on).map(([, lbl]) => lbl),
      ...config.extraColumns.map((c) => c.label),
      "Responsável",
      "Data prevista",
      "Status",
    ];
    const rows = [
      header,
      ...sorted.map((p) => [
        p.nome,
        p.contraparte ?? "",
        p.setor ?? "",
        ...(showSubcat ? [SUBCATEGORIA_LABEL[p.subcategoria ?? ""] ?? p.subcategoria ?? ""] : []),
        config.estagioLabels[p.estagio] ?? p.estagio,
        String(p.valor_estimado ?? ""),
        ...maCols.filter(([on]) => on).map(([, , fn]) => fn(p)),
        ...config.extraColumns.map((c) =>
          String((p[c.key] as number | null | undefined) ?? ""),
        ),
        p.responsavel_id
          ? profileMap.get(p.responsavel_id)?.nome_completo ?? ""
          : "",
        p.data_fechamento_prevista ?? "",
        STATUS_LABEL[p.status] ?? p.status,
      ]),
    ];
    const csv = rows
      .map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.csvPrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleMaCols = showMaCols
    ? Number(colVolume) +
      Number(colOrizon) +
      Number(colTransacao) +
      Number(colEbitda2025) +
      Number(colSinergias) +
      Number(colCapex)
    : 0;

  const colSpan =
    6 + config.extraColumns.length + 4 + (showSubcat ? 1 : 0) + visibleMaCols;

  return (
    <Card className="rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
      {/* Toolbar Superior da Tabela */}
      <div className="flex items-center justify-between p-3.5 border-b border-border/70 bg-muted/20">
        <div className="text-xs font-medium text-muted-foreground">
          <span className="font-bold text-foreground tabular-nums">
            {sorted.length}
          </span>{" "}
          projetos listados
          {selectedSet.size > 0 && (
            <span className="ml-2 font-semibold text-primary">
              • {selectedSet.size} selecionado(s)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showMaCols && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg border-border/80">
                  <Columns3 className="h-3.5 w-3.5" />
                  <span>Colunas</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuLabel className="text-xs">Colunas de M&A</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={colVolume}
                  onCheckedChange={(v) => setColVolume(!!v)}
                >
                  Volume (ton/dia)
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={colOrizon}
                  onCheckedChange={(v) => setColOrizon(!!v)}
                >
                  % Orizon
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={colTransacao}
                  onCheckedChange={(v) => setColTransacao(!!v)}
                >
                  Valor Transação
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={colEbitda2025}
                  onCheckedChange={(v) => setColEbitda2025(!!v)}
                >
                  EBITDA 2025
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={colSinergias}
                  onCheckedChange={(v) => setColSinergias(!!v)}
                >
                  Sinergias Estimadas
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={colCapex}
                  onCheckedChange={(v) => setColCapex(!!v)}
                >
                  CAPEX Estimado
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="h-8 text-xs gap-1.5 rounded-lg border-border/80"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </Button>
        </div>
      </div>

      {/* Tabela de Conteúdo */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/40 border-b border-border/80">
              <TableHead className="w-10 px-3" />
              <SortHead k="nome" sk={sortKey} sd={sortDir} onSort={toggleSort}>
                Nome / Deal
              </SortHead>
              <SortHead k="setor" sk={sortKey} sd={sortDir} onSort={toggleSort}>
                Setor
              </SortHead>
              {showSubcat && <TableHead className="text-xs font-bold">Subcategoria</TableHead>}
              <SortHead k="estagio" sk={sortKey} sd={sortDir} onSort={toggleSort}>
                Estágio
              </SortHead>
              <SortHead
                k="valor_estimado"
                sk={sortKey}
                sd={sortDir}
                onSort={toggleSort}
                className="text-right"
              >
                {config.valorColLabel}
              </SortHead>
              {showMaCols && colVolume && (
                <SortHead k="volume_ton_dia" sk={sortKey} sd={sortDir} onSort={toggleSort} className="text-right">
                  Volume
                </SortHead>
              )}
              {showMaCols && colOrizon && (
                <SortHead k="percentual_orizon" sk={sortKey} sd={sortDir} onSort={toggleSort} className="text-right">
                  % Orizon
                </SortHead>
              )}
              {showMaCols && colTransacao && (
                <SortHead k="valor_transacao_mm" sk={sortKey} sd={sortDir} onSort={toggleSort} className="text-right">
                  Valor Transação
                </SortHead>
              )}
              {showMaCols && colEbitda2025 && (
                <SortHead k="ebitda_2025" sk={sortKey} sd={sortDir} onSort={toggleSort} className="text-right">
                  EBITDA 2025
                </SortHead>
              )}
              {showMaCols && colSinergias && (
                <SortHead k="sinergias_estimadas" sk={sortKey} sd={sortDir} onSort={toggleSort} className="text-right">
                  Sinergias
                </SortHead>
              )}
              {showMaCols && colCapex && (
                <SortHead k="capex_estimado" sk={sortKey} sd={sortDir} onSort={toggleSort} className="text-right">
                  CAPEX
                </SortHead>
              )}
              {config.extraColumns.map((c) => (
                <SortHead
                  key={c.key}
                  k={c.key as SortKey}
                  sk={sortKey}
                  sd={sortDir}
                  onSort={toggleSort}
                  className="text-right"
                >
                  {c.label}
                </SortHead>
              ))}
              <TableHead className="text-xs font-bold">Responsável</TableHead>
              <SortHead
                k="data_fechamento_prevista"
                sk={sortKey}
                sd={sortDir}
                onSort={toggleSort}
              >
                Previsão
              </SortHead>
              <SortHead k="status" sk={sortKey} sd={sortDir} onSort={toggleSort}>
                Status
              </SortHead>
              <TableHead className="text-xs font-bold w-16 text-center">Saúde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((p) => {
              const resp = p.responsavel_id
                ? profileMap.get(p.responsavel_id)
                : undefined;
              const h = healthFor(p);
              return (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors border-b border-border/60"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("[data-no-row]")) return;
                    onOpen(p.id);
                  }}
                >
                  <TableCell data-no-row onClick={(e) => e.stopPropagation()} className="px-3">
                    <Checkbox
                      checked={selectedSet.has(p.id)}
                      onCheckedChange={() => onToggleSelect(p.id)}
                      aria-label="Selecionar para comparar"
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell className="font-semibold text-sm text-foreground">
                    <div>{p.nome}</div>
                    {p.contraparte && (
                      <div className="text-xs font-normal text-muted-foreground truncate">
                        {p.contraparte}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">
                    {p.setor ?? "—"}
                  </TableCell>
                  {showSubcat && (
                    <TableCell>
                      {p.subcategoria ? (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] py-0 px-1.5 font-medium">
                          {SUBCATEGORIA_LABEL[p.subcategoria] ?? p.subcategoria}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant="secondary" className="text-[11px] font-medium">
                      {config.estagioLabels[p.estagio] ?? p.estagio}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-sm text-foreground">
                    {formatBRLFull(p.valor_estimado)}
                  </TableCell>
                  {showMaCols && colVolume && (
                    <TableCell className="text-right text-xs font-mono">
                      {formatTonDia(p.volume_ton_dia) ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {showMaCols && colOrizon && (
                    <TableCell className="text-right text-xs font-mono font-medium text-amber-700 dark:text-amber-300">
                      {formatPercentOrizon(p.percentual_orizon) ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {showMaCols && colTransacao && (
                    <TableCell className="text-right text-xs font-mono">
                      {formatValorTransacaoMM(p.valor_transacao_mm) ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {showMaCols && colEbitda2025 && (
                    <TableCell className="text-right text-xs font-mono">
                      {formatValorTransacaoMM(p.ebitda_2025) ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {showMaCols && colSinergias && (
                    <TableCell className="text-right text-xs font-mono">
                      {p.sinergias_estimadas != null ? formatBRLFull(p.sinergias_estimadas) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {showMaCols && colCapex && (
                    <TableCell className="text-right text-xs font-mono">
                      {p.capex_estimado != null ? formatBRLFull(p.capex_estimado) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {config.extraColumns.map((c) => (
                    <TableCell key={c.key} className="text-right text-xs font-mono">
                      {formatExtra(
                        p[c.key] as number | null | undefined,
                        c.format,
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    {resp ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 border border-border/60">
                          <AvatarFallback className="text-[9px] font-semibold" style={avatarBgStyle(resp.nome_completo)}>
                            {initials(resp.nome_completo)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium text-foreground truncate max-w-32">
                          {resp.nome_completo}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {formatMonthYear(p.data_fechamento_prevista)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium">
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div
                      className={`h-2.5 w-2.5 rounded-full mx-auto ring-2 ring-background ${HEALTH_BG[h]}`}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {pageItems.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="text-center text-muted-foreground py-12 text-sm"
                >
                  Nenhum projeto encontrado nesta visualização.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-border/70 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="h-8 text-xs"
                >
                  Anterior
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  className="h-8 text-xs"
                >
                  Próxima
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </Card>
  );
}

function SortHead({
  k,
  sk,
  sd,
  onSort,
  children,
  className,
}: {
  k: SortKey;
  sk: SortKey;
  sd: "asc" | "desc";
  onSort: (k: SortKey) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(k)}
        className="inline-flex items-center gap-1 hover:text-foreground text-xs font-bold transition-colors"
      >
        <span>{children}</span>
        <ArrowUpDown
          className={`h-3 w-3 ${sk === k ? "text-primary" : "text-muted-foreground/40"}`}
        />
        {sk === k && <span className="text-[10px] text-primary">{sd === "asc" ? "↑" : "↓"}</span>}
      </button>
    </TableHead>
  );
}
