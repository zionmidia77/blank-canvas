import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, Users, ListChecks, Kanban, Search, MessageSquare, BarChart3, CalendarDays, LayoutDashboard, Package, UserPlus } from "lucide-react";

const SHORTCUTS = [
  { key: "N", label: "Novo lead", icon: UserPlus, category: "Ações" },
  { key: "T", label: "Nova tarefa", icon: ListChecks, category: "Ações" },
  { key: "?", label: "Guia de atalhos", icon: Keyboard, category: "Ações" },
  { key: "⌘K", label: "Busca universal", icon: Search, category: "Ações" },
  { key: "D", label: "Dashboard", icon: LayoutDashboard, category: "Navegação" },
  { key: "L", label: "Leads", icon: Users, category: "Navegação" },
  { key: "P", label: "Pipeline", icon: Kanban, category: "Navegação" },
  { key: "M", label: "Mensagens", icon: MessageSquare, category: "Navegação" },
  { key: "C", label: "Catálogo", icon: Package, category: "Navegação" },
  { key: "A", label: "Agenda", icon: CalendarDays, category: "Navegação" },
  { key: "R", label: "Métricas", icon: BarChart3, category: "Navegação" },
];

interface KeyboardShortcutsProps {
  onNewLead?: () => void;
}

const KeyboardShortcuts = ({ onNewLead }: KeyboardShortcutsProps) => {
  const [guideOpen, setGuideOpen] = useState(false);
  const navigate = useNavigate();

  const isInputFocused = useCallback(() => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isInputFocused()) return;

      // Check if any dialog/modal is open (radix portals)
      const hasOpenDialog = document.querySelector("[data-state='open'][role='dialog']");
      if (hasOpenDialog) return;

      switch (e.key.toLowerCase()) {
        case "?":
          e.preventDefault();
          setGuideOpen(true);
          break;
        case "n":
          e.preventDefault();
          onNewLead?.();
          break;
        case "t":
          e.preventDefault();
          navigate("/admin/tasks");
          break;
        case "d":
          e.preventDefault();
          navigate("/admin");
          break;
        case "l":
          e.preventDefault();
          navigate("/admin/leads");
          break;
        case "p":
          e.preventDefault();
          navigate("/admin/pipeline");
          break;
        case "m":
          e.preventDefault();
          navigate("/admin/messages");
          break;
        case "c":
          e.preventDefault();
          navigate("/admin/catalog");
          break;
        case "a":
          e.preventDefault();
          navigate("/admin/calendar");
          break;
        case "r":
          e.preventDefault();
          navigate("/admin/metrics");
          break;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate, onNewLead, isInputFocused]);

  const categories = [...new Set(SHORTCUTS.map(s => s.category))];
  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");

  return (
    <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            Atalhos de teclado
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">{cat}</p>
              <div className="space-y-1">
                {SHORTCUTS.filter(s => s.category === cat).map(shortcut => (
                  <div
                    key={shortcut.key}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <shortcut.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1">{shortcut.label}</span>
                    <kbd className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 rounded-lg bg-secondary border border-border/50 text-xs font-mono text-muted-foreground">
                      {shortcut.key === "⌘K" ? (isMac ? "⌘K" : "Ctrl+K") : shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground text-center pt-2">
            Pressione <kbd className="px-1 py-0.5 rounded bg-muted border border-border/50 font-mono text-[10px]">?</kbd> a qualquer momento para abrir este guia
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcuts;