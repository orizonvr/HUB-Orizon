import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Clock, Calendar, AlertTriangle, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listAllNotificacoes,
  marcarComoLida,
  marcarTodasComoLidas,
} from "@/lib/notificacoes.functions";
import type { Notificacao, NotificacaoTipo } from "@/lib/notificacoes-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({
    meta: [{ title: "Notificações — OrizonVR | Pipeline" }],
  }),
  component: NotificacoesPage,
});

const PAGE_SIZE = 30;

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  const d = Math.floor(diff / 86400);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function IconForTipo({ tipo }: { tipo: NotificacaoTipo }) {
  const cls = "h-4 w-4";
  switch (tipo) {
    case "atribuicao":
      return <UserPlus className={cn(cls, "text-primary")} />;
    case "um_dia_antes":
      return <Clock className={cn(cls, "text-amber-600")} />;
    case "vence_hoje":
      return <Calendar className={cn(cls, "text-orange-600")} />;
    case "vencimento":
      return <AlertTriangle className={cn(cls, "text-destructive")} />;
  }
}

function NotificacoesPage() {
  const [page, setPage] = useState(0);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listAllNotificacoes);
  const markFn = useServerFn(marcarComoLida);
  const markAllFn = useServerFn(marcarTodasComoLidas);

  const q = useQuery({
    queryKey: ["notif-all", page],
    queryFn: () => listFn({ data: { page, pageSize: PAGE_SIZE } }),
  });

  const markMut = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-all"] });
      qc.invalidateQueries({ queryKey: ["notif-count"] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-all"] });
      qc.invalidateQueries({ queryKey: ["notif-count"] });
    },
  });

  const notifs = (q.data?.notificacoes ?? []) as Notificacao[];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8 md:py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Notificações
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico completo · {total} registro{total === 1 ? "" : "s"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllMut.mutate()}
          disabled={markAllMut.isPending}
        >
          <CheckCheck className="mr-1.5 h-4 w-4" /> Marcar todas como lidas
        </Button>
      </div>

      <div className="mt-6 divide-y divide-border rounded-md border border-border bg-card">
        {q.isLoading && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Carregando…
          </div>
        )}
        {!q.isLoading && notifs.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            Nenhuma notificação.
          </div>
        )}
        {notifs.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => {
              if (!n.lida) markMut.mutate(n.id);
              if (n.url_destino) navigate({ to: n.url_destino });
            }}
            className={cn(
              "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/40",
              !n.lida && "bg-primary/[0.04]",
            )}
          >
            <div className="mt-0.5">
              <IconForTipo tipo={n.tipo} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{n.titulo}</p>
              {n.descricao && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {n.descricao}
                </p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {timeAgo(n.created_at)}
              </p>
            </div>
            {!n.lida && (
              <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
