import { createFileRoute } from "@tanstack/react-router";
import { ProjetosWorkspace } from "@/components/projetos/projetos-workspace";
import { MA_CONFIG } from "@/lib/projetos-config";

export const Route = createFileRoute("/_authenticated/ma")({
  head: () => ({
    meta: [{ title: "M&A — OrizonVR | Pipeline Alocação de Capital" }],
  }),
  component: () => <ProjetosWorkspace config={MA_CONFIG} />,
});
