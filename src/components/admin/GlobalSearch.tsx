import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, X, Users, Package, MessageSquare, LayoutDashboard, ListChecks, Kanban, BarChart3, Target, CalendarDays, Calculator, Smartphone, MessagesSquare, Command } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const tempEmoji: Record<string, string> = { hot: "🔥", warm: "🟡", cold: "🔵", frozen: "⚪" };

interface SearchResult {
  id: string;
  type: "lead" | "vehicle" | "conversation" | "page";
  title: string;
  subtitle: string;
  icon?: string;
  path: string;
}

const NAV_PAGES: SearchResult[] = [
  { id: "nav-dashboard", type: "page", title: "Dashboard", subtitle: "Visão geral do CRM", path: "/admin", icon: "dashboard" },
  { id: "nav-leads", type: "page", title: "Leads", subtitle: "Gerenciar leads e clientes", path: "/admin/leads", icon: "leads" },
  { id: "nav-pipeline", type: "page", title: "Pipeline", subtitle: "Funil de vendas kanban", path: "/admin/pipeline", icon: "pipeline" },
  { id: "nav-tasks", type: "page", title: "Tarefas", subtitle: "Follow-ups e atividades", path: "/admin/tasks", icon: "tasks" },
  { id: "nav-calendar", type: "page", title: "Agenda", subtitle: "Calendário de tarefas", path: "/admin/calendar", icon: "calendar" },
  { id: "nav-messages", type: "page", title: "Mensagens", subtitle: "Templates de mensagens", path: "/admin/messages", icon: "messages" },
  { id: "nav-chat", type: "page", title: "Conversas IA", subtitle: "Histórico de chat com IA", path: "/admin/chat-history", icon: "chat" },
  { id: "nav-metrics", type: "page", title: "Métricas", subtitle: "Análises e relatórios", path: "/admin/metrics", icon: "metrics" },
  { id: "nav-goals", type: "page", title: "Metas", subtitle: "Metas mensais", path: "/admin/goals", icon: "goals" },
  { id: "nav-simulations", type: "page", title: "Simulações", subtitle: "Simulações de financiamento", path: "/admin/simulations", icon: "simulations" },
  { id: "nav-catalog", type: "page", title: "Catálogo", subtitle: "Estoque de veículos", path: "/admin/catalog", icon: "catalog" },
  { id: "nav-sms", type: "page", title: "SMS Marketing", subtitle: "Automações de SMS", path: "/admin/sms", icon: "sms" },
];

const PAGE_ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard, leads: Users, pipeline: Kanban, tasks: ListChecks,
  calendar: CalendarDays, messages: MessageSquare, chat: MessagesSquare,
  metrics: BarChart3, goals: Target, simulations: Calculator, catalog: Package, sms: Smartphone,
};

