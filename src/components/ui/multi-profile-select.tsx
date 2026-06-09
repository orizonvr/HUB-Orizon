import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type MultiOption = {
  id: string;
  label: string;
};

type Props = {
  options: MultiOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  triggerClassName?: string;
  /** Compact display: just shows count instead of badges. */
  compact?: boolean;
  disabled?: boolean;
};

export function MultiProfileSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione",
  triggerClassName,
  compact,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const map = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const selected = value.map((id) => map.get(id)).filter(Boolean) as MultiOption[];

  const toggle = (id: string) => {
    if (value.includes(id)) {
      // Don't allow clearing all when we need at least 1
      if (value.length === 1) return;
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-9",
            triggerClassName,
          )}
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : compact ? (
            <span className="truncate text-sm">
              {selected.length === 1
                ? selected[0].label
                : `${selected.length} pessoas`}
            </span>
          ) : (
            <div className="flex flex-wrap gap-1 max-w-full overflow-hidden">
              {selected.slice(0, 2).map((s) => (
                <Badge
                  key={s.id}
                  variant="secondary"
                  className="text-xs gap-1 max-w-[140px]"
                >
                  <span className="truncate">{s.label}</span>
                  {value.length > 1 && (
                    <X
                      className="h-3 w-3 cursor-pointer flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(s.id);
                      }}
                    />
                  )}
                </Badge>
              ))}
              {selected.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{selected.length - 2}
                </Badge>
              )}
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar pessoa..." />
          <CommandList>
            <CommandEmpty>Nenhuma pessoa encontrada.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const checked = value.includes(opt.id);
                return (
                  <CommandItem
                    key={opt.id}
                    value={opt.label}
                    onSelect={() => toggle(opt.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        checked ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {opt.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
