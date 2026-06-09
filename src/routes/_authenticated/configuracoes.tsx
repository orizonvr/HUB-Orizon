import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Moon, Sun, User as UserIcon, Bell } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { updateOwnProfile } from "@/lib/profile-self.functions";
import { getPreferencias, updatePreferencias } from "@/lib/preferencias.functions";
import {
  DEFAULT_PREFERENCIAS,
  type PreferenciasNotificacao,
} from "@/lib/notificacoes-types";
import { colorFromName } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — OrizonVR | Pipeline Alocação de Capital" }] }),
  component: ConfigPage,
});

function ConfigPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8 md:py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
        Configurações
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gerencie seu perfil, preferências e notificações.
      </p>

      <Tabs defaultValue="perfil" className="mt-6">
        <TabsList>
          <TabsTrigger value="perfil"><UserIcon className="h-4 w-4 mr-1.5" /> Perfil</TabsTrigger>
          <TabsTrigger value="preferencias"><Sun className="h-4 w-4 mr-1.5" /> Preferências</TabsTrigger>
          <TabsTrigger value="notificacoes"><Bell className="h-4 w-4 mr-1.5" /> Notificações</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="mt-4">
          <PerfilTab />
        </TabsContent>
        <TabsContent value="preferencias" className="mt-4">
          <PreferenciasTab />
        </TabsContent>
        <TabsContent value="notificacoes" className="mt-4">
          <NotificacoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "U";
}

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
      toast.success("Perfil atualizado.");
      await refreshProfile();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canSave = nome.trim().length > 0 && cargo.trim().length > 0;

  return (
    <Card className="p-6 border-border/80 shadow-none space-y-5">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold text-white"
          style={{ backgroundColor: colorFromName(nome) }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            initialsOf(nome || "U")
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{profile?.email}</p>
          <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nome completo</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Cargo</Label>
          <Input value={cargo} onChange={(e) => setCargo(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>URL do avatar (opcional)</Label>
          <Input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => mut.mutate()} disabled={!canSave || mut.isPending}>
          {mut.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </Card>
  );
}

function PreferenciasTab() {
  const { theme, setTheme } = useTheme();
  return (
    <Card className="p-6 border-border/80 shadow-none space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Aparência</h3>
        <p className="text-xs text-muted-foreground">Escolha como o OrizonVR | Pipeline Alocação de Capital deve aparecer.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={
            "flex items-center gap-3 rounded-md border p-4 text-left transition-colors " +
            (theme === "light"
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-accent")
          }
        >
          <Sun className="h-5 w-5" />
          <div>
            <p className="text-sm font-medium">Claro</p>
            <p className="text-xs text-muted-foreground">Padrão para escritório.</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={
            "flex items-center gap-3 rounded-md border p-4 text-left transition-colors " +
            (theme === "dark"
              ? "border-primary bg-primary/5"
              : "border-border hover:bg-accent")
          }
        >
          <Moon className="h-5 w-5" />
          <div>
            <p className="text-sm font-medium">Escuro</p>
            <p className="text-xs text-muted-foreground">Ideal para reuniões e baixa luz.</p>
          </div>
        </button>
      </div>
    </Card>
  );
}

function NotificacoesTab() {
  const getPrefsFn = useServerFn(getPreferencias);
  const updatePrefsFn = useServerFn(updatePreferencias);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["minhas-preferencias"],
    queryFn: () => getPrefsFn(),
  });

  const mut = useMutation({
    mutationFn: (patch: Partial<PreferenciasNotificacao>) =>
      updatePrefsFn({ data: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["minhas-preferencias"] });
      toast.success("Preferências atualizadas.");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const prefs = q.data?.preferencias ?? DEFAULT_PREFERENCIAS;

  return (
    <Card className="p-6 border-border/80 shadow-none space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
        <p className="text-xs text-muted-foreground">
          Notificações in-app ficam sempre ativas. Aqui você escolhe o que recebe por email.
        </p>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded border border-border bg-secondary/20 p-3 opacity-70">
          <div>
            <p className="text-sm font-medium">Notificações no sino do app</p>
            <p className="text-[11px] text-muted-foreground">Sempre ligado</p>
          </div>
          <Switch checked disabled />
        </div>
        <div className="flex items-center justify-between gap-4 rounded border border-border p-3">
          <div>
            <p className="text-sm font-medium">Receber emails de notificação</p>
            <p className="text-[11px] text-muted-foreground">
              Você receberá emails quando uma tarefa for atribuída a você, quando vencer no dia seguinte ou no dia do vencimento. As notificações in-app no sino continuam ligadas independentemente.
            </p>
          </div>
          <Switch
            checked={prefs.email_notificacoes}
            disabled={mut.isPending}
            onCheckedChange={(v) =>
              mut.mutate({ email_notificacoes: v })
            }
          />
        </div>
      </div>
    </Card>
  );
}
