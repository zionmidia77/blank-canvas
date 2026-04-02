import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useClients, useUpdateClient, useCreateInteraction } from "@/hooks/useSupabase";
import {
  ArrowLeft, ArrowRight, MessageCircle, Phone, Check, Copy,
  AlertTriangle, Clock, Send, ChevronRight, Flame, Zap, Target, Info
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getObjectionMessages } from "@/lib/objectionMessages";
import NextActionModal from "@/components/admin/NextActionModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import PageTour from "@/components/admin/PageTour";
import QueueDashboard from "@/components/admin/QueueDashboard";
import CadenceBadge from "@/components/admin/CadenceBadge";
import { useCadenceBadges } from "@/hooks/useCadenceBadges";

const tempBadge: Record<string, string> = {
  hot: "bg-primary/15 text-primary",
  warm: "bg-warning/15 text-warning",
  cold: "bg-info/15 text-info",
  frozen: "bg-muted/15 text-muted-foreground",
};
const tempLabel: Record<string, string> = { hot: "🔥 Quente", warm: "🟡 Morno", cold: "🔵 Frio", frozen: "⚪ Inativo" };

const stageLabelMap: Record<string, string> = {
  new: "Novo", contacted: "Contatado", interested: "Interessado", attending: "Em atendimento",
  thinking: "Pensando", waiting_response: "Aguardando", scheduled: "Agendado",
  negotiating: "Negociando", proposal_sent: "Proposta enviada", financing_analysis: "Financiamento",
  approved: "Aprovado", rejected: "Reprovado", closed_won: "Fechado ✅", closed_lost: "Perdido ❌",
  reactivation: "Reativação",
};

const nextActionLabels: Record<string, string> = {
  call: "📞 Ligar", send_proposal: "📋 Enviar proposta", send_message: "💬 Enviar mensagem",
  collect_docs: "📄 Coletar docs", follow_up: "🔁 Follow-up", schedule_visit: "📍 Agendar visita",
  submit_credit: "🏦 Submeter crédito", wait_client: "⏳ Aguardar", close_deal: "🤝 Fechar",
  send_content: "📤 Enviar conteúdo",
};

const SMART_QUEUE_ACTIVE_CLIENT_STORAGE_KEY = "admin-smart-queue:active-client-id";
const SMART_QUEUE_ACTIVE_FILTER_STORAGE_KEY = "admin-smart-queue:active-filter";

const getStoredQueueClientId = () => {
  if (typeof window === "undefined") return null;

  try {
    return sessionStorage.getItem(SMART_QUEUE_ACTIVE_CLIENT_STORAGE_KEY);
  } catch {
    return null;
  }
};

const getStoredQueueFilter = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SMART_QUEUE_ACTIVE_FILTER_STORAGE_KEY);
  } catch {
    return null;
  }
};

/** Queue reason badge config */
const queueReasonConfig: Record<string, { label: string; color: string }> = {
  promise_overdue: { label: "🤝 PROMESSA VENCIDA", color: "bg-destructive/15 text-destructive border border-destructive/30" },
  action_overdue: { label: "⏰ AÇÃO ATRASADA", color: "bg-destructive/15 text-destructive border border-destructive/30" },
  no_contact_48h: { label: "📵 SEM CONTATO 48H", color: "bg-warning/15 text-warning border border-warning/30" },
  scheduled_today: { label: "📅 AGENDADO HOJE", color: "bg-info/15 text-info border border-info/30" },
  hot_lead: { label: "🔥 LEAD QUENTE", color: "bg-primary/15 text-primary border border-primary/30" },
};

