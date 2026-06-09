import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { avatarBgStyle } from "@/lib/format";
import { initials } from "@/lib/ma-utils";

export type AvatarStackItem = {
  id: string;
  nome: string;
  avatar_url?: string | null;
};

type Props = {
  items: AvatarStackItem[];
  max?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
};

const SIZE_CLASSES = {
  xs: "h-4 w-4 text-[8px]",
  sm: "h-5 w-5 text-[9px]",
  md: "h-6 w-6 text-[10px]",
};

export function AvatarStack({ items, max = 3, size = "sm", className = "" }: Props) {
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const visible = items.slice(0, max);
  const overflow = items.slice(max);
  const sizeClass = SIZE_CLASSES[size];

  return (
    <TooltipProvider delayDuration={150}>
      <div className={`flex -space-x-1.5 ${className}`}>
        {visible.map((p) => (
          <Tooltip key={p.id}>
            <TooltipTrigger asChild>
              <Avatar
                className={`${sizeClass} ring-2 ring-background cursor-default`}
              >
                {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.nome} /> : null}
                <AvatarFallback
                  style={avatarBgStyle(p.nome)}
                  className={sizeClass.split(" ").slice(2).join(" ")}
                >
                  {initials(p.nome)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{p.nome}</TooltipContent>
          </Tooltip>
        ))}
        {overflow.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`${sizeClass} ring-2 ring-background inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground font-medium cursor-default`}
              >
                +{overflow.length}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-0.5">
                {overflow.map((p) => (
                  <div key={p.id} className="text-xs">
                    {p.nome}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
