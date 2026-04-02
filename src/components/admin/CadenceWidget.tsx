import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Zap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const CadenceWidget = () => {
  const navigate = useNavigate();

  const { data: cadenceStats } = useQuery({
    queryKey: ["cadence-stats"],
    queryFn: async () => {
      const now = new Date().toISOString();

      // Active cadences (pending steps)
      const { count: activeCount } = await supabase
        .from("cadence_steps")
        .select("client_id", { count: "exact", head: true })
        .is("completed_at", null)
        .eq("skipped", false);

      // Overdue steps
      const { count: overdueCount } = await supabase
        .from("cadence_steps")
        .select("*", { count: "exact", head: true })
        .is("completed_at", null)
        .eq("skipped", false)
        .is("task_id", null)
        .lt("scheduled_for", now);

      // Due today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const { count: todayCount } = await supabase
        .from("cadence_steps")
        .select("*", { count: "exact", head: true })
        .is("completed_at", null)
        .eq("skipped", false)
        .gte("scheduled_for", todayStart.toISOString())
        .lte("scheduled_for", todayEnd.toISOString());

      return {
        active: activeCount || 0,
        overdue: overdueCount || 0,
        today: todayCount || 0,
      };
    },
    refetchInterval: 60000,
  });

  if (!cadenceStats || (cadenceStats.active === 0 && cadenceStats.overdue === 0)) return null;

  return (
    <motion.div variants={fadeUp} className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Cadências Ativas
        </h3>
        <button
          onClick={() => navigate("/admin/leads")}
          className="text-xs text-primary flex items-center gap-1 hover:underline"
        >
          Ver leads <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{cadenceStats.active}</p>
          <p className="text-[10px] text-muted-foreground">Ativas</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-warning">{cadenceStats.today}</p>
          <p className="text-[10px] text-muted-foreground">Hoje</p>
        </div>
        <div className="text-center">
          <p className={`text-lg font-bold ${cadenceStats.overdue > 0 ? "text-destructive" : "text-success"}`}>
            {cadenceStats.overdue}
          </p>
          <p className="text-[10px] text-muted-foreground">Atrasadas</p>
        </div>
      </div>
    </motion.div>
  );
};

export default CadenceWidget;