const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Filter pages by query
  const filteredPages = useMemo(() => {
    if (!query.trim()) return NAV_PAGES;
    const q = query.toLowerCase();
    return NAV_PAGES.filter(p =>
      p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)
    );
  }, [query]);

  // Search leads, vehicles, conversations
  useEffect(() => {
    if (!query.trim()) { setResults([]); setSelectedIndex(0); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const q = query.trim();

      const [leadsRes, vehiclesRes, convosRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, phone, temperature, interest")
          .or(`name.ilike.%${q}%,phone.ilike.%${q}%,interest.ilike.%${q}%`)
          .limit(5),
        supabase
          .from("stock_vehicles")
          .select("id, brand, model, year, price, status")
          .or(`brand.ilike.%${q}%,model.ilike.%${q}%`)
          .limit(5),
        supabase
          .from("chat_conversations")
          .select("id, session_id, status, created_at, messages")
          .limit(5),
      ]);

      const leadResults: SearchResult[] = (leadsRes.data || []).map(c => ({
        id: c.id,
        type: "lead",
        title: c.name,
        subtitle: `${tempEmoji[c.temperature] || "⚪"} ${c.interest || "Sem interesse"} · ${c.phone || "Sem tel"}`,
        path: `/admin/client/${c.id}`,
      }));

      const vehicleResults: SearchResult[] = (vehiclesRes.data || []).map(v => ({
        id: v.id,
        type: "vehicle",
        title: `${v.brand} ${v.model} ${v.year || ""}`,
        subtitle: `R$ ${Number(v.price).toLocaleString("pt-BR")} · ${v.status === "available" ? "Disponível" : v.status === "sold" ? "Vendido" : v.status}`,
        path: "/admin/catalog",
      }));

      // Filter conversations that match query in messages
      const convoResults: SearchResult[] = (convosRes.data || [])
        .filter(c => {
          const msgs = Array.isArray(c.messages) ? c.messages : [];
          return msgs.some((m: any) =>
            typeof m.content === "string" && m.content.toLowerCase().includes(q.toLowerCase())
          );
        })
        .slice(0, 3)
        .map(c => ({
          id: c.id,
          type: "conversation",
          title: `Conversa ${c.status === "transferred" ? "transferida" : c.status}`,
          subtitle: new Date(c.created_at).toLocaleDateString("pt-BR"),
          path: "/admin/chat-history",
        }));

      setResults([...leadResults, ...vehicleResults, ...convoResults]);
      setSelectedIndex(0);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const allItems = useMemo(() => {
    const items: SearchResult[] = [];
    if (filteredPages.length > 0) items.push(...filteredPages);
    if (results.length > 0) items.push(...results);
    return items;
  }, [filteredPages, results]);

  const selectItem = useCallback((item: SearchResult) => {
    navigate(item.path);
    setOpen(false);
  }, [navigate]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && allItems[selectedIndex]) {
      e.preventDefault();
      selectItem(allItems[selectedIndex]);
    }
  }, [allItems, selectedIndex, selectItem]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const typeLabel: Record<string, string> = {
    page: "Páginas", lead: "Leads", vehicle: "Veículos", conversation: "Conversas",
  };

  const TypeIcon = ({ type, icon }: { type: string; icon?: string }) => {
    if (type === "page" && icon && PAGE_ICONS[icon]) {
      const Icon = PAGE_ICONS[icon];
      return <Icon className="w-4 h-4 text-muted-foreground" />;
    }
    if (type === "lead") return <Users className="w-4 h-4 text-info" />;
    if (type === "vehicle") return <Package className="w-4 h-4 text-success" />;
    if (type === "conversation") return <MessagesSquare className="w-4 h-4 text-warning" />;
    return <Search className="w-4 h-4 text-muted-foreground" />;
  };

  // Group results by type
  const grouped = useMemo(() => {
    const groups: Record<string, { items: SearchResult[]; startIndex: number }> = {};
    let idx = 0;
    for (const item of allItems) {
      if (!groups[item.type]) groups[item.type] = { items: [], startIndex: idx };
      groups[item.type].items.push(item);
      idx++;
    }
    return groups;
  }, [allItems]);

  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/80 border border-border/50 text-xs text-muted-foreground hover:border-primary/30 transition-colors"
      >
        <Search className="w-3 h-3" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded bg-muted/80 border border-border/50 text-[10px] font-mono text-muted-foreground">
          {isMac ? "⌘" : "Ctrl"}K
        </kbd>
      </button>

      {/* Command Palette Modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-lg"
            >
              <div className="glass-card overflow-hidden border border-border/60 shadow-2xl">
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 border-b border-border/40">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Buscar leads, veículos, páginas..."
                    className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="p-1 rounded-md hover:bg-muted transition-colors">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                  <kbd className="hidden sm:flex items-center px-1.5 py-0.5 rounded bg-muted/60 border border-border/50 text-[10px] font-mono text-muted-foreground">
                    ESC
                  </kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
                  {loading && (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {!loading && allItems.length === 0 && query.trim() && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhum resultado para "{query}"
                    </p>
                  )}

                  {!loading && Object.entries(grouped).map(([type, group]) => (
                    <div key={type} className="mb-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1.5">
                        {typeLabel[type] || type}
                      </p>
                      {group.items.map((item, i) => {
                        const globalIndex = group.startIndex + i;
                        const isSelected = globalIndex === selectedIndex;
                        return (
                          <button
                            key={item.id}
                            data-index={globalIndex}
                            onClick={() => selectItem(item)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                              isSelected ? "bg-primary/10 text-foreground" : "text-foreground/80 hover:bg-muted/50"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected ? "bg-primary/15" : "bg-muted/60"
                            }`}>
                              <TypeIcon type={item.type} icon={item.icon} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.title}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                            </div>
                            {isSelected && (
                              <kbd className="hidden sm:flex items-center px-1.5 py-0.5 rounded bg-muted/60 border border-border/50 text-[10px] font-mono text-muted-foreground">
                                ↵
                              </kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/40 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/50 font-mono">↑↓</kbd> navegar
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/50 font-mono">↵</kbd> abrir
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/50 font-mono">esc</kbd> fechar
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default GlobalSearch;
