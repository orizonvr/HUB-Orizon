import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListTodo, Inbox, Users } from "lucide-react";
import {
  listMinhasTarefas,
  resumoTarefasTime,
} from "@/lib/tarefas.functions";
import { PrazoBadge } from "@/components/tarefas/tarefas-tab";
import { avatarBgStyle } from "@/lib/format";
import { initials } from "@/lib/ma-utils";
import { useTarefaDrawer } from "@/hooks/use-tarefa-drawer";

export function MinhasTarefasBlock() {
  const { openTarefa } = useTarefaDrawer();
  const fn = useServerFn(listMinhasTarefas);
  const { data, isLoading } = useQuery({
    queryKey: ["minhas-tarefas"],
    queryFn: () => fn(),
  });
  const all = data?.tarefas ?? [];
  const items = all.slice(0, 8);

  return (
    <Card className="border border-border/80 bg-card rounded-xl shadow-2xs overflow-hidden">
      {/* Header com cor sólida institucional */}
      <div className="bg-primary/4 dark:bg-primary/10 border-b border-primary/15 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            Minhas Tarefas Pendentes
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ações prioritárias atribuídas a você
          </p>
        </div>
        {all.length > items.length && (
          <Link
            to="/tarefas"
            className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Ver todas ({all.length})
          </Link>
        )}
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center">
            <Inbox className="mx-auto h-5 w-5 text-muted-foreground/40" />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Nenhuma tarefa pendente no momento.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((t) => (
              <li
                key={t.id}
                onClick={() => openTarefa(t.id)}
                className="group flex items-center justify-between gap-3 py-2.5 px-2 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {/* Checkbox circular estilo Linear */}
                  <div className="h-3.5 w-3.5 mt-0.5 rounded-full border border-border/90 bg-background group-hover:border-primary/80 transition-colors shrink-0 flex items-center justify-center shadow-2xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      {t.titulo}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {t.projeto_nome} • {t.projeto_tipo === "ma" ? "M&A" : "Novos Negócios"}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <PrazoBadge prazo={t.prazo} />
                  {t.prioridade === "alta" && (
                    <Badge
                      variant="outline"
                      className="text-[9px] py-0 px-1 border-destructive/40 text-destructive font-semibold bg-destructive/10"
                    >
                      Alta
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function TarefasDoTimeBlock() {
  const fn = useServerFn(resumoTarefasTime);
  const { data, isLoading } = useQuery({
    queryKey: ["resumo-tarefas-time"],
    queryFn: () => fn(),
  });
  const rows = data?.resumo ?? [];

  // Hide block entirely if endpoint returned empty resumo for non-admin/lider.
  if (!isLoading && rows.length === 0 && data) {
    return null;
  }

  return (
    <Card className="border border-border/80 bg-card rounded-xl shadow-2xs overflow-hidden">
      {/* Header com cor sólida institucional */}
      <div className="bg-primary/4 dark:bg-primary/10 border-b border-primary/15 px-5 py-3.5 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Carga de Trabalho da Equipe
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Acompanhamento de entregas e pendências por responsável
          </p>
        </div>
      </div>
      <div className="p-5 overflow-x-auto">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/70 hover:bg-transparent">
                <TableHead className="text-xs font-semibold h-8 text-muted-foreground">Pessoa</TableHead>
                <TableHead className="text-right text-xs font-semibold h-8 text-muted-foreground">Vencidas</TableHead>
                <TableHead className="text-right text-xs font-semibold h-8 text-muted-foreground">Vencem ≤3d</TableHead>
                <TableHead className="text-right text-xs font-semibold h-8 text-muted-foreground">Próximas</TableHead>
                <TableHead className="text-right text-xs font-semibold h-8 text-muted-foreground">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.responsavel_id} className="border-border/50 hover:bg-muted/20">
                  <TableCell className="py-2.5">
                    <Link
                      to="/tarefas"
                      search={{ escopo: "time", resp: r.responsavel_id } as never}
                      className="flex items-center gap-2 hover:text-primary transition-colors font-medium text-xs text-foreground"
                    >
                      <Avatar className="h-5 w-5 border border-border/60">
                        <AvatarFallback
                          style={avatarBgStyle(r.responsavel_nome)}
                          className="text-[9px] font-semibold"
                        >
                          {initials(r.responsavel_nome)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{r.responsavel_nome}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs py-2.5">
                    {r.vencidas > 0 ? (
                      <span className="font-bold text-destructive">
                        {r.vencidas}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs py-2.5">
                    {r.em_3_dias > 0 ? (
                      <span className="font-bold text-amber-600 dark:text-amber-500">
                        {r.em_3_dias}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-muted-foreground py-2.5">
                    {r.proximas}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-bold text-foreground py-2.5">
                    {r.total}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  );
}
