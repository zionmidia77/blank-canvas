import { useMemo } from "react";
import { AlertTriangle, Clock, Flame, CalendarCheck, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

interface QueueDashboardProps {
  queue: Tables<"clients">[];
  attendedCount: number;
  sessionStartTime: number;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

const QueueDashboard = ({ queue, attendedCount, sessionStartTime, activeFilter, onFilterChange }: QueueDashboardProps) => {
  const stats = useMemo(() => {
    const now = new Date();
    
    const urgent = queue.filter(c => 
      c.temperature === "hot" || 
      (c.next_action_due && new Date(c.next_action_due) < now) ||
      c.client_promise_status === "overdue"
    ).length;

    const overdue = queue.filter(c => 
      c.next_action_due && new Date(c.next_action_due) < now
    ).length;

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const scheduledToday = queue.filter(c => {
      if (!c.next_action_due) return false;
      const due = new Date(c.next_action_due);
      return due >= new Date(new Date().setHours(0, 0, 0, 0)) && due <= today;
    }).length;

    const noContact48h = queue.filter(c => {
      if (!c.last_contact_at) return true;
      return (Date.now() - new Date(c.last_contact_at).getTime()) > 48 * 3600000;
    }).length;

    // Avg wait time (hours since last contact for all queue leads)
    const waitTimes = queue
      .filter(c => c.last_contact_at)
      .map(c => (Date.now() - new Date(c.last_contact_at!).getTime()) / 3600000);
    const avgWaitHours = waitTimes.length > 0 
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) 
      : 0;

    return { urgent, overdue, scheduledToday, noContact48h, avgWaitHours };
  }, [queue]);

  // Productivity metrics
  const sessionMinutes = Math.max(1, Math.round((Date.now() - sessionStartTime) / 60000));
  const avgTimePerLead = attendedCount > 0 ? Math.round(sessionMinutes / attendedCount) : 0;

  const filters = [
    { key: null, label: "Todos", count: queue.length, icon: TrendingUp, color: "text-foreground" },
    { key: "urgent", label: "Urgentes", count: stats.urgent, icon: Flame, color: "text-destructive" },
    { key: "overdue", label: "Atrasados", count: stats.overdue, icon: AlertTriangle, color: "text-warning" },
    { key: "today", label: "Hoje", count: stats.scheduledToday, icon: CalendarCheck, color: "text-primary" },
    { key: "inactive", label: "Sem contato 48h+", count: stats.noContact48h, icon: Clock, color: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-3">
      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-destructive/10 rounded-xl p-3 text-center">
          <p className="text-lg font-display font-bold text-destructive">{stats.urgent}</p>
          <p className="text-[10px] text-muted-foreground">🔥 Urgentes</p>
        </div>
        <div className="bg-warning/10 rounded-xl p-3 text-center">
          <p className="text-lg font-display font-bold text-warning">{stats.overdue}</p>
          <p className="text-[10px] text-muted-foreground">⏰ Atrasados</p>
        </div>
        <div className="bg-primary/10 rounded-xl p-3 text-center">
          <p className="text-lg font-display font-bold text-primary">{stats.scheduledToday}</p>
          <p className="text-[10px] text-muted-foreground">📅 Agendados hoje</p>
        </div>
        <div className="bg-secondary rounded-xl p-3 text-center">
          <p className="text-lg font-display font-bold">{stats.avgWaitHours}h</p>
          <p className="text-[10px] text-muted-foreground">⏳ Espera média</p>
        </div>
      </div>

      {/* Productivity bar */}
      {attendedCount > 0 && (
        <div className="flex items-center gap-3 bg-success/10 rounded-xl px-3 py-2 text-xs">
          <span className="text-success font-medium">📊 Sessão:</span>
          <span>✅ {attendedCount} atendidos</span>
          <span>·</span>
          <span>⏱️ ~{avgTimePerLead}min/lead</span>
          <span>·</span>
          <span>🕐 {sessionMinutes}min total</span>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map(f => (
          <button
            key={f.key ?? "all"}
            onClick={() => onFilterChange(f.key)}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors border",
              activeFilter === f.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/50 border-border/50 hover:bg-secondary"
            )}
          >
            <f.icon className={cn("w-3 h-3", activeFilter !== f.key && f.color)} />
            {f.label}
            {f.count > 0 && (
              <span className={cn(
                "ml-0.5 px-1.5 py-0.5 rounded-full text-[9px]",
                activeFilter === f.key ? "bg-primary-foreground/20" : "bg-primary/15 text-primary"
              )}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QueueDashboard;
