import { createFileRoute } from "@tanstack/react-router";
import {
  ProjetosWorkspace,
  projetosQuery,
  profilesQuery,
} from "@/components/projetos/projetos-workspace";
import { MA_CONFIG } from "@/lib/projetos-config";

export const Route = createFileRoute("/_authenticated/ma")({
  head: () => ({
    meta: [{ title: "M&A — OrizonVR | Pipeline Alocação de Capital" }],
  }),
  loader: ({ context }) => {
    // Pré-carrega queries no hover/intent com latência zero
    context.queryClient.prefetchQuery(projetosQuery(MA_CONFIG));
    context.queryClient.prefetchQuery(profilesQuery());
  },
  component: () => <ProjetosWorkspace config={MA_CONFIG} />,
});

