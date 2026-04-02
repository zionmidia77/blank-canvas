import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Bike, DollarSign, Clock, Sparkles, CheckCircle2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const Simulator = () => {
  const navigate = useNavigate();
  const [motoValue, setMotoValue] = useState([20000]);
  const [downPayment, setDownPayment] = useState([5000]);
  const [months, setMonths] = useState([36]);
  const [vehicleYear, setVehicleYear] = useState([new Date().getFullYear() - 3]);

  const financed = motoValue[0] - downPayment[0];
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - vehicleYear[0];
  // Aqui Financiamentos - Moto Leve, Coeficiente A, rate by vehicle age
  const getCoefTable = (age: number): Record<number, number> => {
    if (age <= 3) return { 12: 0.09800, 18: 0.07200, 24: 0.05850, 36: 0.04450, 48: 0.03800 };
    if (age <= 8) return { 12: 0.10100, 18: 0.07450, 24: 0.06050, 36: 0.04650, 48: 0.04000 };
    return { 12: 0.10500, 18: 0.07800, 24: 0.06350, 36: 0.04900, 48: 0.04250 };
  };
  const coefTable = getCoefTable(vehicleAge);
  const closest = [12, 18, 24, 36, 48].reduce((prev, curr) =>
    Math.abs(curr - months[0]) < Math.abs(prev - months[0]) ? curr : prev
  );
  const coef = coefTable[closest] || 0.04000;
  const monthly = financed > 0 ? financed * coef : 0;
  const freeValue = Math.max(0, motoValue[0] * 0.4 - downPayment[0] * 0.1);
  const totalPaid = monthly * closest;
  const totalInterest = totalPaid - financed;

  return (
    <div className="min-h-screen bg-background noise-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50 backdrop-blur-xl bg-background/80 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display font-bold text-lg">Simulador</h1>
          <p className="text-xs text-muted-foreground">Resultado em tempo real</p>
        </div>
      </div>

      <motion.div variants={stagger} initial="initial" animate="animate" className="px-5 py-6 space-y-5">
        <motion.p variants={fadeUp} className="text-muted-foreground text-sm">
          Com sua moto hoje, veja o que é possível 👇
        </motion.p>

        {/* Valor da moto */}
        <motion.div variants={fadeUp} className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground flex items-center gap-2"><Bike className="w-4 h-4 text-primary" /> Valor da moto</span>
            <span className="font-display font-bold text-lg tabular-nums">R$ {motoValue[0].toLocaleString("pt-BR")}</span>
          </div>
          <Slider value={motoValue} onValueChange={setMotoValue} min={5000} max={80000} step={1000} className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:shadow-lg" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>R$ 5.000</span><span>R$ 80.000</span>
          </div>
        </motion.div>

        {/* Entrada */}
        <motion.div variants={fadeUp} className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="w-4 h-4 text-success" /> Entrada</span>
            <span className="font-display font-bold text-lg tabular-nums">R$ {downPayment[0].toLocaleString("pt-BR")}</span>
          </div>
          <Slider value={downPayment} onValueChange={setDownPayment} min={0} max={motoValue[0] * 0.5} step={500} className="[&_[role=slider]]:bg-success [&_[role=slider]]:border-success [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:shadow-lg" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>R$ 0</span><span>R$ {(motoValue[0] * 0.5).toLocaleString("pt-BR")}</span>
          </div>
        </motion.div>

        {/* Parcelas */}
        <motion.div variants={fadeUp} className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4 text-info" /> Parcelas</span>
            <span className="font-display font-bold text-lg">{months[0]}x</span>
          </div>
          <Slider value={months} onValueChange={setMonths} min={12} max={60} step={6} className="[&_[role=slider]]:bg-info [&_[role=slider]]:border-info [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:shadow-lg" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>12x</span><span>60x</span>
          </div>
        </motion.div>

        {/* Ano do veículo */}
        <motion.div variants={fadeUp} className="glass-card p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Ano do veículo</span>
            <span className="font-display font-bold text-lg">{vehicleYear[0]}</span>
          </div>
          <Slider value={vehicleYear} onValueChange={setVehicleYear} min={2005} max={currentYear} step={1} className="[&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:shadow-lg" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>2005</span><span>{currentYear}</span>
          </div>
        </motion.div>

        {/* Results */}
        <motion.div variants={fadeUp} className="glass-card gradient-border p-6 space-y-5">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Parcela estimada</p>
            <motion.p
              key={monthly.toFixed(0)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-4xl font-display font-bold text-gradient tabular-nums"
            >
              R$ {monthly.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </motion.p>
            <p className="text-xs text-muted-foreground mt-1">/mês</p>
          </div>

          <div className="h-px bg-border/50" />

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Valor liberado</p>
              <p className="font-display font-bold text-success tabular-nums">R$ {freeValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Juros total</p>
              <p className="font-display font-bold text-warning tabular-nums">R$ {totalInterest.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">* Simulação aproximada. Condições sujeitas a análise.</p>
        </motion.div>

        {/* Suggestion */}
        <motion.div variants={fadeUp} className="glass-card p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium mb-0.5">Sugestão inteligente</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {months[0] > 36
                ? "Parcelas longas aumentam o custo total. Considere reduzir para 36x."
                : downPayment[0] < motoValue[0] * 0.15
                  ? "Uma entrada maior pode reduzir bastante sua parcela."
                  : "Boa configuração! Condições interessantes para negociar."
              }
            </p>
          </div>
        </motion.div>

        <Button className="w-full rounded-xl h-12 text-base glow-red group" onClick={async () => {
          try {
            await supabase.from("financing_simulations").insert({
              moto_value: motoValue[0],
              down_payment: downPayment[0],
              financed_amount: financed,
              months: months[0],
              monthly_payment: Math.round(monthly),
              interest_rate: coef,
              total_interest: Math.round(totalInterest),
              source: "simulator",
            });
          } catch {}
          navigate("/chat");
        }}>
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Quero essa condição 🔥
        </Button>
      </motion.div>
    </div>
  );
};

export default Simulator;
