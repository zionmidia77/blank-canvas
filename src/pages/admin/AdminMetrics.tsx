import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, Clock, Users, Target, Flame,
  ArrowDownRight, ArrowUpRight, Zap, CalendarDays, Award, Filter, FileDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { generatePDFReport } from "@/lib/generateReport";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend,
  FunnelChart, Funnel, LabelList
} from "recharts";
import { useAllClients } from "@/hooks/useSupabase";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCardSkeleton, MetricsChartSkeleton } from "@/components/admin/SkeletonLoaders";
import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageTour from "@/components/admin/PageTour";

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const STAGE_ORDER = ["new", "contacted", "interested", "attending", "thinking", "waiting_response", "scheduled", "negotiating", "closed_won"];
const STAGE_LABELS: Record<string, string> = {
  new: "Novo", contacted: "Contatado", interested: "Interessado",
  attending: "Atendimento", thinking: "Pensando", waiting_response: "Aguardando",
  scheduled: "Agendado", negotiating: "Negociação", closed_won: "Fechado ✅", closed_lost: "Perdido ❌",
};

const FUNNEL_COLORS = [
  "hsl(217 91% 60%)", "hsl(38 92% 50%)", "hsl(25 95% 53%)",
  "hsl(262 83% 58%)", "hsl(45 93% 47%)", "hsl(180 70% 50%)",
  "hsl(220 70% 55%)", "hsl(142 71% 45%)", "hsl(120 60% 45%)",
];

const SOURCE_COLORS: Record<string, string> = {
  whatsapp: "hsl(142 70% 45%)",
  facebook: "hsl(217 89% 61%)",
  marketplace: "hsl(262 83% 58%)",
  indicação: "hsl(38 92% 50%)",
  loja: "hsl(0 72% 51%)",
  telefone: "hsl(180 70% 50%)",
  funnel: "hsl(340 75% 55%)",
  manual: "hsl(0 0% 55%)",
  desconhecido: "hsl(0 0% 40%)",
};

