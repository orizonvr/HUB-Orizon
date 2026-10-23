import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sliders,
  User as UserIcon,
  LayoutDashboard,
  Bell,
  ShieldCheck,
  Info,
  Sun,
  Moon,
  Kanban,
  LayoutGrid,
  Table2,
  KeyRound,
  Copy,
  Check,
  Lock,
  LogOut,
  Building2,
  Users,
  Mail,
  Briefcase,
  Layers,
  Sparkles,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { updateOwnProfile } from "@/lib/profile-self.functions";
import { getPreferencias, updatePreferencias } from "@/lib/preferencias.functions";
import {
  DEFAULT_PREFERENCIAS,
  type PreferenciasNotificacao,
  type ViewTarefasModo,
  type EscopoTarefasPadrao,
} from "@/lib/notificacoes-types";
import { colorFromName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações & Governança — OrizonVR | Pipeline Alocação de Capital" },
      {
        name: "description",
        content: "Gerenciamento de perfil corporativo, preferências do workspace, canais de notificação e segurança de acesso.",
      },
    ],
  }),
  component: ConfigPage,
});

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador Geral",
  lider: "Líder de Transação / M&A",
  analista: "Analista de Alocação",
  observador: "Membro Observador",
};

const ROLE_BADGE_STYLE: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/25",
  lider: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  analista: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  observador: "bg-muted text-muted-foreground border-border",
};

const AVATAR_PRESETS = [
  {
    label: "Executivo 1",
    url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80",
  },
  {
    label: "Executivo 2",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&auto=format&fit=crop&q=80",
  },
  {
    label: "Executivo 3",
    url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=240&auto=format&fit=crop&q=80",
  },
  {
    label: "Executivo 4",
    url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&auto=format&fit=crop&q=80",
  },
];

function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

