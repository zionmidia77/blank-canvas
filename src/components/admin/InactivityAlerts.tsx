import { motion, AnimatePresence } from "framer-motion";
import { Ghost, Phone, Gift, MessageCircle, RotateCcw, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

type InactiveLead = {
  id: string;
  name: string;
  phone: string | null;
  interest: string | null;
  temperature: string;
  pipeline_stage: string;
  last_contact_at: string | null;
  created_at: string;
  inactiveDays: number;
};

type SuggestedAction = {
  icon: any;
  label: string;
  description: string;
  action: "call" | "whatsapp" | "offer" | "reactivate";
};

const getActions = (lead: InactiveLead): SuggestedAction[] => {
  const firstName = lead.name.split(" ")[0];
  const days = lead.inactiveDays;

  if (days <= 3) {
    return [
      { icon: MessageCircle, label: "Mandar WhatsApp", description: `"E aí ${firstName}, tudo bem? Vi que a gente conversou e queria saber se posso ajudar!"`, action: "whatsapp" },
      { icon: Phone, label: "Ligar", description: "Uma ligação rápida mostra interesse e fecha mais", action: "call" },
    ];
  }
  if (days <= 7) {
    return [
      { icon: Gift, label: "Mandar oferta", description: `Enviar condição especial ou desconto para ${firstName}`, action: "offer" },
      { icon: Phone, label: "Ligar", description: "Mudar de canal pode reativar o interesse", action: "call" },
      { icon: MessageCircle, label: "Mensagem diferente", description: "Abordar por outro ângulo: novidade, urgência", action: "whatsapp" },
    ];
  }
  return [
    { icon: RotateCcw, label: "Reativar lead", description: `${firstName} sumiu há ${days} dias — tente uma abordagem nova`, action: "reactivate" },
    { icon: Gift, label: "Oferta irrecusável", description: "Desconto agressivo ou condição exclusiva", action: "offer" },
    { icon: Phone, label: "Última tentativa", description: "Uma ligação antes de marcar como perdido", action: "call" },
  ];
};

const InactivityAlerts = () => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);

  const { data: inactiveLeads } = useQuery({
    queryKey: ["inactive-leads"],
    queryFn: async () => {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, phone, interest, temperature, pipeline_stage, last_contact_at, created_at")
        .in("status", ["lead", "active"])
        .not("pipeline_stage", "in", '("closed_won","closed_lost")')
        .order("last_contact_at", { ascending: true, nullsFirst: true })
        .limit(200);

      if (!clients) return [];

      const now = Date.now();
      return clients
        .map(c => {
          const lastDate = c.last_contact_at || c.created_at;
          const inactiveDays = Math.floor((now - new Date(lastDate).getTime()) / 86400000);
          return { ...c, inactiveDays } as InactiveLead;
        })
        .filter(c => c.inactiveDays >= 2)
        .sort((a, b) => b.inactiveDays - a.inactiveDays)
        .slice(0, 10);
    },
    refetchInterval: 60000,
  });

  if (!inactiveLeads?.length) return null;

  const criticalCount = inactiveLeads.filter(l => l.inactiveDays >= 7).length;
  const warningCount = inactiveLeads.filter(l => l.inactiveDays >= 3 && l.inactiveDays < 7).length;

  const handleAction = (lead: InactiveLead, action: SuggestedAction) => {
    const firstName = lead.name.split(" ")[0];
    const phone = lead.phone?.replace(/\D/g, "");
    
    switch (action.action) {
      case "whatsapp":
        if (phone) window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(`Fala ${firstName}! Aqui é da Arsenal Motors. Passando pra ver se você ainda tem interesse. Posso ajudar? 🏍️`)}`);
        break;
      case "call":
        if (phone) window.open(`tel:+55${phone}`);
        break;
      case "offer":
        if (phone) window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(`${firstName}, consegui uma condição especial pra você! 🔥 Posso te mostrar? É por tempo limitado!`)}`);
        break;
      case "reactivate":
        if (phone) window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(`Fala ${firstName}! Faz um tempo que não nos falamos. Surgiu algo novo que pode te interessar. Bora conversar? 🏍️`)}`);
        break;
    }
  };

  const getDaysColor = (days: number) => {
    if (days >= 7) return "text-destructive";
    if (days >= 3) return "text-warning";
    return "text-muted-foreground";
  };

  const getDaysBg = (days: number) => {
    if (days >= 7) return "bg-destructive/10 border-destructive/20";
    if (days >= 3) return "bg-warning/10 border-warning/20";
    return "bg-secondary border-border/50";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 space-y-3"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full"
      >
        <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center">
          <Ghost className="w-4 h-4 text-warning" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium font-display">Follow-up por Inatividade</p>
          <p className="text-[10px] text-muted-foreground">
            {inactiveLeads.length} leads inativos
            {criticalCount > 0 && <span className="text-destructive font-medium"> · {criticalCount} críticos</span>}
            {warningCount > 0 && <span className="text-warning font-medium"> · {warningCount} atenção</span>}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-2 overflow-hidden"
          >
            {inactiveLeads.slice(0, 5).map((lead, i) => {
              const actions = getActions(lead);
              return (
                <motion.div
                  key={lead.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-xl p-3 border ${getDaysBg(lead.inactiveDays)}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium truncate flex-1">{lead.name}</span>
                    <span className={`text-[10px] font-mono font-bold ${getDaysColor(lead.inactiveDays)}`}>
                      {lead.inactiveDays}d sem contato
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 rounded-full"
                      onClick={() => navigate(`/admin/client/${lead.id}`)}
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                  </div>
                  {lead.interest && (
                    <p className="text-[10px] text-muted-foreground mb-2">🏍️ {lead.interest}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {actions.map((action, j) => (
                      <Button
                        key={j}
                        size="sm"
                        variant="outline"
                        className="h-6 rounded-full text-[9px] gap-1 px-2"
                        onClick={() => handleAction(lead, action)}
                        title={action.description}
                      >
                        <action.icon className="w-2.5 h-2.5" />
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default InactivityAlerts;
