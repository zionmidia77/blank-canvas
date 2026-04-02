import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Cake, PhoneCall, ArrowUpCircle, Sparkles, ChevronRight, ChevronDown, ChevronUp,
  TrendingUp, MessageCircle, Gift, Eye, CheckCircle2, DollarSign, Users, RefreshCw,
  Clock, BarChart3
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import { toast } from "sonner";

const useLTVStats = () =>
  useQuery({
    queryKey: ["ltv-dashboard-stats"],
    queryFn: async () => {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      // Birthdays this month
      const { data: birthdays } = await supabase
        .from("clients")
        .select("id, name, birthdate, phone")
        .not("birthdate", "is", null)
        .neq("status", "lost");

      const birthdaysThisMonth = (birthdays || []).filter((c) => {
        if (!c.birthdate) return false;
        const d = new Date(c.birthdate + "T12:00:00");
        return d.getMonth() + 1 === month;
      });

      const birthdaysToday = birthdaysThisMonth.filter((c) => {
        const d = new Date(c.birthdate! + "T12:00:00");
        return d.getDate() === day;
      });

      // Pending check-in tasks
      const { data: checkinTasks } = await supabase
        .from("tasks")
        .select("id, client_id, reason, due_date, clients(name, phone)")
        .eq("type", "relationship")
        .eq("status", "pending")
        .ilike("reason", "%check-in%")
        .order("due_date", { ascending: true })
        .limit(10);

      // Pending upgrade opportunities
      const { data: upgrades } = await supabase
        .from("opportunities")
        .select("id, client_id, title, message, clients(name, phone)")
        .eq("type", "trade")
        .eq("status", "pending")
        .order("priority", { ascending: false })
        .limit(10);

      // Pending birthday opportunities
      const { data: bdayOpps } = await supabase
        .from("opportunities")
        .select("id")
        .eq("type", "birthday")
        .eq("status", "pending");

      // Check who was already congratulated today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: congratulated } = await supabase
        .from("interactions")
        .select("client_id")
        .eq("type", "system")
        .ilike("content", "%parabéns enviado%")
        .gte("created_at", todayStart.toISOString());

      // NPS trend - last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data: npsData } = await supabase
        .from("nps_responses")
        .select("score, created_at")
        .gte("created_at", sixMonthsAgo.toISOString())
        .order("created_at", { ascending: true });

      // Group NPS by month
      const npsMonthly: Record<string, { total: number; count: number }> = {};
      (npsData || []).forEach((r) => {
        const d = new Date(r.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!npsMonthly[key]) npsMonthly[key] = { total: 0, count: 0 };
        npsMonthly[key].total += r.score;
        npsMonthly[key].count += 1;
      });

      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const npsTrend = Object.entries(npsMonthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => {
          const [, m] = key.split("-");
          return {
            month: monthNames[parseInt(m) - 1],
            avg: Math.round((val.total / val.count) * 10) / 10,
            count: val.count,
          };
        });

      // Overall NPS average
      const allScores = (npsData || []).map((r) => r.score);
      const npsAvg = allScores.length > 0 ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : null;

      const congratulatedIds = new Set((congratulated || []).map(c => c.client_id));

      // === LTV METRICS ===
      // All clients for lifecycle analysis
      const { data: allClients } = await supabase
        .from("clients")
        .select("id, name, status, pipeline_stage, created_at, updated_at");
      const clients = allClients || [];

      // All financing simulations (revenue proxy)
      const { data: allSims } = await supabase
        .from("financing_simulations")
        .select("client_id, moto_value, created_at")
        .eq("status", "approved");

      // All vehicles (purchased)
      const { data: allVehicles } = await supabase
        .from("vehicles")
        .select("client_id, estimated_value, created_at, status");

      // Calculate LTV metrics
      const totalClients = clients.length;
      const activeClients = clients.filter(c => c.status === "active").length;
      const closedWon = clients.filter(c => c.pipeline_stage === "closed_won").length;

      // Revenue per client from vehicles
      const vehiclesByClient: Record<string, { count: number; totalValue: number; dates: string[] }> = {};
      (allVehicles || []).forEach(v => {
        if (!vehiclesByClient[v.client_id]) vehiclesByClient[v.client_id] = { count: 0, totalValue: 0, dates: [] };
        vehiclesByClient[v.client_id].count += 1;
        vehiclesByClient[v.client_id].totalValue += Number(v.estimated_value || 0);
        vehiclesByClient[v.client_id].dates.push(v.created_at);
      });

      // Average LTV (avg revenue per client with vehicles)
      const clientsWithVehicles = Object.keys(vehiclesByClient).length;
      const totalRevenue = Object.values(vehiclesByClient).reduce((s, v) => s + v.totalValue, 0);
      const avgLTV = clientsWithVehicles > 0 ? totalRevenue / clientsWithVehicles : 0;

      // Repurchase rate (clients with 2+ vehicles)
      const repeatBuyers = Object.values(vehiclesByClient).filter(v => v.count >= 2).length;
      const repurchaseRate = clientsWithVehicles > 0 ? (repeatBuyers / clientsWithVehicles) * 100 : 0;

      // Average time to second purchase
      let avgDaysToSecond = 0;
      let secondPurchaseCount = 0;
      Object.values(vehiclesByClient).forEach(v => {
        if (v.dates.length >= 2) {
          const sorted = v.dates.map(d => new Date(d).getTime()).sort();
          const daysDiff = (sorted[1] - sorted[0]) / (1000 * 60 * 60 * 24);
          avgDaysToSecond += daysDiff;
          secondPurchaseCount += 1;
        }
      });
      avgDaysToSecond = secondPurchaseCount > 0 ? avgDaysToSecond / secondPurchaseCount : 0;

      // Lifecycle stages distribution
      const lifecycleStages = [
        { name: "Novos", value: clients.filter(c => c.pipeline_stage === "new").length, color: "hsl(var(--info))" },
        { name: "Em contato", value: clients.filter(c => ["contacted", "interested", "attending"].includes(c.pipeline_stage)).length, color: "hsl(var(--warning))" },
        { name: "Negociando", value: clients.filter(c => ["negotiating", "scheduled"].includes(c.pipeline_stage)).length, color: "hsl(var(--primary))" },
        { name: "Fechados", value: closedWon, color: "hsl(var(--success))" },
        { name: "Perdidos", value: clients.filter(c => c.pipeline_stage === "closed_lost").length, color: "hsl(var(--muted-foreground))" },
      ].filter(s => s.value > 0);

      // Monthly revenue trend (from vehicles created_at)
      const revenueByMonth: Record<string, number> = {};
      (allVehicles || []).forEach(v => {
        const d = new Date(v.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        revenueByMonth[key] = (revenueByMonth[key] || 0) + Number(v.estimated_value || 0);
      });
      const revenueTrend = Object.entries(revenueByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([key, val]) => ({
          month: monthNames[parseInt(key.split("-")[1]) - 1],
          revenue: val,
        }));

      // Client retention (active vs churned)
      const retentionRate = totalClients > 0 ? ((totalClients - clients.filter(c => c.status === "lost").length) / totalClients) * 100 : 100;

      return {
        birthdaysToday,
        birthdaysThisMonth,
        checkinTasks: checkinTasks || [],
        upgrades: upgrades || [],
        pendingBdayOpps: bdayOpps?.length || 0,
        congratulatedIds,
        npsTrend,
        npsAvg,
        npsTotal: allScores.length,
        // LTV metrics
        avgLTV,
        totalRevenue,
        repurchaseRate,
        repeatBuyers,
        clientsWithVehicles,
        avgDaysToSecond,
        lifecycleStages,
        revenueTrend,
        retentionRate,
        totalClients,
        activeClients,
        closedWon,
      };
    },
  });

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

const LTVDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useLTVStats();
  const [showBirthdays, setShowBirthdays] = useState(true);

  const markCongratulated = useMutation({
    mutationFn: async (client: { id: string; name: string }) => {
      // Insert interaction
      await supabase.from("interactions").insert({
        client_id: client.id,
        type: "system" as const,
        content: `🎂 Parabéns enviado para ${client.name} (aniversário)`,
        created_by: "user",
      });
      // Mark birthday opportunity as acted (if exists)
      await supabase
        .from("opportunities")
        .update({ status: "acted", acted_at: new Date().toISOString() })
        .eq("client_id", client.id)
        .eq("type", "birthday")
        .eq("status", "pending");
      // Complete birthday task (if exists)
      await supabase
        .from("tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("client_id", client.id)
        .eq("type", "relationship")
        .eq("status", "pending")
        .ilike("reason", "%aniversário%");
    },
    onSuccess: (_, client) => {
      toast.success(`✅ ${client.name} marcado como parabenizado!`);
      queryClient.invalidateQueries({ queryKey: ["ltv-dashboard-stats"] });
    },
    onError: () => toast.error("Erro ao marcar como parabenizado"),
  });

  if (isLoading) {
    return (
      <div className="glass-card p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: "Aniversários",
      sublabel: "este mês",
      value: data.birthdaysThisMonth.length,
      highlight: data.birthdaysToday.length,
      highlightLabel: "hoje",
      icon: Cake,
      color: "text-pink-400",
      bg: "bg-pink-400/10",
      border: "border-pink-400/20",
    },
    {
      label: "Check-ins",
      sublabel: "pendentes",
      value: data.checkinTasks.length,
      icon: PhoneCall,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      border: "border-cyan-400/20",
    },
    {
      label: "Upgrades",
      sublabel: "oportunidades",
      value: data.upgrades.length,
      icon: ArrowUpCircle,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      border: "border-amber-400/20",
    },
  ];

  const hasItems =
    data.birthdaysToday.length > 0 ||
    data.checkinTasks.length > 0 ||
    data.upgrades.length > 0;

  return (
    <motion.div variants={fadeUp} className="glass-card gradient-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <div>
          <p className="text-sm font-display font-semibold">Automações LTV</p>
          <p className="text-[11px] text-muted-foreground">Relacionamento & retenção de clientes</p>
        </div>
      </div>

      {/* === LTV METRICS SECTION === */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <p className="text-xs font-display font-semibold">Métricas de LTV</p>
        </div>

        {/* Key metrics row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-background/60 p-3 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-success" />
              <span className="text-[10px] text-muted-foreground">LTV Médio</span>
            </div>
            <p className="text-xl font-display font-bold text-success">
              {data.avgLTV > 0 ? `R$ ${(data.avgLTV / 1000).toFixed(1)}k` : "—"}
            </p>
            <p className="text-[9px] text-muted-foreground">{data.clientsWithVehicles} clientes com veículos</p>
          </div>
          <div className="rounded-xl bg-background/60 p-3 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <RefreshCw className="w-3.5 h-3.5 text-info" />
              <span className="text-[10px] text-muted-foreground">Taxa de Recompra</span>
            </div>
            <p className="text-xl font-display font-bold text-info">
              {data.repurchaseRate > 0 ? `${data.repurchaseRate.toFixed(0)}%` : "0%"}
            </p>
            <p className="text-[9px] text-muted-foreground">{data.repeatBuyers} compraram 2x+</p>
          </div>
          <div className="rounded-xl bg-background/60 p-3 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-warning" />
              <span className="text-[10px] text-muted-foreground">Tempo p/ 2ª Compra</span>
            </div>
            <p className="text-xl font-display font-bold text-warning">
              {data.avgDaysToSecond > 0 ? `${Math.round(data.avgDaysToSecond)}d` : "—"}
            </p>
            <p className="text-[9px] text-muted-foreground">média em dias</p>
          </div>
          <div className="rounded-xl bg-background/60 p-3 border border-border/30">
            <div className="flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] text-muted-foreground">Retenção</span>
            </div>
            <p className="text-xl font-display font-bold text-primary">
              {data.retentionRate.toFixed(0)}%
            </p>
            <p className="text-[9px] text-muted-foreground">{data.activeClients} ativos / {data.totalClients} total</p>
          </div>
        </div>

        {/* Revenue summary */}
        {data.totalRevenue > 0 && (
          <div className="rounded-xl bg-gradient-to-r from-success/10 to-primary/10 p-3 border border-success/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Receita Total Estimada</p>
                <p className="text-2xl font-display font-bold text-success">
                  R$ {(data.totalRevenue / 1000).toFixed(0)}k
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">Vendas fechadas</p>
                <p className="text-lg font-display font-bold">{data.closedWon}</p>
              </div>
            </div>
          </div>
        )}

        {/* Lifecycle funnel */}
        {data.lifecycleStages.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Ciclo de Vida dos Clientes
            </p>
            <div className="space-y-1.5">
              {data.lifecycleStages.map((stage) => {
                const maxVal = Math.max(...data.lifecycleStages.map(s => s.value));
                const pct = maxVal > 0 ? (stage.value / maxVal) * 100 : 0;
                return (
                  <div key={stage.name} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-20 shrink-0">{stage.name}</span>
                    <div className="flex-1 h-5 bg-secondary/50 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full flex items-center justify-end px-2"
                        style={{ backgroundColor: stage.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(pct, 8)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      >
                        <span className="text-[9px] font-bold text-white">{stage.value}</span>
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Revenue trend chart */}
        {data.revenueTrend.length > 1 && (
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Receita Mensal (últimos 6 meses)
            </p>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={data.revenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }}
                  formatter={(value: number) => [`R$ ${(value/1000).toFixed(1)}k`, "Receita"]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3">
        {cards.map((card, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.97 }}
            className={`rounded-xl p-3 border ${card.border} ${card.bg} cursor-pointer relative overflow-hidden`}
          >
            <card.icon className={`w-4 h-4 ${card.color} mb-2`} />
            <p className="text-2xl font-display font-bold tabular-nums">{card.value}</p>
            <p className="text-[10px] text-muted-foreground">{card.label}</p>
            <p className="text-[9px] text-muted-foreground">{card.sublabel}</p>
            {card.highlight != null && card.highlight > 0 && (
              <motion.span
                className="absolute top-2 right-2 text-[9px] font-bold bg-pink-500 text-white px-1.5 py-0.5 rounded-full"
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {card.highlight} {card.highlightLabel}
              </motion.span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Today's birthday alerts - expandable */}
      {data.birthdaysToday.length > 0 && (
        <div className="rounded-xl border border-pink-400/20 overflow-hidden">
          <button
            onClick={() => setShowBirthdays(!showBirthdays)}
            className="w-full flex items-center gap-2 p-3 bg-pink-400/5 hover:bg-pink-400/10 transition-colors"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 4 }}
            >
              <Cake className="w-4 h-4 text-pink-400" />
            </motion.div>
            <span className="text-xs font-medium text-pink-400 flex-1 text-left">
              🎂 Aniversariantes hoje ({data.birthdaysToday.length})
            </span>
            {(() => {
              const pending = data.birthdaysToday.filter(c => !data.congratulatedIds.has(c.id)).length;
              const done = data.birthdaysToday.length - pending;
              if (pending === 0) {
                return (
                  <span className="text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
                    ✓ Todos parabenizados
                  </span>
                );
              }
              return (
                <motion.span
                  className="text-[9px] font-bold bg-pink-500 text-white px-1.5 py-0.5 rounded-full"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {done > 0 ? `${done}/${data.birthdaysToday.length} feitos` : "Ação pendente"}
                </motion.span>
              );
            })()}
            {showBirthdays ? (
              <ChevronUp className="w-3.5 h-3.5 text-pink-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-pink-400" />
            )}
          </button>

          <AnimatePresence>
            {showBirthdays && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="p-3 space-y-2 bg-pink-400/5">
                  {data.birthdaysToday.map((client) => {
                    const age = client.birthdate
                      ? new Date().getFullYear() - new Date(client.birthdate + "T12:00:00").getFullYear()
                      : null;
                    const isCongratulated = data.congratulatedIds.has(client.id);
                    return (
                      <motion.div
                        key={client.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-2 p-2 rounded-lg border ${
                          isCongratulated
                            ? "bg-emerald-400/5 border-emerald-400/20"
                            : "bg-background/40 border-pink-400/10"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                          isCongratulated ? "bg-emerald-400/20" : "bg-pink-400/20"
                        }`}>
                          {isCongratulated ? "✅" : "🎂"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{client.name}</p>
                          {isCongratulated ? (
                            <p className="text-[10px] text-emerald-400 font-medium">Já parabenizado ✓</p>
                          ) : age ? (
                            <p className="text-[10px] text-muted-foreground">Fazendo {age} anos</p>
                          ) : null}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {!isCongratulated && (
                            <>
                              {client.phone && (
                                <Button
                                  size="sm"
                                  className="h-7 rounded-full text-[10px] gap-1 bg-green-600 hover:bg-green-700 text-white border-0"
                                  onClick={() => {
                                    window.open(
                                      `https://wa.me/55${client.phone!.replace(/\D/g, "")}?text=${encodeURIComponent(
                                        `Parabéns pelo seu aniversário, ${client.name}! 🎂🎉 Aqui é da Arsenal Motors, desejamos tudo de melhor pra você! 🥳`
                                      )}`
                                    );
                                    markCongratulated.mutate({ id: client.id, name: client.name });
                                  }}
                                >
                                  <MessageCircle className="w-3 h-3" /> Parabéns
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 rounded-full text-[10px] gap-1 border-emerald-400/30 text-emerald-400"
                                onClick={() => markCongratulated.mutate({ id: client.id, name: client.name })}
                                disabled={markCongratulated.isPending}
                              >
                                <CheckCircle2 className="w-3 h-3" /> Feito
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full text-[10px] gap-1 border-pink-400/30 text-pink-400"
                            onClick={() => navigate(`/admin/client/${client.id}`)}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Birthdays this month (not today) */}
      {data.birthdaysThisMonth.filter(c => !data.birthdaysToday.some(t => t.id === c.id)).length > 0 && (
        <div className="rounded-xl p-3 border border-border/50 bg-secondary/20">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            📅 Próximos aniversários este mês
          </p>
          <div className="space-y-1">
            {data.birthdaysThisMonth
              .filter(c => !data.birthdaysToday.some(t => t.id === c.id))
              .sort((a, b) => {
                const da = new Date(a.birthdate! + "T12:00:00").getDate();
                const db = new Date(b.birthdate! + "T12:00:00").getDate();
                return da - db;
              })
              .map(client => {
                const day = new Date(client.birthdate! + "T12:00:00").getDate();
                return (
                  <div key={client.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono w-8">dia {day}</span>
                    <span className="text-xs font-medium truncate flex-1">{client.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 rounded-full text-[10px]"
                      onClick={() => navigate(`/admin/client/${client.id}`)}
                    >
                      <Eye className="w-2.5 h-2.5" />
                    </Button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Pending check-ins */}
      {data.checkinTasks.length > 0 && (
        <div className="bg-cyan-400/5 rounded-xl p-3 border border-cyan-400/20">
          <div className="flex items-center gap-2 mb-2">
            <PhoneCall className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-medium text-cyan-400">
              Check-ins pendentes ({data.checkinTasks.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {data.checkinTasks.slice(0, 3).map((task) => {
              const client = task.clients as any;
              return (
                <div key={task.id} className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate flex-1">{client?.name}</span>
                  <span className="text-[10px] text-muted-foreground">{task.due_date}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 rounded-full text-[10px] gap-1 border-cyan-400/30 text-cyan-400"
                    onClick={() => navigate(`/admin/client/${(task as any).client_id}`)}
                  >
                    Ver
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending upgrades */}
      {data.upgrades.length > 0 && (
        <div className="bg-amber-400/5 rounded-xl p-3 border border-amber-400/20">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">
              Oportunidades de upgrade ({data.upgrades.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {data.upgrades.slice(0, 3).map((opp) => {
              const client = opp.clients as any;
              return (
                <div key={opp.id} className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate flex-1">{client?.name}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{opp.title}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 rounded-full text-[10px] gap-1 border-amber-400/30 text-amber-400"
                    onClick={() => navigate(`/admin/client/${opp.client_id}`)}
                  >
                    Ver
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NPS Trend Chart */}
      <div className="rounded-xl p-3 border border-border/50 bg-secondary/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium">Tendência NPS</span>
          </div>
          {data.npsAvg !== null && (
            <div className="flex items-center gap-2">
              <span className={`text-lg font-display font-bold ${
                data.npsAvg >= 9 ? "text-emerald-400" : data.npsAvg >= 7 ? "text-amber-400" : "text-red-400"
              }`}>
                {data.npsAvg}
              </span>
              <span className="text-[9px] text-muted-foreground">
                média ({data.npsTotal} respostas)
              </span>
            </div>
          )}
        </div>

        {data.npsTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={data.npsTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11 }}
                formatter={(value: number) => [`${value}`, "NPS médio"]}
                labelFormatter={(label) => `${label}`}
              />
              <ReferenceLine y={7} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.3} />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[10px] text-muted-foreground text-center py-6">
            Nenhuma resposta NPS registrada ainda
          </p>
        )}
      </div>

      {!hasItems && data.npsTrend.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3">
          ✅ Nenhuma automação LTV pendente. Tudo em dia!
        </p>
      )}
    </motion.div>
  );
};

export default LTVDashboard;
