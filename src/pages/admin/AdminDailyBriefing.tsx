import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useClients, useOverdueTasks, useAllPendingTasks } from "@/hooks/useSupabase";
import {
  Zap, AlertTriangle, Clock, Target, ArrowRight, Flame,
  CheckCircle2, MessageCircle, Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import PageTour from "@/components/admin/PageTour";
import { Sun, BarChart3, Zap as ZapIcon } from "lucide-react";

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

const AdminDailyBriefing = () => {
  const navigate = useNavigate();
  const { data: clients } = useClients();
  const { data: overdueTasks } = useOverdueTasks();
  const { data: pendingTasks } = useAllPendingTasks();

  const stats = useMemo(() => {
    if (!clients) return null;

    const active = clients.filter(c => !["closed_won", "closed_lost"].includes(c.pipeline_stage));
    const hot = active.filter(c => c.temperature === "hot");
    const overdueActions = active.filter(c => c.next_action_due && new Date(c.next_action_due) < new Date());
    const brokenPromises = active.filter(c => c.client_promise_status === "overdue" || c.client_promise_status === "broken");
    const highChurn = active.filter(c => (c.churn_risk || 0) > 60);
    const noAction = active.filter(c => !c.next_action && !["new"].includes(c.pipeline_stage));

    const today = new Date().toISOString().split("T")[0];
    const todayTasks = pendingTasks?.filter(t => t.due_date === today) || [];

    return {
      totalActive: active.length,
      hot: hot.length,
      overdueActions: overdueActions.length,
      overdueActionLeads: overdueActions.slice(0, 5),
      brokenPromises: brokenPromises.length,
      brokenPromiseLeads: brokenPromises.slice(0, 3),
      highChurn: highChurn.length,
      highChurnLeads: highChurn.slice(0, 3),
      noAction: noAction.length,
      todayTasks: todayTasks.length,
      overdueTasks: overdueTasks?.length || 0,
    };
  }, [clients, pendingTasks, overdueTasks]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Score the day: how urgent is today?
  const urgencyScore = Math.min(
    stats.overdueActions * 10 + stats.brokenPromises * 15 + stats.highChurn * 5 + stats.overdueTasks * 8,
    100
  );
  const urgencyColor = urgencyScore > 60 ? "text-destructive" : urgencyScore > 30 ? "text-warning" : "text-primary";
  const urgencyLabel = urgencyScore > 60 ? "🔴 Dia crítico" : urgencyScore > 30 ? "🟡 Atenção necessária" : "🟢 Tudo sob controle";

  const briefingTourSteps = [
    { target: '[data-tour="briefing-urgency"]', title: "Indicador de urgência", description: "Mostra o quão crítico é o seu dia baseado em ações atrasadas, promessas vencidas e risco de perda.", icon: ZapIcon, position: "bottom" as const },
    { target: '[data-tour="briefing-stats"]', title: "Resumo rápido", description: "Veja de relance: leads ativos, quentes, tarefas de hoje e atrasadas.", icon: BarChart3, position: "bottom" as const },
    { target: '[data-tour="briefing-actions"]', title: "Ações prioritárias", description: "Lista dos leads que precisam de ação imediata, com acesso rápido à fila inteligente.", icon: Sun, position: "bottom" as const },
  ];

  return (
    <motion.div
      initial="initial"
      animate="animate"
      transition={{ staggerChildren: 0.06 }}
      className="p-5 md:p-6 max-w-2xl mx-auto space-y-5"
    >
      <PageTour tourKey="briefing" steps={briefingTourSteps} />
      {/* Greeting */}
      <motion.div variants={fadeUp} className="space-y-1">
        <h1 className="text-2xl font-display font-bold">
          Bom {new Date().getHours() < 12 ? "dia" : new Date().getHours() < 18 ? "tarde" : "noite"} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </motion.div>

      {/* Urgency indicator */}
      <motion.div variants={fadeUp} data-tour="briefing-urgency" className={cn(
        "rounded-2xl border-2 p-5 text-center space-y-2",
        urgencyScore > 60 ? "border-destructive bg-destructive/5" :
        urgencyScore > 30 ? "border-warning bg-warning/5" :
        "border-primary/30 bg-primary/5"
      )}>
        <p className={cn("text-3xl font-display font-bold", urgencyColor)}>{urgencyLabel}</p>
        <p className="text-sm text-muted-foreground">
          {stats.overdueActions > 0 && `${stats.overdueActions} ações atrasadas · `}
          {stats.brokenPromises > 0 && `${stats.brokenPromises} promessas vencidas · `}
          {stats.totalActive} leads ativos
        </p>
      </motion.div>

      {/* Quick stats grid */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-3" data-tour="briefing-stats">
        <div className="glass-card p-3 text-center">
          <Users className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-display font-bold">{stats.totalActive}</p>
          <p className="text-[10px] text-muted-foreground">Leads ativos</p>
        </div>
        <div className="glass-card p-3 text-center">
          <Flame className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-display font-bold text-primary">{stats.hot}</p>
          <p className="text-[10px] text-muted-foreground">Quentes</p>
        </div>
        <div className="glass-card p-3 text-center">
          <CheckCircle2 className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
          <p className="text-xl font-display font-bold">{stats.todayTasks}</p>
          <p className="text-[10px] text-muted-foreground">Tarefas hoje</p>
        </div>
        <div className="glass-card p-3 text-center">
          <AlertTriangle className={cn("w-5 h-5 mx-auto mb-1", stats.overdueTasks > 0 ? "text-destructive" : "text-muted-foreground")} />
          <p className={cn("text-xl font-display font-bold", stats.overdueTasks > 0 && "text-destructive")}>{stats.overdueTasks}</p>
          <p className="text-[10px] text-muted-foreground">Atrasadas</p>
        </div>
      </motion.div>

      {/* Overdue actions */}
      {stats.overdueActions > 0 && (
        <motion.div variants={fadeUp} className="glass-card p-4 space-y-3 border-destructive/20 border">
          <p className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-destructive" />
            <span className="text-destructive">{stats.overdueActions} ações atrasadas</span>
          </p>
          <div className="space-y-2">
            {stats.overdueActionLeads.map(lead => (
              <button
                key={lead.id}
                onClick={() => navigate(`/admin/client/${lead.id}`)}
                className="w-full text-left bg-destructive/5 rounded-xl p-3 flex items-center justify-between hover:bg-destructive/10 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.next_action || "Ação não definida"}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Broken promises */}
      {stats.brokenPromises > 0 && (
        <motion.div variants={fadeUp} className="glass-card p-4 space-y-3 border-warning/20 border">
          <p className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-warning">{stats.brokenPromises} promessas vencidas</span>
          </p>
          <div className="space-y-2">
            {stats.brokenPromiseLeads.map(lead => (
              <button
                key={lead.id}
                onClick={() => navigate(`/admin/client/${lead.id}`)}
                className="w-full text-left bg-warning/5 rounded-xl p-3 flex items-center justify-between hover:bg-warning/10 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.client_promise || "Promessa não registrada"}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* High churn risk */}
      {stats.highChurn > 0 && (
        <motion.div variants={fadeUp} className="glass-card p-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            {stats.highChurn} leads com risco alto de perda
          </p>
          <div className="space-y-2">
            {stats.highChurnLeads.map(lead => (
              <button
                key={lead.id}
                onClick={() => navigate(`/admin/client/${lead.id}`)}
                className="w-full text-left bg-secondary/50 rounded-xl p-3 flex items-center justify-between hover:bg-secondary transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{lead.name}</p>
                  <p className="text-xs text-destructive">Risco: {lead.churn_risk}%</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Leads without action */}
      {stats.noAction > 0 && (
        <motion.div variants={fadeUp} className="bg-warning/5 rounded-xl p-3 border border-warning/20 flex items-center gap-2">
          <Target className="w-4 h-4 text-warning shrink-0" />
          <p className="text-xs text-warning">
            {stats.noAction} leads sem próxima ação definida! Passe pela fila inteligente para resolver.
          </p>
        </motion.div>
      )}

      {/* CTA */}
      <motion.div variants={fadeUp} className="space-y-2 pt-2">
        <Button className="w-full h-14 rounded-xl gap-2 text-base" onClick={() => navigate("/admin/queue")}>
          <Zap className="w-5 h-5" /> Iniciar Fila Inteligente
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 rounded-xl text-xs" onClick={() => navigate("/admin/tasks")}>
            📋 Ver tarefas
          </Button>
          <Button variant="outline" className="h-11 rounded-xl text-xs" onClick={() => navigate("/admin")}>
            📊 Dashboard
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminDailyBriefing;
