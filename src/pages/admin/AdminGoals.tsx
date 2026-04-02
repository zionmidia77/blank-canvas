import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Target, TrendingUp, Users, DollarSign, Phone, ChevronLeft, ChevronRight, Settings2, Trophy, Flame, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = { animate: { transition: { staggerChildren: 0.1 } } };

// Animated circular progress
const CircularProgress = ({
  value,
  max,
  size = 140,
  strokeWidth = 10,
  color,
  label,
  icon: Icon,
  suffix = "",
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  icon: any;
  suffix?: string;
}) => {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(animatedValue / max, 1) : 0;
  const offset = circumference * (1 - pct);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 300);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="w-5 h-5 mb-1" style={{ color }} />
          <span className="text-2xl font-bold font-mono">
            {animatedValue}{suffix}
          </span>
          <span className="text-[10px] text-muted-foreground">de {max}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {Math.round(pct * 100)}% concluído
        </p>
      </div>
    </div>
  );
};

// Animated counter
const AnimatedNumber = ({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    const startVal = display;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startVal + (value - startVal) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <span>{prefix}{display.toLocaleString("pt-BR")}{suffix}</span>;
};

const AdminGoals = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [editOpen, setEditOpen] = useState(false);
  const [editGoals, setEditGoals] = useState({ target_sales: 10, target_revenue: 0, target_leads: 50, target_contacts: 100, target_ltv: 0 });
  const qc = useQueryClient();

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  // Fetch goal for selected month
  const { data: goal } = useQuery({
    queryKey: ["monthly-goal", month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_goals")
        .select("*")
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch actual metrics for selected month
  const { data: metrics } = useQuery({
    queryKey: ["monthly-metrics", month, year],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      const [salesRes, leadsRes, contactsRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id", { count: "exact" })
          .eq("pipeline_stage", "closed_won")
          .gte("updated_at", startDate)
          .lt("updated_at", endDate),
        supabase
          .from("clients")
          .select("id", { count: "exact" })
          .gte("created_at", startDate)
          .lt("created_at", endDate),
        supabase
          .from("interactions")
          .select("id", { count: "exact" })
          .gte("created_at", startDate)
          .lt("created_at", endDate),
      ]);

      return {
        sales: salesRes.count || 0,
        leads: leadsRes.count || 0,
        contacts: contactsRes.count || 0,
      };
    },
  });

  // Fetch previous month metrics for comparison
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const { data: prevMetrics } = useQuery({
    queryKey: ["monthly-metrics-prev", prevMonth, prevYear],
    queryFn: async () => {
      const startDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
      const endMonth = prevMonth === 12 ? 1 : prevMonth + 1;
      const endYear = prevMonth === 12 ? prevYear + 1 : prevYear;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      const [salesRes, leadsRes, contactsRes] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact" }).eq("pipeline_stage", "closed_won").gte("updated_at", startDate).lt("updated_at", endDate),
        supabase.from("clients").select("id", { count: "exact" }).gte("created_at", startDate).lt("created_at", endDate),
        supabase.from("interactions").select("id", { count: "exact" }).gte("created_at", startDate).lt("created_at", endDate),
      ]);
      return { sales: salesRes.count || 0, leads: leadsRes.count || 0, contacts: contactsRes.count || 0 };
    },
  });

  // Calculate LTV: avg revenue per client (closed_won) * avg lifespan
  const { data: ltvData } = useQuery({
    queryKey: ["ltv-data", month, year],
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      // Get simulations with revenue for the month
      const { data: sims } = await supabase
        .from("financing_simulations")
        .select("moto_value, client_id")
        .gte("created_at", startDate)
        .lt("created_at", endDate);

      const totalRevenue = sims?.reduce((sum, s) => sum + Number(s.moto_value || 0), 0) || 0;
      const uniqueClients = new Set(sims?.map(s => s.client_id).filter(Boolean)).size || 1;
      const avgRevenue = totalRevenue / Math.max(uniqueClients, 1);

      // Get referrals count for the month as a proxy for retention/repeat
      const { count: referralCount } = await supabase
        .from("referrals")
        .select("id", { count: "exact" })
        .gte("created_at", startDate)
        .lt("created_at", endDate);

      return { avgRevenue: Math.round(avgRevenue), totalRevenue: Math.round(totalRevenue), clientCount: uniqueClients, referrals: referralCount || 0 };
    },
  });

  const { data: prevLtvData } = useQuery({
    queryKey: ["ltv-data-prev", prevMonth, prevYear],
    queryFn: async () => {
      const startDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
      const endMonth = prevMonth === 12 ? 1 : prevMonth + 1;
      const endYear = prevMonth === 12 ? prevYear + 1 : prevYear;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      const { data: sims } = await supabase
        .from("financing_simulations")
        .select("moto_value, client_id")
        .gte("created_at", startDate)
        .lt("created_at", endDate);

      const totalRevenue = sims?.reduce((sum, s) => sum + Number(s.moto_value || 0), 0) || 0;
      const uniqueClients = new Set(sims?.map(s => s.client_id).filter(Boolean)).size || 1;
      return { avgRevenue: Math.round(totalRevenue / Math.max(uniqueClients, 1)), totalRevenue: Math.round(totalRevenue) };
    },
  });

  const targets = goal || { target_sales: 10, target_revenue: 0, target_leads: 50, target_contacts: 100, target_ltv: 0 };
  const actual = metrics || { sales: 0, leads: 0, contacts: 0 };
  const prev = prevMetrics || { sales: 0, leads: 0, contacts: 0 };
  const ltv = ltvData || { avgRevenue: 0, totalRevenue: 0, clientCount: 0, referrals: 0 };
  const prevLtv = prevLtvData || { avgRevenue: 0, totalRevenue: 0 };

  const navigate = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  const handleSaveGoals = async () => {
    try {
      if (goal) {
        const { error } = await supabase
          .from("monthly_goals")
          .update(editGoals)
          .eq("id", goal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("monthly_goals")
          .insert({ month, year, ...editGoals });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ["monthly-goal", month, year] });
      toast.success("Metas atualizadas!");
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar metas");
    }
  };

  const openEdit = () => {
    setEditGoals({
      target_sales: targets.target_sales,
      target_revenue: targets.target_revenue,
      target_leads: targets.target_leads,
      target_contacts: targets.target_contacts,
      target_ltv: (targets as any).target_ltv || 0,
    });
    setEditOpen(true);
  };

  // Growth comparison helper
  const growthPct = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const GrowthBadge = ({ current, previous, label }: { current: number; previous: number; label?: string }) => {
    const pct = growthPct(current, previous);
    const isUp = pct > 0;
    const isDown = pct < 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-green-400" : isDown ? "text-destructive" : "text-muted-foreground"}`}>
        {isUp ? <ArrowUpRight className="w-3 h-3" /> : isDown ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        {Math.abs(pct)}%{label ? ` ${label}` : ""}
      </span>
    );
  };

  const ltvPct = (targets as any).target_ltv > 0 ? Math.round((ltv.avgRevenue / (targets as any).target_ltv) * 100) : 0;

  const salesPct = targets.target_sales > 0 ? Math.round((actual.sales / targets.target_sales) * 100) : 0;
  const overallPct = Math.round(
    ((actual.sales / Math.max(targets.target_sales, 1)) * 50 +
      (actual.leads / Math.max(targets.target_leads, 1)) * 30 +
      (actual.contacts / Math.max(targets.target_contacts, 1)) * 20)
  );

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" /> Metas
          </h1>
          <p className="text-sm text-muted-foreground">Acompanhe seu progresso mensal</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full text-xs gap-1.5" onClick={openEdit}>
          <Settings2 className="w-3.5 h-3.5" /> Definir metas
        </Button>
      </motion.div>

      {/* Month navigation */}
      <motion.div variants={fadeUp} className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center min-w-[160px]">
          <p className="text-lg font-bold font-display">{MONTH_NAMES[month - 1]}</p>
          <p className="text-xs text-muted-foreground">{year}{isCurrentMonth ? " • Mês atual" : ""}</p>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(1)}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </motion.div>

      {/* Overall progress bar */}
      <motion.div variants={fadeUp} className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {overallPct >= 100 ? (
              <Trophy className="w-5 h-5 text-yellow-400" />
            ) : overallPct >= 70 ? (
              <Flame className="w-5 h-5 text-primary" />
            ) : (
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="font-medium text-sm">Progresso geral</span>
          </div>
          <span className="text-2xl font-bold font-mono">
            <AnimatedNumber value={Math.min(overallPct, 100)} suffix="%" />
          </span>
        </div>
        <div className="h-3 rounded-full bg-secondary overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(overallPct, 100)}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className={`h-full rounded-full ${
              overallPct >= 100
                ? "bg-gradient-to-r from-yellow-500 to-yellow-400"
                : overallPct >= 70
                  ? "bg-gradient-to-r from-primary to-primary/70"
                  : "bg-gradient-to-r from-muted-foreground/50 to-muted-foreground/30"
            }`}
          />
        </div>
        {overallPct >= 100 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm text-yellow-400 font-medium"
          >
            🏆 Parabéns! Meta atingida!
          </motion.p>
        )}
      </motion.div>

      {/* Circular progress rings */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 flex justify-center">
          <CircularProgress
            value={actual.sales}
            max={targets.target_sales}
            color="hsl(var(--primary))"
            label="Vendas"
            icon={DollarSign}
          />
        </div>
        <div className="glass-card p-4 flex justify-center">
          <CircularProgress
            value={actual.leads}
            max={targets.target_leads}
            color="hsl(142 71% 45%)"
            label="Novos Leads"
            icon={Users}
          />
        </div>
        <div className="glass-card p-4 flex justify-center">
          <CircularProgress
            value={actual.contacts}
            max={targets.target_contacts}
            color="hsl(217 91% 60%)"
            label="Contatos"
            icon={Phone}
          />
        </div>
      </motion.div>

      {/* Stats cards with growth comparison */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Vendas este mês</p>
            <GrowthBadge current={actual.sales} previous={prev.sales} />
          </div>
          <p className="text-3xl font-bold font-mono">
            <AnimatedNumber value={actual.sales} />
            <span className="text-sm text-muted-foreground font-normal">/{targets.target_sales}</span>
          </p>
          <p className={`text-xs mt-1 ${salesPct >= 100 ? "text-green-400" : salesPct >= 50 ? "text-yellow-400" : "text-muted-foreground"}`}>
            {salesPct >= 100 ? "🎯 Meta batida!" : `Faltam ${Math.max(targets.target_sales - actual.sales, 0)}`}
          </p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Leads captados</p>
            <GrowthBadge current={actual.leads} previous={prev.leads} />
          </div>
          <p className="text-3xl font-bold font-mono">
            <AnimatedNumber value={actual.leads} />
            <span className="text-sm text-muted-foreground font-normal">/{targets.target_leads}</span>
          </p>
          <p className="text-xs mt-1 text-muted-foreground">
            {actual.leads > 0
              ? `Taxa conv. ~${targets.target_sales > 0 && actual.leads > 0 ? Math.round((actual.sales / actual.leads) * 100) : 0}%`
              : "Sem leads ainda"}
          </p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Contatos realizados</p>
            <GrowthBadge current={actual.contacts} previous={prev.contacts} />
          </div>
          <p className="text-3xl font-bold font-mono">
            <AnimatedNumber value={actual.contacts} />
            <span className="text-sm text-muted-foreground font-normal">/{targets.target_contacts}</span>
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Dias restantes</p>
          <p className="text-3xl font-bold font-mono">
            {isCurrentMonth
              ? (() => {
                  const lastDay = new Date(year, month, 0).getDate();
                  return Math.max(lastDay - now.getDate(), 0);
                })()
              : "—"}
          </p>
          {isCurrentMonth && (
            <p className="text-xs mt-1 text-muted-foreground">
              {targets.target_sales - actual.sales > 0
                ? `~${Math.ceil((targets.target_sales - actual.sales) / Math.max(new Date(year, month, 0).getDate() - now.getDate(), 1))}/dia necessário`
                : "Meta atingida 🎉"}
            </p>
          )}
        </div>
      </motion.div>

      {/* LTV Section */}
      <motion.div variants={fadeUp} className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-display font-bold text-sm">LTV Mensal</h2>
          </div>
          {(targets as any).target_ltv > 0 && (
            <span className="text-xs text-muted-foreground">
              Meta: R$ {((targets as any).target_ltv).toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        {/* LTV progress bar */}
        {(targets as any).target_ltv > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>R$ {ltv.avgRevenue.toLocaleString("pt-BR")} / R$ {((targets as any).target_ltv).toLocaleString("pt-BR")}</span>
              <span>{Math.min(ltvPct, 100)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(ltvPct, 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${ltvPct >= 100 ? "bg-green-500" : "bg-primary"}`}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-xl bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">LTV Médio</p>
            <p className="text-lg font-bold font-mono">
              R$ <AnimatedNumber value={ltv.avgRevenue} />
            </p>
            <GrowthBadge current={ltv.avgRevenue} previous={prevLtv.avgRevenue} label="vs mês ant." />
          </div>
          <div className="text-center p-3 rounded-xl bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">Receita Total</p>
            <p className="text-lg font-bold font-mono">
              R$ <AnimatedNumber value={ltv.totalRevenue} />
            </p>
            <GrowthBadge current={ltv.totalRevenue} previous={prevLtv.totalRevenue} label="vs mês ant." />
          </div>
          <div className="text-center p-3 rounded-xl bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">Clientes</p>
            <p className="text-lg font-bold font-mono">
              <AnimatedNumber value={ltv.clientCount} />
            </p>
            <p className="text-xs text-muted-foreground">{ltv.referrals} indicações</p>
          </div>
        </div>
      </motion.div>

      {/* Edit goals dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Metas de {MONTH_NAMES[month - 1]} {year}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Meta de vendas (fechamentos)</label>
              <Input
                type="number"
                value={editGoals.target_sales}
                onChange={(e) => setEditGoals({ ...editGoals, target_sales: parseInt(e.target.value) || 0 })}
                className="rounded-xl bg-secondary border-border/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Meta de novos leads</label>
              <Input
                type="number"
                value={editGoals.target_leads}
                onChange={(e) => setEditGoals({ ...editGoals, target_leads: parseInt(e.target.value) || 0 })}
                className="rounded-xl bg-secondary border-border/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Meta de contatos (interações)</label>
              <Input
                type="number"
                value={editGoals.target_contacts}
                onChange={(e) => setEditGoals({ ...editGoals, target_contacts: parseInt(e.target.value) || 0 })}
                className="rounded-xl bg-secondary border-border/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Meta de receita (R$)</label>
              <Input
                type="number"
                value={editGoals.target_revenue}
                onChange={(e) => setEditGoals({ ...editGoals, target_revenue: parseFloat(e.target.value) || 0 })}
                className="rounded-xl bg-secondary border-border/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Meta de LTV médio (R$)</label>
              <Input
                type="number"
                value={editGoals.target_ltv}
                onChange={(e) => setEditGoals({ ...editGoals, target_ltv: parseFloat(e.target.value) || 0 })}
                className="rounded-xl bg-secondary border-border/50"
                placeholder="Ex: 25000"
              />
            </div>
            <Button className="w-full rounded-xl glow-red" onClick={handleSaveGoals}>
              Salvar metas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default AdminGoals;
