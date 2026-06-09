import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { CommandPalette } from "@/components/command-palette";
import { NotificationBell } from "@/components/notificacoes/notification-bell";
import { TarefaDrawerProvider } from "@/hooks/use-tarefa-drawer";
import { supabase } from "@/integrations/supabase/client";

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
  "/": "Dashboard",
  "/ma": "M&A",
  "/novos-negocios": "Novos Negócios",
  "/documentos": "Documentos",
  "/tarefas": "Tarefas",
  "/equipe": "Equipe",
  "/configuracoes": "Configurações",
};

function AuthenticatedLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const sectionLabel =
    PATH_LABEL[path] ??
    Object.entries(PATH_LABEL).find(([p]) => p !== "/" && path.startsWith(p))?.[1] ??
    "Painel";

  return (
    <SidebarProvider>
      <TarefaDrawerProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex flex-1 flex-col min-w-0">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
              <SidebarTrigger className="-ml-1" />
              <div className="h-5 w-px bg-border" />
              <span className="text-sm font-medium text-foreground">OrizonVR | Pipeline Alocação de Capital</span>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                / {sectionLabel}
              </span>
              <div className="ml-auto flex items-center gap-3">
                <div className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
                  <kbd className="rounded border border-border bg-background px-1.5 py-0.5">⌘</kbd>
                  <kbd className="rounded border border-border bg-background px-1.5 py-0.5">K</kbd>
                  <span className="ml-1">buscar</span>
                </div>
                <NotificationBell />
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
