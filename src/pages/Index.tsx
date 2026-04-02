import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { Bike, ArrowRight, Shield, Zap, Users, Star, ChevronRight, ShoppingBag, Lock } from "lucide-react";
import FloatingChatButton from "@/components/FloatingChatButton";
import { Helmet } from "react-helmet-async";

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const testimonials = [
  { name: "Lucas M.", text: "Troquei minha moto em 2 dias. Atendimento top!", rating: 5 },
  { name: "Ana C.", text: "Melhor experiência que já tive comprando moto.", rating: 5 },
  { name: "Pedro S.", text: "Simulador me ajudou demais. Recomendo!", rating: 5 },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background noise-bg overflow-hidden">
      <Helmet>
        <title>Arsenal Motors — Motos e Carros Novos e Seminovos</title>
        <meta name="description" content="Arsenal Motors: compre, troque ou venda seu veículo com atendimento personalizado. Simulação de financiamento em até 60x. Avaliação gratuita do seu usado." />
        <meta property="og:title" content="Arsenal Motors — Motos e Carros Novos e Seminovos" />
        <meta property="og:description" content="Sua próxima moto está a uma conversa de distância. Simule, negocie e feche — tudo em um só lugar." />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://a-arsenal-crm.lovable.app" />
      </Helmet>

      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between px-5 py-4 md:px-8"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Bike className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display font-bold text-sm">Arsenal <span className="text-primary">Motors</span></span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/catalogo")} className="text-xs text-muted-foreground gap-1">
            <ShoppingBag className="w-3 h-3" />
            Catálogo
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/member")} className="text-xs text-muted-foreground">
            Minha área
          </Button>
          <ThemeToggle />
        </div>
      </motion.nav>

      {/* Hero */}
      <motion.div
        variants={stagger}
        initial="initial"
        animate="animate"
        className="flex flex-col items-center text-center px-6 pt-12 pb-16 md:pt-20"
      >
        <motion.div
          variants={fadeUp}
          className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-8 animate-pulse-glow relative"
        >
          <Bike className="w-10 h-10 text-primary" />
          <div className="absolute inset-0 rounded-3xl bg-primary/10 animate-ping opacity-20" />
        </motion.div>

        <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-secondary/80 rounded-full px-4 py-1.5 mb-6 border border-border/50">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs text-muted-foreground">+200 motos negociadas este mês</span>
        </motion.div>

        <motion.h1 variants={fadeUp} className="text-5xl md:text-6xl font-display font-bold mb-4 leading-tight">
          Arsenal <span className="text-gradient">Motors</span>
        </motion.h1>

        <motion.p variants={fadeUp} className="text-muted-foreground text-lg mb-10 max-w-md leading-relaxed">
          Sua próxima moto está a uma conversa de distância. Simule, negocie e feche — tudo em um só lugar.
        </motion.p>

        <motion.div variants={fadeUp} className="w-full max-w-sm space-y-3">
          <Button
            onClick={() => navigate("/chat")}
            className="w-full h-14 rounded-2xl text-base font-semibold glow-red gap-2 group"
          >
            Começar agora
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Button>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate("/catalogo")}
              variant="outline"
              className="flex-1 h-12 rounded-xl border-border/50 hover:border-primary/30 transition-colors"
            >
              Ver catálogo
            </Button>
            <Button
              disabled
              variant="outline"
              className="flex-1 h-12 rounded-xl border-border/50 opacity-60 cursor-not-allowed relative overflow-hidden"
            >
              <Lock className="w-4 h-4 mr-2 animate-pulse" />
              Simular
              <span className="absolute inset-0 rounded-xl border-2 border-primary/20 animate-pulse pointer-events-none" />
            </Button>
          </div>
        </motion.div>
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="grid grid-cols-3 gap-4 px-6 max-w-md mx-auto mb-16"
      >
        {[
          { icon: Zap, label: "Rápido", desc: "Resposta em minutos" },
          { icon: Shield, label: "Seguro", desc: "Dados protegidos" },
          { icon: Users, label: "Pessoal", desc: "Atendimento exclusivo" },
        ].map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + i * 0.1 }}
            className="glass-card-hover p-4 flex flex-col items-center gap-2 text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <f.icon className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-medium">{f.label}</span>
            <span className="text-[10px] text-muted-foreground leading-tight">{f.desc}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Social Proof */}
      <div className="px-6 max-w-md mx-auto mb-16">
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center font-display font-bold text-lg mb-6 text-gradient-subtle"
        >
          O que dizem nossos clientes
        </motion.h2>
        <div className="space-y-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 + i * 0.1 }}
              className="glass-card p-4"
            >
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-3 h-3 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-foreground/80 mb-2">"{t.text}"</p>
              <p className="text-xs text-muted-foreground font-medium">{t.name}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA Final */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="px-6 pb-12 max-w-md mx-auto"
      >
        <div className="glass-card gradient-border p-6 text-center">
          <p className="font-display font-bold text-lg mb-2">Pronto pra sua próxima moto?</p>
          <p className="text-sm text-muted-foreground mb-4">Fale com um especialista agora mesmo</p>
          <Button
            onClick={() => navigate("/chat")}
            className="w-full rounded-xl h-12 glow-red group"
          >
            Falar com especialista <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </motion.div>

      <FloatingChatButton />
    </div>
  );
};

export default Index;
