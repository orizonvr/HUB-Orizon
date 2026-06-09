import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Handshake,
  Sprout,
  FileText,
  Users,
  Settings,
  ChevronsUpDown,
  LogOut,
  UserCog,
  ListTodo,
  Gavel,
} from "lucide-react";
import { contarAlertasTarefas } from "@/lib/tarefas.functions";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { avatarBgStyle } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "M&A", url: "/ma", icon: Handshake },
  { title: "Novos Negócios", url: "/novos-negocios", icon: Sprout },
];

const workspaceItems = [
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Tarefas", url: "/tarefas", icon: ListTodo, badgeKey: "tarefas" as const },
  { title: "Comitês", url: "/comites", icon: Gavel },
  { title: "Equipe", url: "/equipe", icon: Users },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "U";
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  lider: "Líder",
  analista: "Analista",
  observador: "Observador",
};

export function AppSidebar() {
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });
  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  const alertasFn = useServerFn(contarAlertasTarefas);
  const alertasQ = useQuery({
    queryKey: ["alertas-tarefas"],
    queryFn: () => alertasFn(),
    enabled: !!user,
    refetchOnWindowFocus: true,
  });
  const tarefasBadge = alertasQ.data?.count ?? 0;

  const displayName = profile?.nome_completo || user?.email?.split("@")[0] || "Usuário";
  const displayCargo = profile?.cargo || (profile?.role ? ROLE_LABEL[profile.role] : "—");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-sm font-semibold tracking-tight">O</span>
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              OrizonVR
            </span>
            <span className="text-[11px] text-muted-foreground">Pipeline Alocação de Capital</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Pipeline</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {workspaceItems.map((item) => {
                const showBadge =
                  "badgeKey" in item && item.badgeKey === "tarefas" && tarefasBadge > 0;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {showBadge && (
                          <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                            {tarefasBadge > 99 ? "99+" : tarefasBadge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={displayName}
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                    style={avatarBgStyle(displayName)}
                  >
                    {initialsOf(displayName)}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col leading-tight text-left">
                    <span className="truncate text-sm font-medium text-sidebar-foreground">
                      {displayName}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {displayCargo}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{displayName}</span>
                    <span className="text-xs text-muted-foreground">{user?.email}</span>
                    {profile?.role && (
                      <span className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {ROLE_LABEL[profile.role]}
                      </span>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/configuracoes" })}>
                  <UserCog className="mr-2 h-4 w-4" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    toast.success("Sessão encerrada.");
                    navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
