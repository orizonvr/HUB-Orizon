import { createFileRoute } from "@tanstack/react-router";
import { ProjetosWorkspace } from "@/components/projetos/projetos-workspace";
import { NN_CONFIG } from "@/lib/projetos-config";

export const Route = createFileRoute("/_authenticated/novos-negocios")({
  head: () => ({
    meta: [{ title: "Novos Negócios — OrizonVR | Pipeline Alocação de Capital" }],
  }),
  component: () => <ProjetosWorkspace config={NN_CONFIG} />,
});
