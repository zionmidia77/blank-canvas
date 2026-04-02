import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRightLeft, DollarSign, TrendingUp, Calculator,
  ChevronRight, Bell, Bike, Sparkles, ArrowUpRight
} from "lucide-react";

const alerts = [
  { text: "Sua moto está valorizada! Bom momento pra troca 🔥", icon: TrendingUp, accent: "border-primary/30" },
  { text: "Você pode melhorar sua parcela em R$ 45/mês", icon: DollarSign, accent: "border-success/30" },
];

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const ClientDashboard = () => {
  const navigate = useNavigate();
  const clientName = "Lucas";

  return (
    <div className="min-h-screen bg-background noise-bg pb-28">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <motion.div variants={stagger} initial="initial" animate="animate">
          <motion.h1 variants={fadeUp} className="text-2xl font-display font-bold">
            Fala, {clientName} 👋
          </motion.h1>
          <motion.p variants={fadeUp} className="text-sm text-muted-foreground mt-1">Sua central Arsenal Motors</motion.p>
        </motion.div>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background animate-pulse" />
        </Button>
      </div>

      {/* Alerts */}
      <div className="px-5 space-y-2 mb-5">
        {alerts.map((alert, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className={`glass-card-hover px-4 py-3 flex items-center gap-3 ${alert.accent}`}
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <alert.icon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm text-foreground/90 flex-1">{alert.text}</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </motion.div>
        ))}
      </div>

      {/* Cards */}
      <motion.div variants={stagger} initial="initial" animate="animate" className="px-5 space-y-4">
        {/* Valor da moto */}
        <motion.div variants={fadeUp} className="glass-card gradient-border p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bike className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">Valor da sua moto</span>
            <ArrowUpRight className="w-3 h-3 text-success ml-auto" />
          </div>
          <p className="text-3xl font-display font-bold text-gradient">R$ 18.500 - R$ 22.000</p>
          <p className="text-xs text-muted-foreground mt-1.5">Valor estimado atual de mercado</p>
        </motion.div>

        {/* Dinheiro disponível */}
        <motion.div variants={fadeUp} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-success" />
            <span className="text-sm text-muted-foreground">Dinheiro disponível</span>
          </div>
          <p className="text-3xl font-display font-bold">R$ 8.500</p>
          <p className="text-xs text-muted-foreground mt-1.5">Você pode liberar até esse valor</p>
          <Button onClick={() => navigate("/simulator")} className="mt-4 w-full rounded-xl glow-red group h-11">
            Simular agora <Sparkles className="w-4 h-4 ml-1 transition-transform group-hover:rotate-12" />
          </Button>
        </motion.div>

        {/* Progresso */}
        <motion.div variants={fadeUp} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Seu progresso</span>
            <span className="text-sm font-semibold text-primary font-display">18 / 36</span>
          </div>
          <Progress value={50} className="h-2.5 bg-secondary" />
          <p className="text-xs text-muted-foreground mt-2.5">Você já pagou 18 de 36 parcelas 🎯</p>
        </motion.div>

        {/* Oportunidade */}
        <motion.div variants={fadeUp} className="glass-card gradient-border p-5">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Momento pra troca!</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Sua moto tá num ótimo momento. Condições especiais disponíveis.</p>
          <Button variant="outline" className="w-full rounded-xl border-primary/30 hover:bg-primary hover:text-primary-foreground transition-all group h-11">
            Ver opções <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </motion.div>

      {/* Fixed bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-xl border-t border-border/50 px-5 py-3 z-20">
        <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
          {[
            { icon: ArrowRightLeft, label: "Trocar" },
            { icon: DollarSign, label: "Vender" },
            { icon: TrendingUp, label: "Dinheiro" },
            { icon: Calculator, label: "Simular", route: "/simulator" },
          ].map((item, i) => (
            <Button
              key={i}
              variant="ghost"
              onClick={() => item.route && navigate(item.route)}
              className="flex flex-col items-center gap-1 h-auto py-2.5 hover:bg-primary/10 rounded-xl transition-all active:scale-95"
            >
              <item.icon className="w-5 h-5 text-primary" />
              <span className="text-[10px] text-muted-foreground font-medium">{item.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
