import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Ban } from "lucide-react";

const LOSS_LABELS: Record<string, { label: string; color: string }> = {
  price_high: { label: "Preço alto", color: "hsl(0, 72%, 51%)" },
  financing_rejected: { label: "Financiamento recusado", color: "hsl(30, 90%, 50%)" },
  bought_elsewhere: { label: "Comprou em outro", color: "hsl(200, 70%, 50%)" },
  no_response: { label: "Sumiu", color: "hsl(260, 60%, 55%)" },
  no_budget: { label: "Sem orçamento", color: "hsl(45, 80%, 50%)" },
  changed_mind: { label: "Desistiu", color: "hsl(170, 60%, 45%)" },
  other: { label: "Outro", color: "hsl(0, 0%, 50%)" },
};

const LossReasonsChart = () => {
  const { data } = useQuery({
    queryKey: ["loss-reasons"],
    queryFn: async () => {
      const { data: clients } = await supabase
        .from("clients")
        .select("funnel_data")
        .eq("pipeline_stage", "closed_lost")
        .limit(500);

      if (!clients) return [];

      const counts: Record<string, number> = {};
      clients.forEach(c => {
        const reason = (c.funnel_data as any)?.loss_reason;
        if (reason) {
          counts[reason] = (counts[reason] || 0) + 1;
        } else {
          counts["unknown"] = (counts["unknown"] || 0) + 1;
        }
      });

      return Object.entries(counts)
        .map(([key, value]) => ({
          name: LOSS_LABELS[key]?.label || "Sem motivo",
          value,
          color: LOSS_LABELS[key]?.color || "hsl(0, 0%, 40%)",
          percentage: Math.round((value / clients.length) * 100),
        }))
        .sort((a, b) => b.value - a.value);
    },
  });

  if (!data?.length) return null;

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
          <Ban className="w-4 h-4 text-destructive" />
        </div>
        <div>
          <p className="text-sm font-medium font-display">Motivos de Perda</p>
          <p className="text-[10px] text-muted-foreground">{total} leads perdidos</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-28 h-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={50}
                dataKey="value"
                strokeWidth={2}
                stroke="hsl(var(--background))"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => [`${value} leads`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-1.5">
          {data.slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-xs truncate flex-1">{item.name}</span>
              <span className="text-xs font-bold font-mono">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {data[0] && (
        <div className="bg-destructive/5 rounded-lg p-2 border border-destructive/20">
          <p className="text-[10px] text-center">
            ⚠️ <span className="font-bold">{data[0].percentage}%</span> das perdas são por <span className="font-bold">{data[0].name.toLowerCase()}</span>
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default LossReasonsChart;
