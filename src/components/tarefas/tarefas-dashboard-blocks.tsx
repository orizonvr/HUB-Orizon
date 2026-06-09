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

export function MinhasTarefasBlock() {
  const fn = useServerFn(listMinhasTarefas);
  const { data, isLoading } = useQuery({
    queryKey: ["minhas-tarefas"],
    queryFn: () => fn(),
  });
  const all = data?.tarefas ?? [];
  const items = all.slice(0, 8);

  return (
    <Card className="border-border/80 p-6 shadow-none">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            Minhas tarefas pendentes
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pendentes e em andamento atribuídas a você
          </p>
        </div>
        {all.length > items.length && (
          <Link
            to="/tarefas"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Ver todas ({all.length})
          </Link>
        )}
      </div>
      <div className="mt-5">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center">
            <Inbox className="mx-auto h-6 w-6 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhuma tarefa pendente. 🎉
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 py-2.5 first:pt-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {t.titulo}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {t.projeto_nome} ·{" "}
                    {t.projeto_tipo === "ma" ? "M&A" : "NN"}
                  </p>
                </div>
                <div className="shrink-0 text-xs">
                  <PrazoBadge prazo={t.prazo} />
                </div>
                {t.prioridade === "alta" && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-destructive/40 text-destructive"
                  >
                    Alta
                  </Badge>
                )}
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
    <Card className="border-border/80 p-6 shadow-none">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Tarefas do time
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Carga atual de tarefas pendentes por pessoa
          </p>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead className="text-right">Vencidas</TableHead>
                <TableHead className="text-right">Vencem ≤3 dias</TableHead>
                <TableHead className="text-right">Próximas</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.responsavel_id}>
                  <TableCell>
                    <Link
                      to="/tarefas"
                      search={{ escopo: "time", resp: r.responsavel_id } as never}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarFallback
                          style={avatarBgStyle(r.responsavel_nome)}
                          className="text-[9px]"
                        >
                          {initials(r.responsavel_nome)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{r.responsavel_nome}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.vencidas > 0 ? (
                      <span className="font-medium text-destructive">
                        {r.vencidas}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.em_3_dias > 0 ? (
                      <span className="font-medium text-amber-600">
                        {r.em_3_dias}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {r.proximas}
                  </TableCell>
                  <TableCell className="text-right font-medium">
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