/** Generates priority reason tags for a client */
function getPriorityReasons(client: any): { label: string; color: string }[] {
  const tags: { label: string; color: string }[] = [];
  // Use queue_reason from DB if available
  const qr = client.queue_reason as string | null;
  if (qr && qr !== 'standard' && queueReasonConfig[qr]) {
    tags.push(queueReasonConfig[qr]);
  }
  // Additional visual tags
  if (client.temperature === "hot" && qr !== 'hot_lead') tags.push({ label: "🔥 Quente", color: "bg-primary/15 text-primary" });
  if (client.next_action_due && new Date(client.next_action_due) < new Date() && qr !== 'action_overdue') tags.push({ label: "⏰ Atrasada", color: "bg-destructive/15 text-destructive" });
  if ((client.deal_value || 0) >= 30000) tags.push({ label: "💰 Alto valor", color: "bg-success/15 text-success" });
  if ((client.churn_risk || 0) > 50) tags.push({ label: "⚠️ Risco alto", color: "bg-warning/15 text-warning" });
  if (client.client_promise_status === "overdue" && qr !== 'promise_overdue') tags.push({ label: "🤝 Promessa vencida", color: "bg-destructive/15 text-destructive" });
  if (client.has_down_payment) tags.push({ label: "💵 Tem entrada", color: "bg-success/15 text-success" });
  if (client.docs_status === "complete") tags.push({ label: "📄 Docs completos", color: "bg-info/15 text-info" });
  return tags.slice(0, 5);
}

