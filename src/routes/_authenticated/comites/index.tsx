import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Plus, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { listComites, type ComiteStatus } from "@/lib/comites.functions";
import { listProfiles } from "@/lib/projetos.functions";
import { NovoComiteDialog } from "@/components/comites/novo-comite-dialog";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/comites/")({
  head: () => ({
    meta: [
      { title: "Comitês — OrizonVR | Pipeline" },
      {
        name: "description",
        content: "Decisões formais do pipeline de M&A e Novos Negócios.",
      },
    ],
  }),
  component: ComitesListPage,
});

const STATUS_META: Record<
  ComiteStatus,
  { label: string; className: string }
> = {
  preparacao: {
    label: "Em preparação",
    className: "bg-accent/60 text-accent-foreground",
  },
  realizado: {
    label: "Realizado",
    className: "bg-primary/15 text-primary",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
  },
};

function formatDataBR(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dia.replace(".", "")}, ${hora}`;
}

function ComitesListPage() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  const listFn = useServerFn(listComites);
  const profilesFn = useServerFn(listProfiles);

  const comitesQ = useQuery({
    queryKey: ["comites"],
    queryFn: () => listFn(),
  });
  const profilesQ = useQuery({
    queryKey: ["profiles-all"],
    queryFn: () => profilesFn(),
  });

  const profMap = new Map(
    (profilesQ.data?.profiles ?? []).map((p) => [
      p.id,
      { id: p.id, nome: p.nome_completo, avatar_url: p.avatar_url },
    ]),
  );

  const canCreate = profile?.role && profile.role !== "observador";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Comitês</h1>
          <p className="text-sm text-muted-foreground">
            Decisões formais do pipeline de M&amp;A e Novos Negócios
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo comitê
          </Button>
        )}
      </div>

      {comitesQ.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : (comitesQ.data?.comites ?? []).length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/50">
            <Gavel className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Nenhum comitê ainda.</p>
            <p className="text-xs text-muted-foreground">
              Crie o primeiro para começar.
            </p>
          </div>
          {canCreate && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo comitê
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {comitesQ.data!.comites.map((c) => {
            const meta = STATUS_META[c.status];
            const participantes = c.participante_ids
              .map((id) => profMap.get(id))
              .filter(Boolean) as Array<{
              id: string;
              nome: string;
              avatar_url: string | null;
            }>;
            return (
              <Link
                key={c.id}
                to="/comites/$id"
                params={{ id: c.id }}
                className="block"
              >
                <Card className="cursor-pointer p-5 transition-colors hover:bg-accent/30">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-base font-semibold">
                          {c.titulo}
                        </h3>
                        <Badge
                          variant="secondary"
                          className={`${meta.className} text-[10px]`}
                        >
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDataBR(c.data)} · {c.pauta_count}{" "}
                        {c.pauta_count === 1 ? "projeto" : "projetos"} em pauta
                      </p>
                      {c.criado_por_nome && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Criado por {c.criado_por_nome}
                        </p>
                      )}
                    </div>
                    <AvatarStack items={participantes} max={5} size="md" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <NovoComiteDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
