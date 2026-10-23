import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  UserPlus,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
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
      return <Clock className={cn(cls, "text-amber-500")} />;
    case "vence_hoje":
      return <Calendar className={cn(cls, "text-orange-500")} />;
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
  const naoLidas = notifs.filter((n) => !n.lida).length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-360 px-4 py-6 md:px-8 space-y-5">
      {/* ======================================================== */}
      {/* HERO BANNER EXECUTIVO INSTITUCIONAL (PADRÃO ORIZONVR)   */}
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
          {/* Título & Identidade Institucional */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
              <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
                  Central de Notificações
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 text-white border border-white/20 backdrop-blur-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Tempo Real
                </span>
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-white/80 font-normal truncate max-w-2xl">
                Acompanhamento de alertas de prazos, atribuições de tarefas e eventos do ecossistema OrizonVR
              </p>
            </div>
          </div>

          {/* Ações Rápidas no Hero */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs text-white">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>
                <strong className="font-semibold">{total}</strong> total ·{" "}
                <strong className="font-semibold text-amber-200">{naoLidas}</strong> não lidas nesta página
              </span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => markAllMut.mutate()}
              disabled={markAllMut.isPending || notifs.length === 0}
              className="bg-white text-primary hover:bg-white/90 font-medium shadow-xs border-0 text-xs h-8.5 px-3.5 gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <CheckCheck className="h-3.5 w-3.5 text-primary" />
              Marcar todas como lidas
            </Button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* LISTAGEM DE NOTIFICAÇÕES                                 */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-border/80 bg-card shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border/60 flex items-center justify-between gap-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              Histórico de Notificações
            </h2>
            <span className="text-xs text-muted-foreground font-medium">
              ({total} registros)
            </span>
          </div>
          {total > PAGE_SIZE && (
            <span className="text-xs text-muted-foreground">
              Página {page + 1} de {totalPages}
            </span>
          )}
        </div>

        <div className="divide-y divide-border/60">
          {q.isLoading && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              Carregando notificações…
            </div>
          )}

          {!q.isLoading && notifs.length === 0 && (
            <div className="px-4 py-16 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              Nenhuma notificação registrada no momento.
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
                "group flex w-full items-start gap-3.5 px-4 sm:px-5 py-3.5 text-left transition-colors hover:bg-muted/40 cursor-pointer",
                !n.lida && "bg-primary/3 dark:bg-primary/6",
              )}
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border/80 shadow-2xs group-hover:border-primary/40 transition-colors">
                <IconForTipo tipo={n.tipo} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-xs sm:text-sm font-medium tracking-tight text-foreground truncate",
                      !n.lida && "font-semibold text-primary dark:text-primary-foreground",
                    )}
                  >
                    {n.titulo}
                  </p>
                  <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
                    {timeAgo(n.created_at)}
                  </span>
                </div>
                {n.descricao && (
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {n.descricao}
                  </p>
                )}
              </div>
              {!n.lida && (
                <span
                  className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary ring-2 ring-primary/20"
                  title="Não lida"
                />
              )}
            </button>
          ))}
        </div>

        {total > PAGE_SIZE && (
          <div className="p-3.5 sm:px-5 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Mostrando {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} de {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="h-8 px-2.5 gap-1 text-xs cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 px-2.5 gap-1 text-xs cursor-pointer"
              >
                Próxima
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
