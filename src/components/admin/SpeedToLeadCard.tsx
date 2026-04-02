import { motion } from "framer-motion";
import { Clock, AlertTriangle, Zap, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const SpeedToLeadCard = () => {
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["speed-to-lead"],
    queryFn: async () => {
      // Get all leads with response_time_hours
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, phone, created_at, last_contact_at, response_time_hours, temperature, pipeline_stage")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!clients) return { avgTime: 0, unresponded: [], responded: 0 };

      // Calculate average response time
      const withResponse = clients.filter(c => c.response_time_hours != null && c.response_time_hours > 0);
      const avgTime = withResponse.length > 0 
        ? withResponse.reduce((sum, c) => sum + (c.response_time_hours || 0), 0) / withResponse.length 
        : 0;

      // Find leads not responded (new stage, no last_contact_at or created > 5 min ago)
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      const unresponded = clients.filter(c => {
        if (c.pipeline_stage !== "new") return false;
        if (c.last_contact_at) return false;
        return new Date(c.created_at).getTime() < fiveMinAgo;
      });

      return { avgTime: Math.round(avgTime * 10) / 10, unresponded, responded: withResponse.length };
    },
    refetchInterval: 30000, // refresh every 30s
  });

  if (!data) return null;

  const { avgTime, unresponded } = data;
  const isGood = avgTime > 0 && avgTime < 1;
  const isBad = avgTime > 2;

  const formatTime = (hours: number) => {
    if (hours === 0) return "—";
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    return `${Math.round(hours * 10) / 10}h`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
          isBad ? "bg-destructive/10" : isGood ? "bg-success/10" : "bg-warning/10"
        }`}>
          <Zap className={`w-4 h-4 ${
            isBad ? "text-destructive" : isGood ? "text-success" : "text-warning"
          }`} />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Speed-to-Lead</p>
          <p className="text-lg font-bold font-display">{formatTime(avgTime)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">Tempo médio de resposta</p>
          {isGood && <p className="text-[10px] text-success font-medium">✅ Excelente</p>}
          {isBad && <p className="text-[10px] text-destructive font-medium">⚠️ Muito lento</p>}
          {!isGood && !isBad && avgTime > 0 && <p className="text-[10px] text-warning font-medium">🟡 Pode melhorar</p>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, avgTime > 0 ? (1 / avgTime) * 100 : 0)}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${
            isBad ? "bg-destructive" : isGood ? "bg-success" : "bg-warning"
          }`}
        />
      </div>

      {/* Unresponded alerts */}
      {unresponded.length > 0 && (
        <motion.div
          className="bg-destructive/10 rounded-xl p-3 border border-destructive/20"
          animate={{
            boxShadow: [
              "0 0 0 0 hsl(var(--destructive) / 0)",
              "0 0 8px 2px hsl(var(--destructive) / 0.15)",
              "0 0 0 0 hsl(var(--destructive) / 0)",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            <span className="text-[11px] font-bold text-destructive">
              🚨 {unresponded.length} lead{unresponded.length > 1 ? "s" : ""} sem resposta!
            </span>
          </div>
          <div className="space-y-1.5">
            {unresponded.slice(0, 3).map(lead => {
              const waitMins = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 60000);
              return (
                <div key={lead.id} className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-destructive/70" />
                  <span className="text-xs font-medium truncate flex-1">{lead.name}</span>
                  <span className="text-[10px] text-destructive font-mono">
                    {waitMins < 60 ? `${waitMins}min` : `${Math.floor(waitMins / 60)}h${waitMins % 60}min`}
                  </span>
                  <Button
                    size="sm"
                    className="h-5 rounded-full text-[9px] px-2 gap-0.5"
                    onClick={() => navigate(`/admin/client/${lead.id}`)}
                  >
                    <Eye className="w-2.5 h-2.5" /> Atender
                  </Button>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <p className="text-[10px] text-muted-foreground text-center">
        💡 78% dos clientes compram de quem responde primeiro
      </p>
    </motion.div>
  );
};

export default SpeedToLeadCard;
