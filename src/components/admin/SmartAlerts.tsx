import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Zap, RefreshCw, Cake, DollarSign, TrendingUp, Clock,
  MessageCircle, Eye, Check, X, ChevronDown, ChevronUp,
  Sparkles, AlertCircle, Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface SmartAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: number;
  clientId: string;
  clientName: string;
  clientPhone?: string | null;
  source: "opportunity" | "task";
  sourceId: string;
  createdAt: string;
}

const ALERT_CONFIG: Record<string, { icon: typeof Zap; label: string; color: string; bg: string; emoji: string }> = {
  upgrade: { icon: TrendingUp, label: "Upgrade", color: "text-blue-400", bg: "bg-blue-500/10", emoji: "🔄" },
  trade: { icon: RefreshCw, label: "Troca", color: "text-blue-400", bg: "bg-blue-500/10", emoji: "🔄" },
  refinance: { icon: DollarSign, label: "Refinanciamento", color: "text-cyan-400", bg: "bg-cyan-500/10", emoji: "💰" },
  birthday: { icon: Cake, label: "Aniversário", color: "text-pink-400", bg: "bg-pink-500/10", emoji: "🎂" },
  milestone: { icon: Calendar, label: "Marco", color: "text-green-400", bg: "bg-green-500/10", emoji: "🏆" },
  reactivation: { icon: Sparkles, label: "Reativação", color: "text-amber-400", bg: "bg-amber-500/10", emoji: "⚡" },
  revision: { icon: Clock, label: "Revisão", color: "text-purple-400", bg: "bg-purple-500/10", emoji: "🛡️" },
  stale: { icon: AlertCircle, label: "Sem resposta", color: "text-destructive", bg: "bg-destructive/10", emoji: "⚠️" },
  upsell: { icon: TrendingUp, label: "Upsell", color: "text-indigo-400", bg: "bg-indigo-500/10", emoji: "📈" },
};

