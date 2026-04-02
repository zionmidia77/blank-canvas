import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateClient, useCreateInteraction } from "@/hooks/useSupabase";
import { X, Phone, Send, FileText, FolderOpen, RotateCcw, MapPin, Landmark, Clock, Handshake, Mail, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const actionOptions = [
  { type: "call", label: "Ligar", icon: Phone, emoji: "📞" },
  { type: "send_message", label: "Enviar mensagem", icon: Send, emoji: "💬" },
  { type: "send_proposal", label: "Enviar proposta", icon: FileText, emoji: "📋" },
  { type: "collect_docs", label: "Coletar docs", icon: FolderOpen, emoji: "📄" },
  { type: "follow_up", label: "Follow-up", icon: RotateCcw, emoji: "🔁" },
  { type: "schedule_visit", label: "Agendar visita", icon: MapPin, emoji: "📍" },
  { type: "submit_credit", label: "Submeter crédito", icon: Landmark, emoji: "🏦" },
  { type: "wait_client", label: "Aguardar cliente", icon: Clock, emoji: "⏳" },
  { type: "close_deal", label: "Fechar negócio", icon: Handshake, emoji: "🤝" },
  { type: "send_content", label: "Enviar conteúdo", icon: Mail, emoji: "📤" },
] as const;

// Simplified pipeline stage progression — suggests the next logical group
const STAGE_FLOW: Record<string, { key: string; label: string; emoji: string }> = {
  new: { key: "contacted", label: "Contatado", emoji: "📞" },
  contacted: { key: "qualification", label: "Qualificação", emoji: "🔍" },
  first_contact: { key: "qualification", label: "Qualificação", emoji: "🔍" },
  interested: { key: "qualification", label: "Qualificação", emoji: "🔍" },
  qualification: { key: "proposal", label: "Proposta", emoji: "📋" },
  attending: { key: "proposal", label: "Proposta", emoji: "📋" },
  scheduled: { key: "qualification", label: "Qualificação", emoji: "🔍" },
  proposal: { key: "negotiation", label: "Negociação", emoji: "💰" },
  proposal_sent: { key: "negotiation", label: "Negociação", emoji: "💰" },
  thinking: { key: "negotiation", label: "Negociação", emoji: "💰" },
  waiting_response: { key: "negotiation", label: "Negociação", emoji: "💰" },
  negotiation: { key: "closed_won", label: "Ganho ✅", emoji: "🏆" },
  negotiating: { key: "closed_won", label: "Ganho ✅", emoji: "🏆" },
  financing_analysis: { key: "negotiation", label: "Negociação", emoji: "💰" },
  approved: { key: "closed_won", label: "Ganho ✅", emoji: "🏆" },
  closing: { key: "closed_won", label: "Ganho ✅", emoji: "🏆" },
  reactivation: { key: "contacted", label: "Contatado", emoji: "📞" },
};

const STAGE_LABELS: Record<string, string> = {
  new: "Novo Lead", contacted: "Contatado", first_contact: "1º Contato",
  interested: "Interessado", qualification: "Qualificação", attending: "Atendendo",
  scheduled: "Agendado", proposal: "Proposta", proposal_sent: "Proposta Enviada",
  thinking: "Pensando", waiting_response: "Aguardando", negotiation: "Negociação",
  negotiating: "Negociando", financing_analysis: "Análise Crédito", approved: "Aprovado",
  rejected: "Rejeitado", closing: "Fechamento", closed_won: "Ganho ✅",
  closed_lost: "Perdido", reactivation: "Reativação",
};

interface NextActionModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  currentStage?: string;
}

const NextActionModal = ({ open, onClose, clientId, clientName, currentStage }: NextActionModalProps) => {
  const updateClient = useUpdateClient();
  const createInteraction = useCreateInteraction();
  const [selected, setSelected] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<"action" | "stage">("action");

  const suggestedNext = currentStage ? STAGE_FLOW[currentStage] : null;
  const currentStageLabel = currentStage ? STAGE_LABELS[currentStage] || currentStage : "";

  const handleSubmitAction = () => {
    if (!selected) {
      toast.error("Selecione uma ação");
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const opt = actionOptions.find(a => a.type === selected);

    updateClient.mutate({
      id: clientId,
      next_action_type: selected as any,
      next_action: description || `${opt?.emoji} ${opt?.label}`,
      next_action_due: tomorrow.toISOString(),
    } as any);

    toast.success("Próxima ação definida!");

    // If there's a suggested next stage, show stage prompt
    if (suggestedNext && currentStage !== "closed_won" && currentStage !== "closed_lost") {
      setStep("stage");
    } else {
      resetAndClose();
    }
  };

  const handleAdvanceStage = () => {
    if (!suggestedNext) return;
    updateClient.mutate({ id: clientId, pipeline_stage: suggestedNext.key as any } as any);
    createInteraction.mutate({
      client_id: clientId,
      type: "system",
      content: `Pipeline avançado: ${currentStageLabel} → ${suggestedNext.label}`,
      created_by: "admin",
    });
    toast.success(`Avançado para ${suggestedNext.emoji} ${suggestedNext.label}`);
    resetAndClose();
  };

  const handleKeepStage = () => {
    resetAndClose();
  };

  const resetAndClose = () => {
    setSelected(null);
    setDescription("");
    setStep("action");
    onClose();
  };

  const handleSkip = () => {
    // If on action step and there's a stage suggestion, still ask about stage
    if (step === "action" && suggestedNext && currentStage !== "closed_won" && currentStage !== "closed_lost") {
      setStep("stage");
    } else {
      resetAndClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={resetAndClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md mx-4 mb-4 md:mb-0 bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AnimatePresence mode="wait">
              {step === "action" && (
                <motion.div
                  key="action"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-display font-bold">Qual a próxima ação?</p>
                      <p className="text-xs text-muted-foreground">{clientName}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={resetAndClose}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {actionOptions.slice(0, 8).map((opt) => (
                      <motion.button
                        key={opt.type}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelected(opt.type)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                          selected === opt.type
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 bg-secondary/30 hover:bg-secondary/60 text-foreground/80"
                        }`}
                      >
                        <span>{opt.emoji}</span>
                        {opt.label}
                      </motion.button>
                    ))}
                  </div>

                  {selected && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                      <Input
                        placeholder="Detalhe (opcional): ex: Ligar às 14h"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="text-sm rounded-xl"
                      />
                    </motion.div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="ghost" className="flex-1 text-xs" onClick={handleSkip}>
                      Pular
                    </Button>
                    <Button className="flex-1 text-xs" onClick={handleSubmitAction} disabled={!selected}>
                      Definir ação
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === "stage" && suggestedNext && (
                <motion.div
                  key="stage"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-display font-bold">Avançar etapa?</p>
                      <p className="text-xs text-muted-foreground">{clientName}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={resetAndClose}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-center gap-3 py-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Atual</p>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/60 text-xs font-medium">
                        {currentStageLabel}
                      </span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-primary" />
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Sugerida</p>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 text-primary text-xs font-medium border border-primary/30">
                        {suggestedNext.emoji} {suggestedNext.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 text-xs rounded-xl" onClick={handleKeepStage}>
                      Manter etapa
                    </Button>
                    <Button className="flex-1 text-xs rounded-xl gap-1.5" onClick={handleAdvanceStage}>
                      <ArrowRight className="w-3.5 h-3.5" />
                      Avançar
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NextActionModal;
