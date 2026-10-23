import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  UserMinus,
  MoreHorizontal,
  Mail,
  Copy,
  Check,
  Link2,
  RefreshCw,
  X,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Search,
  Filter as FilterIcon,
  RotateCcw,
  Briefcase,
  AlertTriangle,
  Building2,
  Sliders,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
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
import { avatarBgStyle } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Gestão de Equipe & Alçadas — OrizonVR | Pipeline Alocação de Capital" },
      {
        name: "description",
        content: "Gestão de colaboradores, alçadas executivas, convites institucionais e governança.",
      },
    ],
  }),
  component: EquipePage,
});

const ROLE_LABEL: Record<TeamMember["role"], string> = {
  admin: "Admin",
  lider: "Líder",
  analista: "Analista",
  observador: "Observador",
};

const ROLE_TONE: Record<TeamMember["role"], string> = {
  admin: "bg-primary/10 text-primary border-primary/25",
  lider: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  analista: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  observador: "bg-muted text-muted-foreground border-border",
};

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function buildInviteUrl(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/aceitar-convite?token=${token}`;
}

type FilterScope = "ativos" | "pendentes" | "excluidos" | "todos";

function EquipePage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const queryClient = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [filterScope, setFilterScope] = useState<FilterScope>("ativos");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [linkDialog, setLinkDialog] = useState<{ url: string; title: string } | null>(null);
  const [excludeTarget, setExcludeTarget] = useState<TeamMember | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: () => listTeam(),
  });

  const roleMut = useMutation({
    mutationFn: (args: { id: string; role: TeamMember["role"] }) =>
      updateMemberRole({ data: args }),
    onSuccess: () => {
      toast.success("Permissão atualizada.");
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Mutação para ativar/desativar (exclusão suave da lista)
  const activeMut = useMutation({
    mutationFn: (args: { id: string; ativo: boolean }) =>
      setMemberActive({ data: args }),
    onSuccess: (_data, variables) => {
      if (variables.ativo) {
        toast.success("Usuário restaurado para a lista da equipe.");
      } else {
        toast.success("Usuário removido da lista da equipe. O histórico foi preservado no banco.");
      }
      setExcludeTarget(null);
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

  // Métricas para a Faixa de KPIs
  const totalAtivos = members.filter((m) => m.ativo && m.status_convite === "ativo").length;
  const totalLiderancas = members.filter(
    (m) => m.ativo && (m.role === "admin" || m.role === "lider"),
  ).length;
  const totalPendentes = members.filter((m) => m.status_convite === "pendente").length;
  const totalExcluidos = members.filter((m) => !m.ativo).length;

  // Filtragem composta
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return members.filter((m) => {
      // 1. Filtro de escopo
      if (filterScope === "ativos") {
        if (!m.ativo || m.status_convite !== "ativo") return false;
      } else if (filterScope === "pendentes") {
        if (m.status_convite !== "pendente") return false;
      } else if (filterScope === "excluidos") {
        if (m.ativo) return false;
      }

      // 2. Filtro de alçada / role
      if (roleFilter !== "all" && m.role !== roleFilter) return false;

      // 3. Busca textual
      if (q) {
        const text = `${m.nome_completo} ${m.email} ${m.cargo ?? ""}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [members, filterScope, roleFilter, search]);

  return (
    <div className="mx-auto w-full max-w-360 px-4 py-6 md:px-8 space-y-5">
      {/* ======================================================== */}
      {/* 1. HERO BANNER EXECUTIVO INSTITUCIONAL (PADRÃO ORIZONVR)  */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground px-5 py-5 sm:px-6 sm:py-5 shadow-xs border border-primary/20">
        {/* Marca d'água oficial circular da Orizon */}
        <div className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 opacity-[0.08] dark:opacity-[0.10] select-none">
          <img
            src="/brand/orizon-symbol.png"
            alt=""
            aria-hidden="true"
            className="h-56 w-56 sm:h-64 sm:w-64 rounded-full object-cover filter contrast-125"
          />
        </div>

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Identidade Institucional & Resumo */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
              <Users className="h-6 w-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                  Gestão de Equipe & Acessos
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-medium text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>Governança & Alçadas</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/80 font-normal truncate max-w-2xl">
                {totalAtivos} colaborador{totalAtivos === 1 ? "" : "es"} ativo{totalAtivos === 1 ? "" : "s"} • {totalPendentes} convite{totalPendentes === 1 ? "" : "s"} pendente{totalPendentes === 1 ? "" : "s"} • Controle de alçadas em M&A e Novos Negócios
              </p>
            </div>
          </div>

          {/* Ações Rápidas Executivas */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isAdmin && (
              <Button
                onClick={() => setInviteOpen(true)}
                className="h-9 text-xs font-bold bg-white text-primary hover:bg-white/90 px-4 gap-1.5 rounded-xl shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
              >
                <UserPlus className="h-4 w-4 text-primary" />
                <span>Convidar Usuário</span>
              </Button>
            )}

            <Button
              asChild
              size="sm"
              variant="ghost"
              className="h-9 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white hover:text-white border border-white/20 hover:border-white/40 px-3.5 gap-1.5 rounded-xl shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
            >
              <Link to="/configuracoes">
                <Sliders className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Configurações</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. BENTO STRIP DE KPIS DA EQUIPE (PADRÃO TAREFAS/DASH)   */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Membros Ativos */}
        <Card
          onClick={() => {
            setFilterScope("ativos");
            setRoleFilter("all");
          }}
          className={cn(
            "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
            filterScope === "ativos" && roleFilter === "all" && "ring-2 ring-primary/80 border-primary bg-primary/2",
          )}
        >
          <div className="bg-primary/[0.07] dark:bg-primary/[0.14] border-b border-primary/15 px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-foreground tracking-tight">
                Membros Ativos
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                Operação
              </span>
            </div>
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-primary/20 bg-background text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-200 shadow-2xs">
              <UserCheck className="h-3 w-3" />
            </div>
          </div>
          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
              ) : (
                <div className="flex items-baseline tracking-tight">
                  <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                    {totalAtivos}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                    colaboradores
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80 truncate">
                Acesso liberado ao Hub
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
                {filterScope === "ativos" && roleFilter === "all" ? "Filtrando" : "Filtrar"}
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: Liderança & Governança */}
        <Card
          onClick={() => {
            setRoleFilter((prev) => (prev === "admin" ? "all" : "admin"));
            if (filterScope === "excluidos") setFilterScope("ativos");
          }}
          className={cn(
            "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-amber-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
            roleFilter === "admin" && "ring-2 ring-amber-500/80 border-amber-500 bg-amber-500/3",
          )}
        >
          <div className="bg-amber-500/[0.07] dark:bg-amber-500/[0.14] border-b border-amber-500/20 px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-foreground tracking-tight">
                Liderança & Governança
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                Alçadas
              </span>
            </div>
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-amber-500/25 bg-background text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-all duration-200 shadow-2xs">
              <ShieldCheck className="h-3 w-3" />
            </div>
          </div>
          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
              ) : (
                <div className="flex items-baseline tracking-tight">
                  <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                    {totalLiderancas}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                    líderes e admins
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80 truncate">
                Comitês e aprovações
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
                {roleFilter === "admin" ? "Filtrando" : "Filtrar"}
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </Card>

        {/* Card 3: Convites Pendentes */}
        <Card
          onClick={() => {
            setFilterScope("pendentes");
            setRoleFilter("all");
          }}
          className={cn(
            "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-sky-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
            filterScope === "pendentes" && "ring-2 ring-sky-500/80 border-sky-500 bg-sky-500/3",
          )}
        >
          <div className="bg-sky-500/[0.07] dark:bg-sky-500/[0.14] border-b border-sky-500/20 px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-foreground tracking-tight">
                Convites Pendentes
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                {totalPendentes > 0 ? "Aguardando" : "Em dia"}
              </span>
            </div>
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-sky-500/25 bg-background text-sky-600 dark:text-sky-400 group-hover:bg-sky-500 group-hover:text-white group-hover:border-sky-500 transition-all duration-200 shadow-2xs">
              <Clock className="h-3 w-3" />
            </div>
          </div>
          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
              ) : (
                <div className="flex items-baseline tracking-tight">
                  <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                    {totalPendentes}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                    aguardando
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80 truncate">
                Tokens de primeiro acesso
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-600 dark:text-sky-400 font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
                {filterScope === "pendentes" ? "Filtrando" : "Filtrar"}
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </Card>

        {/* Card 4: Excluídos da Lista / Inativos */}
        <Card
          onClick={() => {
            setFilterScope("excluidos");
            setRoleFilter("all");
          }}
          className={cn(
            "group relative rounded-xl border border-border/80 bg-card shadow-2xs hover:border-rose-500/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer",
            filterScope === "excluidos" && "ring-2 ring-rose-500/80 border-rose-500 bg-rose-500/3",
          )}
        >
          <div className="bg-rose-500/[0.07] dark:bg-rose-500/[0.14] border-b border-rose-500/20 px-3.5 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-foreground tracking-tight">
                Excluídos da Lista
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-background/90 text-muted-foreground border border-border/70 shadow-2xs">
                Auditoria
              </span>
            </div>
            <div className="flex h-6.5 w-6.5 items-center justify-center rounded-md border border-rose-500/25 bg-background text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white group-hover:border-rose-500 transition-all duration-200 shadow-2xs">
              <UserX className="h-3 w-3" />
            </div>
          </div>
          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-16 my-0.5 rounded-md" />
              ) : (
                <div className="flex items-baseline tracking-tight">
                  <span className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-foreground tabular-nums">
                    {totalExcluidos}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground ml-1.5 select-none">
                    arquivados
                  </span>
                </div>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/80 truncate">
                Preservados no banco
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-600 dark:text-rose-400 font-medium shrink-0 group-hover:translate-x-0.5 transition-transform">
                {filterScope === "excluidos" ? "Filtrando" : "Filtrar"}
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ======================================================== */}
      {/* 3. COCKPIT DE FILTROS & BUSCA UNIFICADA                 */}
      {/* ======================================================== */}
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-xl border border-border/80">
        {/* Segmented Tabs de Escopo */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-muted/50 rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => setFilterScope("ativos")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap",
              filterScope === "ativos"
                ? "bg-card text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Ativos <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary">{totalAtivos}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterScope("pendentes")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap",
              filterScope === "pendentes"
                ? "bg-card text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Convites <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">{totalPendentes}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterScope("excluidos")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap",
              filterScope === "excluidos"
                ? "bg-card text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Excluídos da Lista <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300">{totalExcluidos}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterScope("todos")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap",
              filterScope === "todos"
                ? "bg-card text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Todos <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground">{members.length}</span>
          </button>
        </div>

        {/* Busca e Filtro de Permissão */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou cargo..."
              className="h-8.5 pl-8 pr-7 text-xs rounded-lg border-border/80"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-8.5 text-xs w-36 rounded-lg border-border/80">
              <SelectValue placeholder="Permissão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Alçadas</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="lider">Líder</SelectItem>
              <SelectItem value="analista">Analista</SelectItem>
              <SelectItem value="observador">Observador</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. TABELA EXECUTIVA DE MEMBROS                           */}
      {/* ======================================================== */}
      <Card className="border-border/80 shadow-none overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="py-3.5 pl-5 font-semibold text-xs text-foreground">Colaborador / Membro</TableHead>
              <TableHead className="font-semibold text-xs text-foreground">Cargo Corporativo</TableHead>
              <TableHead className="font-semibold text-xs text-foreground">Alçada / Permissão</TableHead>
              <TableHead className="text-center font-semibold text-xs text-foreground">Projetos Resp.</TableHead>
              <TableHead className="text-center font-semibold text-xs text-foreground">Projetos Líder</TableHead>
              <TableHead className="font-semibold text-xs text-foreground">Última Atividade</TableHead>
              <TableHead className="pr-5 text-right font-semibold text-xs text-foreground">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-8">
                  <div className="space-y-3">
                    <Skeleton className="h-9 w-full rounded-lg" />
                    <Skeleton className="h-9 w-full rounded-lg" />
                    <Skeleton className="h-9 w-full rounded-lg" />
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-14 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                      <Users className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">Nenhum membro encontrado</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Não há colaboradores com os critérios de filtro selecionados. Tente alterar o escopo ou limpar o campo de busca.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {filtered.map((m) => {
              const pendente = m.status_convite === "pendente";
              const isSelf = m.id === profile?.id;
              const isExcluido = !m.ativo;

              return (
                <TableRow
                  key={m.id}
                  className={cn(
                    "transition-colors hover:bg-muted/30",
                    isExcluido && "bg-muted/20 opacity-70"
                  )}
                >
                  {/* Coluna 1: Colaborador */}
                  <TableCell className="py-3.5 pl-5">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-2xs overflow-hidden"
                          style={avatarBgStyle(m.nome_completo)}
                        >
                          {m.avatar_url ? (
                            <img
                              src={m.avatar_url}
                              alt={m.nome_completo}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            initials(m.nome_completo)
                          )}
                        </div>
                        {m.ativo && !pendente && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
                            title="Ativo"
                          />
                        )}
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                            {m.nome_completo}
                          </span>
                          {pendente && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 py-0 px-2"
                            >
                              Convite pendente
                            </Badge>
                          )}
                          {isExcluido && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 py-0 px-2"
                            >
                              Excluído da lista
                            </Badge>
                          )}
                          {isSelf && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium bg-primary/10 text-primary border-primary/20 py-0 px-1.5"
                            >
                              Você
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{m.email}</span>
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Coluna 2: Cargo */}
                  <TableCell className="text-xs font-medium text-foreground">
                    {m.cargo ? (
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-44">{m.cargo}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Coluna 3: Permissão */}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px] font-semibold tracking-wide capitalize",
                        ROLE_TONE[m.role]
                      )}
                    >
                      {ROLE_LABEL[m.role]}
                    </Badge>
                  </TableCell>

                  {/* Coluna 4: Responsável */}
                  <TableCell className="text-center text-xs font-semibold text-foreground tabular-nums">
                    {m.projetos_responsavel}
                  </TableCell>

                  {/* Coluna 5: Líder */}
                  <TableCell className="text-center text-xs font-semibold text-foreground tabular-nums">
                    {m.projetos_lider}
                  </TableCell>

                  {/* Coluna 6: Última atividade */}
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(m.ultima_atividade)}
                  </TableCell>

                  {/* Coluna 7: Ações */}
                  <TableCell className="pr-5 text-right">
                    {/* Ações para convite pendente */}
                    {isAdmin && pendente && (
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
                          onClick={() => copyMut.mutate(m.id)}
                          disabled={copyMut.isPending}
                          title="Copiar Link de Convite"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Copiar link</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
                          onClick={() => resendMut.mutate(m.id)}
                          disabled={resendMut.isPending}
                          title="Reenviar Convite"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Reenviar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1.5 text-xs font-medium text-destructive hover:text-destructive cursor-pointer"
                          onClick={() => {
                            if (window.confirm(`Cancelar convite de ${m.nome_completo}?`)) {
                              cancelMut.mutate(m.id);
                            }
                          }}
                          disabled={cancelMut.isPending}
                          title="Cancelar Convite"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Cancelar</span>
                        </Button>
                      </div>
                    )}

                    {/* Ações para membro cadastrado */}
                    {isAdmin && !pendente && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Opções do Colaborador"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel className="text-xs">Permissão de Alçada</DropdownMenuLabel>
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

                          {/* Se ativo: opção de Excluir da Lista */}
                          {m.ativo ? (
                            <DropdownMenuItem
                              disabled={isSelf}
                              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer font-medium"
                              onClick={() => setExcludeTarget(m)}
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Excluir da Lista
                            </DropdownMenuItem>
                          ) : (
                            /* Se inativo/excluído: opção de Restaurar para a Lista */
                            <DropdownMenuItem
                              className="text-emerald-600 dark:text-emerald-400 focus:text-emerald-700 cursor-pointer font-medium"
                              onClick={() => activeMut.mutate({ id: m.id, ativo: true })}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Restaurar para a Lista
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

      {/* ======================================================== */}
      {/* 5. MODAL DE EXCLUSÃO DA LISTA (PRESERVAÇÃO NO BANCO)     */}
      {/* ======================================================== */}
      <Dialog open={Boolean(excludeTarget)} onOpenChange={(open) => !open && setExcludeTarget(null)}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl">
          <div className="relative overflow-hidden bg-rose-700 text-white px-6 py-4.5 border-b border-rose-800">
            <div className="relative z-10 flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 border border-white/20 text-white shadow-xs">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-base font-bold text-white">
                  Excluir da Lista da Equipe?
                </DialogTitle>
                <DialogDescription className="text-xs text-white/80">
                  Esta ação suspende o operador na listagem ativa.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-3.5">
            <p className="text-xs text-foreground leading-relaxed">
              Deseja remover <strong>{excludeTarget?.nome_completo}</strong> ({excludeTarget?.email}) da lista operacional de equipe?
            </p>

            <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 text-xs text-muted-foreground space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Histórico protegido no banco de dados</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Nenhum dado será deletado do banco de dados. Projetos, tarefas anteriores, comentários e registros de auditoria continuarão íntegros e vinculados ao usuário. O usuário poderá ser restaurado a qualquer momento na aba <strong>&quot;Excluídos da Lista&quot;</strong>.
              </p>
            </div>
          </div>

          <DialogFooter className="p-4 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="text-xs cursor-pointer"
              onClick={() => setExcludeTarget(null)}
              disabled={activeMut.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
              onClick={() => {
                if (excludeTarget) {
                  activeMut.mutate({ id: excludeTarget.id, ativo: false });
                }
              }}
              disabled={activeMut.isPending}
            >
              {activeMut.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <UserMinus className="h-3.5 w-3.5" />
                  <span>Excluir da Lista</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Convidar Novo Membro */}
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={(url, title) => {
          setInviteOpen(false);
          setLinkDialog({ url, title });
          queryClient.invalidateQueries({ queryKey: ["team"] });
        }}
      />

      {/* Modal de Visualização do Link Gerado */}
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
        {/* HERO BANNER DO MODAL */}
        <div className="relative overflow-hidden bg-primary text-primary-foreground px-6 py-4.5 border-b border-primary/20 shrink-0">
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

        {/* Formulário */}
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

              <div className="space-y-1.5">
                <Label htmlFor="inv-cargo" className="text-xs font-medium text-foreground">
                  Cargo / Função <span className="text-destructive">*</span>
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
                <Label htmlFor="inv-role" className="text-xs font-medium text-foreground">
                  Alçada / Permissão <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as TeamMember["role"])}
                >
                  <SelectTrigger id="inv-role" className="rounded-xl bg-background border-border/80 text-xs">
                    <SelectValue placeholder="Selecione a alçada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (Gestão Geral & Equipe)</SelectItem>
                    <SelectItem value="lider">Líder (Gestão de Projetos & Comitês)</SelectItem>
                    <SelectItem value="analista">Analista (Execução & Tarefas)</SelectItem>
                    <SelectItem value="observador">Observador (Somente Leitura)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl text-xs"
              onClick={() => onOpenChange(false)}
              disabled={mut.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="rounded-xl text-xs font-semibold gap-1.5 shadow-xs"
              disabled={mut.isPending || !nome.trim() || !email.trim() || !cargo.trim()}
            >
              {mut.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Gerando link...</span>
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Gerar Link de Convite</span>
                </>
              )}
            </Button>
          </DialogFooter>
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
      toast.success("Link copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden rounded-2xl">
        <div className="relative overflow-hidden bg-primary text-primary-foreground px-6 py-4.5 border-b border-primary/20 shrink-0">
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
