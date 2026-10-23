import { createFileRoute } from "@tanstack/react-router";
import {
  ProjetosWorkspace,
  projetosQuery,
  profilesQuery,
} from "@/components/projetos/projetos-workspace";
import { NN_CONFIG } from "@/lib/projetos-config";

export const Route = createFileRoute("/_authenticated/novos-negocios")({
  head: () => ({
    meta: [{ title: "Novos Negócios — OrizonVR | Pipeline Alocação de Capital" }],
  }),
  loader: ({ context }) => {
    // Pré-carrega queries no hover/intent com latência zero
    context.queryClient.prefetchQuery(projetosQuery(NN_CONFIG));
    context.queryClient.prefetchQuery(profilesQuery());
  },
  component: () => <ProjetosWorkspace config={NN_CONFIG} />,
});

