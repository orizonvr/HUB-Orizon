import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  TrendingUp,
  Leaf,
  ArrowRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — OrizonVR | Pipeline Alocação de Capital" },
      {
        name: "description",
        content: "Acesso corporativo ao Hub de Alocação de Capital da OrizonVR.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Por favor, preencha seu e-mail e senha.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Autenticação realizada com sucesso.", {
        description: "Redirecionando para o painel executivo...",
      });
      navigate({ to: "/" });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível conectar ao servidor de autenticação.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col lg:flex-row overflow-x-hidden bg-background">
      {/* ========================================================= */}
      {/* COLUNA ESQUERDA: Showcase Institucional OrizonVR          */}
      {/* ========================================================= */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-[54%] flex-col justify-between p-10 xl:p-14 bg-linear-to-br from-[#12241C] via-[#1A3427] to-[#0E1D16] text-white overflow-hidden selection:bg-emerald-500/30 animate-fade-in-left">
        {/* Iluminação e Atmosfera Visual com Pulsação Suave */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-136 w-136 rounded-full bg-emerald-500/20 blur-[120px] animate-pulse-glow" />
        <div className="pointer-events-none absolute -bottom-32 -right-24 h-120 w-120 rounded-full bg-[#5C7A54]/25 blur-[130px] animate-pulse-glow animation-delay-400" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-white/3 to-transparent" />

        {/* Marca d'água animada ao fundo (Símbolo de 4 pétalas com Rotação Ultra-Lenta) */}
        <div className="pointer-events-none absolute top-1/2 right-[-10%] -translate-y-1/2 opacity-[0.07] select-none animate-spin-ultra-slow">
          <img
            src="/brand/orizon-symbol.png"
            alt=""
            aria-hidden="true"
            className="h-184 w-184 rounded-full object-cover filter contrast-125"
          />
        </div>

        {/* Topo: Logo Corporativo Oficial em Moldura Glassmorphism */}
        <div className="relative z-10 animate-fade-in-down animation-delay-100">
          <div className="inline-flex items-center gap-3.5 bg-white/95 dark:bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl shadow-black/20 border border-white/20 transition-transform duration-300 hover:scale-[1.02]">
            <img
              src="/brand/orizon-logo.png"
              alt="Orizon Valorização de Resíduos"
              className="h-9 w-auto object-contain"
            />
          </div>
        </div>

        {/* Centro: Título de Impacto & Cards de Pilares Estratégicos */}
        <div className="relative z-10 my-auto py-12 max-w-xl">
          <h1 className="text-3xl xl:text-4xl 2xl:text-5xl font-bold tracking-tight text-white leading-[1.18] animate-fade-in-up animation-delay-150">
            Liderança sustentável e inteligência em investimentos.
          </h1>

          <p className="mt-4 text-base xl:text-lg text-emerald-100/75 leading-relaxed font-normal animate-fade-in-up animation-delay-350">
            Plataforma interna unificada para monitoramento de teses de M&A,
            expansão de Ecoparques e alocação estratégica de Capex.
          </p>

          {/* Cards Flutuantes com Glassmorphism e Movimento Contínuo */}
          <div className="mt-9 grid grid-cols-1 gap-4">
            <div className="group rounded-2xl border border-white/10 bg-white/6 p-4.5 backdrop-blur-xl shadow-lg transition-all duration-300 hover:bg-white/10 hover:border-emerald-400/30 hover:scale-[1.01] animate-fade-in-up animation-delay-450 animate-float-slow">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-wide">
                    M&A e Novos Negócios
                  </h2>
                  <p className="mt-0.5 text-xs text-emerald-100/70 leading-relaxed">
                    Diligências ativas, modelagens financeiras e governança ágil
                    para decisões de capital.
                  </p>
                </div>
              </div>
            </div>

            <div className="group rounded-2xl border border-white/10 bg-white/6 p-4.5 backdrop-blur-xl shadow-lg transition-all duration-300 hover:bg-white/10 hover:border-emerald-400/30 hover:scale-[1.01] animate-fade-in-up animation-delay-550 animate-float-reverse">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5C7A54]/30 text-emerald-200 border border-[#5C7A54]/40">
                  <Leaf className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-wide">
                    Ecoparques & Transição Energética
                  </h2>
                  <p className="mt-0.5 text-xs text-emerald-100/70 leading-relaxed">
                    Pioneirismo na produção de biometano, créditos de carbono e
                    economia circular no Brasil.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé da Coluna Esquerda: Confiabilidade & Compliance */}
        <div className="relative z-10 flex items-center justify-between text-xs text-emerald-100/60 pt-4 border-t border-white/10 animate-fade-in-up animation-delay-650">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Ambiente restrito e auditado</span>
          </div>
          <span>OrizonVR © 2026</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* COLUNA DIREITA: Formulário de Autenticação Executiva       */}
      {/* ========================================================= */}
      <div className="relative flex flex-1 flex-col justify-between p-6 sm:p-10 lg:p-14 xl:p-20 bg-background min-h-screen lg:min-h-0 animate-fade-in-right">
        {/* Topo Mobile / Tablet: Exibição da marca se coluna esquerda estiver oculta */}
        <div className="lg:hidden flex items-center justify-between mb-8 animate-fade-in-down animation-delay-100">
          <div className="inline-flex items-center gap-2.5 bg-white p-2 rounded-xl shadow-sm border border-border">
            <img
              src="/brand/orizon-logo.png"
              alt="Orizon Valorização de Resíduos"
              className="h-7 w-auto object-contain"
            />
          </div>
          <Badge variant="outline" className="text-xs">
            Acesso Interno
          </Badge>
        </div>

        {/* Área Central: Caixa de Login */}
        <div className="my-auto mx-auto w-full max-w-sm sm:max-w-md">
          {/* Cabeçalho do Card */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 animate-fade-in-up animation-delay-150">
              <img
                src="/brand/orizon-symbol.png"
                alt="Símbolo Orizon"
                className="h-10 w-10 rounded-xl object-cover shadow-sm ring-1 ring-border/80 transition-transform hover:scale-105"
              />
              <div className="leading-tight">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Hub OrizonVR
                </span>
                <p className="text-xs text-muted-foreground">
                  Alocação Estratégica de Capital
                </p>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground pt-2 animate-fade-in-up animation-delay-250">
              Acesse sua conta
            </h2>
            <p className="text-sm text-muted-foreground animate-fade-in-up animation-delay-300">
              Utilize suas credenciais corporativas autorizadas para continuar.
            </p>
          </div>

          {/* Formulário Interativo */}
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {/* Campo E-mail */}
            <div className="space-y-2 animate-fade-in-up animation-delay-350">
              <Label
                htmlFor="email"
                className="text-xs font-medium text-foreground tracking-wide"
              >
                E-mail corporativo
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors" />
                <Input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="seu.nome@orizonvr.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-muted/30 focus-visible:bg-background transition-all border-border/80 hover:border-primary/50 text-sm"
                  disabled={busy}
                />
              </div>
            </div>

            {/* Campo Senha com Alternador de Visibilidade */}
            <div className="space-y-2 animate-fade-in-up animation-delay-450">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-medium text-foreground tracking-wide"
                >
                  Senha de acesso
                </Label>
                <span
                  title="Para redefinição de senha ou primeiro acesso, procure o administrador do sistema."
                  className="text-[11px] text-muted-foreground hover:text-foreground cursor-help transition-colors"
                >
                  Esqueceu?
                </span>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 bg-muted/30 focus-visible:bg-background transition-all border-border/80 hover:border-primary/50 text-sm"
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors rounded-md focus:outline-none"
                  aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Botão de Entrar */}
            <div className="animate-fade-in-up animation-delay-550">
              <Button
                type="submit"
                disabled={busy}
                className="w-full h-11 text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Hub</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Aviso Informativo de Segurança */}
          <div className="mt-8 rounded-xl border border-border/60 bg-muted/40 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5 animate-fade-in-up animation-delay-650">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Ambiente protegido com Row Level Security (RLS) e criptografia.
              Acesso exclusivo a membros da equipe Orizon e parceiros autorizados.
            </p>
          </div>
        </div>

        {/* Rodapé da Coluna Direita */}
        <div className="mt-8 text-center text-xs text-muted-foreground/80 animate-fade-in-up animation-delay-700">
          <p>
            Orizon Valorização de Resíduos S.A. • Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
