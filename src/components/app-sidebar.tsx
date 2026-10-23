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

const pipelineItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "M&A", url: "/ma", icon: Handshake },
  { title: "Novos Negócios", url: "/novos-negocios", icon: Sprout },
];

const execucaoItems = [
  { title: "Tarefas", url: "/tarefas", icon: ListTodo, badgeKey: "tarefas" as const },
  { title: "Documentos", url: "/documentos", icon: FileText },
  { title: "Comitês", url: "/comites", icon: Gavel },
];

const adminItems = [
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
      {/* Header com altura travada em h-14: alinhamento perfeito de 56px com a Navbar */}
      <SidebarHeader className="h-14 border-b border-sidebar-border/80 p-0 flex items-center justify-center">
        <div className="flex h-14 w-full items-center px-3.5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          {/* Quando aberta: logo corporativo em branco sobre verde escuro */}
          <div className="flex items-center group-data-[collapsible=icon]:hidden min-w-0">
            <img
              src="/brand/orizon-logo.png"
              alt="OrizonVR"
              className="h-6 w-auto object-contain brightness-0 invert opacity-95"
            />
          </div>
          {/* Quando colapsada: símbolo circular oficial de 4 pétalas com anel sutil */}
          <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center w-full">
            <img
              src="/brand/orizon-symbol.png"
              alt="OrizonVR"
              className="h-8 w-8 rounded-full object-cover shrink-0 ring-1 ring-white/20 filter contrast-125"
            />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Grupo 1: Estratégia */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-wider text-emerald-200/60 uppercase">
            Estratégia & Deals
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pipelineItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Grupo 2: Execução */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-wider text-emerald-200/60 uppercase">
            Execução & Governança
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {execucaoItems.map((item) => {
                const showBadge =
                  "badgeKey" in item && item.badgeKey === "tarefas" && tarefasBadge > 0;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                        {showBadge && (
                          <span className="ml-auto inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-mono font-medium text-destructive-foreground group-data-[collapsible=icon]:hidden">
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

        {/* Grupo 3: Administração */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold tracking-wider text-emerald-200/60 uppercase">
            Administração
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer com Botão de Logout Dedicado */}
      <SidebarFooter className="border-t border-sidebar-border/80 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Encerrar Sessão"
              onClick={async () => {
                await signOut();
                toast.success("Sessão encerrada.");
                navigate({ to: "/login" });
              }}
              className="text-white/70 hover:bg-rose-500/15 hover:text-rose-200 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="group-data-[collapsible=icon]:hidden font-medium text-xs">
                Encerrar Sessão
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
