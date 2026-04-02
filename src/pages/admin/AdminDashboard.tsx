import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft } from "lucide-react";
import {
  Users, Flame, AlertTriangle, TrendingUp, CalendarCheck,
  MessageCircle, Eye, ChevronRight, BarChart3, Target, Trophy, Activity,
  Cake, X, Gift, FileDown, Loader2, Kanban, Zap
} from "lucide-react";
import { fetchMonthlyData, generateMonthlyPDF } from "@/lib/generateMonthlyReport";
import { toast } from "sonner";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useDashboardStats, useClients, useOverdueTasks, useAllPendingTasks, useLeadsChartData } from "@/hooks/useSupabase";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import EmptyState from "@/components/EmptyState";
import ActivityFeed from "@/components/admin/ActivityFeed";
import LTVDashboard from "@/components/admin/LTVDashboard";
import SmartAlerts from "@/components/admin/SmartAlerts";
import AIUsageDashboard from "@/components/admin/AIUsageDashboard";
import SpeedToLeadCard from "@/components/admin/SpeedToLeadCard";
import InactivityAlerts from "@/components/admin/InactivityAlerts";
import LossReasonsChart from "@/components/admin/LossReasonsChart";
import { useOverdueLeads } from "@/hooks/useOverdueLeads";
import QueueAlertBanner from "@/components/admin/QueueAlertBanner";
import CadenceWidget from "@/components/admin/CadenceWidget";

const tempEmoji: Record<string, string> = { hot: "🔥", warm: "🟡", cold: "🔵", frozen: "⚪" };
const tempBg: Record<string, string> = { hot: "bg-primary/10", warm: "bg-warning/10", cold: "bg-info/10", frozen: "bg-muted" };

const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

// Animated counter component
const AnimatedCounter = ({ value, duration = 1.2 }: { value: number; duration?: number }) => {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    if (start === end) return;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(step);
      else prevValue.current = end;
    };
    requestAnimationFrame(step);
  }, [value, duration]);

  return <>{display}</>;
};

const formatTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentClients, isLoading: clientsLoading } = useClients();
  const { data: overdueTasks } = useOverdueTasks();
  const { data: pendingTasks } = useAllPendingTasks();
  const { data: chartData } = useLeadsChartData();
  const overdueLeadCount = useOverdueLeads();
  const [dismissedBirthday, setDismissedBirthday] = useState(false);
  const [dismissedUrgent, setDismissedUrgent] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  // Alert banner replaces auto-redirect (user chose "show alert only")
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const handleGenerateReport = async () => {
    setGeneratingPDF(true);
    setShowMonthPicker(false);
    try {
      const data = await fetchMonthlyData(reportMonth, reportYear);
      generateMonthlyPDF(data);
      toast.success(`Relatório de ${MONTH_NAMES_SHORT[reportMonth - 1]}/${reportYear} gerado!`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar relatório");
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Birthday query
  const { data: birthdayClients } = useQuery({
    queryKey: ["birthday-today"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name, phone, birthdate");
      if (!data) return [];
      const today = new Date();
      const m = today.getMonth() + 1;
      const d = today.getDate();
      return data.filter(c => {
        if (!c.birthdate) return false;
        const bd = new Date(c.birthdate + "T12:00:00");
        return bd.getMonth() + 1 === m && bd.getDate() === d;
      });
    },
  });

  const hotLeads = (recentClients || []).filter(c => c.temperature === "hot").slice(0, 5);
  const todayTasks = (pendingTasks || []).filter(t => t.due_date === new Date().toISOString().split("T")[0]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const statCards = [
    { label: "Leads novos", value: stats?.totalLeads || 0, icon: Users, color: "text-info", bg: "bg-info/10" },
    { label: "Leads quentes", value: stats?.hotLeads || 0, icon: Flame, color: "text-primary", bg: "bg-primary/10" },
    { label: "Follow-ups hoje", value: stats?.todayTasks || 0, icon: CalendarCheck, color: "text-success", bg: "bg-success/10" },
    { label: "Atrasados", value: stats?.overdueTasks || 0, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-4 md:p-6 space-y-5 md:space-y-6 max-w-4xl">
      {/* Queue Alert Banner */}
      <QueueAlertBanner />
      {/* Greeting */}
      <motion.div variants={fadeUp} className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">{greeting()}, Arsenal 👊</h1>
          <p className="text-sm text-muted-foreground">
            {(overdueTasks?.length || 0) > 0
              ? `⚠️ Você tem ${overdueTasks?.length} follow-ups atrasados`
              : "Tudo em dia! Continue assim 🔥"
            }
          </p>
        </div>
        <Popover open={showMonthPicker} onOpenChange={setShowMonthPicker}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" disabled={generatingPDF}>
              {generatingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Relatório PDF
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4" align="end">
            <div className="space-y-3">
              <p className="text-sm font-medium">Selecione o período</p>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReportYear(y => y - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold">{reportYear}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReportYear(y => y + 1)} disabled={reportYear >= new Date().getFullYear()}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {MONTH_NAMES_SHORT.map((m, i) => {
                  const isFuture = reportYear === new Date().getFullYear() && i + 1 > new Date().getMonth() + 1;
                  return (
                    <Button
                      key={m}
                      variant={reportMonth === i + 1 ? "default" : "ghost"}
                      size="sm"
                      className="h-8 text-xs"
                      disabled={isFuture}
                      onClick={() => setReportMonth(i + 1)}
                    >
                      {m}
                    </Button>
                  );
                })}
              </div>
              <Button className="w-full gap-2" size="sm" onClick={handleGenerateReport} disabled={generatingPDF}>
                {generatingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Gerar {MONTH_NAMES_SHORT[reportMonth - 1]}/{reportYear}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </motion.div>

      {/* 🎂 Birthday Banner */}
      <AnimatePresence>
        {(birthdayClients?.length || 0) > 0 && !dismissedBirthday && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-pink-500/10 p-4"
          >
            {/* Animated confetti dots */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{
                  background: ["#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#10b981", "#3b82f6"][i],
                  left: `${15 + i * 15}%`,
                  top: `${10 + (i % 3) * 30}%`,
                }}
                animate={{
                  y: [0, -8, 0],
                  opacity: [0.4, 1, 0.4],
                  scale: [0.8, 1.2, 0.8],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: "easeInOut",
                }}
              />
            ))}

            <button
              onClick={() => setDismissedBirthday(true)}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/20 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>

            <div className="flex items-start gap-3">
              <motion.div
                className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0"
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
              >
                <Cake className="w-5 h-5 text-amber-400" />
              </motion.div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-display font-semibold flex items-center gap-1.5">
                  🎂 {birthdayClients!.length === 1 ? "Aniversário hoje!" : `${birthdayClients!.length} aniversários hoje!`}
                </p>
                <div className="mt-1.5 space-y-1">
                  {birthdayClients!.map(client => (
                    <motion.div
                      key={client.id}
                      className="flex items-center gap-2"
                      whileHover={{ x: 4 }}
                    >
                      <span className="text-xs font-medium">{client.name}</span>
                      <div className="flex gap-1 ml-auto">
                        {client.phone && (
                          <Button
                            size="sm"
                            className="h-6 rounded-full text-[10px] gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-0"
                            variant="outline"
                            onClick={() => window.open(`https://wa.me/55${client.phone!.replace(/\D/g, "")}?text=${encodeURIComponent(`Parabéns pelo seu aniversário, ${client.name}! 🎂🎉 Aqui é da Arsenal Motors, desejamos tudo de melhor! 🥳`)}`)}
                          >
                            <Gift className="w-2.5 h-2.5" /> Parabenizar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 rounded-full text-[10px]"
                          onClick={() => navigate(`/admin/client/${client.id}`)}
                        >
                          <Eye className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🚨 Urgent Queue Banner */}
      {overdueLeadCount > 0 && !dismissedUrgent && (
        <motion.div
          variants={fadeUp}
          className="relative rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-4"
          animate={{ boxShadow: ["0 0 0 0 hsl(var(--destructive) / 0)", "0 0 16px 2px hsl(var(--destructive) / 0.2)", "0 0 0 0 hsl(var(--destructive) / 0)"] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <button onClick={() => setDismissedUrgent(true)} className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/20">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Zap className="w-5 h-5 text-destructive" />
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-display font-bold text-destructive">
                Você tem {overdueLeadCount} leads aguardando ação — resolver agora
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Leads com ações atrasadas perdem interesse rápido</p>
            </div>
          </div>
          <Button className="w-full mt-3 gap-2" size="sm" onClick={() => navigate("/admin/queue")}>
            <Zap className="w-4 h-4" /> Iniciar Fila Inteligente
          </Button>
        </motion.div>
      )}

      {/* 📱 Quick Actions - Mobile Only */}
      <motion.div variants={fadeUp} className="grid grid-cols-4 gap-2 md:hidden">
        {[
          { icon: Users, label: "Novo Lead", color: "text-info", bg: "bg-info/10", action: () => document.querySelector<HTMLButtonElement>('[data-tour="add-lead"] button')?.click() },
          { icon: Kanban, label: "Pipeline", color: "text-primary", bg: "bg-primary/10", action: () => navigate("/admin/pipeline") },
          { icon: MessageCircle, label: "Mensagens", color: "text-success", bg: "bg-success/10", action: () => navigate("/admin/messages") },
          { icon: CalendarCheck, label: "Agenda", color: "text-amber-500", bg: "bg-amber-500/10", action: () => navigate("/admin/calendar") },
        ].map((item, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.92 }}
            onClick={item.action}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl ${item.bg} active:opacity-70 transition-opacity`}
          >
            <item.icon className={`w-5 h-5 ${item.color}`} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {statCards.map((s, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            whileHover={{ scale: 1.04, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.97 }}
            className="glass-card-hover p-4 cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <motion.div
                className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}
                whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.4 } }}
              >
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </motion.div>
              {s.label === "Atrasados" && (s.value > 0) && (
                <motion.span
                  className="w-2.5 h-2.5 rounded-full bg-destructive"
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </div>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-display font-bold tabular-nums">
                <AnimatedCounter value={s.value} />
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Conversion Rate */}
      {stats && stats.totalLeads > 0 && (
        <motion.div
          variants={fadeUp}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
          className="glass-card gradient-border p-4 flex items-center gap-4 cursor-pointer"
        >
          <motion.div
            className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Trophy className="w-5 h-5 text-success" />
          </motion.div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Taxa de conversão</p>
            <p className="text-xl font-display font-bold"><AnimatedCounter value={Math.round(stats.conversionRate)} />%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Fechados</p>
            <p className="text-sm font-semibold text-success"><AnimatedCounter value={stats.closedWon} /> <span className="text-muted-foreground font-normal">/ {stats.totalLeads}</span></p>
          </div>
        </motion.div>
      )}

      {/* 🔥 DAILY ROUTINE */}
      <motion.div variants={fadeUp} className="glass-card gradient-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-display font-semibold">Hoje você precisa fazer:</p>
            <p className="text-[11px] text-muted-foreground">Foco nas ações que geram resultado</p>
          </div>
        </div>

        {/* Overdue alerts */}
        {(overdueTasks?.length || 0) > 0 && (
          <motion.div
            className="bg-destructive/10 rounded-xl p-3 border border-destructive/20"
            animate={{ boxShadow: ["0 0 0 0 hsl(var(--destructive) / 0)", "0 0 12px 2px hsl(var(--destructive) / 0.15)", "0 0 0 0 hsl(var(--destructive) / 0)"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <motion.div animate={{ rotate: [0, -15, 15, 0] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}>
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </motion.div>
              <span className="text-xs font-medium text-destructive">Follow-ups atrasados ({overdueTasks?.length})</span>
            </div>
            <div className="space-y-1.5">
              {overdueTasks?.slice(0, 3).map(task => {
                const clientData = task.clients as any;
                return (
                  <motion.div key={task.id} className="flex items-center gap-2" whileHover={{ x: 4, transition: { duration: 0.15 } }}>
                    <span className="text-[10px] text-destructive/70">{task.due_date}</span>
                    <span className="text-xs font-medium truncate flex-1">{clientData?.name}</span>
                    {clientData?.phone && (
                      <Button size="sm" className="h-6 ml-auto rounded-full text-[10px] gap-1" onClick={() => window.open(`https://wa.me/55${clientData.phone.replace(/\D/g, "")}`)}>
                        <MessageCircle className="w-2.5 h-2.5" /> Chamar
                      </Button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Hot leads to act on */}
        {hotLeads.length > 0 && (
          <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-primary">Leads quentes ({hotLeads.length})</span>
            </div>
            <div className="space-y-1.5">
              {hotLeads.slice(0, 3).map(client => (
                <div key={client.id} className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate flex-1">{client.name}</span>
                  <span className="text-[10px] text-muted-foreground">{client.interest}</span>
                  <Button size="sm" variant="outline" className="h-6 rounded-full text-[10px]" onClick={() => navigate(`/admin/client/${client.id}`)}>
                    <Eye className="w-2.5 h-2.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's follow-ups */}
        {todayTasks.length > 0 && (
          <div className="bg-success/5 rounded-xl p-3 border border-success/20">
            <div className="flex items-center gap-2 mb-2">
              <CalendarCheck className="w-4 h-4 text-success" />
              <span className="text-xs font-medium text-success">Retornos agendados ({todayTasks.length})</span>
            </div>
            <div className="space-y-1.5">
              {todayTasks.slice(0, 3).map(task => {
                const clientData = task.clients as any;
                return (
                  <div key={task.id} className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate flex-1">{clientData?.name}</span>
                    <span className="text-[10px] text-muted-foreground">{task.reason}</span>
                    {clientData?.phone && (
                      <Button size="sm" className="h-6 ml-auto rounded-full text-[10px] gap-1" onClick={() => window.open(`https://wa.me/55${clientData.phone.replace(/\D/g, "")}`)}>
                        <MessageCircle className="w-2.5 h-2.5" /> Chamar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hotLeads.length === 0 && todayTasks.length === 0 && (overdueTasks?.length || 0) === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            ✅ Nada pendente! Aproveite para prospectar novos leads.
          </p>
        )}
      </motion.div>

      {/* ⏱️ Speed-to-Lead */}
      <motion.div variants={fadeUp}>
        <SpeedToLeadCard />
      </motion.div>

      {/* 🎯 Follow-up por Inatividade */}
      <motion.div variants={fadeUp}>
        <InactivityAlerts />
      </motion.div>

      {/* ⚡ Cadence Widget */}
      <CadenceWidget />

      {/* 🧠 Smart Alerts */}
      <SmartAlerts />

      {/* LTV Automations Dashboard */}
      <LTVDashboard />

      {/* 📊 Motivos de Perda */}
      <motion.div variants={fadeUp}>
        <LossReasonsChart />
      </motion.div>

      {/* Chart - Real Data */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Leads esta semana</span>
          {chartData && (
            <span className="text-xs text-muted-foreground ml-auto">
              Total: {chartData.reduce((a, b) => a + b.leads, 0)}
            </span>
          )}
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={chartData || []}>
            <defs>
              <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(0 0% 50%)' }} />
            <Tooltip contentStyle={{ background: 'hsl(0 0% 9%)', border: '1px solid hsl(0 0% 15%)', borderRadius: '12px', fontSize: '12px' }} />
            <Area type="monotone" dataKey="leads" stroke="hsl(0 72% 51%)" strokeWidth={2} fill="url(#leadGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* AI Usage */}
      <motion.div variants={fadeUp}>
        <AIUsageDashboard />
      </motion.div>

      {/* Activity Feed */}
      <motion.div variants={fadeUp} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Atividades recentes</span>
        </div>
        <ActivityFeed />
      </motion.div>

      {/* Recent Leads */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold">Leads recentes</h2>
          <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={() => navigate("/admin/leads")}>
            Ver todos <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        {clientsLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        ) : recentClients && recentClients.length > 0 ? (
          <div className="space-y-2">
            {recentClients.slice(0, 5).map((client) => (
              <motion.div
                key={client.id}
                variants={fadeUp}
                whileHover={{ scale: 1.02, x: 4, transition: { duration: 0.15 } }}
                whileTap={{ scale: 0.98 }}
                className="glass-card-hover px-4 py-3 flex items-center gap-3 cursor-pointer"
                onClick={() => navigate(`/admin/client/${client.id}`)}
              >
                <div className={`w-9 h-9 rounded-full ${tempBg[client.temperature]} flex items-center justify-center text-xs font-bold shrink-0`}>
                  {tempEmoji[client.temperature]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{client.name}</p>
                  <p className="text-xs text-muted-foreground">{client.interest || "Sem interesse"} · {formatTimeAgo(client.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">{client.lead_score}pts</span>
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="Nenhum lead ainda"
            description="Compartilhe o funil de captura para começar a receber leads automaticamente!"
            actionLabel="Copiar link do funil"
            onAction={() => {
              navigator.clipboard.writeText(`${window.location.origin}/chat`);
              import("sonner").then(({ toast }) => toast.success("Link copiado!"));
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );
};

export default AdminDashboard;
