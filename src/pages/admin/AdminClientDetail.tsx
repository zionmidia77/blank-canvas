import { useParams, useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useClient, useClientInteractions, useClientVehicles, useCreateInteraction, useUpdateClient, useCreateTask } from "@/hooks/useSupabase";
import {
  ArrowLeft, MessageCircle, Phone, Mail, MapPin, Calendar, Bike,
  TrendingUp, Clock, Plus, Star, CalendarPlus, Check, AlertTriangle,
  Copy, Send, Tag, FileCheck, Cake, Edit2, Columns3, PanelRightOpen, PanelRightClose
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import TagManager from "@/components/admin/TagManager";
import FinancingSection from "@/components/admin/FinancingSection";
import ReferralSection from "@/components/admin/ReferralSection";
import LTVOpportunities from "@/components/admin/LTVOpportunities";
import NPSSection from "@/components/admin/NPSSection";
import ClientReportSection from "@/components/admin/ClientReportSection";
import ExclusiveOffersSection from "@/components/admin/ExclusiveOffersSection";
import ChatHistorySection from "@/components/admin/ChatHistorySection";
import LeadCopilotPanel from "@/components/admin/LeadCopilotPanel";
import LeadTimeline from "@/components/admin/LeadTimeline";
import CadenceTracker from "@/components/admin/CadenceTracker";
import BriefingCard from "@/components/admin/BriefingCard";
import WhatsAppAnalyzer from "@/components/admin/WhatsAppAnalyzer";

const tempBadge: Record<string, string> = {
  hot: "bg-primary/15 text-primary",
  warm: "bg-warning/15 text-warning",
  cold: "bg-info/15 text-info",
  frozen: "bg-muted/15 text-muted-foreground",
};
const tempLabel: Record<string, string> = { hot: "🔥 Quente", warm: "🟡 Morno", cold: "🔵 Frio", frozen: "⚪ Inativo" };

const STAGES = [
  { key: "new", label: "Novo" },
  { key: "contacted", label: "Contatado" },
  { key: "interested", label: "Interessado" },
  { key: "attending", label: "Em atendimento" },
  { key: "thinking", label: "Pensando" },
  { key: "waiting_response", label: "Aguardando" },
  { key: "scheduled", label: "Agendado" },
  { key: "negotiating", label: "Negociando" },
  { key: "proposal_sent", label: "Proposta enviada" },
  { key: "financing_analysis", label: "Financiamento" },
  { key: "approved", label: "Aprovado ✅" },
  { key: "rejected", label: "Reprovado ❌" },
  { key: "closed_won", label: "Fechado ✅" },
  { key: "closed_lost", label: "Perdido ❌" },
  { key: "reactivation", label: "Reativação 🔄" },
];

const stageBadge: Record<string, string> = {
  new: "bg-info/15 text-info",
  contacted: "bg-warning/15 text-warning",
  interested: "bg-primary/15 text-primary",
  attending: "bg-purple-400/15 text-purple-400",
  thinking: "bg-amber-400/15 text-amber-400",
  waiting_response: "bg-cyan-400/15 text-cyan-400",
  scheduled: "bg-indigo-400/15 text-indigo-400",
  negotiating: "bg-success/15 text-success",
  proposal_sent: "bg-primary/15 text-primary",
  financing_analysis: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  closed_won: "bg-success text-success-foreground",
  closed_lost: "bg-destructive/15 text-destructive",
  reactivation: "bg-info/15 text-info",
};

const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const AdminClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: client, isLoading } = useClient(id || "");
  const { data: vehicles } = useClientVehicles(id || "");
  const createInteraction = useCreateInteraction();
  const updateClient = useUpdateClient();
  const createTask = useCreateTask();
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<string>("system");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().split("T")[0]);
  const [scheduleReason, setScheduleReason] = useState("");
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [showLossDialog, setShowLossDialog] = useState(false);
  const [lossReason, setLossReason] = useState("");
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-14 h-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-5 text-center">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/leads")}>Voltar</Button>
      </div>
    );
  }

  const firstName = client.name.split(" ")[0];

  const proposalLink = `${window.location.origin}/proposta/${client.id}`;

  // Mensagens por etapa do funil
  const stageMessages: Record<string, { label: string; msg: string }[]> = {
    new: [
      { label: "👋 Boas-vindas", msg: `Fala ${firstName}! Aqui é da Arsenal Motors 🏍️ Vi que você tem interesse em ${(client.interest || "motos").toLowerCase()}. Posso te ajudar?` },
      { label: "📸 Catálogo", msg: `${firstName}, tenho umas opções incríveis pra te mostrar! Quer que eu mande fotos e condições?` },
    ],
    contacted: [
      { label: "🔁 Follow-up", msg: `E aí ${firstName}! Passando pra ver se você teve tempo de pensar. Tem alguma dúvida?` },
      { label: "📋 Proposta", msg: `${firstName}, preparei sua proposta com todas as condições! 👉 ${proposalLink}` },
    ],
    interested: [
      { label: "🔥 Esquenta", msg: `${firstName}, essa moto tá saindo rápido! Quer que eu reserve pra você? 🏍️` },
      { label: "💰 Simulação", msg: `${firstName}, fiz uma simulação de financiamento pra você. Parcelas a partir de valores bem acessíveis! Quer ver?` },
    ],
    attending: [
      { label: "📍 Confirmação", msg: `${firstName}, tudo certo pra sua visita! Te espero aqui na Arsenal Motors. Qualquer coisa me avisa! 🏍️` },
      { label: "📸 Prévia", msg: `${firstName}, separei a moto pra você ver pessoalmente. Tá impecável! Vem conferir 🔥` },
    ],
    thinking: [
      { label: "⏳ Incentivo", msg: `${firstName}, entendo que precisa pensar! Mas essa condição é por tempo limitado. Posso segurar até quando?` },
      { label: "🤝 Dúvidas", msg: `${firstName}, se tiver qualquer dúvida sobre a moto ou financiamento, pode mandar! Tô aqui pra ajudar 💪` },
    ],
    negotiating: [
      { label: "⚡ Urgência", msg: `${firstName}, fechamos então? Tenho outros interessados nessa mesma moto. Quero garantir pra você! 🏍️` },
      { label: "🎯 Condição", msg: `${firstName}, consegui uma condição especial pra fechar hoje! Posso te contar os detalhes?` },
    ],
    proposal_sent: [
      { label: "📋 Proposta", msg: `${firstName}, preparei sua proposta completa! Dá uma olhada:\n\n👉 ${proposalLink}\n\nQualquer dúvida é só chamar!` },
      { label: "⏰ Retorno", msg: `${firstName}, viu a proposta que te mandei? Conseguiu analisar? 😊` },
    ],
    financing_analysis: [
      { label: "🏦 Andamento", msg: `${firstName}, seu financiamento está em análise no banco! Te aviso assim que tiver retorno 🤞` },
      { label: "📄 Documentos", msg: `${firstName}, o banco precisa de mais um documento pra liberar. Consegue me mandar [documento]?` },
    ],
    approved: [
      { label: "✅ Fechamento", msg: `${firstName}, APROVADO! 🎉 Quando você pode vir assinar e sair com a moto?` },
      { label: "📋 Link", msg: `${firstName}, sua proposta aprovada tá aqui:\n\n👉 ${proposalLink}\n\nBora fechar? 🏍️` },
    ],
    reactivation: [
      { label: "🔄 Reativação", msg: `Fala ${firstName}! Faz um tempo que a gente conversou. Surgiu algo novo que pode te interessar 🔥` },
      { label: "🎁 Oferta", msg: `${firstName}, tenho uma condição exclusiva pra quem já é nosso cliente. Quer saber mais?` },
    ],
  };

  const currentStageMessages = stageMessages[client.pipeline_stage] || stageMessages.new || [];
  

  const quickMessages = [
    ...currentStageMessages,
    { label: "📋 Proposta", msg: `${firstName}, preparei sua proposta com todas as condições! Dá uma olhada aqui:\n\n👉 ${proposalLink}\n\nQualquer dúvida é só me chamar! 🏍️` },
    { label: "🔄 Reativação", msg: `Fala ${firstName}! Faz um tempo que a gente conversou. Surgiu algo novo que pode te interessar 🔥` },
  ];

  // Dados reais do banco (salvos em funnel_data)
  const bankProposal = (client.funnel_data as any)?.bank_proposal || {};
  const bankAmount = bankProposal.approved_amount;
  const bankInstallments = bankProposal.installments || {};
  const bankName = bankProposal.bank_name;
  
  // Build installment string for messages
  const installmentOptions = Object.entries(bankInstallments)
    .filter(([_, v]) => v)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([months, value]) => `${months}x de R$ ${Number(value).toLocaleString("pt-BR")}`)
    .join("\n");

  // Mensagens específicas por status de financiamento com valores reais
  const financingMessages: { label: string; msg: string }[] = [];
  
  if (client.financing_status === "approved") {
    const amountStr = bankAmount ? `R$ ${Number(bankAmount).toLocaleString("pt-BR")}` : "";
    financingMessages.push(
      { label: "✅ Aprovado!", msg: `${firstName}, ótima notícia! 🎉 Seu financiamento foi APROVADO${bankName ? ` pelo ${bankName}` : ""}!${amountStr ? ` Valor liberado: *${amountStr}*` : ""}\n\n${installmentOptions ? `As opções de parcela são:\n${installmentOptions}\n\n` : ""}Quando você pode passar aqui pra gente finalizar?` },
      { label: "✅ Melhor parcela", msg: (() => {
        const entries = Object.entries(bankInstallments).filter(([_, v]) => v).sort(([a], [b]) => Number(a) - Number(b));
        if (entries.length === 0) return `${firstName}, seu crédito foi liberado! 🔥 Posso te mostrar as condições. Qual horário fica bom?`;
        const shortest = entries[0];
        const longest = entries[entries.length - 1];
        return `${firstName}, olha que legal as condições que consegui pra você! 🔥\n\n💰 Parcela mais curta: *${shortest[0]}x de R$ ${Number(shortest[1]).toLocaleString("pt-BR")}*\n💰 Parcela mais longa: *${longest[0]}x de R$ ${Number(longest[1]).toLocaleString("pt-BR")}*\n\nQual se encaixa melhor no seu bolso?`;
      })() },
      { label: "✅ Urgência", msg: `${firstName}, seu financiamento tá aprovado e a moto tá reservada pra você! ⚡${installmentOptions ? `\n\nParcelas a partir de *${Object.entries(bankInstallments).filter(([_, v]) => v).sort(([_, a], [__, b]) => Number(a) - Number(b))[0]?.[0] || ""}x de R$ ${Number(Object.entries(bankInstallments).filter(([_, v]) => v).sort(([_, a], [__, b]) => Number(a) - Number(b))[0]?.[1] || 0).toLocaleString("pt-BR")}*` : ""}\n\nTemos outros interessados, bora fechar? 🏍️` },
    );
  } else if (client.financing_status === "pre_approved") {
    const amountStr = bankAmount ? `R$ ${Number(bankAmount).toLocaleString("pt-BR")}` : "";
    financingMessages.push(
      { label: "🟡 Pré-Aprovado", msg: `${firstName}, boas notícias! 🟡 Seu financiamento foi pré-aprovado${bankName ? ` pelo ${bankName}` : ""}!${amountStr ? ` Valor de *${amountStr}*` : ""}\n\n${installmentOptions ? `Opções de parcela:\n${installmentOptions}\n\n` : ""}Falta só confirmar alguns dados pra liberar de vez. Pode me enviar [documento]?` },
      { label: "🟡 Pendência", msg: `Fala ${firstName}! O ${bankName || "banco"} sinalizou que seu crédito tá quase aprovado.${amountStr ? ` Valor pré-liberado: *${amountStr}*` : ""}\n\nPra finalizar, eles precisam de [documento/informação]. Consegue me mandar hoje?` },
      { label: "🟡 Incentivo", msg: `${firstName}, tá quase lá! 💪 O ${bankName || "banco"} pré-aprovou seu crédito.${installmentOptions ? `\n\nParcelas previstas:\n${installmentOptions}` : ""}\n\nAssim que eu receber a documentação pendente, a gente fecha! O que falta do seu lado?` },
    );
  } else if (client.financing_status === "rejected") {
    financingMessages.push(
      { label: "❌ Alternativas", msg: `${firstName}, infelizmente o ${bankName || "banco"} não liberou dessa vez 😔${bankProposal.notes ? ` (${bankProposal.notes})` : ""}\n\nMas calma, temos outras opções! Posso tentar em outro banco, ou a gente pode ajustar a entrada. Bora conversar?` },
      { label: "❌ Outro banco", msg: `Fala ${firstName}! Sobre o financiamento, o ${bankName || "primeiro banco"} não aprovou, mas isso é normal. Já enviei pra outro parceiro. Te aviso assim que tiver retorno! 💪` },
      { label: "❌ Consórcio", msg: `${firstName}, o financiamento tradicional não saiu, mas tenho uma alternativa boa: consórcio com carta contemplada! Parcelas menores e sem juros. Quer que eu simule?` },
    );
  }

  const sendWhatsApp = (msg: string) => {
    if (!client.phone) { toast.error("Cliente sem telefone"); return; }
    const phone = client.phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`);
    createInteraction.mutate({ client_id: client.id, type: "whatsapp", content: `Mensagem enviada via WhatsApp: "${msg.slice(0, 100)}..."`, created_by: "admin" });
    updateClient.mutate({ id: client.id, last_contact_at: new Date().toISOString() } as any);
  };

  const copyMsg = (msg: string) => {
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada!");
  };

  const addNote = () => {
    if (!note.trim()) return;
    createInteraction.mutate({ client_id: client.id, type: noteType as any, content: note, created_by: "admin" });
    updateClient.mutate({ id: client.id, last_contact_at: new Date().toISOString() } as any);
    setNote("");
    toast.success("Interação registrada!");
  };

  const changeStage = (stage: string) => {
    // If changing to closed_lost, show loss reason dialog
    if (stage === "closed_lost") {
      setShowLossDialog(true);
      return;
    }
    updateClient.mutate({ id: client.id, pipeline_stage: stage as any });
    createInteraction.mutate({ client_id: client.id, type: "system", content: `Pipeline alterado para: ${STAGES.find(s => s.key === stage)?.label}`, created_by: "admin" });
    toast.success(`Status atualizado para ${STAGES.find(s => s.key === stage)?.label}`);
  };

  const LOSS_REASONS = [
    { value: "price_high", label: "💰 Preço alto", emoji: "💰" },
    { value: "financing_rejected", label: "🏦 Financiamento recusado", emoji: "🏦" },
    { value: "bought_elsewhere", label: "🏪 Comprou em outro lugar", emoji: "🏪" },
    { value: "no_response", label: "👻 Sumiu / sem resposta", emoji: "👻" },
    { value: "no_budget", label: "💸 Sem orçamento agora", emoji: "💸" },
    { value: "changed_mind", label: "🔄 Desistiu da compra", emoji: "🔄" },
    { value: "other", label: "📝 Outro motivo", emoji: "📝" },
  ];

  const confirmLoss = () => {
    if (!lossReason) { toast.error("Selecione o motivo da perda"); return; }
    const reasonLabel = LOSS_REASONS.find(r => r.value === lossReason)?.label || lossReason;
    const currentFunnelData = (client.funnel_data as any) || {};
    updateClient.mutate({ 
      id: client.id, 
      pipeline_stage: "closed_lost" as any,
      funnel_data: { ...currentFunnelData, loss_reason: lossReason }
    } as any);
    createInteraction.mutate({ client_id: client.id, type: "system", content: `Lead perdido. Motivo: ${reasonLabel}`, created_by: "admin" });
    setShowLossDialog(false);
    setLossReason("");
    toast.success("Lead marcado como perdido");
  };

  const changeTemperature = (temp: string) => {
    updateClient.mutate({ id: client.id, temperature: temp as any });
    toast.success("Temperatura atualizada!");
  };

  const markAttended = () => {
    updateClient.mutate({ id: client.id, last_contact_at: new Date().toISOString() } as any);
    createInteraction.mutate({ client_id: client.id, type: "system", content: "Atendimento registrado", created_by: "admin" });
    toast.success("Atendimento registrado!");
  };

  const scheduleFollowUp = () => {
    if (!scheduleReason.trim()) { toast.error("Adicione um motivo"); return; }
    createTask.mutate({ client_id: client.id, type: "follow_up", reason: scheduleReason, due_date: scheduleDate, status: "pending" });
    createInteraction.mutate({ client_id: client.id, type: "system", content: `Follow-up agendado para ${new Date(scheduleDate + "T12:00:00").toLocaleDateString("pt-BR")}: ${scheduleReason}`, created_by: "admin" });
    setShowSchedule(false);
    setScheduleReason("");
    toast.success("Follow-up agendado!");
  };

  const daysAgo = Math.floor((Date.now() - new Date(client.created_at).getTime()) / 86400000);
  const lastContactDays = client.last_contact_at ? Math.floor((Date.now() - new Date(client.last_contact_at).getTime()) / 86400000) : null;

  // Next action helpers
  const nextActionIcons: Record<string, React.ReactNode> = {
    call: <Phone className="w-5 h-5" />,
    send_proposal: <Send className="w-5 h-5" />,
    send_message: <MessageCircle className="w-5 h-5" />,
    collect_docs: <FileCheck className="w-5 h-5" />,
    follow_up: <Clock className="w-5 h-5" />,
    schedule_visit: <MapPin className="w-5 h-5" />,
    submit_credit: <TrendingUp className="w-5 h-5" />,
    wait_client: <Clock className="w-5 h-5" />,
    close_deal: <Check className="w-5 h-5" />,
    send_content: <Send className="w-5 h-5" />,
  };
  const nextActionLabels: Record<string, string> = {
    call: "Ligar agora",
    send_proposal: "Enviar proposta",
    send_message: "Enviar mensagem",
    collect_docs: "Coletar documentos",
    follow_up: "Fazer follow-up",
    schedule_visit: "Agendar visita",
    submit_credit: "Submeter crédito",
    wait_client: "Aguardar cliente",
    close_deal: "Fechar negócio",
    send_content: "Enviar conteúdo",
  };
  const nextActionDueOverdue = client.next_action_due ? new Date(client.next_action_due) < new Date() : false;

  const objectionLabels: Record<string, string> = {
    price: "💰 Preço", down_payment: "💵 Entrada", installment: "📊 Parcela alta",
    credit: "🏦 Crédito", trust: "🤝 Confiança", comparison: "⚖️ Comparação",
    trade_undervalued: "🔄 Troca desvalorizada", indecision: "🤔 Indecisão",
    timing: "⏰ Timing", none: "✅ Nenhuma",
  };

  const leadContent = (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold">{client.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tempBadge[client.temperature]}`}>
              {tempLabel[client.temperature]}
            </span>
            <button
              onClick={() => navigate(`/admin/pipeline?highlight=${client.id}`)}
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 hover:ring-1 hover:ring-primary/50 transition-all cursor-pointer ${stageBadge[client.pipeline_stage] || ''}`}
              title="Ver no Pipeline"
            >
              <Columns3 className="w-3 h-3" />
              {STAGES.find(s => s.key === client.pipeline_stage)?.label}
            </button>
            <span className="text-[10px] text-muted-foreground">· {daysAgo === 0 ? "hoje" : `${daysAgo}d atrás`}</span>
          </div>
        </div>
         <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Score</p>
            <p className="text-lg font-display font-bold text-primary">{client.lead_score}</p>
          </div>
        </div>
      </motion.div>

      {/* ═══ AI BRIEFING CARD ═══ */}
      <motion.div variants={fadeUp}>
        <BriefingCard client={client} onSendWhatsApp={sendWhatsApp} />
      </motion.div>

      {/* ═══ WHATSAPP ANALYZER ═══ */}
      <motion.div variants={fadeUp}>
        <WhatsAppAnalyzer client={client} onSendWhatsApp={sendWhatsApp} />
      </motion.div>

      {/* ═══ SUMMARY CARD (Zona 2) ═══ */}
      <motion.div variants={fadeUp} className={cn(
        "rounded-2xl border-2 p-5 space-y-3",
        nextActionDueOverdue ? "border-destructive bg-destructive/5" : "border-primary/30 bg-primary/5"
      )}>
        {/* Top row: Resumo + Objeção + Promessa */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {client.interest && <span>📝 {client.interest}</span>}
          {client.objection_type && <span>⚖️ {objectionLabels[client.objection_type] || client.objection_type}</span>}
          {client.client_promise && (
            <span className={cn(client.client_promise_status === "overdue" && "text-destructive font-medium")}>
              ⏰ {client.client_promise}
              {client.client_promise_due && ` · ${format(new Date(client.client_promise_due), "dd/MM HH:mm")}`}
            </span>
          )}
        </div>

        {/* Separator */}
        <div className="h-px bg-border/50" />

        {/* NEXT ACTION — Central & Prominent */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1.5 text-base font-display font-bold",
              nextActionDueOverdue ? "text-destructive" : "text-primary"
            )}>
              {client.next_action_type && nextActionIcons[client.next_action_type]}
              {client.next_action || "Nenhuma ação definida"}
            </span>
            {nextActionDueOverdue && (
              <span className="text-[10px] bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full font-medium animate-pulse">
                ⏰ Atrasada
              </span>
            )}
          </div>
          {client.next_action_due && (
            <p className="text-xs text-muted-foreground">
              Próxima ação · {format(new Date(client.next_action_due), "dd/MM 'às' HH:mm")}
            </p>
          )}
          {/* Direct execution button */}
          {client.next_action_type && (
            <Button
              className={cn("rounded-full px-6 h-10 gap-2 font-medium", nextActionDueOverdue && "bg-destructive hover:bg-destructive/90")}
              onClick={() => {
                if (client.next_action_type === "call" && client.phone) window.open(`tel:${client.phone}`);
                else if (client.next_action_type === "send_message" && client.phone) sendWhatsApp(quickMessages[0]?.msg || "");
                else if (client.next_action_type === "send_proposal") {
                  navigator.clipboard.writeText(proposalLink);
                  toast.success("Link da proposta copiado!");
                }
                else toast.info("Ação registrada");
              }}
            >
              {nextActionIcons[client.next_action_type]}
              {nextActionLabels[client.next_action_type] || "Executar"}
            </Button>
          )}
        </div>
      </motion.div>


      {/* Tags */}
      <motion.div variants={fadeUp} className="glass-card p-3">
        <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-primary" /> Tags
        </p>
        <TagManager clientId={client.id} />
      </motion.div>

      {/* Last contact warning */}
      {lastContactDays !== null && lastContactDays > 2 && (
        <motion.div variants={fadeUp} className="bg-destructive/10 rounded-xl p-3 border border-destructive/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">Último contato há {lastContactDays} dias! Faça o follow-up.</p>
        </motion.div>
      )}

      {/* Quick Actions Bar */}
      <motion.div variants={fadeUp} className="grid grid-cols-4 gap-2">
        {client.phone && (
          <Button className="h-14 rounded-xl flex flex-col gap-1 text-xs glow-red" onClick={() => sendWhatsApp(quickMessages[0].msg)}>
            <MessageCircle className="w-5 h-5" />
            WhatsApp
          </Button>
        )}
        <Button variant="outline" className="h-14 rounded-xl flex flex-col gap-1 text-xs border-primary/30" onClick={markAttended}>
          <Check className="w-5 h-5" />
          Atendido
        </Button>
        <Button variant="outline" className="h-14 rounded-xl flex flex-col gap-1 text-xs border-primary/30" onClick={() => setShowSchedule(!showSchedule)}>
          <CalendarPlus className="w-5 h-5" />
          Agendar
        </Button>
        {client.phone && (
          <Button variant="outline" className="h-14 rounded-xl flex flex-col gap-1 text-xs border-primary/30" onClick={() => window.open(`tel:${client.phone}`)}>
            <Phone className="w-5 h-5" />
            Ligar
          </Button>
        )}
      </motion.div>

      {/* Schedule Follow-up */}
      {showSchedule && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass-card p-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-primary" /> Agendar retorno
          </p>
          <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="rounded-xl bg-secondary border-border/50 h-10" />
          <Input value={scheduleReason} onChange={(e) => setScheduleReason(e.target.value)} placeholder="Ex: Ligar às 18h sobre CB 500..." className="rounded-xl bg-secondary border-border/50 h-10" />
          <div className="flex gap-2">
            <Button onClick={scheduleFollowUp} className="flex-1 rounded-xl h-10">
              <CalendarPlus className="w-4 h-4 mr-2" /> Agendar
            </Button>
            <Button variant="outline" onClick={() => setShowSchedule(false)} className="rounded-xl h-10">Cancelar</Button>
          </div>
        </motion.div>
      )}

      {/* ═══ ACCORDION SECTIONS ═══ */}
      <Accordion type="multiple" defaultValue={["messages", "contact"]} className="space-y-2">

        {/* 📨 Mensagens Rápidas */}
        <AccordionItem value="messages" className="glass-card rounded-xl border-none overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-medium gap-2">
            <span className="flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> Mensagens rápidas</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-2">
              {quickMessages.map((qm, i) => (
                <div key={i} className="bg-secondary/50 rounded-xl p-3 space-y-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{qm.label}</p>
                  <p className="text-xs text-foreground/70 line-clamp-2">{qm.msg}</p>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 rounded-full text-[10px] gap-1 flex-1" onClick={() => sendWhatsApp(qm.msg)}>
                      <MessageCircle className="w-2.5 h-2.5" /> Enviar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px] gap-1" onClick={() => copyMsg(qm.msg)}>
                      <Copy className="w-2.5 h-2.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {financingMessages.length > 0 && (
              <>
                <div className="flex items-center gap-2 mt-4 mb-3">
                  <div className="h-px flex-1 bg-border/50" />
                  <p className="text-[10px] font-medium text-primary uppercase tracking-wider">
                    {client.financing_status === "approved" ? "✅ Financiamento Aprovado" :
                     client.financing_status === "pre_approved" ? "🟡 Pré-Aprovado" :
                     "❌ Financiamento Recusado"}
                  </p>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {financingMessages.map((qm, i) => (
                    <div key={`fin-${i}`} className={cn(
                      "rounded-xl p-3 space-y-2 border",
                      client.financing_status === "approved" ? "bg-green-500/5 border-green-500/20" :
                      client.financing_status === "pre_approved" ? "bg-amber-500/5 border-amber-500/20" :
                      "bg-destructive/5 border-destructive/20"
                    )}>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{qm.label}</p>
                      <p className="text-xs text-foreground/70">{qm.msg}</p>
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-7 rounded-full text-[10px] gap-1 flex-1" onClick={() => sendWhatsApp(qm.msg)}>
                          <MessageCircle className="w-2.5 h-2.5" /> Enviar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px] gap-1" onClick={() => copyMsg(qm.msg)}>
                          <Copy className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 📇 Informações de Contato */}
        <AccordionItem value="contact" className="glass-card rounded-xl border-none overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-medium gap-2">
            <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> Contato & dados pessoais</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-3">
            {client.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{client.email}</span>
              </div>
            )}
            {client.city && (
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{client.city}</span>
              </div>
            )}
            {client.interest && (
              <div className="flex items-center gap-3">
                <Star className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm">{client.interest}</span>
              </div>
            )}
            {client.budget_range && (
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Orçamento: {client.budget_range}</span>
              </div>
            )}
            {client.source && (
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Origem: {client.source}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Cake className="w-4 h-4 text-muted-foreground" />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className={cn("h-auto p-0 text-sm font-normal hover:bg-transparent hover:underline", !client.birthdate && "text-muted-foreground")}>
                    {client.birthdate ? `🎂 ${format(new Date(client.birthdate + "T12:00:00"), "dd/MM/yyyy")}` : "Adicionar data de nascimento"}
                    <Edit2 className="w-3 h-3 ml-1.5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={client.birthdate ? new Date(client.birthdate + "T12:00:00") : undefined}
                    onSelect={(date) => {
                      if (date) {
                        updateClient.mutate({ id: client.id, birthdate: format(date, "yyyy-MM-dd") } as any);
                        toast.success("Data de nascimento atualizada!");
                      }
                    }}
                    disabled={(date) => date > new Date() || date < new Date("1920-01-01")}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 🌡️ Temperatura & Pipeline */}
        <AccordionItem value="pipeline" className="glass-card rounded-xl border-none overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-medium gap-2">
            <span className="flex items-center gap-2"><Columns3 className="w-4 h-4 text-primary" /> Temperatura & Pipeline</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">Temperatura</p>
              <div className="flex gap-2">
                {(["hot", "warm", "cold", "frozen"] as const).map(temp => (
                  <Button key={temp} size="sm" variant={client.temperature === temp ? "default" : "outline"} className="rounded-full text-xs flex-1 h-9" onClick={() => changeTemperature(temp)}>
                    {tempLabel[temp]}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">Pipeline</p>
              <div className="flex gap-1.5 overflow-x-auto">
                {STAGES.map((stage) => (
                  <Button key={stage.key} size="sm" variant={client.pipeline_stage === stage.key ? "default" : "outline"} className="rounded-full text-[10px] shrink-0 h-7" onClick={() => changeStage(stage.key)}>
                    {stage.label}
                  </Button>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 🏦 Qualificação de Financiamento */}
        <AccordionItem value="financing" className="glass-card rounded-xl border-none overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-medium gap-2">
            <span className="flex items-center gap-2"><FileCheck className="w-4 h-4 text-primary" /> Qualificação para Financiamento</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <FinancingSection client={client} />
          </AccordionContent>
        </AccordionItem>

        {/* 📈 LTV & Oportunidades */}
        <AccordionItem value="ltv" className="glass-card rounded-xl border-none overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-medium gap-2">
            <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> LTV & Oportunidades</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <LTVOpportunities clientId={client.id} clientName={client.name} clientPhone={client.phone} />
          </AccordionContent>
        </AccordionItem>

        {/* 🤝 Indicações */}
        <AccordionItem value="referral" className="glass-card rounded-xl border-none overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-medium gap-2">
            <span className="flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> Indicações</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <ReferralSection client={client} />
          </AccordionContent>
        </AccordionItem>

        {/* ⭐ NPS */}
        <AccordionItem value="nps" className="glass-card rounded-xl border-none overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-medium gap-2">
            <span className="flex items-center gap-2">⭐ NPS</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <NPSSection client={client} />
          </AccordionContent>
        </AccordionItem>

        {/* 📊 Relatório */}
        <AccordionItem value="report" className="glass-card rounded-xl border-none overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-medium gap-2">
            <span className="flex items-center gap-2">📊 Relatório do cliente</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <ClientReportSection client={client} vehicles={vehicles} />
          </AccordionContent>
        </AccordionItem>

        {/* 🎁 Ofertas */}
        <AccordionItem value="offers" className="glass-card rounded-xl border-none overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-medium gap-2">
            <span className="flex items-center gap-2">🎁 Ofertas exclusivas</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <ExclusiveOffersSection client={client} />
          </AccordionContent>
        </AccordionItem>

        {/* 💬 Histórico do Chat */}
        <AccordionItem value="chat" className="glass-card rounded-xl border-none overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-medium gap-2">
            <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-primary" /> Histórico do Chat</span>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <ChatHistorySection clientId={client.id} />
          </AccordionContent>
        </AccordionItem>

        {/* 🏍️ Veículos */}
        {vehicles && vehicles.length > 0 && (
          <AccordionItem value="vehicles" className="glass-card rounded-xl border-none overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline text-sm font-medium gap-2">
              <span className="flex items-center gap-2"><Bike className="w-4 h-4 text-primary" /> Veículos ({vehicles.length})</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 space-y-2">
              {vehicles.map((v) => (
                <div key={v.id} className="glass-card p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{v.brand} {v.model} {v.year}</p>
                    <p className="text-xs text-muted-foreground">{v.is_financed ? `${v.installments_paid}/${v.installments_total} parcelas` : "Quitada"}</p>
                  </div>
                  {v.estimated_value && <p className="text-sm font-display font-bold text-primary">R$ {v.estimated_value.toLocaleString("pt-BR")}</p>}
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

      </Accordion>

      {/* Add Interaction - always visible */}
      <motion.div variants={fadeUp} className="glass-card p-4">
        <p className="text-sm font-medium mb-3">Registrar interação</p>
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          {[
            { key: "whatsapp", label: "💬 WhatsApp" },
            { key: "call", label: "📞 Ligação" },
            { key: "visit", label: "🏪 Visita" },
            { key: "system", label: "📝 Nota" },
          ].map(t => (
            <Button key={t.key} size="sm" variant={noteType === t.key ? "default" : "outline"} className="rounded-full text-[10px] shrink-0 h-7" onClick={() => setNoteType(t.key)}>
              {t.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Ex: Cliente interessado em CB 500..." className="rounded-xl bg-secondary border-border/50 h-10" />
          <Button size="icon" className="rounded-xl h-10 w-10 shrink-0" onClick={addNote}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      {/* Cadence Tracker */}
      <motion.div variants={fadeUp} className="glass-card p-4">
        <CadenceTracker clientId={client.id} />
      </motion.div>

      {/* Unified Timeline - always visible */}
      <motion.div variants={fadeUp}>
        <h2 className="font-display font-semibold text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Timeline Unificada</h2>
        <LeadTimeline clientId={client.id} />
      </motion.div>

      {/* Loss Reason Dialog */}
      <Dialog open={showLossDialog} onOpenChange={setShowLossDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">❌ Por que perdeu esse lead?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {LOSS_REASONS.map(reason => (
              <Button
                key={reason.value}
                variant={lossReason === reason.value ? "default" : "outline"}
                className="w-full justify-start rounded-xl h-11 text-sm gap-2"
                onClick={() => setLossReason(reason.value)}
              >
                {reason.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setShowLossDialog(false); setLossReason(""); }}>
              Cancelar
            </Button>
            <Button className="flex-1 rounded-xl" onClick={confirmLoss} disabled={!lossReason}>
              Confirmar perda
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );

  // Desktop: split-view with resizable panels; Mobile: stacked
  if (isMobile) {
    return leadContent;
  }

  return (
    <div className="overflow-y-auto h-full max-w-4xl min-h-[calc(100vh-4rem)]">
      {leadContent}
    </div>
  );
};

export default AdminClientDetail;
