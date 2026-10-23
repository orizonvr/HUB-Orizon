import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, MoreHorizontal, Mail, Copy, Check, Link2, RefreshCw, X, ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  listTeam,
  updateMemberRole,
  setMemberActive,
  type TeamMember,
} from "@/lib/team.functions";
import {
  inviteUser,
  resendInvite,
  getCurrentInvite,
  cancelInvite,
} from "@/lib/convites.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({ meta: [{ title: "Equipe — OrizonVR | Pipeline Alocação de Capital" }] }),
  component: EquipePage,
});

const ROLE_LABEL: Record<TeamMember["role"], string> = {
  admin: "Admin",
  lider: "Líder",
  analista: "Analista",
  observador: "Observador",
};

const ROLE_TONE: Record<TeamMember["role"], string> = {
  admin: "bg-primary/10 text-primary border-primary/20",
  lider: "bg-gold/15 text-gold border-gold/30",
  analista: "bg-accent text-accent-foreground border-border",
  observador: "bg-muted text-muted-foreground border-border",
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

function buildInviteUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/aceitar-convite?token=${token}`;
}

type Filter = "todos" | "ativos" | "pendentes";

function EquipePage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("todos");
  const [linkDialog, setLinkDialog] = useState<{ url: string; title: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: () => listTeam(),
  });

  const roleMut = useMutation({
    mutationFn: (args: { id: string; role: TeamMember["role"] }) => updateMemberRole({ data: args }),
    onSuccess: () => {
      toast.success("Permissão atualizada.");
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const activeMut = useMutation({
    mutationFn: (args: { id: string; ativo: boolean }) => setMemberActive({ data: args }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const copyMut = useMutation({
    mutationFn: (profile_id: string) => getCurrentInvite({ data: { profile_id } }),
    onSuccess: (res, profile_id) => {
      const member = data?.members.find((m) => m.id === profile_id);
      setLinkDialog({
        url: buildInviteUrl(res.token),
        title: `Convite para ${member?.nome_completo ?? "membro"}`,
      });
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const resendMut = useMutation({
    mutationFn: (profile_id: string) => resendInvite({ data: { profile_id } }),
    onSuccess: (res, profile_id) => {
      const member = data?.members.find((m) => m.id === profile_id);
      setLinkDialog({
        url: buildInviteUrl(res.token),
        title: `Novo convite para ${member?.nome_completo ?? "membro"}`,
      });
      toast.success("Convite anterior expirado. Novo link gerado.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const cancelMut = useMutation({
    mutationFn: (profile_id: string) => cancelInvite({ data: { profile_id } }),
    onSuccess: () => {
      toast.success("Convite cancelado.");
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const members = data?.members ?? [];
  const ativos = members.filter((m) => m.status_convite === "ativo").length;
  const pendentes = members.filter((m) => m.status_convite === "pendente").length;
  const filtered = useMemo(() => {
    if (filter === "ativos") return members.filter((m) => m.status_convite === "ativo");
    if (filter === "pendentes") return members.filter((m) => m.status_convite === "pendente");
    return members;
  }, [members, filter]);

  return (
    <div className="mx-auto w-full max-w-350 px-4 py-8 md:px-8 md:py-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
            Equipe
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length} membro{members.length === 1 ? "" : "s"} · {ativos} ativo{ativos === 1 ? "" : "s"} · {pendentes} pendente{pendentes === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(["todos", "ativos", "pendentes"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {isAdmin && (
            <Button onClick={() => setInviteOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" /> Convidar usuário
            </Button>
          )}
        </div>
      </div>

      <Card className="mt-6 border-border/80 shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membro</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Permissão</TableHead>
              <TableHead className="text-center">Resp.</TableHead>
              <TableHead className="text-center">Líder</TableHead>
              <TableHead>Última atividade</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum membro nesta visão.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((m) => {
              const pendente = m.status_convite === "pendente";
              return (
                <TableRow key={m.id} className={m.ativo ? "" : "opacity-50"}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                        {initials(m.nome_completo)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {m.nome_completo}
                          </p>
                          {pendente && (
                            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                              Convite pendente
                            </Badge>
                          )}
                        </div>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" /> {m.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.cargo ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ROLE_TONE[m.role]}>
                      {ROLE_LABEL[m.role]}
                    </Badge>
                    {!m.ativo && (
                      <Badge variant="outline" className="ml-2 border-destructive/30 bg-destructive/10 text-destructive">
                        Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{m.projetos_responsavel}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{m.projetos_lider}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(m.ultima_atividade)}</TableCell>
                  <TableCell className="text-right">
                    {isAdmin && pendente && (
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => copyMut.mutate(m.id)}
                          disabled={copyMut.isPending}
                        >
                          <Link2 className="h-3.5 w-3.5" /> Copiar link
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => resendMut.mutate(m.id)}
                          disabled={resendMut.isPending}
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Reenviar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Cancelar convite de ${m.nome_completo}?`)) cancelMut.mutate(m.id);
                          }}
                          disabled={cancelMut.isPending}
                        >
                          <X className="h-3.5 w-3.5" /> Cancelar
                        </Button>
                      </div>
                    )}
                    {isAdmin && !pendente && m.id !== profile?.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Permissão</DropdownMenuLabel>
                          <DropdownMenuRadioGroup
                            value={m.role}
                            onValueChange={(v) =>
                              roleMut.mutate({ id: m.id, role: v as TeamMember["role"] })
                            }
                          >
                            <DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="lider">Líder</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="analista">Analista</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="observador">Observador</DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                          <DropdownMenuSeparator />
                          {m.ativo ? (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => activeMut.mutate({ id: m.id, ativo: false })}
                            >
                              Desativar usuário
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => activeMut.mutate({ id: m.id, ativo: true })}>
                              Reativar usuário
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={(url, title) => {
          setInviteOpen(false);
          setLinkDialog({ url, title });
          queryClient.invalidateQueries({ queryKey: ["team"] });
        }}
      />

      <LinkDialog
        open={Boolean(linkDialog)}
        url={linkDialog?.url ?? ""}
        title={linkDialog?.title ?? ""}
        onClose={() => setLinkDialog(null)}
      />
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (url: string, title: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [role, setRole] = useState<TeamMember["role"]>("analista");

  const mut = useMutation({
    mutationFn: () =>
      inviteUser({
        data: {
          nome_completo: nome.trim(),
          email: email.trim(),
          cargo: cargo.trim(),
          role,
        },
      }),
    onSuccess: (res) => {
      onCreated(buildInviteUrl(res.token), `Convite para ${nome.trim()}`);
      setNome("");
      setEmail("");
      setCargo("");
      setRole("analista");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mut.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        {/* ========================================================= */}
        {/* HERO BANNER DO MODAL (PADRÃO BANNER EXECUTIVO DO DASHBOARD) */}
        {/* ========================================================= */}
        <div className="relative overflow-hidden bg-primary text-primary-foreground px-6 py-4.5 border-b border-primary/20 shrink-0">
          {/* Marca d'água circular oficial da Orizon */}
          <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.10] select-none">
            <img
              src="/brand/orizon-symbol.png"
              alt=""
              aria-hidden="true"
              className="h-44 w-44 rounded-full object-cover filter contrast-125"
            />
          </div>

          <div className="relative z-10 flex items-start gap-3.5 pr-12">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                  Convidar Novo Membro
                </DialogTitle>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-semibold tracking-wide text-white/90 uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>Acesso Corporativo</span>
                </span>
              </div>
              <DialogDescription className="text-xs text-white/75 font-normal leading-relaxed truncate max-w-md">
                Gera um link de uso único e temporário com alçada e perfil configurados.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Corpo do Formulário Agrupado em Card */}
        <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="rounded-xl border border-border/70 bg-secondary/25 p-4.5 space-y-3.5">
              <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary/80" />
                Dados do Usuário & Alçada
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-nome" className="text-xs font-medium text-foreground">
                  Nome completo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inv-nome"
                  required
                  placeholder="Ex.: Carlos Mendes"
                  className="rounded-xl bg-background border-border/80 focus-visible:ring-primary/25"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-email" className="text-xs font-medium text-foreground">
                  E-mail corporativo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inv-email"
                  type="email"
                  required
                  placeholder="carlos.mendes@orizonvr.com.br"
                  className="rounded-xl bg-background border-border/80 focus-visible:ring-primary/25"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-cargo" className="text-xs font-medium text-foreground">
                    Cargo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="inv-cargo"
                    required
                    placeholder="Ex.: Analista de M&A"
                    className="rounded-xl bg-background border-border/80 focus-visible:ring-primary/25"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-foreground">
                    Perfil de Permissão <span className="text-destructive">*</span>
                  </Label>
                  <Select value={role} onValueChange={(v) => setRole(v as TeamMember["role"])}>
                    <SelectTrigger className="rounded-xl bg-background border-border/80 focus:ring-primary/25">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="lider">Líder de Negócios</SelectItem>
                      <SelectItem value="analista">Analista</SelectItem>
                      <SelectItem value="observador">Observador (Leitura)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Fixo */}
          <div className="p-4 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-border/80 hover:bg-secondary/60 cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mut.isPending}
              className="rounded-xl font-medium shadow-xs cursor-pointer gap-2"
            >
              {mut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando…
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Gerar convite
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LinkDialog({
  open,
  url,
  title,
  onClose,
}: {
  open: boolean;
  url: string;
  title: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Falha ao copiar link.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        {/* ========================================================= */}
        {/* HERO BANNER DO MODAL (PADRÃO BANNER EXECUTIVO DO DASHBOARD) */}
        {/* ========================================================= */}
        <div className="relative overflow-hidden bg-primary text-primary-foreground px-6 py-4.5 border-b border-primary/20 shrink-0">
          {/* Marca d'água circular oficial da Orizon */}
          <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.10] select-none">
            <img
              src="/brand/orizon-symbol.png"
              alt=""
              aria-hidden="true"
              className="h-44 w-44 rounded-full object-cover filter contrast-125"
            />
          </div>

          <div className="relative z-10 flex items-start gap-3.5 pr-12">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
              <Link2 className="h-5 w-5" />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                  {title}
                </DialogTitle>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-semibold tracking-wide text-white/90 uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>Link Ativo • 7 Dias</span>
                </span>
              </div>
              <DialogDescription className="text-xs text-white/75 font-normal leading-relaxed truncate max-w-md">
                O convidado definirá a senha de acesso pessoal ao abrir o endereço.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Corpo com Link de Compartilhamento */}
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-border/70 bg-secondary/25 p-4 space-y-3">
            <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center justify-between">
              <span>Link Exclusivo de Primeiro Acesso</span>
              <span className="text-[10px] font-normal text-muted-foreground/80">Uso único</span>
            </div>

            <div className="flex w-full min-w-0 items-stretch gap-2.5">
              <div
                className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border/80 bg-background/80 px-3 py-2.5 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={(e) => {
                  const selection = window.getSelection();
                  const range = document.createRange();
                  range.selectNodeContents(e.currentTarget);
                  selection?.removeAllRanges();
                  selection?.addRange(range);
                }}
                title="Clique para selecionar tudo"
              >
                <code className="block overflow-x-auto whitespace-nowrap font-mono text-xs text-foreground">
                  {url}
                </code>
              </div>
              <Button
                size="sm"
                variant={copied ? "default" : "outline"}
                className={cn(
                  "shrink-0 gap-1.5 rounded-xl cursor-pointer font-medium h-auto py-2.5 px-4 shadow-2xs transition-all",
                  copied && "bg-emerald-600 hover:bg-emerald-600 text-white border-emerald-600",
                )}
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" /> Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copiar Link
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Por motivos de segurança e governança, este link de convite é de <strong>uso único</strong>. Assim que a senha for cadastrada, o token é invalidado imediatamente.
            </p>
          </div>
        </div>

        {/* Footer Fixo */}
        <div className="p-4 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-end">
          <Button
            type="button"
            className="rounded-xl font-medium shadow-xs cursor-pointer px-6"
            onClick={onClose}
          >
            Concluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
