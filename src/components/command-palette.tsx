import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  FileText as FileIcon,
  MessageSquare,
  User as UserIcon,
  Keyboard,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { globalSearch, type SearchResult } from "@/lib/search.functions";

// Custom event that any page can dispatch to open the "new project" dialog.
// Pages that don't know how to create a project (Dashboard, Documentos, etc.)
// will redirect to M&A first.
export const NEW_PROJECT_EVENT = "orizon:new-project";

function emitNewProject() {
  window.dispatchEvent(new CustomEvent(NEW_PROJECT_EVENT));
}

export function CommandPalette() {
  const [openSearch, setOpenSearch] = useState(false);
  const [openHelp, setOpenHelp] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const searchFn = useServerFn(globalSearch);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    let lastG = 0;
    const handler = (e: KeyboardEvent) => {
      // ignore when typing in an input/textarea/contenteditable
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable);

      // Cmd/Ctrl+K — works even while typing
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpenSearch((v) => !v);
        return;
      }

      if (typing) return;

      // ? — help
      if (e.key === "?") {
        e.preventDefault();
        setOpenHelp(true);
        return;
      }

      // N — new project
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        const onProjectPage = path.startsWith("/ma") || path.startsWith("/novos-negocios");
        if (onProjectPage) {
          emitNewProject();
        } else {
          // default to M&A then trigger
          navigate({ to: "/ma" });
          setTimeout(emitNewProject, 250);
        }
        return;
      }

      // G then D/M/N
      if (e.key.toLowerCase() === "g") {
        lastG = Date.now();
        return;
      }
      if (Date.now() - lastG < 1200) {
        const k = e.key.toLowerCase();
        if (k === "d") {
          e.preventDefault();
          navigate({ to: "/" });
          lastG = 0;
          return;
        }
        if (k === "m") {
          e.preventDefault();
          navigate({ to: "/ma" });
          lastG = 0;
          return;
        }
        if (k === "n") {
          e.preventDefault();
          navigate({ to: "/novos-negocios" });
          lastG = 0;
          return;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, path]);

  // ---- debounced search ----
  useEffect(() => {
    if (!openSearch) {
      setQ("");
      setResults([]);
      return;
    }
  }, [openSearch]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const tid = setTimeout(async () => {
      try {
        const res = await searchFn({ data: { q: q.trim() } });
        if (!cancelled) setResults(res.results);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(tid);
    };
  }, [q, searchFn]);

  const grouped = {
    projeto: results.filter((r) => r.kind === "projeto"),
    comentario: results.filter((r) => r.kind === "comentario"),
    documento: results.filter((r) => r.kind === "documento"),
    profile: results.filter((r) => r.kind === "profile"),
  } as const;

  const go = (r: SearchResult) => {
    setOpenSearch(false);
    if (r.kind === "projeto") {
      navigate({ to: r.tipo === "ma" ? "/ma" : "/novos-negocios" });
      // The workspace listens for this to auto-open the project sheet.
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("orizon:open-projeto", { detail: { id: r.id } }),
        );
      }, 200);
    } else if (r.kind === "comentario" || r.kind === "documento") {
      // Don't know the project type here; jump to dashboard search context.
      navigate({ to: "/ma" });
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("orizon:open-projeto", { detail: { id: r.projeto_id } }),
        );
      }, 200);
    } else if (r.kind === "profile") {
      navigate({ to: "/equipe" });
    }
  };

  return (
    <>
      <CommandDialog open={openSearch} onOpenChange={setOpenSearch}>
        <CommandInput
          placeholder="Buscar projetos, comentários, documentos, pessoas..."
          value={q}
          onValueChange={setQ}
        />
        <CommandList>
          {!loading && q.trim() && results.length === 0 && (
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
          )}
          {!q.trim() && (
            <CommandEmpty>
              Digite ao menos 1 caractere. Dica: <kbd className="px-1 text-[10px]">G</kbd>+
              <kbd className="px-1 text-[10px]">D</kbd> vai ao Dashboard.
            </CommandEmpty>
          )}
          {grouped.projeto.length > 0 && (
            <CommandGroup heading="Projetos">
              {grouped.projeto.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`projeto-${r.id}-${r.title}`}
                  onSelect={() => go(r)}
                >
                  <Briefcase className="mr-2 h-4 w-4 text-primary" />
                  <span className="flex-1 truncate">{r.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">
                    {r.subtitle}
                  </span>
                  {r.kind === "projeto" && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {r.tipo === "ma" ? "M&A" : "Novos Negócios"}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {grouped.comentario.length > 0 && (
            <CommandGroup heading="Comentários">
              {grouped.comentario.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`com-${r.id}-${r.title}`}
                  onSelect={() => go(r)}
                >
                  <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{r.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">
                    {r.subtitle}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {grouped.documento.length > 0 && (
            <CommandGroup heading="Documentos">
              {grouped.documento.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`doc-${r.id}-${r.title}`}
                  onSelect={() => go(r)}
                >
                  <FileIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{r.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">
                    {r.subtitle}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {grouped.profile.length > 0 && (
            <CommandGroup heading="Equipe">
              {grouped.profile.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`prof-${r.id}-${r.title}`}
                  onSelect={() => go(r)}
                >
                  <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{r.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground truncate">
                    {r.subtitle}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>

      <Dialog open={openHelp} onOpenChange={setOpenHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" /> Atalhos de teclado
            </DialogTitle>
            <DialogDescription>
              Use o teclado para navegar mais rápido pelo OrizonVR | Pipeline Alocação de Capital.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-2 text-sm">
            <Shortcut keys={["⌘", "K"]} desc="Busca global" />
            <Shortcut keys={["Ctrl", "K"]} desc="Busca global (Windows/Linux)" />
            <Shortcut keys={["N"]} desc="Novo projeto" />
            <Shortcut keys={["G", "D"]} desc="Ir para Dashboard" />
            <Shortcut keys={["G", "M"]} desc="Ir para M&A" />
            <Shortcut keys={["G", "N"]} desc="Ir para Novos Negócios" />
            <Shortcut keys={["?"]} desc="Mostrar este painel" />
            <Shortcut keys={["Esc"]} desc="Fechar modais" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Shortcut({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-border bg-secondary/40 px-3 py-2">
      <span className="text-foreground">{desc}</span>
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="rounded border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground shadow-sm"
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );
}
