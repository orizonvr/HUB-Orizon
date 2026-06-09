import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite, previewInvite } from "@/lib/convites.functions";

const search = z.object({ token: z.string().uuid().optional() });

export const Route = createFileRoute("/aceitar-convite")({
  head: () => ({ meta: [{ title: "Aceitar convite — OrizonVR | Pipeline Alocação de Capital" }] }),
  validateSearch: (s) => search.parse(s),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: AceitarConvitePage,
});

function AceitarConvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const preview = useQuery({
    queryKey: ["invite-preview", token],
    queryFn: () => previewInvite({ data: { token: token! } }),
    enabled: Boolean(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: async () => {
      const res = await acceptInvite({ data: { token: token!, password } });
      const { error } = await supabase.auth.signInWithPassword({
        email: res.email,
        password,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Acesso criado. Bem-vindo!");
      navigate({ to: "/" });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  useEffect(() => {
    if (!token) toast.error("Token de convite ausente.");
  }, [token]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Senha precisa de pelo menos 8 caracteres.");
    if (password !== confirm) return toast.error("As senhas não conferem.");
    accept.mutate();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm border-border/80 p-7 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <span className="text-sm font-semibold">O</span>
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">OrizonVR | Pipeline Alocação de Capital</p>
            <p className="text-[11px] text-muted-foreground">Aceitar convite</p>
          </div>
        </div>

        {!token || preview.isLoading ? (
          <div className="mt-8 flex items-center justify-center text-sm text-muted-foreground">
            {preview.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Token ausente."}
          </div>
        ) : !preview.data?.valid ? (
          <InvalidState reason={preview.data?.reason ?? "inexistente"} />
        ) : (
          <>
            <h1 className="mt-6 text-xl font-semibold tracking-tight">
              Bem-vindo à OrizonVR | Pipeline Alocação de Capital
            </h1>
            <p className="mt-2 text-sm text-foreground">
              <span className="font-medium">{preview.data.nome_completo}</span>{" "}
              <span className="text-muted-foreground">({preview.data.email})</span>
              {preview.data.cargo ? ` — ${preview.data.cargo}` : ""}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Defina sua senha pra entrar:</p>

            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha (mínimo 8 caracteres)</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={accept.isPending}>
                {accept.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar acesso
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}

function InvalidState({ reason }: { reason: "expirado" | "usado" | "inexistente" }) {
  const msg = {
    expirado: "Este convite expirou. Peça um novo ao admin da sua equipe.",
    usado: "Este convite já foi utilizado. Vá para o login.",
    inexistente: "Convite inválido. Verifique o link recebido.",
  }[reason];
  return (
    <div className="mt-8 text-sm">
      <p className="text-foreground">{msg}</p>
      <Link
        to="/login"
        className="mt-4 inline-flex font-medium text-primary hover:underline"
      >
        Ir para o login
      </Link>
    </div>
  );
}
