import { useMemo, useState } from "react";
import { Copy, MessageCircle, ChevronDown, ChevronUp, Zap, BookOpen, Target, Shield, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLeadMemory } from "@/hooks/useLeadCopilot";
import type { Tables } from "@/integrations/supabase/types";

interface BriefingCardProps {
  client: Tables<"clients">;
  onSendWhatsApp?: (msg: string) => void;
}

// ── Strategy Engine ──────────────────────────────────────────
export type StrategyLevel = "leve" | "médio" | "forte" | "direto";
export type StrategyType = "pressionar" | "educar" | "fechar" | "recuperar" | "aguardar" | "qualificar";

export interface Strategy {
  type: StrategyType;
  level: StrategyLevel;
  label: string;
  emoji: string;
  color: string;
}

interface Priority {
  level: "urgente" | "normal" | "baixo";
  label: string;
  color: string;
}

interface WhyReason {
  emoji: string;
  text: string;
}

export function computeStrategy(client: Tables<"clients">): Strategy {
  const stage = client.pipeline_stage;
  const obj = client.objection_type;
  const temp = client.temperature;
  const lastContact = client.last_contact_at;
  const hoursSinceContact = lastContact
    ? (Date.now() - new Date(lastContact).getTime()) / 3600000
    : 999;

  // Fechar direto — hot + advanced stage + has signals
  if (
    temp === "hot" &&
    ["negotiation", "negotiating", "closing", "approved"].includes(stage) &&
    (client.has_down_payment || client.docs_status === "complete")
  ) {
    return { type: "fechar", level: "direto", label: "Fechar direto", emoji: "🏆", color: "bg-green-500/15 text-green-600 border-green-500/30" };
  }

  // Pressionar — negotiating with resolvable objection
  if (["negotiation", "negotiating", "proposal_sent", "proposal"].includes(stage)) {
    if (temp === "hot" && hoursSinceContact < 24) {
      return { type: "pressionar", level: "forte", label: "Pressionar forte", emoji: "⚡", color: "bg-primary/15 text-primary border-primary/30" };
    }
    if (temp === "hot" || (obj && ["price", "down_payment", "installment"].includes(obj))) {
      return { type: "pressionar", level: "médio", label: "Pressionar médio", emoji: "💪", color: "bg-primary/15 text-primary border-primary/30" };
    }
    return { type: "pressionar", level: "leve", label: "Pressionar leve", emoji: "👉", color: "bg-primary/10 text-primary border-primary/20" };
  }

  // Educar — qualification stage or trust/comparison objection
  if (["qualification", "interested", "attending", "first_contact"].includes(stage)) {
    if (obj && ["trust", "comparison"].includes(obj)) {
      return { type: "educar", level: "médio", label: "Educar médio", emoji: "📚", color: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
    }
    return { type: "educar", level: "leve", label: "Educar leve", emoji: "📖", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
  }

  // Recuperar — cold/frozen or reactivation
  if (temp === "cold" || temp === "frozen" || stage === "reactivation") {
    return { type: "recuperar", level: "médio", label: "Recuperar", emoji: "🔄", color: "bg-info/15 text-info border-info/30" };
  }

  // Aguardar — waiting client promise
  if (client.client_promise_status === "pending" && stage !== "new") {
    return { type: "aguardar", level: "leve", label: "Aguardar", emoji: "⏳", color: "bg-muted/30 text-muted-foreground border-border/50" };
  }

  // Qualificar — new or contacted
  if (["new", "contacted"].includes(stage)) {
    return { type: "qualificar", level: "leve", label: "Qualificar", emoji: "🔍", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
  }

  // Default
  return { type: "pressionar", level: "leve", label: "Abordar", emoji: "💬", color: "bg-muted/20 text-muted-foreground border-border/50" };
}

function computePriority(client: Tables<"clients">): Priority {
  const temp = client.temperature;
  const lastContact = client.last_contact_at;
  const hoursSince = lastContact ? (Date.now() - new Date(lastContact).getTime()) / 3600000 : 999;
  const isActionOverdue = client.next_action_due ? new Date(client.next_action_due) < new Date() : false;
  const isPromiseOverdue = client.client_promise_status === "overdue" || client.client_promise_status === "broken";

  if (isPromiseOverdue || (isActionOverdue && temp === "hot") || (temp === "hot" && hoursSince > 24)) {
    return { level: "urgente", label: "🔴 Urgente", color: "text-destructive" };
  }
  if (isActionOverdue || hoursSince > 48 || temp === "warm") {
    return { level: "normal", label: "🟡 Normal", color: "text-warning" };
  }
  return { level: "baixo", label: "🟢 Baixo", color: "text-success" };
}

function computeWhyReasons(client: Tables<"clients">): WhyReason[] {
  const reasons: WhyReason[] = [];
  const hoursSince = client.last_contact_at
    ? (Date.now() - new Date(client.last_contact_at).getTime()) / 3600000
    : null;

  if (client.temperature === "hot") reasons.push({ emoji: "🔥", text: "Lead quente" });
  if (client.temperature === "frozen") reasons.push({ emoji: "🧊", text: "Lead congelado" });
  if (hoursSince && hoursSince > 48) reasons.push({ emoji: "📵", text: `Sem contato há ${Math.floor(hoursSince / 24)}d` });
  if (hoursSince === null) reasons.push({ emoji: "📵", text: "Nunca contatado" });
  if (client.objection_type && client.objection_type !== "none") {
    const labels: Record<string, string> = {
      price: "Objeção: preço", down_payment: "Objeção: entrada", installment: "Objeção: parcela",
      credit: "Objeção: crédito", trust: "Objeção: confiança", comparison: "Objeção: comparação",
      trade_undervalued: "Objeção: troca", indecision: "Objeção: indecisão", timing: "Objeção: timing",
    };
    reasons.push({ emoji: "⚖️", text: labels[client.objection_type] || client.objection_type });
  }
  if (client.client_promise_status === "overdue") reasons.push({ emoji: "🤝", text: "Promessa vencida" });
  if (client.has_down_payment) reasons.push({ emoji: "💵", text: "Tem entrada" });
  if (client.deal_value && client.deal_value >= 30000) reasons.push({ emoji: "💰", text: "Alto valor" });
  if (client.docs_status === "complete") reasons.push({ emoji: "📄", text: "Docs completos" });

  return reasons.slice(0, 4);
}

// ── Situation label ──────────────────────────────────────────
const situationLabels: Record<string, string> = {
  new: "Lead novo, aguardando 1º contato",
  contacted: "Contatado, aguardando resposta",
  first_contact: "1º contato realizado",
  interested: "Demonstrou interesse",
  qualification: "Em qualificação",
  attending: "Em atendimento presencial",
  scheduled: "Visita agendada",
  proposal: "Preparando proposta",
  proposal_sent: "Proposta enviada, aguardando retorno",
  negotiation: "Em negociação ativa",
  negotiating: "Negociando condições",
  thinking: "Cliente pensando",
  waiting_response: "Aguardando resposta do cliente",
  financing_analysis: "Crédito em análise no banco",
  approved: "Crédito aprovado, fechar negócio",
  closing: "Em fechamento",
  closed_won: "Negócio fechado ✅",
  closed_lost: "Lead perdido",
  rejected: "Crédito recusado",
  reactivation: "Em reativação",
};

// ── Suggested message by context ─────────────────────────────
function buildSuggestedMessage(client: Tables<"clients">, strategy: Strategy): string {
  const name = client.name.split(" ")[0];
  const stage = client.pipeline_stage;
  const obj = client.objection_type;
  const hoursSince = client.last_contact_at
    ? (Date.now() - new Date(client.last_contact_at).getTime()) / 3600000
    : 999;

  // Objection-specific messages
  if (obj && obj !== "none") {
    const objMsgs: Record<string, string> = {
      price: `${name}, entendo a preocupação com o valor! Mas olha, comparando com a tabela FIPE e o que tem no mercado, essa condição tá muito boa. Posso te mostrar o comparativo?`,
      down_payment: `${name}, sobre a entrada: a gente consegue trabalhar com valores flexíveis. Qual valor você consegue dar de entrada hoje? Vamos achar a melhor opção juntos!`,
      installment: `${name}, vamos ajustar a parcela pro seu bolso! Posso simular em mais vezes ou com uma entrada diferente. Qual valor de parcela seria ideal pra você?`,
      credit: `${name}, entendo a situação do crédito. Temos parceiros que trabalham com perfis variados. Me deixa tentar por você antes de desistir!`,
      trust: `${name}, pode ficar tranquilo! A Arsenal tem [X] anos de mercado. Posso te mandar depoimentos de clientes e nosso CNPJ pra você verificar.`,
      comparison: `${name}, fico feliz que esteja pesquisando! Compara preço, condição e qualidade — tenho certeza que nosso custo-benefício é imbatível. Posso te mostrar?`,
      indecision: `${name}, eu entendo! Decidir é importante. Me conta: o que te faria bater o martelo hoje? Quero te ajudar a tomar a melhor decisão.`,
      timing: `${name}, sem pressa! Mas fica ligado que essa condição é por tempo limitado. Quer que eu reserve pra você por mais uns dias?`,
    };
    if (objMsgs[obj]) return objMsgs[obj];
  }

  // Stage + behavior messages
  if (stage === "new") return `Fala ${name}! Aqui é da Arsenal Motors 🏍️ Vi que você tem interesse em ${(client.interest || "motos").toLowerCase()}. Posso te ajudar com informações?`;
  if (stage === "contacted" && hoursSince > 48) return `E aí ${name}! Passando pra ver se você conseguiu pensar na proposta. Tô aqui se precisar de qualquer coisa! 😊`;
  if (["proposal_sent", "proposal"].includes(stage)) return `${name}, viu a proposta? Qualquer ajuste que precisar, é só me falar. Quero achar a melhor condição pra você! 💪`;
  if (["negotiation", "negotiating"].includes(stage)) return `${name}, vamos fechar? Tenho uma condição especial mas é por tempo limitado. Posso te contar? ⚡`;
  if (stage === "approved") return `${name}, APROVADO! 🎉 Quando você pode vir assinar e sair pilotando?`;
  if (stage === "reactivation") return `Fala ${name}! Faz um tempo que a gente conversou. Surgiu algo novo que pode te interessar 🔥 Posso te contar?`;
  if (hoursSince > 72) return `${name}, faz ${Math.floor(hoursSince / 24)} dias que a gente não conversa. Tá tudo bem? Posso te ajudar com algo?`;

  return `${name}, tudo certo? Tô aqui pra te ajudar no que precisar! 😊`;
}

// ── Component ────────────────────────────────────────────────
const BriefingCard = ({ client, onSendWhatsApp }: BriefingCardProps) => {
  const { data: memory } = useLeadMemory(client.id);
  const [showDetails, setShowDetails] = useState(false);

  const strategy = useMemo(() => computeStrategy(client), [client]);
  const priority = useMemo(() => computePriority(client), [client]);
  const whyReasons = useMemo(() => computeWhyReasons(client), [client]);
  const situation = situationLabels[client.pipeline_stage] || "Em andamento";
  const suggestedMessage = useMemo(() => buildSuggestedMessage(client, strategy), [client, strategy]);

  // Use AI memory summary if available, otherwise fallback
  const summary = memory?.summary || null;

  const copyMsg = (msg: string) => {
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada!");
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* ── Top: 3 answers ── */}
      <div className="p-4 space-y-3">
        {/* 1. O que está acontecendo */}
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">📍 Situação</p>
          <p className="text-sm font-medium">{situation}</p>
          {summary && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{summary}</p>}
        </div>

        {/* Strategy + Priority row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${strategy.color}`}>
            {strategy.emoji} {strategy.label}
          </span>
          <span className={`text-xs font-medium ${priority.color}`}>
            {priority.label}
          </span>
        </div>

        {/* 2. O que fazer */}
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">🎯 O que fazer</p>
          <p className="text-sm font-medium">
            {client.next_action || (strategy.type === "fechar" ? "Ligar e fechar negócio" : strategy.type === "recuperar" ? "Enviar mensagem de reativação" : strategy.type === "qualificar" ? "Fazer primeiro contato" : "Continuar negociação")}
          </p>
        </div>

        {/* 3. Como falar — suggested message */}
        <div className="bg-secondary/50 rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">💬 Como falar</p>
          <p className="text-xs text-foreground/80 leading-relaxed">{suggestedMessage}</p>
          <div className="flex gap-1.5">
            {onSendWhatsApp && client.phone && (
              <Button size="sm" className="h-7 rounded-full text-[10px] gap-1 flex-1" onClick={() => onSendWhatsApp(suggestedMessage)}>
                <MessageCircle className="w-2.5 h-2.5" /> WhatsApp
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px] gap-1" onClick={() => copyMsg(suggestedMessage)}>
              <Copy className="w-2.5 h-2.5" /> Copiar
            </Button>
          </div>
        </div>
      </div>

      {/* ── Why section (expandable) ── */}
      {whyReasons.length > 0 && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-between px-4 py-2 border-t border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">💡 Por que essa recomendação</span>
          </div>
          {showDetails ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </button>
      )}
      {showDetails && whyReasons.length > 0 && (
        <div className="px-4 py-2 border-t border-border/20 bg-muted/10">
          <div className="flex flex-wrap gap-1.5">
            {whyReasons.map((r, i) => (
              <span key={i} className="text-[10px] font-medium bg-secondary/80 text-muted-foreground px-2 py-0.5 rounded-full">
                {r.emoji} {r.text}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BriefingCard;