function ConfigPage() {
  const { profile, signOut } = useAuth();
  const isAdminOrLider = profile?.role === "admin" || profile?.role === "lider";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 space-y-6">
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
          {/* Identidade Institucional & Usuário Logado */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-12 w-12 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-xl bg-white/12 border border-white/20 text-white shadow-xs">
              <Sliders className="h-6 w-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                  Configurações & Governança
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-medium text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>Ambiente Corporativo Seguro</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white/80 font-normal truncate max-w-2xl">
                {profile?.nome_completo || "Usuário"} • {profile?.cargo || "Membro da Equipe"} •{" "}
                <span className="text-white font-medium capitalize">
                  {ROLE_LABEL[profile?.role ?? "analista"]}
                </span>
              </p>
            </div>
          </div>

          {/* Ações Rápidas Executivas */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isAdminOrLider && (
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="h-9 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white hover:text-white border border-white/20 hover:border-white/40 px-3.5 gap-1.5 rounded-xl shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
              >
                <Link to="/equipe">
                  <Users className="h-3.5 w-3.5" />
                  <span>Gestão de Equipe</span>
                </Link>
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (window.confirm("Deseja realmente encerrar sua sessão atual?")) {
                  signOut();
                }
              }}
              className="h-9 text-xs font-semibold bg-white/10 hover:bg-red-500/20 text-white hover:text-white border border-white/20 hover:border-red-400/40 px-3.5 gap-1.5 rounded-xl shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sair da Conta</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. TABS EXECUTIVAS MODERNAS                             */}
      {/* ======================================================== */}
      <Tabs defaultValue="perfil" className="space-y-5">
        <TabsList className="h-auto p-1 bg-muted/60 border border-border/80 rounded-xl grid grid-cols-2 sm:grid-cols-5 gap-1">
          <TabsTrigger
            value="perfil"
            className="flex items-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all cursor-pointer"
          >
            <UserIcon className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Perfil</span>
          </TabsTrigger>

          <TabsTrigger
            value="workspace"
            className="flex items-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all cursor-pointer"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Workspace</span>
          </TabsTrigger>

          <TabsTrigger
            value="notificacoes"
            className="flex items-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all cursor-pointer"
          >
            <Bell className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Notificações</span>
          </TabsTrigger>

          <TabsTrigger
            value="seguranca"
            className="flex items-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Segurança</span>
          </TabsTrigger>

          <TabsTrigger
            value="sistema"
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-medium rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs transition-all cursor-pointer"
          >
            <Info className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Sobre o Hub</span>
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* ABA 1: PERFIL CORPORATIVO                                */}
        {/* ======================================================== */}
        <TabsContent value="perfil" className="space-y-5 focus-visible:outline-none">
          <PerfilTab />
        </TabsContent>

        {/* ======================================================== */}
        {/* ABA 2: WORKSPACE & PRODUTIVIDADE                         */}
        {/* ======================================================== */}
        <TabsContent value="workspace" className="space-y-5 focus-visible:outline-none">
          <WorkspaceTab />
        </TabsContent>

        {/* ======================================================== */}
        {/* ABA 3: CANAIS DE NOTIFICAÇÃO                             */}
        {/* ======================================================== */}
        <TabsContent value="notificacoes" className="space-y-5 focus-visible:outline-none">
          <NotificacoesTab />
        </TabsContent>

        {/* ======================================================== */}
        {/* ABA 4: SEGURANÇA & ACESSO                                */}
        {/* ======================================================== */}
        <TabsContent value="seguranca" className="space-y-5 focus-visible:outline-none">
          <SegurancaTab />
        </TabsContent>

        {/* ======================================================== */}
        {/* ABA 5: SOBRE O HUB & GOVERNANÇA                          */}
        {/* ======================================================== */}
        <TabsContent value="sistema" className="space-y-5 focus-visible:outline-none">
          <SistemaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =================================================================
// SUBCOMPONENTE: PerfilTab
// =================================================================
function PerfilTab() {
  const { profile, refreshProfile } = useAuth();
  const updateFn = useServerFn(updateOwnProfile);

  const [nome, setNome] = useState(profile?.nome_completo ?? "");
  const [cargo, setCargo] = useState(profile?.cargo ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");

  const mut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          nome_completo: nome.trim(),
          cargo: cargo.trim(),
          avatar_url: avatarUrl.trim() || null,
        },
      }),
    onSuccess: async () => {
      toast.success("Perfil corporativo atualizado com sucesso!");
      await refreshProfile();
    },
    onError: (e) => toast.error((e as Error).message || "Falha ao atualizar perfil."),
  });

  const hasChanges =
    nome.trim() !== (profile?.nome_completo ?? "") ||
    cargo.trim() !== (profile?.cargo ?? "") ||
    avatarUrl.trim() !== (profile?.avatar_url ?? "");

  const canSave = nome.trim().length > 0 && cargo.trim().length > 0 && hasChanges;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Cartão de Resumo Executivo / Preview */}
      <Card className="p-6 border-border/80 shadow-none space-y-6 flex flex-col justify-between bg-card">
        <div className="space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Visualização Corporativa
            </span>
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-medium capitalize text-center justify-center leading-tight py-1 px-2.5",
                ROLE_BADGE_STYLE[profile?.role ?? "analista"]
              )}
            >
              {ROLE_LABEL[profile?.role ?? "analista"]}
            </Badge>
          </div>

          <div className="flex flex-col items-center text-center space-y-3.5">
            <div className="relative">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-md border-2 border-border/60 overflow-hidden"
                style={{ backgroundColor: colorFromName(nome || "Orizon") }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={nome}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  initialsOf(nome || "U")
                )}
              </div>
              <span
                className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-card ring-1 ring-emerald-500/30"
                title="Usuário Ativo"
              />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground leading-snug">
                {nome || "Seu Nome Completo"}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <Briefcase className="h-3 w-3" />
                <span>{cargo || "Seu Cargo Corporativo"}</span>
              </p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <Mail className="h-3 w-3" />
                <span>{profile?.email}</span>
              </p>
            </div>
          </div>

          {/* Presets Rápidos de Fotos Executivas */}
          <div className="pt-2 space-y-2">
            <Label className="text-[11px] font-medium text-muted-foreground">
              Sugestões de Avatar Executivo
            </Label>
            <div className="flex items-center justify-center gap-2">
              {AVATAR_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatarUrl(preset.url)}
                  title={preset.label}
                  className={cn(
                    "h-9 w-9 rounded-full overflow-hidden border-2 transition-all hover:scale-105 cursor-pointer",
                    avatarUrl === preset.url
                      ? "border-primary ring-2 ring-primary/20 scale-105"
                      : "border-border/80 opacity-75 hover:opacity-100"
                  )}
                >
                  <img src={preset.url} alt={preset.label} className="h-full w-full object-cover" />
                </button>
              ))}
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAvatarUrl("")}
                  className="h-8 text-[11px] px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Usar Iniciais
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-muted/40 p-3 border border-border/50 text-[11px] text-muted-foreground">
          Sua foto e identificação corporativa são visíveis para os membros das transações nos módulos de M&A, Novos Negócios e Comitês.
        </div>
      </Card>

      {/* Formulário de Edição */}
      <Card className="p-6 border-border/80 shadow-none space-y-5 lg:col-span-2 bg-card">
        <div>
          <h2 className="text-base font-semibold text-foreground">Dados de Identificação</h2>
          <p className="text-xs text-muted-foreground">
            Atualize suas informações cadastrais exibidas para o comitê de investimentos e equipes de projeto.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome Completo</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Ana Beatriz Silva"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cargo">Cargo / Posição</Label>
            <Input
              id="cargo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ex: Diretor de M&A e Expansão"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="avatarUrl">URL da Foto de Perfil (Opcional)</Label>
            <Input
              id="avatarUrl"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://exemplo.com/sua-foto.jpg"
            />
            <p className="text-[11px] text-muted-foreground">
              Insira o link direto de uma imagem corporativa ou selecione uma das opções rápidas ao lado.
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2 pt-2 border-t border-border/60">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-muted-foreground" /> E-mail Institucional
                </span>
                <p className="text-sm font-semibold text-foreground">{profile?.email}</p>
                <span className="text-[10px] text-muted-foreground">
                  Gerenciado via autenticação corporativa Supabase.
                </span>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 text-muted-foreground" /> Perfil de Governança
                </span>
                <p className="text-sm font-semibold text-foreground capitalize">
                  {ROLE_LABEL[profile?.role ?? "analista"]}
                </p>
                <span className="text-[10px] text-muted-foreground">
                  Permissões atribuídas pelo Administrador Geral da Orizon.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border/60">
          <p className="text-xs text-muted-foreground">
            {hasChanges ? "Existem alterações não salvas." : "Dados sincronizados com o banco de dados."}
          </p>

          <Button
            onClick={() => mut.mutate()}
            disabled={!canSave || mut.isPending}
            className="font-medium gap-2 cursor-pointer shadow-xs"
          >
            {mut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Salvar Alterações</span>
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// =================================================================
// SUBCOMPONENTE: WorkspaceTab
// =================================================================
function WorkspaceTab() {
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();

  const getPrefsFn = useServerFn(getPreferencias);
  const updatePrefsFn = useServerFn(updatePreferencias);

  const q = useQuery({
    queryKey: ["preferencias"],
    queryFn: () => getPrefsFn(),
  });

  const mut = useMutation({
    mutationFn: (patch: Partial<PreferenciasNotificacao>) => updatePrefsFn({ data: patch }),
    onSuccess: (data) => {
      qc.setQueryData(["preferencias"], data);
      toast.success("Preferência de workspace atualizada!");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const prefs = q.data?.preferencias ?? DEFAULT_PREFERENCIAS;

  return (
    <div className="space-y-6">
      {/* 1. SELEÇÃO DE TEMA DO SISTEMA */}
      <Card className="p-6 border-border/80 shadow-none space-y-4 bg-card">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sun className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Aparência do Hub</h2>
              <p className="text-xs text-muted-foreground">
                Personalize o contraste visual de acordo com o seu ambiente de trabalho e iluminação.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Opção Claro */}
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={cn(
              "relative flex flex-col p-4 rounded-xl border-2 text-left transition-all hover:border-primary/60 cursor-pointer group",
              theme === "light"
                ? "border-primary bg-primary/4 shadow-xs"
                : "border-border/80 bg-background/50 hover:bg-muted/40"
            )}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Sun className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Tema Claro</p>
                  <p className="text-xs text-muted-foreground">Ideal para ambiente diurno e escritório</p>
                </div>
              </div>
              {theme === "light" && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>

            {/* Ilustração mini da interface clara */}
            <div className="w-full h-20 rounded-lg border border-border/60 bg-white p-2.5 flex flex-col justify-between shadow-2xs overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="h-2 w-12 rounded bg-emerald-800" />
                <div className="h-2 w-5 rounded bg-slate-300" />
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-3/4 rounded bg-slate-200" />
                <div className="h-2 w-1/2 rounded bg-slate-100" />
              </div>
              <div className="flex gap-1.5">
                <div className="h-2.5 w-7 rounded bg-emerald-700/20" />
                <div className="h-2.5 w-7 rounded bg-slate-100" />
              </div>
            </div>
          </button>

          {/* Opção Escuro */}
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={cn(
              "relative flex flex-col p-4 rounded-xl border-2 text-left transition-all hover:border-primary/60 cursor-pointer group",
              theme === "dark"
                ? "border-primary bg-primary/4 shadow-xs"
                : "border-border/80 bg-background/50 hover:bg-muted/40"
            )}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Moon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Tema Escuro</p>
                  <p className="text-xs text-muted-foreground">Ideal para reuniões, salas executivas e baixa luz</p>
                </div>
              </div>
              {theme === "dark" && (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
            </div>

            {/* Ilustração mini da interface escura */}
            <div className="w-full h-20 rounded-lg border border-slate-700/70 bg-slate-900 p-2.5 flex flex-col justify-between shadow-2xs overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="h-2 w-12 rounded bg-emerald-500" />
                <div className="h-2 w-5 rounded bg-slate-700" />
              </div>
              <div className="space-y-1.5">
                <div className="h-2 w-3/4 rounded bg-slate-700" />
                <div className="h-2 w-1/2 rounded bg-slate-800" />
              </div>
              <div className="flex gap-1.5">
                <div className="h-2.5 w-7 rounded bg-emerald-500/30" />
                <div className="h-2.5 w-7 rounded bg-slate-800" />
              </div>
            </div>
          </button>
        </div>
      </Card>

      {/* 2. VISUALIZAÇÃO PADRÃO DE TAREFAS */}
      <Card className="p-6 border-border/80 shadow-none space-y-4 bg-card">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Visualização Padrão das Entregas & Tarefas</h2>
              <p className="text-xs text-muted-foreground">
                Defina o formato de visualização inicial que será carregado ao acessar o módulo de Gestão de Tarefas.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Opção Kanban */}
          <button
            type="button"
            onClick={() => mut.mutate({ view_tarefas_modo: "kanban" })}
            className={cn(
              "relative flex flex-col p-4 rounded-xl border-2 text-left transition-all hover:border-primary/60 cursor-pointer",
              prefs.view_tarefas_modo === "kanban"
                ? "border-primary bg-primary/4 shadow-xs"
                : "border-border/80 bg-background/50 hover:bg-muted/40"
            )}
          >
            <div className="flex items-center justify-between w-full mb-2.5">
              <div className="flex items-center gap-2">
                <Kanban className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Quadro Kanban</span>
              </div>
              {prefs.view_tarefas_modo === "kanban" && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                  Ativo
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Colunas ágeis organizadas por status: Pendentes, Em Andamento e Concluídas.
            </p>
            <div className="mt-auto h-12 w-full rounded border border-border/60 bg-muted/30 p-1.5 flex gap-1.5">
              <div className="flex-1 bg-card rounded border border-border/40 p-1 flex flex-col gap-1">
                <div className="h-1.5 w-full bg-slate-300 dark:bg-slate-700 rounded" />
                <div className="h-1.5 w-2/3 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
              <div className="flex-1 bg-card rounded border border-border/40 p-1 flex flex-col gap-1">
                <div className="h-1.5 w-full bg-slate-300 dark:bg-slate-700 rounded" />
              </div>
              <div className="flex-1 bg-card rounded border border-border/40 p-1 flex flex-col gap-1">
                <div className="h-1.5 w-full bg-emerald-500/40 rounded" />
              </div>
            </div>
          </button>

          {/* Opção Cards */}
          <button
            type="button"
            onClick={() => mut.mutate({ view_tarefas_modo: "cards" })}
            className={cn(
              "relative flex flex-col p-4 rounded-xl border-2 text-left transition-all hover:border-primary/60 cursor-pointer",
              prefs.view_tarefas_modo === "cards"
                ? "border-primary bg-primary/4 shadow-xs"
                : "border-border/80 bg-background/50 hover:bg-muted/40"
            )}
          >
            <div className="flex items-center justify-between w-full mb-2.5">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Cartões Executivos</span>
              </div>
              {prefs.view_tarefas_modo === "cards" && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                  Ativo
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Grid responsivo focado em detalhes rápidos, tags de projeto, prazos e responsáveis.
            </p>
            <div className="mt-auto h-12 w-full rounded border border-border/60 bg-muted/30 p-1.5 grid grid-cols-2 gap-1.5">
              <div className="bg-card rounded border border-border/40 p-1 flex flex-col justify-between">
                <div className="h-1.5 w-full bg-slate-300 dark:bg-slate-700 rounded" />
                <div className="h-1 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
              <div className="bg-card rounded border border-border/40 p-1 flex flex-col justify-between">
                <div className="h-1.5 w-full bg-slate-300 dark:bg-slate-700 rounded" />
                <div className="h-1 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            </div>
          </button>

          {/* Opção Tabela */}
          <button
            type="button"
            onClick={() => mut.mutate({ view_tarefas_modo: "tabela" })}
            className={cn(
              "relative flex flex-col p-4 rounded-xl border-2 text-left transition-all hover:border-primary/60 cursor-pointer",
              prefs.view_tarefas_modo === "tabela"
                ? "border-primary bg-primary/4 shadow-xs"
                : "border-border/80 bg-background/50 hover:bg-muted/40"
            )}
          >
            <div className="flex items-center justify-between w-full mb-2.5">
              <div className="flex items-center gap-2">
                <Table2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Tabela Dinâmica</span>
              </div>
              {prefs.view_tarefas_modo === "tabela" && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                  Ativo
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Visão densa em formato de planilha executiva, otimizada para triagem em massa e auditoria.
            </p>
            <div className="mt-auto h-12 w-full rounded border border-border/60 bg-muted/30 p-1.5 flex flex-col justify-around">
              <div className="h-1.5 w-full bg-slate-300 dark:bg-slate-700 rounded" />
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          </button>
        </div>
      </Card>

      {/* 3. ESCOPO PREFERENCIAL DE INICIALIZAÇÃO */}
      <Card className="p-6 border-border/80 shadow-none space-y-4 bg-card">
        <div>
          <h2 className="text-base font-semibold text-foreground">Escopo Padrão de Tarefas</h2>
          <p className="text-xs text-muted-foreground">
            Escolha qual grupo de tarefas deve aparecer automaticamente ao abrir a página.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {[
            { id: "minhas" as EscopoTarefasPadrao, title: "Minhas Tarefas", desc: "Foco individual apenas nas entregas sob sua responsabilidade." },
            { id: "time" as EscopoTarefasPadrao, title: "Do Time", desc: "Visão colaborativa da equipe (recomendado para gestores)." },
            { id: "todas" as EscopoTarefasPadrao, title: "Todas da Organização", desc: "Visão global consolidada de todos os projetos do pipeline." },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => mut.mutate({ escopo_padrao_tarefas: item.id })}
              className={cn(
                "p-3.5 rounded-lg border text-left transition-all cursor-pointer",
                prefs.escopo_padrao_tarefas === item.id
                  ? "border-primary bg-primary/5 shadow-2xs font-medium"
                  : "border-border/70 hover:bg-muted/30"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-foreground">{item.title}</span>
                {prefs.escopo_padrao_tarefas === item.id && (
                  <Check className="h-3.5 w-3.5 text-primary" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">{item.desc}</p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

// =================================================================
// SUBCOMPONENTE: NotificacoesTab
// =================================================================
function NotificacoesTab() {
  const qc = useQueryClient();
  const getPrefsFn = useServerFn(getPreferencias);
  const updatePrefsFn = useServerFn(updatePreferencias);

  const q = useQuery({
    queryKey: ["preferencias"],
    queryFn: () => getPrefsFn(),
  });

  const mut = useMutation({
    mutationFn: (patch: Partial<PreferenciasNotificacao>) => updatePrefsFn({ data: patch }),
    onSuccess: (data) => {
      qc.setQueryData(["preferencias"], data);
      toast.success("Preferências de notificação salvas.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const prefs = q.data?.preferencias ?? DEFAULT_PREFERENCIAS;

  return (
    <div className="space-y-6">
      {/* 1. NOTIFICAÇÕES IN-APP (SINO) */}
      <Card className="p-6 border-border/80 shadow-none space-y-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Alertas no Sino do Topbar (In-App)</h2>
              <p className="text-xs text-muted-foreground">
                Notificações instantâneas na barra superior do sistema durante sua navegação.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
            Sempre Ativo
          </Badge>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">Sino Central de Notificações</p>
              <p className="text-xs text-muted-foreground">
                Garante que alertas de prazos críticos, novas reuniões de comitê e transferências de projetos nunca passem despercebidos.
              </p>
            </div>
            <Switch checked disabled className="opacity-80" />
          </div>
        </div>
      </Card>

      {/* 2. NOTIFICAÇÕES POR E-MAIL */}
      <Card className="p-6 border-border/80 shadow-none space-y-5 bg-card">
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Canais de E-mail Corporativo</h2>
              <p className="text-xs text-muted-foreground">
                Controle granular de comunicados enviados para seu e-mail institucional.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
              Receber E-mails
            </span>
            <Switch
              checked={prefs.email_notificacoes}
              disabled={mut.isPending}
              onCheckedChange={(val) => mut.mutate({ email_notificacoes: val })}
            />
          </div>
        </div>

        {/* Sub-canais de e-mail */}
        <div className={cn("space-y-3.5 transition-opacity", !prefs.email_notificacoes && "opacity-40 pointer-events-none")}>
          {/* Alerta de atribuição */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4 bg-background/50 hover:bg-muted/20 transition-colors">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">Nova Tarefa Atribuída</p>
              <p className="text-xs text-muted-foreground">
                Envio imediato quando um líder ou colega de projeto incluir você como responsável por uma entrega.
              </p>
            </div>
            <Switch
              checked={prefs.email_tarefa_atribuida}
              disabled={!prefs.email_notificacoes || mut.isPending}
              onCheckedChange={(val) => mut.mutate({ email_tarefa_atribuida: val })}
            />
          </div>

          {/* Alerta de proximidade de vencimento */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4 bg-background/50 hover:bg-muted/20 transition-colors">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">Alertas de Proximidade de Vencimento</p>
              <p className="text-xs text-muted-foreground">
                Notificação automática disparada 1 dia antes e na manhã do vencimento para prazos não concluídos.
              </p>
            </div>
            <Switch
              checked={prefs.email_tarefa_vencendo}
              disabled={!prefs.email_notificacoes || mut.isPending}
              onCheckedChange={(val) => mut.mutate({ email_tarefa_vencendo: val })}
            />
          </div>

          {/* Resumo semanal */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-4 bg-background/50 hover:bg-muted/20 transition-colors">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">Resumo Semanal do Pipeline (Digest)</p>
              <p className="text-xs text-muted-foreground">
                Boletim executivo toda segunda-feira às 08:00 com os marcos prioritários da semana para o comitê.
              </p>
            </div>
            <Switch
              checked={prefs.email_resumo_semanal}
              disabled={!prefs.email_notificacoes || mut.isPending}
              onCheckedChange={(val) => mut.mutate({ email_resumo_semanal: val })}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

// =================================================================
// SUBCOMPONENTE: SegurancaTab
// =================================================================
function SegurancaTab() {
  const { user, profile } = useAuth();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loadingSenha, setLoadingSenha] = useState(false);
  const [loadingResetEmail, setLoadingResetEmail] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  const handleUpdatePassword = async () => {
    if (novaSenha.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmacao) {
      toast.error("A confirmação não coincide com a nova senha digitada.");
      return;
    }

    setLoadingSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
      toast.success("Sua senha corporativa foi atualizada com sucesso!");
      setNovaSenha("");
      setConfirmacao("");
    } catch (err) {
      toast.error((err as Error).message || "Erro ao atualizar senha.");
    } finally {
      setLoadingSenha(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!profile?.email) return;
    setLoadingResetEmail(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/configuracoes`,
      });
      if (error) throw error;
      toast.success(`E-mail de redefinição enviado para ${profile.email}`);
    } catch (err) {
      toast.error((err as Error).message || "Erro ao solicitar e-mail de redefinição.");
    } finally {
      setLoadingResetEmail(false);
    }
  };

  const copyUidToClipboard = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedUid(true);
      toast.info("ID de usuário copiado para a área de transferência.");
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. STATUS DE CREDENCIAIS & AUTENTICAÇÃO */}
      <Card className="p-6 border-border/80 shadow-none space-y-5 bg-card">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Sessão & Identidade Criptográfica</h2>
            <p className="text-xs text-muted-foreground">
              Parâmetros de autenticação gerenciados sob a arquitetura de segurança Supabase Auth & RLS.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">Provedor de Acesso</span>
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span>Supabase Auth (E-mail)</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Token JWT criptografado com rotação contínua.</p>
          </div>

          <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">Nível de Acesso RLS</span>
            <p className="text-sm font-semibold text-foreground capitalize">
              {profile?.role ?? "analista"}
            </p>
            <p className="text-[10px] text-muted-foreground">Políticas Row-Level Security ativas no banco.</p>
          </div>

          <div className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">ID do Usuário (UUID)</span>
            <div className="flex items-center justify-between gap-2">
              <code className="text-xs text-foreground font-mono truncate">{user?.id || "—"}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyUidToClipboard}
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Copiar ID"
              >
                {copiedUid ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">Identificador único do operador.</p>
          </div>
        </div>
      </Card>

      {/* 2. ALTERAÇÃO DE SENHA */}
      <Card className="p-6 border-border/80 shadow-none space-y-5 bg-card">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Alteração de Senha</h2>
              <p className="text-xs text-muted-foreground">
                Defina uma nova senha para acessar sua conta corporativa na plataforma.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="novaSenha">Nova Senha</Label>
            <Input
              id="novaSenha"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="••••••••••••"
            />
            <p className="text-[10px] text-muted-foreground">Mínimo de 6 caracteres recomendando letras e números.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmacao">Confirmar Nova Senha</Label>
            <Input
              id="confirmacao"
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder="••••••••••••"
            />
            <p className="text-[10px] text-muted-foreground">Repita exatamente a mesma senha digitada.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border/60">
          <Button
            onClick={handleUpdatePassword}
            disabled={!novaSenha || !confirmacao || loadingSenha}
            className="font-medium gap-2 cursor-pointer shadow-xs"
          >
            {loadingSenha ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Atualizando...</span>
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                <span>Atualizar Senha Agora</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleSendResetEmail}
            disabled={loadingResetEmail}
            className="text-xs cursor-pointer"
          >
            {loadingResetEmail ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                <span>Enviando link...</span>
              </>
            ) : (
              <span>Enviar link de recuperação por e-mail</span>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// =================================================================
// SUBCOMPONENTE: SistemaTab
// =================================================================
function SistemaTab() {
  return (
    <div className="space-y-6">
      <Card className="p-6 border-border/80 shadow-none space-y-5 bg-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              Hub OrizonVR — Pipeline de Alocação de Capital
            </h2>
            <p className="text-xs text-muted-foreground">
              Plataforma institucional de gestão estratégica de Fusões & Aquisições (M&A) e Novos Negócios.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Versão do Sistema</span>
            <p className="text-sm font-semibold text-foreground">v2.4.0 (Out/2026)</p>
            <p className="text-[10px] text-muted-foreground">Arquitetura TanStack Start + SSR</p>
          </div>

          <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Base de Dados</span>
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>PostgreSQL & RLS</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Sincronização em tempo real</p>
          </div>

          <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Conformidade</span>
            <p className="text-sm font-semibold text-foreground">LGPD & SOX Ready</p>
            <p className="text-[10px] text-muted-foreground">Rastreabilidade completa de auditoria</p>
          </div>

          <div className="p-3.5 rounded-xl border border-border/70 bg-muted/20 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Ambiente</span>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 font-mono">PRODUÇÃO</p>
            <p className="text-[10px] text-muted-foreground">Segurança HTTPS/TLS 1.3</p>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/3 p-4 space-y-2 mt-4">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs sm:text-sm">
            <Sparkles className="h-4 w-4" />
            <span>Diretrizes de Governança e Confidencialidade OrizonVR</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            As informações contidas neste sistema relativas a pipelines de transações, comitês de alocação de capital e teses de investimento constituem informações confidenciais e estratégicas da <strong>Orizon Valorização de Resíduos</strong>. O acesso e as decisões registradas são auditados periodicamente conforme a política corporativa de segurança da informação.
          </p>
        </div>
      </Card>
    </div>
  );
}
