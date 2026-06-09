import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Calendar, AlertTriangle, UserPlus, Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  listNotificacoes,
  contarNaoLidas,
  marcarComoLida,
  marcarTodasComoLidas,
} from "@/lib/notificacoes.functions";
import type { Notificacao, NotificacaoTipo } from "@/lib/notificacoes-types";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

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

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const countFn = useServerFn(contarNaoLidas);
  const listFn = useServerFn(listNotificacoes);
  const markFn = useServerFn(marcarComoLida);
  const markAllFn = useServerFn(marcarTodasComoLidas);

  const countQ = useQuery({
    queryKey: ["notif-count"],
    queryFn: () => countFn(),
    enabled: !!user,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const listQ = useQuery({
    queryKey: ["notif-list"],
    queryFn: () => listFn({ data: { limit: 10 } }),
    enabled: !!user && open,
  });

  // Garante refresh do contador quando algo invalidar
  useEffect(() => {
    if (open) {
      qc.invalidateQueries({ queryKey: ["notif-list"] });
    }
  }, [open, qc]);

  const markMut = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-count"] });
      qc.invalidateQueries({ queryKey: ["notif-list"] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-count"] });
      qc.invalidateQueries({ queryKey: ["notif-list"] });
    },
  });

  const unread = countQ.data?.count ?? 0;
  const notifs = (listQ.data?.notificacoes ?? []) as Notificacao[];

  const handleClick = async (n: Notificacao) => {
    setOpen(false);
    if (!n.lida) {
      markMut.mutate(n.id);
    }
    if (n.url_destino) {
      navigate({ to: n.url_destino });
    }
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-semibold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] p-0 overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          {unread > 0 && (
            <button
              type="button"
              className="text-[11px] font-medium text-primary hover:underline"
              onClick={() => markAllMut.mutate()}
              disabled={markAllMut.isPending}
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {listQ.isLoading && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Carregando…
            </div>
          )}
          {!listQ.isLoading && notifs.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              Nenhuma notificação por enquanto.
            </div>
          )}
          {notifs.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleClick(n)}
              className={cn(
                "flex w-full items-start gap-2.5 border-b border-border/60 px-3 py-2.5 text-left hover:bg-accent/60",
                !n.lida && "bg-primary/[0.04]",
              )}
            >
              <div className="mt-0.5">
                <IconForTipo tipo={n.tipo} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-tight text-foreground">
                  {n.titulo}
                </p>
                {n.descricao && (
                  <p className="mt-0.5 text-[12px] text-muted-foreground leading-snug truncate">
                    {n.descricao}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {timeAgo(n.created_at)}
                </p>
              </div>
              {!n.lida && (
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
        <div className="border-t border-border px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setOpen(false);
              navigate({ to: "/notificacoes" });
            }}
          >
            Ver todas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
