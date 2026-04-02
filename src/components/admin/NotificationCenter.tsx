import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Flame, AlertTriangle, FileCheck, ChevronRight, Bot } from "lucide-react";
import { useOverdueTasks, useClients } from "@/hooks/useSupabase";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type FilterType = "all" | "docs" | "leads" | "ai" | "tasks";

const FILTERS: { key: FilterType; label: string; emoji: string }[] = [
  { key: "all", label: "Todos", emoji: "📋" },
  { key: "ai", label: "Chat IA", emoji: "🤖" },
  { key: "docs", label: "Docs", emoji: "📄" },
  { key: "leads", label: "Leads", emoji: "🔥" },
  { key: "tasks", label: "Tarefas", emoji: "⚠️" },
];

const NotificationCenter = () => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const navigate = useNavigate();
  const { data: overdueTasks } = useOverdueTasks();
  const { data: recentClients } = useClients();

  const newLeads = (recentClients || []).filter(c => {
    const diff = Date.now() - new Date(c.created_at).getTime();
    return diff < 24 * 60 * 60 * 1000;
  });

  const aiLeads = newLeads.filter(c => c.source === "ai-chat");
  const nonAiLeads = newLeads.filter(c => c.source !== "ai-chat");

  const docsReadyLeads = (recentClients || []).filter(c => {
    const docs = c.financing_docs as Record<string, boolean> | null;
    if (!docs) return false;
    return docs.cnh && docs.proof_of_residence && docs.pay_stub && docs.reference;
  });

  const docsNotifications = docsReadyLeads.slice(0, 10).map(c => ({
    id: `docs-${c.id}`,
    type: "docs" as const,
    icon: FileCheck,
    color: "text-green-400",
    bg: "bg-green-500/10",
    title: "📋 Docs completos!",
    desc: `${c.name} — ficha pronta para enviar`,
    action: () => { navigate(`/admin/client/${c.id}`); setOpen(false); },
  }));

  const taskNotifications = (overdueTasks || []).slice(0, 10).map(t => ({
    id: `task-${t.id}`,
    type: "tasks" as const,
    icon: AlertTriangle,
    color: "text-destructive",
    bg: "bg-destructive/10",
    title: "Follow-up atrasado",
    desc: (t.clients as any)?.name || "Cliente",
    action: () => { navigate("/admin/tasks"); setOpen(false); },
  }));

  const leadNotifications = nonAiLeads.slice(0, 10).map(c => ({
    id: `lead-${c.id}`,
    type: "leads" as const,
    icon: Flame,
    color: "text-primary",
    bg: "bg-primary/10",
    title: "Novo lead!",
    desc: `${c.name} · ${c.interest || "sem interesse"}`,
    action: () => { navigate(`/admin/client/${c.id}`); setOpen(false); },
  }));

  const aiNotifications = aiLeads.slice(0, 10).map(c => ({
    id: `ai-${c.id}`,
    type: "ai" as const,
    icon: Bot,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    title: "🤖 Novo lead via Chat IA!",
    desc: `${c.name} · ${c.interest || "sem interesse"} · capturado automaticamente`,
    action: () => { navigate(`/admin/client/${c.id}`); setOpen(false); },
  }));

  const allNotifications = [...aiNotifications, ...docsNotifications, ...taskNotifications, ...leadNotifications];

  const filtered = filter === "all"
    ? allNotifications
    : allNotifications.filter(n => n.type === filter);

  const counts: Record<FilterType, number> = {
    all: allNotifications.length,
    ai: aiNotifications.length,
    docs: docsNotifications.length,
    leads: leadNotifications.length,
    tasks: taskNotifications.length,
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full relative">
          <Bell className="h-4 w-4" />
          {allNotifications.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
              {allNotifications.length > 9 ? "9+" : allNotifications.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="px-4 py-3 border-b border-border/50">
          <p className="text-sm font-display font-semibold">Notificações</p>
          <p className="text-[10px] text-muted-foreground">{allNotifications.length} pendentes</p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-border/30 overflow-x-auto">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors flex items-center gap-1 ${
                filter === f.key
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f.emoji} {f.label}
              {counts[f.key] > 0 && (
                <span className={`text-[9px] min-w-[14px] h-[14px] rounded-full flex items-center justify-center ${
                  filter === f.key ? "bg-primary-foreground/20" : "bg-primary/15 text-primary"
                }`}>
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              ✅ Nenhuma notificação
            </div>
          ) : (
            filtered.map(n => (
              <button
                key={n.id}
                onClick={n.action}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
              >
                <div className={`w-8 h-8 rounded-full ${n.bg} flex items-center justify-center shrink-0`}>
                  <n.icon className={`w-3.5 h-3.5 ${n.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{n.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{n.desc}</p>
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
              </button>
            ))
          )}
        </div>
        {allNotifications.length > 0 && (
          <div className="px-4 py-2 border-t border-border/50">
            <Button variant="ghost" size="sm" className="w-full text-xs text-primary" onClick={() => { navigate("/admin/tasks"); setOpen(false); }}>
              Ver todas as tarefas
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;