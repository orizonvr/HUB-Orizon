import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function OnboardingDialog() {
  const { profile, user, refreshProfile, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    const needs = !profile || !profile.nome_completo?.trim() || !profile.cargo?.trim();
    setOpen(needs);
    if (profile) {
      setNome(profile.nome_completo ?? "");
      setCargo(profile.cargo ?? "");
    }
  }, [profile, user, loading]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        nome_completo: nome.trim(),
        cargo: cargo.trim(),
        email: user.email ?? "",
      });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Perfil atualizado.");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={() => { /* required: locked */ }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Bem-vindo à OrizonVR | Pipeline Alocação de Capital</DialogTitle>
          <DialogDescription>
            Antes de começar, confirme seu nome e cargo. Isso aparece nas atribuições de projeto e no feed da equipe.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ob-nome">Nome completo</Label>
            <Input id="ob-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ob-cargo">Cargo</Label>
            <Input
              id="ob-cargo"
              required
              placeholder="ex. Analista de M&A"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !nome.trim() || !cargo.trim()}>
            Continuar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
