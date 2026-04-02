import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Zap, TrendingDown, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const AIUsageDashboard = () => {
  const { data: usage } = useQuery({
    queryKey: ["ai-usage-stats"],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [todayRes, weekRes, monthRes] = await Promise.all([
        supabase.from("ai_usage_logs").select("id, function_name, tokens_used, created_at").gte("created_at", todayStart),
        supabase.from("ai_usage_logs").select("id, function_name, tokens_used, created_at").gte("created_at", weekStart),
        supabase.from("ai_usage_logs").select("id, function_name, tokens_used, created_at").gte("created_at", monthStart),
      ]);

      const today = todayRes.data || [];
      const week = weekRes.data || [];
      const month = monthRes.data || [];

      const byFunction = (logs: typeof today) => {
        const map: Record<string, number> = {};
        logs.forEach(l => { map[l.function_name] = (map[l.function_name] || 0) + 1; });
        return Object.entries(map).map(([name, count]) => ({ name: fnLabel(name), count })).sort((a, b) => b.count - a.count);
      };

      const dailyBreakdown = () => {
        const days: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          const key = `${d.getDate()}/${d.getMonth() + 1}`;
          days[key] = 0;
        }
        week.forEach(l => {
          const d = new Date(l.created_at);
          const key = `${d.getDate()}/${d.getMonth() + 1}`;
          if (key in days) days[key]++;
        });
        return Object.entries(days).map(([day, calls]) => ({ day, calls }));
      };

      return {
        today: today.length,
        week: week.length,
        month: month.length,
        todayTokens: today.reduce((s, l) => s + (l.tokens_used || 0), 0),
        weekTokens: week.reduce((s, l) => s + (l.tokens_used || 0), 0),
        monthTokens: month.reduce((s, l) => s + (l.tokens_used || 0), 0),
        byFunctionToday: byFunction(today),
        byFunctionMonth: byFunction(month),
        dailyChart: dailyBreakdown(),
      };
    },
    refetchInterval: 30000,
  });

  if (!usage) return null;

  const colors = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--info))", "hsl(var(--destructive))"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          Uso de IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Hoje", value: usage.today, tokens: usage.todayTokens, icon: Zap },
            { label: "Semana", value: usage.week, tokens: usage.weekTokens, icon: BarChart3 },
            { label: "Mês", value: usage.month, tokens: usage.monthTokens, icon: TrendingDown },
          ].map(s => (
            <div key={s.label} className="bg-secondary/30 rounded-lg p-3 text-center">
              <s.icon className="w-4 h-4 mx-auto mb-1 text-primary" />
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              {s.tokens > 0 && (
                <p className="text-[9px] text-muted-foreground mt-0.5">{(s.tokens / 1000).toFixed(1)}k tokens</p>
              )}
            </div>
          ))}
        </div>

        {/* Daily chart */}
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={usage.dailyChart}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                formatter={(v: number) => [`${v} chamadas`, "IA"]}
              />
              <Bar dataKey="calls" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By function */}
        <Tabs defaultValue="today" className="w-full">
          <TabsList className="w-full h-8">
            <TabsTrigger value="today" className="text-xs flex-1">Hoje</TabsTrigger>
            <TabsTrigger value="month" className="text-xs flex-1">Mês</TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="mt-2 space-y-1.5">
            {usage.byFunctionToday.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhuma chamada hoje</p>
            ) : usage.byFunctionToday.map((f, i) => (
              <div key={f.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                  <span>{f.name}</span>
                </div>
                <span className="font-mono font-medium">{f.count}x</span>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="month" className="mt-2 space-y-1.5">
            {usage.byFunctionMonth.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhuma chamada este mês</p>
            ) : usage.byFunctionMonth.map((f, i) => (
              <div key={f.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                  <span>{f.name}</span>
                </div>
                <span className="font-mono font-medium">{f.count}x</span>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

function fnLabel(name: string): string {
  const map: Record<string, string> = {
    "ai-chat": "Chat IA",
    "ai-copilot": "Copilot",
    "transcribe-audio": "Transcrição",
    "analyze-document": "Análise Doc",
    "extract-vehicle-doc": "OCR Veículo",
    "extract-lead-from-image": "Lead por Foto",
  };
  return map[name] || name;
}

export default AIUsageDashboard;
