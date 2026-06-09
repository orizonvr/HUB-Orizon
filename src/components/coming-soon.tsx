import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="flex min-h-[420px] flex-col items-center justify-center gap-4 border-dashed border-border bg-card/50 p-10 text-center shadow-none">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="max-w-sm">
          <h2 className="text-base font-semibold text-foreground">
            Em construção
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Esta área será construída nas próximas etapas. Comece pelo Dashboard
            para ter a visão consolidada.
          </p>
        </div>
      </Card>
    </div>
  );
}
