import { createFileRoute, Outlet, redirect, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { NotificationBell } from "@/components/notificacoes/notification-bell";
import { TarefaDrawerProvider } from "@/hooks/use-tarefa-drawer";
import { supabase } from "@/integrations/supabase/client";

import { ChevronRight, Search, Settings, Users, Command, LogOut, Sun, Moon } from "lucide-react";
import { emitOpenSearch, CommandPalette } from "@/components/command-palette";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { avatarBgStyle } from "@/lib/format";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated")({
  // Skip SSR: the user session lives in the browser. SSR has no token, so it
  // would always redirect to /login and the auth-protected server fns called
  // from loaders/components would 401 during prerender.
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AuthenticatedLayout,
});

const PATH_LABEL: Record<string, string> = {
  "/": "Dashboard Executivo",
  "/ma": "Pipeline de M&A",
  "/novos-negocios": "Novos Negócios",
  "/documentos": "Dossiê & Documentos",
  "/tarefas": "Gestão de Tarefas",
  "/comites": "Comitês & Governança",
  "/equipe": "Equipe & Alçadas",
  "/configuracoes": "Configurações",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  lider: "Líder de Negócios",
  membro: "Membro da Equipe",
  visualizador: "Visualizador",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function UserNavAvatar({
  avatarUrl,
  name,
  className,
}: {
  avatarUrl?: string | null;
  name: string;
  className?: string;
}) {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [avatarUrl]);

  if (avatarUrl && !error) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setError(true)}
        className={cn("rounded-full object-cover select-none", className)}
      />
    );
  }

  return (
    <div
      style={avatarBgStyle(name)}
      className={cn("flex items-center justify-center rounded-full font-bold text-white shadow-2xs select-none", className)}
    >
      {initialsOf(name)}
    </div>
  );
}

function AuthenticatedLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();

  const sectionLabel =
    PATH_LABEL[path] ??
    Object.entries(PATH_LABEL).find(([p]) => p !== "/" && path.startsWith(p))?.[1] ??
    "Painel";

  const displayName = profile?.nome_completo || user?.email?.split("@")[0] || "Usuário";
  const displayCargo = profile?.cargo || (profile?.role ? ROLE_LABEL[profile.role] : "—");

  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <SidebarProvider>
      <TarefaDrawerProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex flex-1 flex-col min-w-0">
            {/* Header da Navbar: altura travada em h-14 para alinhamento milimétrico com a Sidebar */}
            <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm md:px-6">
              {/* Esquerda: Trigger + Separador + Breadcrumb */}
              <div className="flex items-center gap-3 shrink-0 min-w-0">
                <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground cursor-pointer" />
                <div className="h-4 w-px bg-border/70" />

                {/* Breadcrumb Executivo */}
                <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
                  <span className="font-medium text-muted-foreground/80 hover:text-foreground transition-colors shrink-0">
                    OrizonVR
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="font-semibold text-foreground tracking-tight truncate max-w-35 sm:max-w-none">
                    {sectionLabel}
                  </span>
                </nav>
              </div>

              {/* Centro: Barra de Busca Centralizada com Largura Ampliada */}
              <div className="hidden md:flex flex-1 max-w-lg mx-auto justify-center px-4">
                <button
                  type="button"
                  onClick={emitOpenSearch}
                  className="w-full max-w-md flex items-center justify-between rounded-lg border border-border/80 bg-secondary/35 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/70 hover:border-border hover:text-foreground transition-all cursor-pointer shadow-2xs group"
                  title="Abrir busca global (⌘K ou Ctrl+K)"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                    <span className="text-[12px] truncate">Buscar projetos, tarefas, pessoas...</span>
                  </div>
                  <span className="ml-3 flex items-center gap-0.5 text-[10px] font-mono font-medium text-muted-foreground/80 shrink-0">
                    <kbd className="rounded border border-border/70 bg-background/90 px-1.5 py-0.5 shadow-2xs">⌘</kbd>
                    <kbd className="rounded border border-border/70 bg-background/90 px-1.5 py-0.5 shadow-2xs">K</kbd>
                  </span>
                </button>
              </div>

              {/* Direita: Ações (Busca Mobile, Toggle de Tema, Notificações, Perfil) */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Ícone de Busca para telas móveis */}
                <button
                  type="button"
                  onClick={emitOpenSearch}
                  className="md:hidden flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                  title="Buscar (⌘K)"
                >
                  <Search className="h-4 w-4" />
                </button>

                {/* Alternador de Tema Claro/Escuro (posicionado antes do sino de notificações) */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                  title={theme === "dark" ? "Alternar para tema claro" : "Alternar para tema escuro"}
                  aria-label="Alternar tema claro/escuro"
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4 text-amber-500 transition-transform duration-200 hover:rotate-45" />
                  ) : (
                    <Moon className="h-4 w-4 text-slate-600 dark:text-slate-300 transition-transform duration-200 hover:-rotate-12" />
                  )}
                </button>

                {/* Sino de Notificações */}
                <NotificationBell />

                <div className="h-4 w-px bg-border/60 mx-0.5" />

                {/* Perfil do Usuário na Navbar (Avatar com Dropdown Modernizado) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="group relative flex items-center justify-center rounded-full p-0.5 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      title={`${displayName} (${displayCargo})`}
                    >
                      <div className="relative">
                        <UserNavAvatar
                          avatarUrl={profile?.avatar_url}
                          name={displayName}
                          className="h-8 w-8 text-xs transition-transform group-hover:scale-105 group-hover:ring-2 group-hover:ring-primary/30"
                        />
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background"
                          title="Online"
                        />
                      </div>
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="end"
                    sideOffset={8}
                    className="w-72 p-2 rounded-xl border border-border/80 bg-popover/98 backdrop-blur-md shadow-xl shadow-black/10 animate-in fade-in-0 zoom-in-95"
                  >
                    {/* Header do Perfil com Avatar Ampliado & Identidade */}
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 flex items-start gap-3 select-none">
                      <UserNavAvatar
                        avatarUrl={profile?.avatar_url}
                        name={displayName}
                        className="h-10 w-10 text-sm shrink-0"
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-foreground truncate">
                            {displayName}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Ativo
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {user?.email}
                        </span>

                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-primary/10 text-primary border border-primary/20">
                            {profile?.role ? (ROLE_LABEL[profile.role] ?? profile.role) : "Membro"}
                          </span>
                          {profile?.cargo && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-30">
                              {profile.cargo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <DropdownMenuSeparator className="my-1.5 bg-border/60" />

                    {/* Navegação e Atalhos Rápidos */}
                    <DropdownMenuItem
                      onClick={() => navigate({ to: "/configuracoes" })}
                      className="cursor-pointer py-2 px-2.5 rounded-md text-xs font-medium text-foreground hover:bg-accent flex items-center gap-2.5"
                    >
                      <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span>Configurações da Conta</span>
                        <span className="text-[10px] text-muted-foreground">Perfil, segurança e preferências</span>
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => navigate({ to: "/equipe" })}
                      className="cursor-pointer py-2 px-2.5 rounded-md text-xs font-medium text-foreground hover:bg-accent flex items-center gap-2.5"
                    >
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span>Equipe & Alçadas</span>
                        <span className="text-[10px] text-muted-foreground">Membros e governança do Hub</span>
                      </div>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={emitOpenSearch}
                      className="cursor-pointer py-2 px-2.5 rounded-md text-xs font-medium text-foreground hover:bg-accent flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <Command className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs">Paleta de Comandos</span>
                      </div>
                      <kbd className="text-[10px] font-mono font-medium text-muted-foreground/80 px-1.5 py-0.5 rounded bg-muted border border-border/80">
                        ⌘K
                      </kbd>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="my-1.5 bg-border/60" />

                    {/* Alternador Rápido de Tema */}
                    <DropdownMenuItem
                      onClick={toggleTheme}
                      className="cursor-pointer py-2 px-2.5 rounded-md text-xs font-medium text-foreground hover:bg-accent flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        {theme === "dark" ? (
                          <Sun className="h-4 w-4 text-amber-500 shrink-0" />
                        ) : (
                          <Moon className="h-4 w-4 text-slate-600 dark:text-slate-300 shrink-0" />
                        )}
                        <span className="text-xs">Tema da Interface</span>
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 border border-border/60">
                        {theme === "dark" ? "Escuro" : "Claro"}
                      </span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator className="my-1.5 bg-border/60" />

                    {/* Encerrar Sessão */}
                    <DropdownMenuItem
                      onClick={async () => {
                        await signOut();
                        toast.success("Sessão encerrada com sucesso.");
                        navigate({ to: "/login" });
                      }}
                      className="cursor-pointer py-2 px-2.5 rounded-md text-xs font-medium text-destructive focus:bg-destructive/10 focus:text-destructive flex items-center gap-2.5"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      <span>Encerrar Sessão</span>
                    </DropdownMenuItem>

                    {/* Rodapé Institucional do Hub */}
                    <div className="mt-1.5 pt-1.5 px-2 pb-0.5 flex items-center justify-between text-[10px] text-muted-foreground/60 border-t border-border/40 select-none">
                      <span className="font-medium">OrizonVR • Hub</span>
                      <span className="font-mono text-[9px]">v2.4.0</span>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
            <main className="flex-1 min-w-0">
              <Outlet />
            </main>
          </div>
        </div>
        <OnboardingDialog />
        <CommandPalette />
      </TarefaDrawerProvider>
    </SidebarProvider>
  );
}
