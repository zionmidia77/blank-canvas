import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { TrendingUp, TrendingDown, Target, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, subDays, startOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(142 71% 45%)", "hsl(48 96% 53%)"];

const useBotLogsHistory = (days = 14) =>
  useQuery({
    queryKey: ["bot-logs-history", days],
    queryFn: async () => {
      const since = subDays(new Date(), days).toISOString();
      const { data, error } = await supabase
        .from("bot_logs")
        .select("id, event_type, lead_created, error, created_at, bot_config_id, platform")
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

const useBotConfigs = () =>
  useQuery({
    queryKey: ["bot-configs-perf"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_configs").select("id, seller_name, bot_type");
      if (error) throw error;
      return data;
    },
  });

const BotPerformanceDashboard = () => {
  const { data: logs, isLoading } = useBotLogsHistory(14);
  const { data: configs } = useBotConfigs();

  const configMap = useMemo(() => {
    const map = new Map<string, { name: string; type: string }>();
    configs?.forEach((c) => map.set(c.id, { name: c.seller_name, type: c.bot_type || "messaging" }));
    return map;
  }, [configs]);

  const { dailyData, totals, errorRate, avgLeadsPerDay, trend, eventBreakdown, botBreakdown } = useMemo(() => {
    if (!logs?.length) return { dailyData: [], totals: { total: 0, leads: 0, errors: 0 }, errorRate: 0, avgLeadsPerDay: 0, trend: 0, eventBreakdown: [], botBreakdown: [] };

    const days = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() });
    const dayMap = new Map<string, { date: string; label: string; leads: number; errors: number; messages: number; total: number }>();
    days.forEach((d) => {
      const key = format(d, "yyyy-MM-dd");
      dayMap.set(key, { date: key, label: format(d, "dd/MM", { locale: ptBR }), leads: 0, errors: 0, messages: 0, total: 0 });
    });

    let totalLeads = 0, totalErrors = 0;
    const eventCounts = new Map<string, number>();
    const botCounts = new Map<string, { leads: number; errors: number; total: number }>();

    logs.forEach((log) => {
      const dayKey = format(new Date(log.created_at), "yyyy-MM-dd");
      const day = dayMap.get(dayKey);
      if (day) {
        day.total++;
        if (log.lead_created) { day.leads++; totalLeads++; }
        if (log.error) { day.errors++; totalErrors++; }
        if (log.event_type === "message") day.messages++;
      }

      eventCounts.set(log.event_type, (eventCounts.get(log.event_type) || 0) + 1);

      const botId = log.bot_config_id;
      if (!botCounts.has(botId)) botCounts.set(botId, { leads: 0, errors: 0, total: 0 });
      const bc = botCounts.get(botId)!;
      bc.total++;
      if (log.lead_created) bc.leads++;
      if (log.error) bc.errors++;
    });

    const dailyData = Array.from(dayMap.values());
    const total = logs.length;
    const errorRate = total > 0 ? (totalErrors / total) * 100 : 0;
    const activeDays = dailyData.filter((d) => d.total > 0).length || 1;
    const avgLeadsPerDay = totalLeads / activeDays;

    // Trend: compare last 7 days vs previous 7
    const last7 = dailyData.slice(-7).reduce((s, d) => s + d.leads, 0);
    const prev7 = dailyData.slice(0, 7).reduce((s, d) => s + d.leads, 0);
    const trend = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : last7 > 0 ? 100 : 0;

    const eventBreakdown = Array.from(eventCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const botBreakdown = Array.from(botCounts.entries()).map(([id, counts]) => ({
      name: configMap.get(id)?.name || id.slice(0, 8),
      type: configMap.get(id)?.type || "messaging",
      ...counts,
      conversionRate: counts.total > 0 ? ((counts.leads / counts.total) * 100).toFixed(1) : "0",
    }));

    return {
      dailyData,
      totals: { total, leads: totalLeads, errors: totalErrors },
      errorRate,
      avgLeadsPerDay,
      trend,
      eventBreakdown,
      botBreakdown,
    };
  }, [logs, configMap]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse"><CardContent className="p-6 h-24" /></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Total de Eventos"
          value={totals.total.toLocaleString("pt-BR")}
          subtitle="últimos 14 dias"
          icon={<Zap className="w-4 h-4" />}
          color="text-primary"
        />
        <KPICard
          label="Leads Capturados"
          value={totals.leads.toLocaleString("pt-BR")}
          subtitle={`~${avgLeadsPerDay.toFixed(1)}/dia`}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="text-green-500"
          trend={trend}
        />
        <KPICard
          label="Taxa de Erro"
          value={`${errorRate.toFixed(1)}%`}
          subtitle={`${totals.errors} erros`}
          icon={<AlertTriangle className="w-4 h-4" />}
          color={errorRate > 10 ? "text-destructive" : "text-yellow-500"}
        />
        <KPICard
          label="Taxa Conversão"
          value={`${totals.total > 0 ? ((totals.leads / totals.total) * 100).toFixed(1) : 0}%`}
          subtitle="eventos → leads"
          icon={<Target className="w-4 h-4" />}
          color="text-blue-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Leads por dia */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Leads Capturados por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Bar dataKey="leads" name="Leads" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="errors" name="Erros" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Linha de tendência */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tendência de Atividade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="leads" name="Leads" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="messages" name="Mensagens" stroke="hsl(48 96% 53%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bot Breakdown */}
      {botBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Performance por Bot</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {botBreakdown.map((bot) => (
                <div key={bot.name} className="flex items-center justify-between p-3 rounded-lg bg-accent/50">
                  <div>
                    <p className="font-medium text-sm">{bot.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{bot.type}</p>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-sm font-bold text-green-500">{bot.leads}</p>
                      <p className="text-[10px] text-muted-foreground">leads</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-destructive">{bot.errors}</p>
                      <p className="text-[10px] text-muted-foreground">erros</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {bot.conversionRate}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const KPICard = ({ label, value, subtitle, icon, color, trend }: {
  label: string; value: string; subtitle: string; icon: React.ReactNode; color: string; trend?: number;
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center justify-between mb-1">
        <span className={`${color}`}>{icon}</span>
        {trend !== undefined && trend !== 0 && (
          <div className={`flex items-center gap-0.5 text-xs ${trend > 0 ? "text-green-500" : "text-destructive"}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(0)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
    </CardContent>
  </Card>
);

export default BotPerformanceDashboard;
