import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/ma-utils";
import { avatarBgStyle } from "@/lib/format";
import {
  listComentariosByTarefa,
  createComentario,
} from "@/lib/tarefas.functions";
import type { TarefaComentario } from "@/lib/tarefas-types";
import { useAuth } from "@/hooks/use-auth";

type Props = {
  tarefaId: string;
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const time = format(d, "HH:mm");
    if (isToday(d)) return `Hoje às ${time}`;
    if (isYesterday(d)) return `Ontem às ${time}`;
    return `${format(d, "dd/MM/yyyy", { locale: ptBR })} ${time}`;
  } catch {
    return "";
  }
}

export function TarefaChat({ tarefaId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [conteudo, setConteudo] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const listFn = useServerFn(listComentariosByTarefa);
  const createFn = useServerFn(createComentario);

  const { data, isLoading } = useQuery({
    queryKey: ["tarefa-comentarios", tarefaId],
    queryFn: () => listFn({ data: { tarefa_id: tarefaId } }),
    refetchInterval: 15_000,
  });

  const comentarios = (data?.comentarios ?? []) as TarefaComentario[];

  const sendMut = useMutation({
    mutationFn: (text: string) =>
      createFn({ data: { tarefa_id: tarefaId, conteudo: text } }),
    onSuccess: () => {
      setConteudo("");
      qc.invalidateQueries({ queryKey: ["tarefa-comentarios", tarefaId] });
      qc.invalidateQueries({ queryKey: ["tarefa", tarefaId] });
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    },
    onError: (err) => {
      toast.error((err as Error).message || "Falha ao enviar comentário");
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comentarios.length, isLoading]);

  const handleSend = () => {
    const clean = conteudo.trim();
    if (!clean || sendMut.isPending) return;
    sendMut.mutate(clean);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card/60 overflow-hidden shadow-xs">
      {/* Header do Chat */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/40 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            Comentários
          </span>
          <span className="text-[11px] text-muted-foreground">
            ({comentarios.length})
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          Enter para enviar · Shift+Enter quebra linha
        </span>
      </div>

      {/* Área de Mensagens (WhatsApp style) */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/15"
        style={{ scrollBehavior: "smooth" }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : comentarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-xs">Nenhum comentário registrado ainda.</p>
            <p className="text-[11px] opacity-75">
              Inicie a conversa para alinhar o andamento desta tarefa.
            </p>
          </div>
        ) : (
          comentarios.map((c) => {
            const isMe = user?.id === c.autor_id;
            return (
              <div
                key={c.id}
                className={cn(
                  "flex items-end gap-2 max-w-[88%]",
                  isMe ? "ml-auto flex-row-reverse" : "mr-auto",
                )}
              >
                {!isMe && (
                  <Avatar className="h-6 w-6 shrink-0 text-[10px]">
                    {c.autor_avatar && <AvatarImage src={c.autor_avatar} />}
                    <AvatarFallback
                      className="text-white"
                      style={avatarBgStyle(c.autor_id)}
                    >
                      {initials(c.autor_nome)}
                    </AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-xs shadow-xs relative wrap-break-word leading-relaxed",
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-xs"
                      : "bg-background border rounded-bl-xs text-foreground",
                  )}
                >
                  {!isMe && (
                    <div className="font-semibold text-[11px] text-primary mb-1">
                      {c.autor_nome}
                    </div>
                  )}

                  <div className="whitespace-pre-wrap select-text">
                    {c.conteudo}
                  </div>

                  <div
                    className={cn(
                      "text-[9px] mt-1 text-right select-none",
                      isMe ? "text-primary-foreground/75" : "text-muted-foreground",
                    )}
                  >
                    {formatTimestamp(c.criado_em)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Caixa de Entrada de Mensagem */}
      <div className="p-3 border-t bg-background shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva uma mensagem..."
            className="min-h-10 max-h-28 text-xs resize-none py-2 px-3 leading-normal"
            rows={1}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!conteudo.trim() || sendMut.isPending}
            className="h-9 w-9 shrink-0 p-0"
            title="Enviar mensagem"
          >
            {sendMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
