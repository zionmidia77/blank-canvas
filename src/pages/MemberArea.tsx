import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Bike, DollarSign, Clock, FileText, ChevronRight,
  MessageCircle, TrendingUp, ArrowRightLeft, Bell, LogOut, User,
  Trophy, Gift, Users, Check, Share2, Copy, Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const stagger = { animate: { transition: { staggerChildren: 0.08 } } };
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const MemberArea = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"status" | "vehicles" | "history" | "referrals">("status");
  const [refForm, setRefForm] = useState({ name: "", phone: "" });
  const [showRefForm, setShowRefForm] = useState(false);

  // Find client by email
  const { data: client } = useQuery({
    queryKey: ["member-client", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase.from("clients").select("*").eq("email", user.email).maybeSingle();
      return data;
    },
    enabled: !!user?.email,
  });

  // Get vehicles
  const { data: vehicles } = useQuery({
    queryKey: ["member-vehicles", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data } = await supabase.from("vehicles").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!client?.id,
  });

  // Get interactions (history)
  const { data: interactions } = useQuery({
    queryKey: ["member-interactions", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data } = await supabase.from("interactions").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!client?.id,
  });

  // Get referrals
  const { data: referrals, refetch: refetchReferrals } = useQuery({
    queryKey: ["member-referrals", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", client.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!client?.id,
  });

  const totalBonus = (referrals || [])
    .filter(r => r.status === "converted")
    .reduce((sum, r) => sum + (Number(r.reward_amount) || 0), 0);
  const convertedCount = (referrals || []).filter(r => r.status === "converted").length;
  const pendingCount = (referrals || []).filter(r => r.status === "pending").length;

  const handleSubmitReferral = async () => {
    if (!client?.id || !refForm.name.trim()) return;
    const { error } = await supabase.from("referrals").insert({
      referrer_id: client.id,
      referred_name: refForm.name,
      referred_phone: refForm.phone,
      reward_amount: 0,
      status: "pending",
    });
    if (error) {
      toast.error("Erro ao enviar indicação");
      return;
    }
    toast.success("🎉 Indicação enviada com sucesso!");
    setRefForm({ name: "", phone: "" });
    setShowRefForm(false);
    refetchReferrals();
  };

  

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const firstName = client?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Cliente";

  const shareText = `Quer comprar uma moto com as melhores condições? Fala que o ${firstName} indicou! Arsenal Motors 🏍️`;
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success("Link copiado!");
    }
  };

  const stageLabels: Record<string, { label: string; color: string }> = {
    new: { label: "Cadastro recebido", color: "text-info" },
    contacted: { label: "Em contato", color: "text-warning" },
    interested: { label: "Interesse confirmado", color: "text-primary" },
    attending: { label: "Em atendimento", color: "text-success" },
    negotiating: { label: "Em negociação", color: "text-warning" },
    scheduled: { label: "Agendado", color: "text-info" },
    thinking: { label: "Analisando proposta", color: "text-muted-foreground" },
    waiting_response: { label: "Aguardando resposta", color: "text-muted-foreground" },
    closed_won: { label: "Concluído ✅", color: "text-success" },
    closed_lost: { label: "Encerrado", color: "text-destructive" },
  };

  const currentStage = client ? stageLabels[client.pipeline_stage] : null;

  const interactionIcons: Record<string, any> = {
    whatsapp: MessageCircle,
    call: MessageCircle,
    visit: User,
    system: Clock,
    email: FileText,
    sms: MessageCircle,
  };

  // Onboarding for new users without client profile
  if (!client) {
    return (
      <div className="min-h-screen bg-background noise-bg flex flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/15 flex items-center justify-center">
            <Bike className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold">Bem-vindo à Arsenal Motors! 🏍️</h1>
          <p className="text-muted-foreground">
            Sua área exclusiva ainda está sendo preparada. Inicie uma conversa no chat para que possamos te conhecer melhor e criar seu perfil personalizado.
          </p>
          <div className="space-y-3">
            <Button onClick={() => navigate("/chat")} className="w-full h-12 rounded-xl glow-red gap-2">
              <MessageCircle className="w-4 h-4" /> Iniciar conversa
            </Button>
            <Button variant="outline" onClick={() => navigate("/")} className="w-full h-12 rounded-xl">
              Voltar ao início
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="text-xs text-muted-foreground gap-1">
            <LogOut className="w-3 h-3" /> Sair
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background noise-bg pb-28">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between">
        <motion.div variants={stagger} initial="initial" animate="animate">
          <motion.h1 variants={fadeUp} className="text-2xl font-display font-bold">
            {greeting()}, {firstName} 👋
          </motion.h1>
          <motion.p variants={fadeUp} className="text-sm text-muted-foreground mt-1">
            Sua área Arsenal Motors
          </motion.p>
        </motion.div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="rounded-full relative">
            <Bell className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 mb-5">
        <div className="flex gap-2">
          {([
            { key: "status", label: "Status" },
            { key: "vehicles", label: "Veículos" },
            { key: "referrals", label: "Indicações" },
            { key: "history", label: "Histórico" },
          ] as const).map(tab => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
              className="rounded-full text-xs"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      <motion.div variants={stagger} initial="initial" animate="animate" className="px-5 space-y-4">
        {!client ? (
          <motion.div variants={fadeUp} className="glass-card p-6 text-center">
            <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Seu perfil ainda não foi vinculado. Entre em contato com a Arsenal Motors para associar seu cadastro.
            </p>
            <Button className="mt-4 rounded-xl" onClick={() => window.open("https://wa.me/5500000000000")}>
              <MessageCircle className="w-4 h-4 mr-2" /> Falar com Arsenal
            </Button>
          </motion.div>
        ) : (
          <>
            {activeTab === "status" && (
              <>
                {/* Current status */}
                <motion.div variants={fadeUp} className="glass-card gradient-border p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground">Status do seu pedido</span>
                  </div>
                  <p className={`text-xl font-display font-bold ${currentStage?.color || ""}`}>
                    {currentStage?.label || client.pipeline_stage}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Atualizado em {new Date(client.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </motion.div>

                {/* Interest */}
                {client.interest && (
                  <motion.div variants={fadeUp} className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-info" />
                      <span className="text-sm text-muted-foreground">Seu interesse</span>
                    </div>
                    <p className="text-sm font-medium">{client.interest}</p>
                    {client.budget_range && (
                      <p className="text-xs text-muted-foreground mt-1">Orçamento: {client.budget_range}</p>
                    )}
                  </motion.div>
                )}

                {/* Quick actions */}
                <motion.div variants={fadeUp} className="glass-card p-5">
                  <p className="text-sm font-medium mb-3">Ações rápidas</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="rounded-xl h-auto py-3 flex-col gap-1" onClick={() => navigate("/simulator")}>
                      <DollarSign className="w-5 h-5 text-success" />
                      <span className="text-xs">Simular</span>
                    </Button>
                    <Button variant="outline" className="rounded-xl h-auto py-3 flex-col gap-1" onClick={() => window.open("https://wa.me/5500000000000")}>
                      <MessageCircle className="w-5 h-5 text-success" />
                      <span className="text-xs">WhatsApp</span>
                    </Button>
                    <Button variant="outline" className="rounded-xl h-auto py-3 flex-col gap-1" onClick={() => setActiveTab("vehicles")}>
                      <Bike className="w-5 h-5 text-primary" />
                      <span className="text-xs">Meus veículos</span>
                    </Button>
                    <Button variant="outline" className="rounded-xl h-auto py-3 flex-col gap-1" onClick={() => setActiveTab("history")}>
                      <FileText className="w-5 h-5 text-info" />
                      <span className="text-xs">Histórico</span>
                    </Button>
                  </div>
                </motion.div>
              </>
            )}

            {activeTab === "vehicles" && (
              <>
                {vehicles && vehicles.length > 0 ? (
                  vehicles.map(v => (
                    <motion.div key={v.id} variants={fadeUp} className="glass-card p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Bike className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{v.brand} {v.model}</p>
                          <p className="text-xs text-muted-foreground">{v.year} · {v.km?.toLocaleString("pt-BR")} km</p>
                        </div>
                      </div>
                      {v.estimated_value && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">Valor estimado</span>
                          <span className="text-sm font-display font-bold text-primary">
                            R$ {Number(v.estimated_value).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      )}
                      {v.is_financed && v.installments_total && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground">Parcelas pagas</span>
                            <span className="text-sm font-semibold">{v.installments_paid || 0} / {v.installments_total}</span>
                          </div>
                          <Progress
                            value={((v.installments_paid || 0) / v.installments_total) * 100}
                            className="h-2 bg-secondary"
                          />
                          {v.monthly_payment && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Parcela: R$ {Number(v.monthly_payment).toLocaleString("pt-BR")}/mês
                            </p>
                          )}
                        </>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground text-sm glass-card rounded-2xl">
                    <Bike className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Nenhum veículo cadastrado
                  </div>
                )}
              </>
            )}

            {activeTab === "referrals" && (
              <>
                {/* Indica e Ganha Hero */}
                <motion.div variants={fadeUp} className="glass-card gradient-border p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-6 h-6 text-primary" />
                    <h2 className="text-lg font-display font-bold">Indica e Ganha</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Indique amigos e ganhe <span className="text-primary font-bold">R$ 200</span> por cada indicação que fechar negócio!
                  </p>
                  <Button onClick={handleShare} className="w-full rounded-xl glow-red h-11 gap-2">
                    <Share2 className="w-4 h-4" /> Compartilhar convite
                  </Button>
                </motion.div>

                {/* Stats */}
                <motion.div variants={fadeUp} className="grid grid-cols-3 gap-2">
                  <div className="glass-card p-3 text-center">
                    <Users className="w-4 h-4 mx-auto text-primary mb-1" />
                    <p className="text-xl font-bold font-mono">{referrals?.length || 0}</p>
                    <p className="text-[9px] text-muted-foreground">Indicações</p>
                  </div>
                  <div className="glass-card p-3 text-center">
                    <Check className="w-4 h-4 mx-auto text-green-400 mb-1" />
                    <p className="text-xl font-bold font-mono text-green-400">{convertedCount}</p>
                    <p className="text-[9px] text-muted-foreground">Convertidos</p>
                  </div>
                  <div className="glass-card p-3 text-center">
                    <Gift className="w-4 h-4 mx-auto text-amber-400 mb-1" />
                    <p className="text-xl font-bold font-mono text-amber-400">
                      {totalBonus > 0 ? `R$${totalBonus}` : "R$0"}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Bônus total</p>
                  </div>
                </motion.div>

                {/* Referral list */}
                {referrals && referrals.length > 0 && (
                  <motion.div variants={fadeUp} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                      Suas indicações
                    </p>
                    {referrals.map(ref => {
                      const statusMap: Record<string, { label: string; color: string; icon: typeof Check }> = {
                        pending: { label: "Em análise", color: "text-amber-400", icon: Loader2 },
                        converted: { label: "Convertido! +R$200", color: "text-green-400", icon: Check },
                        lost: { label: "Não convertido", color: "text-muted-foreground", icon: Clock },
                      };
                      const st = statusMap[ref.status] || statusMap.pending;
                      return (
                        <div key={ref.id} className="glass-card p-3.5 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ref.referred_name || "—"}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(ref.created_at).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                            {ref.status === "converted" && (
                              <p className="text-[10px] text-green-400 font-mono">🎉</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}

                {/* Add referral */}
                {showRefForm ? (
                  <motion.div variants={fadeUp} className="glass-card p-4 space-y-3">
                    <p className="text-xs font-medium">Nova indicação</p>
                    <Input
                      placeholder="Nome do amigo"
                      value={refForm.name}
                      onChange={e => setRefForm({ ...refForm, name: e.target.value })}
                      className="rounded-xl h-10"
                    />
                    <Input
                      placeholder="Telefone (WhatsApp)"
                      value={refForm.phone}
                      onChange={e => setRefForm({ ...refForm, phone: e.target.value })}
                      className="rounded-xl h-10"
                    />
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 rounded-xl h-10"
                        disabled={!refForm.name.trim()}
                        onClick={handleSubmitReferral}
                      >
                        Enviar indicação
                      </Button>
                      <Button variant="outline" className="rounded-xl h-10" onClick={() => setShowRefForm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div variants={fadeUp}>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl h-11 gap-2 border-primary/30"
                      onClick={() => setShowRefForm(true)}
                    >
                      <Users className="w-4 h-4" /> Indicar um amigo
                    </Button>
                  </motion.div>
                )}
              </>
            )}

            {activeTab === "history" && (
              <>
                {interactions && interactions.length > 0 ? (
                  interactions.map(i => {
                    const Icon = interactionIcons[i.type] || Clock;
                    return (
                      <motion.div key={i.id} variants={fadeUp} className="glass-card-hover p-3.5 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs">{i.content}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(i.created_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-muted-foreground text-sm glass-card rounded-2xl">
                    Nenhum registro no histórico
                  </div>
                )}
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
};

export default MemberArea;