const AdminSmartQueue = () => {
  const navigate = useNavigate();
  const { data: allClients, isLoading } = useClients();
  const updateClient = useUpdateClient();
  const createInteraction = useCreateInteraction();
  const [currentClientId, setCurrentClientId] = useState<string | null>(() => getStoredQueueClientId());
  const [direction, setDirection] = useState(1);
  const [nextActionModalOpen, setNextActionModalOpen] = useState(false);
  const [attendedCount, setAttendedCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string | null>(() => getStoredQueueFilter());
  const sessionStartTime = useRef(Date.now()).current;

  // Enhanced sorting: overdue promises > overdue actions > hot leads > scheduled today > priority_score
  const fullQueue = useMemo(() => {
    if (!allClients) return [];
    const now = new Date();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

    return allClients
      .filter(c => !["closed_won", "closed_lost"].includes(c.pipeline_stage))
      .sort((a, b) => {
        // 1. Overdue promises first
        const aPromiseOverdue = a.client_promise_status === "overdue" ? 1 : 0;
        const bPromiseOverdue = b.client_promise_status === "overdue" ? 1 : 0;
        if (aPromiseOverdue !== bPromiseOverdue) return bPromiseOverdue - aPromiseOverdue;

        // 2. Overdue next actions
        const aOverdue = a.next_action_due && new Date(a.next_action_due) < now ? 1 : 0;
        const bOverdue = b.next_action_due && new Date(b.next_action_due) < now ? 1 : 0;
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;

        // 3. No contact > 48h gets boosted
        const aInactive = !a.last_contact_at || (Date.now() - new Date(a.last_contact_at).getTime()) > 48 * 3600000 ? 1 : 0;
        const bInactive = !b.last_contact_at || (Date.now() - new Date(b.last_contact_at).getTime()) > 48 * 3600000 ? 1 : 0;
        if (aInactive !== bInactive) return bInactive - aInactive;

        // 4. Scheduled for today
        const aToday = a.next_action_due && new Date(a.next_action_due) >= todayStart && new Date(a.next_action_due) <= todayEnd ? 1 : 0;
        const bToday = b.next_action_due && new Date(b.next_action_due) >= todayStart && new Date(b.next_action_due) <= todayEnd ? 1 : 0;
        if (aToday !== bToday) return bToday - aToday;

        // 5. Hot leads
        const tempWeight: Record<string, number> = { hot: 4, warm: 2, cold: 1, frozen: 0 };
        const aTempW = tempWeight[a.temperature] || 0;
        const bTempW = tempWeight[b.temperature] || 0;
        if (aTempW !== bTempW) return bTempW - aTempW;

        // 6. Priority score
        return (b.priority_score || 0) - (a.priority_score || 0);
      });
  }, [allClients]);

  // Apply filter
  const queue = useMemo(() => {
    if (!activeFilter) return fullQueue;
    const now = new Date();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

    switch (activeFilter) {
      case "urgent":
        return fullQueue.filter(c =>
          c.temperature === "hot" ||
          (c.next_action_due && new Date(c.next_action_due) < now) ||
          c.client_promise_status === "overdue"
        );
      case "overdue":
        return fullQueue.filter(c => c.next_action_due && new Date(c.next_action_due) < now);
      case "today":
        return fullQueue.filter(c => {
          if (!c.next_action_due) return false;
          const due = new Date(c.next_action_due);
          return due >= todayStart && due <= todayEnd;
        });
      case "inactive":
        return fullQueue.filter(c =>
          !c.last_contact_at || (Date.now() - new Date(c.last_contact_at).getTime()) > 48 * 3600000
        );
      default:
        return fullQueue;
    }
  }, [fullQueue, activeFilter]);

  const client = useMemo(() => {
    if (queue.length === 0) return null;
    return queue.find(item => item.id === currentClientId) ?? queue[0];
  }, [queue, currentClientId]);

  const currentIndex = client ? queue.findIndex(item => item.id === client.id) : 0;
  const total = queue.length;

  useEffect(() => {
    if (isLoading || allClients === undefined) return;

    if (queue.length === 0) {
      if (currentClientId !== null) {
        setCurrentClientId(null);
      }
      return;
    }

    if (!currentClientId || !queue.some(item => item.id === currentClientId)) {
      setCurrentClientId(queue[0].id);
    }
  }, [queue, currentClientId, isLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (currentClientId) {
        sessionStorage.setItem(SMART_QUEUE_ACTIVE_CLIENT_STORAGE_KEY, currentClientId);
        return;
      }

      sessionStorage.removeItem(SMART_QUEUE_ACTIVE_CLIENT_STORAGE_KEY);
    } catch {}
  }, [currentClientId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (activeFilter) {
        sessionStorage.setItem(SMART_QUEUE_ACTIVE_FILTER_STORAGE_KEY, activeFilter);
      } else {
        sessionStorage.removeItem(SMART_QUEUE_ACTIVE_FILTER_STORAGE_KEY);
      }
    } catch {}
  }, [activeFilter]);

  // Cadence badges for visible clients
  const { data: cadenceBadges } = useCadenceBadges(client ? [client.id] : []);

  const goNext = () => {
    if (currentIndex < total - 1) {
      setDirection(1);
      setCurrentClientId(queue[currentIndex + 1].id);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentClientId(queue[currentIndex - 1].id);
    }
  };

  // Get objection-based messages
  const objMessages = client ? getObjectionMessages(client.name.split(" ")[0], client.pipeline_stage, client.objection_type || undefined) : [];
  const bestMessage = objMessages[0]?.msg || (client ? `Olá ${client.name.split(" ")[0]}!` : "");

  const sendWhatsApp = (msg: string) => {
    if (!client?.phone) { toast.error("Sem telefone"); return; }
    const phone = client.phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`);
    createInteraction.mutate({ client_id: client.id, type: "whatsapp", content: `Mensagem via WhatsApp: "${msg.slice(0, 80)}..."`, created_by: "admin" });
    updateClient.mutate({ id: client.id, last_contact_at: new Date().toISOString() } as any);
  };

  const markAttended = () => {
    if (!client) return;
    updateClient.mutate({ id: client.id, last_contact_at: new Date().toISOString() } as any);
    createInteraction.mutate({ client_id: client.id, type: "system", content: "Atendimento registrado (fila inteligente)", created_by: "admin" });
    setAttendedCount(c => c + 1);
    toast.success("Atendimento registrado!");
    setNextActionModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (total === 0 || !client) {
    return (
      <div className="p-6 text-center space-y-4">
        <div className="text-4xl">🎉</div>
        <h2 className="text-lg font-display font-bold">Fila zerada!</h2>
        <p className="text-sm text-muted-foreground">Todos os leads foram atendidos.</p>
        <Button onClick={() => navigate("/admin")} variant="outline">Voltar ao Dashboard</Button>
      </div>
    );
  }

  const lastContactDays = client.last_contact_at
    ? Math.floor((Date.now() - new Date(client.last_contact_at).getTime()) / 86400000)
    : null;

  const nextActionOverdue = client.next_action_due ? new Date(client.next_action_due) < new Date() : false;
  const priorityReasons = getPriorityReasons(client);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <PageTour tourKey="queue" steps={[
        { target: '[data-tour="queue-progress"]', title: "Progresso da fila", description: "Acompanhe quantos leads você já atendeu e quantos faltam.", icon: Zap, position: "bottom" as const },
        { target: '[data-tour="queue-card"]', title: "Card do lead", description: "Informações completas do lead: nome, temperatura, score, valor e próxima ação a executar.", icon: Target, position: "bottom" as const },
        { target: '[data-tour="queue-actions"]', title: "Ações rápidas", description: "Envie WhatsApp com mensagem pronta, marque como atendido ou ligue — tudo em 1 clique.", icon: MessageCircle, position: "bottom" as const },
        { target: '[data-tour="queue-messages"]', title: "Mensagens sugeridas", description: "Mensagens personalizadas baseadas na objeção do lead, prontas para envio.", icon: Flame, position: "bottom" as const },
      ]} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Sair da fila
        </Button>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Fila Inteligente</span>
        </div>
      </div>

      {/* Queue Dashboard */}
      <QueueDashboard
        queue={fullQueue}
        attendedCount={attendedCount}
        sessionStartTime={sessionStartTime}
        activeFilter={activeFilter}
        onFilterChange={(f) => {
          setActiveFilter(f);
          setDirection(1);
          setCurrentClientId(null);
        }}
      />

      {/* Progress bar */}
      <div className="space-y-1" data-tour="queue-progress">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Lead {currentIndex + 1} de {total}</span>
          <span>Faltam {Math.max(total - currentIndex - 1, 0)}</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${((currentIndex + 1) / total) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Lead Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={client.id}
          initial={{ opacity: 0, x: direction * 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -60 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {/* Main card */}
          <div className={cn(
            "rounded-2xl border-2 p-5 space-y-4",
            nextActionOverdue ? "border-destructive bg-destructive/5" : "border-primary/30 bg-primary/5"
          )}>
            {/* Name & badges */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-display font-bold">{client.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tempBadge[client.temperature]}`}>
                    {tempLabel[client.temperature]}
                  </span>
                  <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full">
                    {stageLabelMap[client.pipeline_stage] || client.pipeline_stage}
                  </span>
                  {client.objection_type && (
                    <span className="text-[10px] bg-warning/15 text-warning px-2 py-0.5 rounded-full">
                      ⚖️ {client.objection_type}
                    </span>
                  )}
                  <CadenceBadge info={cadenceBadges?.[client.id]} />
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-right cursor-help">
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">Prioridade <Info className="w-3 h-3" /></p>
                      <p className="text-2xl font-display font-bold text-primary">{client.priority_score || 0}</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[220px]">
                    <p className="text-xs font-medium mb-1">Por que este score?</p>
                    {priorityReasons.length > 0 ? (
                      <ul className="text-xs space-y-0.5">
                        {priorityReasons.map((r, i) => <li key={i}>{r.label}</li>)}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">Score baseado em temperatura, engajamento e valor do negócio</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Main queue reason banner */}
            {client.queue_reason && client.queue_reason !== 'standard' && queueReasonConfig[client.queue_reason as string] && (
              <div className={`text-xs font-bold px-3 py-1.5 rounded-lg text-center ${queueReasonConfig[client.queue_reason as string].color}`}>
                {queueReasonConfig[client.queue_reason as string].label}
              </div>
            )}

            {/* Additional priority tags */}
            {priorityReasons.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {priorityReasons.filter((_, i) => !(i === 0 && client.queue_reason && client.queue_reason !== 'standard')).map((r, i) => (
                  <span key={i} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.color}`}>
                    {r.label}
                  </span>
                ))}
              </div>
            )}

            {/* Key info */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {client.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-muted-foreground" /> {client.phone}</div>}
              {client.interest && <div className="flex items-center gap-1.5"><Target className="w-3 h-3 text-muted-foreground" /> {client.interest}</div>}
              {client.deal_value && <div className="flex items-center gap-1.5 text-primary font-medium">💰 R$ {Number(client.deal_value).toLocaleString("pt-BR")}</div>}
              {lastContactDays !== null && (
                <div className={cn("flex items-center gap-1.5", lastContactDays > 2 && "text-destructive font-medium")}>
                  <Clock className="w-3 h-3" /> {lastContactDays === 0 ? "Hoje" : `⏰ ${lastContactDays}d atrás`}
                </div>
              )}
            </div>

            {/* Churn risk bar */}
            {(client.churn_risk || 0) > 30 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Risco de perda</span>
                  <span className={cn("font-medium", (client.churn_risk || 0) > 60 ? "text-destructive" : "text-warning")}>{client.churn_risk}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full", (client.churn_risk || 0) > 60 ? "bg-destructive" : "bg-warning")} style={{ width: `${client.churn_risk}%` }} />
                </div>
              </div>
            )}

            {/* Promise */}
            {client.client_promise && (
              <div className={cn("text-xs p-2 rounded-lg border", client.client_promise_status === "overdue" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-secondary/50")}>
                ⏰ Promessa: {client.client_promise}
                {client.client_promise_due && ` · ${format(new Date(client.client_promise_due), "dd/MM HH:mm")}`}
              </div>
            )}

            {/* Next action - prominent */}
            <div className="h-px bg-border/50" />
            <div className="text-center space-y-2">
              <p className={cn("text-base font-display font-bold", nextActionOverdue ? "text-destructive" : "text-primary")}>
                {client.next_action || "Sem ação definida"}
              </p>
              {client.next_action_type && (
                <p className="text-xs text-muted-foreground">{nextActionLabels[client.next_action_type] || client.next_action_type}</p>
              )}
              {nextActionOverdue && (
                <span className="text-[10px] bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full font-medium animate-pulse inline-block">
                  ⏰ Atrasada
                </span>
              )}
            </div>
          </div>

          {/* Action buttons - WhatsApp now sends best message directly */}
          <div className="grid grid-cols-3 gap-2" data-tour="queue-actions">
            {client.phone && (
              <Button className="h-14 rounded-xl flex flex-col gap-1 text-xs" onClick={() => sendWhatsApp(bestMessage)}>
                <MessageCircle className="w-5 h-5" />
                WhatsApp
              </Button>
            )}
            <Button variant="outline" className="h-14 rounded-xl flex flex-col gap-1 text-xs border-primary/30" onClick={markAttended}>
              <Check className="w-5 h-5" />
              Atendido
            </Button>
            {client.phone && (
              <Button variant="outline" className="h-14 rounded-xl flex flex-col gap-1 text-xs border-primary/30" onClick={() => window.open(`tel:${client.phone}`)}>
                <Phone className="w-5 h-5" />
                Ligar
              </Button>
            )}
          </div>

          {/* Smart messages based on objection */}
          {objMessages.length > 0 && (
            <div className="glass-card p-4 space-y-2" data-tour="queue-messages">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-primary" />
                Mensagens sugeridas (baseadas na objeção)
              </p>
              <div className="space-y-2">
                {objMessages.slice(0, 3).map((m, i) => (
                  <div key={i} className="bg-secondary/50 rounded-xl p-3 space-y-2">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{m.label}</p>
                    <p className="text-xs text-foreground/70 line-clamp-2">{m.msg}</p>
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 rounded-full text-[10px] gap-1 flex-1" onClick={() => sendWhatsApp(m.msg)}>
                        <Send className="w-2.5 h-2.5" /> Enviar
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px] gap-1" onClick={() => { navigator.clipboard.writeText(m.msg); toast.success("Copiado!"); }}>
                        <Copy className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* See full profile */}
          <Button variant="ghost" className="w-full text-xs text-muted-foreground gap-1" onClick={() => navigate(`/admin/client/${client.id}`)}>
            Ver ficha completa <ChevronRight className="w-3 h-3" />
          </Button>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1 h-12 rounded-xl gap-2" onClick={goPrev} disabled={currentIndex === 0}>
          <ArrowLeft className="w-4 h-4" /> Anterior
        </Button>
        <Button className="flex-1 h-12 rounded-xl gap-2" onClick={goNext} disabled={currentIndex >= total - 1}>
          Próximo <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Next Action Modal */}
      <NextActionModal
        open={nextActionModalOpen}
        onClose={() => {
          setNextActionModalOpen(false);
        }}
        clientId={client.id}
        clientName={client.name}
        currentStage={client.pipeline_stage}
      />
    </div>
  );
};

export default AdminSmartQueue;
