import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table2, LayoutGrid, Columns3 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ViewTarefasModo } from "@/lib/notificacoes-types";

export function ViewModoToggle({
  value,
  onChange,
}: {
  value: ViewTarefasModo;
  onChange: (v: ViewTarefasModo) => void;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as ViewTarefasModo)}
        variant="outline"
        size="sm"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="tabela" aria-label="Tabela">
              <Table2 className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Tabela</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="cards" aria-label="Cards">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Cards</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="kanban" aria-label="Kanban">
              <Columns3 className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Kanban</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  );
}