const AdminMetrics = () => {
  const { data: clients, isLoading } = useAllClients();
  const [period, setPeriod] = useState<"7" | "14" | "30">("14");

  const metrics = useMemo(() => {
    if (!clients) return null;

    const now = new Date();
    const days = parseInt(period);

    // ── Leads by source ──
    const sourceMap: Record<string, number> = {};
    clients.forEach(c => {
      const src = c.source || "desconhecido";
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    const bySource = Object.entries(sourceMap)
      .map(([name, value]) => ({ name, value, fill: SOURCE_COLORS[name] || "hsl(0 0% 45%)" }))
      .sort((a, b) => b.value - a.value);

    // ── Funnel stages with conversion rates ──
    const stageMap: Record<string, number> = {};
    clients.forEach(c => { stageMap[c.pipeline_stage] = (stageMap[c.pipeline_stage] || 0) + 1; });
    const funnelData = STAGE_ORDER.map((s, i) => {
      const value = stageMap[s] || 0;
      const prevValue = i > 0 ? (stageMap[STAGE_ORDER[i - 1]] || 0) : value;
      const conversionRate = prevValue > 0 ? Math.round((value / prevValue) * 100) : 0;
      return { key: s, name: STAGE_LABELS[s] || s, value, conversionRate };
    });

    // ── Temperature distribution ──
    const tempMap: Record<string, number> = { hot: 0, warm: 0, cold: 0, frozen: 0 };
    clients.forEach(c => { tempMap[c.temperature] = (tempMap[c.temperature] || 0) + 1; });
    const tempData = [
      { name: "🔥 Quente", value: tempMap.hot, color: "hsl(0 72% 51%)" },
      { name: "🟡 Morno", value: tempMap.warm, color: "hsl(38 92% 50%)" },
      { name: "🔵 Frio", value: tempMap.cold, color: "hsl(217 91% 60%)" },
      { name: "⬜ Inativo", value: tempMap.frozen, color: "hsl(0 0% 45%)" },
    ];

    // ── Response time ──
    const withResponse = clients.filter(c => c.response_time_hours != null);
    const avgResponse = withResponse.length > 0
      ? Math.round(withResponse.reduce((a, c) => a + (c.response_time_hours || 0), 0) / withResponse.length)
      : null;

    // ── Leads per day (dynamic period) ──
    const dailyMap: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyMap[d.toISOString().split("T")[0]] = 0;
    }
    clients.forEach(c => {
      const day = c.created_at.split("T")[0];
      if (day in dailyMap) dailyMap[day]++;
    });
    const dailyData = Object.entries(dailyMap).map(([date, count]) => {
      const d = new Date(date + "T12:00:00");
      return { day: `${d.getDate()}/${d.getMonth() + 1}`, leads: count, date };
    });

    // ── This week vs last week ──
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    startOfThisWeek.setHours(0, 0, 0, 0);
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    const thisWeekLeads = clients.filter(c => new Date(c.created_at) >= startOfThisWeek).length;
    const lastWeekLeads = clients.filter(c => {
      const d = new Date(c.created_at);
      return d >= startOfLastWeek && d < startOfThisWeek;
    }).length;
    const weekTrend = lastWeekLeads > 0
      ? Math.round(((thisWeekLeads - lastWeekLeads) / lastWeekLeads) * 100)
      : thisWeekLeads > 0 ? 100 : 0;

    // ── Core stats ──
    const total = clients.length;
    const won = stageMap["closed_won"] || 0;
    const lost = stageMap["closed_lost"] || 0;
    const conversionRate = total > 0 ? Math.round((won / total) * 100) : 0;
    const lossRate = total > 0 ? Math.round((lost / total) * 100) : 0;
    const avgScore = total > 0 ? Math.round(clients.reduce((a, c) => a + c.lead_score, 0) / total) : 0;

    // ── Top sources (for pie) ──
    const topSources = bySource.slice(0, 6);

    // ── Leads by day of week ──
    const dayOfWeekMap: Record<string, number> = { Dom: 0, Seg: 0, Ter: 0, Qua: 0, Qui: 0, Sex: 0, Sáb: 0 };
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    clients.forEach(c => {
      const d = new Date(c.created_at);
      dayOfWeekMap[dayNames[d.getDay()]]++;
    });
    const dayOfWeekData = dayNames.map(name => ({ name, leads: dayOfWeekMap[name] }));
    const bestDay = dayOfWeekData.reduce((a, b) => a.leads > b.leads ? a : b, dayOfWeekData[0]);

    return {
      bySource, funnelData, tempData, avgResponse, dailyData,
      total, won, lost, conversionRate, lossRate, avgScore,
      thisWeekLeads, lastWeekLeads, weekTrend,
      topSources, dayOfWeekData, bestDay,
    };
  }, [clients, period]);

  if (isLoading || !metrics) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
        </div>
        {[1, 2, 3].map(i => <MetricsChartSkeleton key={i} />)}
      </div>
    );
  }

  const statCards = [
    { label: "Total de leads", value: metrics.total, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Conversão", value: `${metrics.conversionRate}%`, icon: Target, color: "text-green-400", bg: "bg-green-500/10", sub: `${metrics.won} fechados` },
    { label: "Perda", value: `${metrics.lossRate}%`, icon: ArrowDownRight, color: "text-red-400", bg: "bg-red-500/10", sub: `${metrics.lost} perdidos` },
    { label: "Score médio", value: metrics.avgScore, icon: Award, color: "text-primary", bg: "bg-primary/10" },
  ];

  const metricsTourSteps = [
    { target: '[data-tour="metrics-period"]', title: "Período de análise", description: "Escolha entre 7, 14 ou 30 dias para ajustar o período de análise.", icon: CalendarDays, position: "bottom" as const },
    { target: '[data-tour="metrics-export"]', title: "Exportar relatório", description: "Gere um PDF completo com todas as métricas e gráficos para compartilhar.", icon: FileDown, position: "bottom" as const },
    { target: '[data-tour="metrics-stats"]', title: "Indicadores principais", description: "Veja total de leads, taxas de conversão e perda, e score médio de um relance.", icon: TrendingUp, position: "bottom" as const },
  ];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5 max-w-5xl">
      <PageTour tourKey="metrics" steps={metricsTourSteps} />
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Métricas Avançadas</h1>
          <p className="text-sm text-muted-foreground">Análise completa de desempenho e conversão</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-xl text-xs gap-1.5"
            onClick={() => generatePDFReport(metrics)}
            data-tour="metrics-export"
          >
            <FileDown className="w-3.5 h-3.5" /> Exportar PDF
          </Button>
          <Tabs value={period} onValueChange={v => setPeriod(v as any)} data-tour="metrics-period">
            <TabsList className="h-8">
              <TabsTrigger value="7" className="text-xs h-6 px-2">7d</TabsTrigger>
              <TabsTrigger value="14" className="text-xs h-6 px-2">14d</TabsTrigger>
              <TabsTrigger value="30" className="text-xs h-6 px-2">30d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <motion.div key={i} variants={fadeUp} className="glass-card p-4 relative overflow-hidden">
            <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-2xl font-display font-bold tabular-nums">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            {s.sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{s.sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* Week trend + Response time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <motion.div variants={fadeUp} className="glass-card p-4 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${metrics.weekTrend >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            {metrics.weekTrend >= 0
              ? <ArrowUpRight className="w-5 h-5 text-green-400" />
              : <ArrowDownRight className="w-5 h-5 text-red-400" />
            }
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">Tendência semanal</p>
            <p className={`text-xl font-display font-bold ${metrics.weekTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {metrics.weekTrend >= 0 ? '+' : ''}{metrics.weekTrend}%
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              {metrics.thisWeekLeads} esta semana · {metrics.lastWeekLeads} anterior
            </p>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="glass-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">Tempo médio de resposta</p>
            <p className="text-xl font-display font-bold">
              {metrics.avgResponse !== null ? `${metrics.avgResponse}h` : 'N/A'}
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              {metrics.avgResponse !== null && metrics.avgResponse <= 2
                ? '🟢 Excelente'
                : metrics.avgResponse !== null && metrics.avgResponse <= 6
                  ? '🟡 Pode melhorar'
                  : '🔴 Muito lento'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Best day insight */}
      <motion.div variants={fadeUp} className="glass-card p-3 flex items-center gap-3 border-l-4 border-l-primary">
        <Zap className="w-4 h-4 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Insight:</span> Seu melhor dia para leads é <span className="font-bold text-primary">{metrics.bestDay.name}</span> com {metrics.bestDay.leads} leads.
        </p>
      </motion.div>

      {/* Daily leads chart */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Leads por dia</span>
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            Total: {metrics.dailyData.reduce((a, b) => a + b.leads, 0)}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={metrics.dailyData}>
            <defs>
              <linearGradient id="lgMetrics" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(0 0% 50%)' }} interval={Math.ceil(parseInt(period) / 10)} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(0 0% 50%)' }} width={25} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: 'hsl(0 0% 9%)', border: '1px solid hsl(0 0% 15%)', borderRadius: '12px', fontSize: '12px' }}
              labelStyle={{ color: 'hsl(0 0% 70%)' }}
            />
            <Area type="monotone" dataKey="leads" stroke="hsl(0 72% 51%)" strokeWidth={2} fill="url(#lgMetrics)" dot={{ r: 2, fill: 'hsl(0 72% 51%)' }} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Conversion Rate Cards */}
      <motion.div variants={fadeUp}>
        <p className="text-sm font-medium mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-green-400" /> Taxas de Conversão por Etapa
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {metrics.funnelData.filter((_, i) => i > 0).map((stage, i) => {
            const prev = metrics.funnelData[i];
            const rateColor = stage.conversionRate >= 50 ? 'text-green-400' : stage.conversionRate >= 25 ? 'text-amber-400' : 'text-red-400';
            const rateBg = stage.conversionRate >= 50 ? 'bg-green-500/10' : stage.conversionRate >= 25 ? 'bg-amber-500/10' : 'bg-red-500/10';
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-3 text-center"
              >
                <p className="text-[9px] text-muted-foreground truncate mb-1">
                  {prev.name} → {stage.name}
                </p>
                <p className={`text-xl font-display font-bold tabular-nums ${rateColor}`}>
                  {stage.conversionRate}%
                </p>
                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full mt-1 ${rateBg}`}>
                  <span className="text-[9px] tabular-nums font-medium">{prev.value} → {stage.value}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Funnel de Conversão Visual */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <p className="text-sm font-medium mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Funil Visual
        </p>

        {/* Bar chart representation of funnel */}
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={metrics.funnelData} margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 15%)" vertical={false} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: 'hsl(0 0% 50%)' }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={50}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: 'hsl(0 0% 50%)' }} width={30} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: 'hsl(0 0% 9%)', border: '1px solid hsl(0 0% 15%)', borderRadius: '12px', fontSize: '12px' }}
              formatter={(value: number, _name: string, props: any) => {
                const idx = metrics.funnelData.findIndex(s => s.name === props.payload.name);
                const rate = idx > 0 ? ` (${metrics.funnelData[idx].conversionRate}% conv.)` : '';
                return [`${value} leads${rate}`, 'Quantidade'];
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={28}>
              {metrics.funnelData.map((_, i) => (
                <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} fillOpacity={0.75} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Horizontal funnel bars */}
        <div className="mt-4 space-y-1.5">
          {metrics.funnelData.map((stage, i) => {
            const maxVal = Math.max(...metrics.funnelData.map(s => s.value), 1);
            const width = Math.max((stage.value / maxVal) * 100, 6);
            return (
              <div key={i} className="group">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-24 text-right shrink-0 truncate">{stage.name}</span>
                  <div className="flex-1 h-7 bg-secondary/30 rounded-lg overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ duration: 0.5, delay: i * 0.06 }}
                      className="h-full rounded-lg flex items-center px-2.5"
                      style={{ backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length] + "40" }}
                    >
                      <span className="text-[11px] font-bold tabular-nums">{stage.value}</span>
                    </motion.div>
                  </div>
                  {i > 0 && (
                    <span className={`text-[10px] font-medium tabular-nums w-10 text-right shrink-0 ${
                      stage.conversionRate >= 50 ? 'text-green-400' : stage.conversionRate >= 25 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {stage.conversionRate}%
                    </span>
                  )}
                  {i === 0 && <span className="w-10 shrink-0" />}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 text-right">% = taxa de passagem da etapa anterior</p>
      </motion.div>

      {/* Leads by source + Temperature (side by side on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Leads por origem */}
        <motion.div variants={fadeUp} className="glass-card p-5">
          <p className="text-sm font-medium mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" /> Leads por origem
          </p>
          <ResponsiveContainer width="100%" height={Math.max(metrics.bySource.length * 36, 120)}>
            <BarChart data={metrics.bySource} layout="vertical" margin={{ left: 0 }}>
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(0 0% 50%)' }} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(0 0% 70%)' }} width={85} />
              <Tooltip contentStyle={{ background: 'hsl(0 0% 9%)', border: '1px solid hsl(0 0% 15%)', borderRadius: '12px', fontSize: '12px' }} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                {metrics.bySource.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Temperatura */}
        <motion.div variants={fadeUp} className="glass-card p-5">
          <p className="text-sm font-medium mb-4 flex items-center gap-2">
            <Flame className="w-4 h-4 text-primary" /> Temperatura dos leads
          </p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie
                  data={metrics.tempData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {metrics.tempData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {metrics.tempData.map((t, i) => {
                const pct = metrics.total > 0 ? Math.round((t.value / metrics.total) * 100) : 0;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="text-xs flex-1">{t.name}</span>
                    <span className="text-xs font-bold tabular-nums">{t.value}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Day of week heatmap */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <p className="text-sm font-medium mb-4 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-purple-400" /> Leads por dia da semana
        </p>
        <div className="flex gap-2">
          {metrics.dayOfWeekData.map((d, i) => {
            const maxLeads = Math.max(...metrics.dayOfWeekData.map(x => x.leads), 1);
            const intensity = d.leads / maxLeads;
            const isBest = d.name === metrics.bestDay.name;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div
                  className={`w-full aspect-square rounded-xl flex items-center justify-center text-xs font-bold tabular-nums transition-all ${
                    isBest ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
                  }`}
                  style={{
                    backgroundColor: `hsl(0 72% 51% / ${Math.max(intensity * 0.6, 0.05)})`,
                  }}
                >
                  {d.leads}
                </div>
                <span className={`text-[10px] ${isBest ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{d.name}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Source Pie Chart */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <p className="text-sm font-medium mb-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-cyan-400" /> Distribuição por canal
        </p>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={150} height={150}>
            <PieChart>
              <Pie
                data={metrics.topSources}
                cx="50%"
                cy="50%"
                outerRadius={68}
                dataKey="value"
                strokeWidth={0}
                paddingAngle={2}
              >
                {metrics.topSources.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(0 0% 9%)', border: '1px solid hsl(0 0% 15%)', borderRadius: '12px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {metrics.topSources.map((s, i) => {
              const pct = metrics.total > 0 ? Math.round((s.value / metrics.total) * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.fill }} />
                  <span className="text-xs flex-1 capitalize">{s.name}</span>
                  <span className="text-xs font-bold tabular-nums">{s.value}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Bottom spacer for mobile nav */}
      <div className="h-4" />
    </motion.div>
  );
};

export default AdminMetrics;