const SmartAlerts = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Fetch pending opportunities with client data
  const { data: opportunities } = useQuery({
    queryKey: ["smart-alerts-opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*, client:client_id(id, name, phone)")
        .eq("status", "pending")
        .order("priority", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch auto-generated tasks (pending, from auto source)
  const { data: autoTasks } = useQuery({
    queryKey: ["smart-alerts-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, clients:client_id(id, name, phone)")
        .eq("status", "pending")
        .eq("source", "auto")
        .order("priority", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Merge into unified alerts
  const alerts: SmartAlert[] = [
    ...(opportunities || []).map((opp): SmartAlert => {
      const client = opp.client as any;
      return {
        id: `opp-${opp.id}`,
        type: opp.type as SmartAlert["type"],
        title: opp.title,
        message: opp.message || "",
        priority: opp.priority,
        clientId: client?.id || opp.client_id,
        clientName: client?.name || "—",
        clientPhone: client?.phone,
        source: "opportunity",
        sourceId: opp.id,
        createdAt: opp.created_at,
      };
    }),
    ...(autoTasks || [])
      .filter(t => {
        // Avoid duplicating opportunities already shown
        const isOpportunityTask = t.type === "opportunity";
        if (isOpportunityTask) return false;
        return true;
      })
      .map((task): SmartAlert => {
        const client = task.clients as any;
        const alertType = task.reason?.includes("revisão") || task.reason?.includes("Revisão")
          ? "revision"
          : task.reason?.includes("Check-in") ? "milestone"
          : task.reason?.includes("IPVA") ? "revision"
          : task.reason?.includes("aniversário") || task.reason?.includes("Aniversário") ? "birthday"
          : task.reason?.includes("upgrade") || task.reason?.includes("Upgrade") ? "upgrade"
          : task.reason?.includes("sem resposta") || task.reason?.includes("recontatar") ? "stale"
          : "reactivation";
        return {
          id: `task-${task.id}`,
          type: alertType,
          title: task.reason,
          message: "",
          priority: task.priority || 5,
          clientId: client?.id || task.client_id,
          clientName: client?.name || "—",
          clientPhone: client?.phone,
          source: "task",
          sourceId: task.id,
          createdAt: task.created_at,
        };
      }),
  ].sort((a, b) => b.priority - a.priority);

  const actOnAlert = useMutation({
    mutationFn: async (alert: SmartAlert) => {
      if (alert.source === "opportunity") {
        await supabase
          .from("opportunities")
          .update({ status: "acted", acted_at: new Date().toISOString() })
          .eq("id", alert.sourceId);
      } else {
        await supabase
          .from("tasks")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", alert.sourceId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smart-alerts-opportunities"] });
      qc.invalidateQueries({ queryKey: ["smart-alerts-tasks"] });
      toast.success("✅ Ação concluída!");
    },
  });

  const dismissAlert = useMutation({
    mutationFn: async (alert: SmartAlert) => {
      if (alert.source === "opportunity") {
        await supabase
          .from("opportunities")
          .update({ status: "dismissed" })
          .eq("id", alert.sourceId);
      } else {
        await supabase
          .from("tasks")
          .update({ status: "dismissed" })
          .eq("id", alert.sourceId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["smart-alerts-opportunities"] });
      qc.invalidateQueries({ queryKey: ["smart-alerts-tasks"] });
    },
  });

  const getQuickMessage = (alert: SmartAlert) => {
    const firstName = alert.clientName.split(" ")[0];
    switch (alert.type) {
      case "birthday":
        return `Fala ${firstName}! 🎂 Parabéns pelo seu aniversário! A Arsenal Motors deseja tudo de bom pra você! Passa aqui que temos uma surpresa especial! 🎉`;
      case "upgrade":
      case "trade":
        return `E aí ${firstName}! Já faz um tempo que você tá com sua moto. Que tal dar um upgrade? Temos condições especiais pra quem já é cliente Arsenal! 🔥`;
      case "refinance":
        return `Fala ${firstName}! Vi aqui que pode ser um bom momento pra renegociar suas condições. Quer ver como melhorar sua parcela? 💰`;
      case "revision":
        return `Opa ${firstName}! Tá chegando a hora da revisão da sua moto. Quer agendar? A gente cuida de tudo pra você! 🛡️`;
      case "stale":
        return `Fala ${firstName}! Passando pra ver se você ainda tem interesse. Posso ajudar em algo? 😊`;
      case "milestone":
        return `Fala ${firstName}! Passando pra ver como tá tudo com sua moto. Precisa de algo? Tamo aqui! 💪`;
      default:
        return `Fala ${firstName}! Passando pra ver como você tá. Precisa de algo? 😊`;
    }
  };

  const sendWhatsApp = (alert: SmartAlert) => {
    if (!alert.clientPhone) { toast.error("Cliente sem telefone"); return; }
    const phone = alert.clientPhone.replace(/\D/g, "");
    const msg = getQuickMessage(alert);
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`);
    actOnAlert.mutate(alert);
  };

  if (alerts.length === 0) return null;

  const displayAlerts = showAll ? alerts : alerts.slice(0, 5);

  // Group by type for summary
  const typeCounts = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-4"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <motion.div
            className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Zap className="w-4.5 h-4.5 text-primary" />
          </motion.div>
          <div className="text-left">
            <p className="text-sm font-display font-semibold">Alertas Inteligentes</p>
            <p className="text-[10px] text-muted-foreground">
              {alerts.length} oportunidades detectadas automaticamente
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.span
            className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            {alerts.length}
          </motion.span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-3 overflow-hidden"
          >
            {/* Type summary chips */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(typeCounts).map(([type, count]) => {
                const config = ALERT_CONFIG[type] || ALERT_CONFIG.reactivation;
                return (
                  <span key={type} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} text-[10px] font-medium ${config.color}`}>
                    {config.emoji} {config.label} ({count})
                  </span>
                );
              })}
            </div>

            {/* Alert cards */}
            <div className="space-y-2">
              {displayAlerts.map((alert, i) => {
                const config = ALERT_CONFIG[alert.type] || ALERT_CONFIG.reactivation;
                const Icon = config.icon;

                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-secondary/30 rounded-xl p-3 space-y-2 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium truncate flex-1">{alert.title}</p>
                          <span className={`text-[9px] font-medium ${config.color} px-1.5 py-0.5 rounded-full ${config.bg}`}>
                            P{alert.priority}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          👤 {alert.clientName}
                          {alert.message && ` · ${alert.message.slice(0, 60)}${alert.message.length > 60 ? "..." : ""}`}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 pl-10">
                      {alert.clientPhone && (
                        <Button
                          size="sm"
                          className="h-6 rounded-full text-[10px] gap-1 flex-1"
                          onClick={() => sendWhatsApp(alert)}
                        >
                          <MessageCircle className="w-2.5 h-2.5" /> WhatsApp
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 rounded-full text-[10px] gap-1"
                        onClick={() => navigate(`/admin/client/${alert.clientId}`)}
                      >
                        <Eye className="w-2.5 h-2.5" /> Ver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 rounded-full text-[10px] gap-1"
                        onClick={() => actOnAlert.mutate(alert)}
                      >
                        <Check className="w-2.5 h-2.5" /> Feito
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 rounded-full"
                        onClick={() => dismissAlert.mutate(alert)}
                      >
                        <X className="w-2.5 h-2.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {alerts.length > 5 && (
              <Button
                variant="ghost"
                className="w-full h-8 text-xs text-muted-foreground"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? "Mostrar menos" : `Ver todos (${alerts.length})`}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SmartAlerts;