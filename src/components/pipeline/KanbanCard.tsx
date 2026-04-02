import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, Eye, AlertCircle, Clock, AlertTriangle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { Draggable } from "@hello-pangea/dnd";
import TagManager from "@/components/admin/TagManager";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { computeStrategy } from "@/components/admin/BriefingCard";

const tempBadge: Record<string, string> = {
  hot: "bg-primary/15 text-primary",
  warm: "bg-yellow-500/15 text-yellow-600",
  cold: "bg-blue-500/15 text-blue-500",
  frozen: "bg-muted/15 text-muted-foreground",
};
const tempEmoji: Record<string, string> = { hot: "🔥", warm: "🟡", cold: "🔵", frozen: "⚪" };

const dealTypeLabels: Record<string, { label: string; emoji: string }> = {
  cash: { label: "À vista", emoji: "💵" },
  financing_down: { label: "Entrada+Financ.", emoji: "🏦" },
  financing_full: { label: "100% Financ.", emoji: "🏦" },
  trade_financing: { label: "Troca+Financ.", emoji: "🔄" },
  trade_only: { label: "Troca pura", emoji: "🔄" },
};

const objectionLabels: Record<string, string> = {
  price: "💲 Preço",
  down_payment: "💸 Entrada",
  installment: "📊 Parcela",
  credit: "🚫 Crédito",
  trust: "🤝 Confiança",
  comparison: "⚖️ Comparação",
  trade_undervalued: "📉 Troca",
  indecision: "🤔 Indecisão",
  timing: "⏰ Timing",
};

const churnRiskConfig = (risk: number) => {
  if (risk >= 81) return { color: "bg-red-500/15 text-red-600", label: "Crítico", emoji: "🔴" };
  if (risk >= 61) return { color: "bg-orange-500/15 text-orange-600", label: "Em risco", emoji: "🟠" };
  if (risk >= 31) return { color: "bg-yellow-500/15 text-yellow-600", label: "Atenção", emoji: "🟡" };
  return null;
};

const queueReasonBadge: Record<string, { label: string; color: string }> = {
  promise_overdue: { label: "🤝 Promessa vencida", color: "bg-destructive/15 text-destructive" },
  action_overdue: { label: "⏰ Ação atrasada", color: "bg-destructive/15 text-destructive" },
  no_contact_48h: { label: "📵 Sem contato 48h", color: "bg-warning/15 text-warning" },
  scheduled_today: { label: "📅 Agendado hoje", color: "bg-info/15 text-info" },
  hot_lead: { label: "🔥 Lead quente", color: "bg-primary/15 text-primary" },
};

interface KanbanCardProps {
  client: Tables<"clients">;
  index: number;
  highlight?: boolean;
  chatCount?: number;
  hasActiveChat?: boolean;
  interactionCount?: number;
  compact?: boolean;
  subStageLabel?: string;
}

const KanbanCard = ({ client, index, highlight, chatCount = 0, hasActiveChat = false, interactionCount = 0, compact = false, subStageLabel }: KanbanCardProps) => {
  const navigate = useNavigate();
  const noContact = interactionCount === 0 && client.pipeline_stage === "new";
  const churnRisk = (client as any).churn_risk || 0;
  const priorityScore = (client as any).priority_score || 0;
  const dealType = (client as any).deal_type as string | null;
  const objType = (client as any).objection_type as string | null;
  const nextAction = (client as any).next_action as string | null;
  const nextActionDue = (client as any).next_action_due as string | null;
  const clientPromiseStatus = (client as any).client_promise_status as string | null;
  const dealValue = (client as any).deal_value as number | null;
  const creditStatus = (client as any).credit_status as string | null;
  const docsStatus = (client as any).docs_status as string | null;
  const queueReason = (client as any).queue_reason as string | null;
  const substatus = (client as any).substatus as string | null;

  const riskInfo = churnRiskConfig(churnRisk);
  const isActionOverdue = nextActionDue ? new Date(nextActionDue) < new Date() : false;
  const isPromiseBroken = clientPromiseStatus === 'broken' || clientPromiseStatus === 'overdue';
  const qrBadge = queueReason && queueReason !== 'standard' ? queueReasonBadge[queueReason] : null;
  const strategy = computeStrategy(client);

  const substatusLabels: Record<string, string> = {
    scheduled: "📅 Agendado",
    waiting_client: "⏳ Aguardando",
    thinking: "🤔 Pensando",
    no_response: "🔇 Sem resposta",
    docs_pending: "📄 Docs pendentes",
  };

  return (
    <Draggable draggableId={client.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          id={`kanban-card-${client.id}`}
          className={`rounded-xl border bg-card transition-all ${
            highlight
              ? "ring-2 ring-primary border-primary shadow-lg shadow-primary/20 animate-pulse"
              : "border-border/50 shadow-sm hover:shadow-md"
          } ${snapshot.isDragging ? "shadow-xl ring-2 ring-primary/30 rotate-2 scale-105" : ""} ${compact ? "p-2" : "p-3 space-y-1.5"}`}
        >
          {compact ? (
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-medium px-1 py-0.5 rounded-full ${tempBadge[client.temperature]}`}>
                {tempEmoji[client.temperature]}
              </span>
              <span className="text-xs font-medium truncate flex-1">{client.name}</span>
              {subStageLabel && (
                <span className="text-[8px] bg-accent/40 text-accent-foreground px-1 py-0.5 rounded-full">{subStageLabel}</span>
              )}
              {qrBadge && <span className="text-[8px]">{qrBadge.label.split(" ")[0]}</span>}
              <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${strategy.color}`}>{strategy.emoji}</span>
              {riskInfo && <span className="text-[9px]">{riskInfo.emoji}</span>}
              <span className="text-[9px] text-muted-foreground font-mono">{priorityScore}</span>
              {hasActiveChat && <MessageCircle className="w-2.5 h-2.5 text-primary shrink-0" />}
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0 rounded-full shrink-0"
                onClick={(e) => { e.stopPropagation(); navigate(`/admin/client/${client.id}`); }}
              >
                <Eye className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <>
              {/* Header: temp + name + score */}
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tempBadge[client.temperature]}`}>
                  {tempEmoji[client.temperature]}
                </span>
                <span className="text-sm font-medium truncate flex-1">{client.name}</span>
                <div className="flex items-center gap-1">
                  {hasActiveChat && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="relative flex items-center">
                            <MessageCircle className="w-3 h-3 text-primary" />
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Conversa IA ativa</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {chatCount > 0 && !hasActiveChat && (
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <MessageCircle className="w-2.5 h-2.5" />{chatCount}
                    </span>
                  )}
                  {noContact && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild><AlertCircle className="w-3 h-3 text-destructive" /></TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Sem contato ainda</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <span className="text-[10px] text-muted-foreground tabular-nums font-mono">{priorityScore}pts</span>
                </div>
              </div>

              {/* Sub-stage + substatus badges */}
              {(subStageLabel || (substatus && substatus !== 'active')) && (
                <div className="flex gap-1 flex-wrap">
                  {subStageLabel && (
                    <span className="text-[9px] font-medium bg-accent/50 text-accent-foreground px-1.5 py-0.5 rounded-full">
                      📌 {subStageLabel}
                    </span>
                  )}
                  {substatus && substatus !== 'active' && substatusLabels[substatus] && (
                    <span className="text-[9px] font-medium bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-full">
                      {substatusLabels[substatus]}
                    </span>
                  )}
                </div>
              )}

              {/* Queue reason badge */}
              {qrBadge && (
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full inline-block ${qrBadge.color}`}>
                  {qrBadge.label}
                </span>
              )}

              {/* Strategy badge */}
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${strategy.color}`}>
                {strategy.emoji} {strategy.label}
              </span>
              <div className="flex flex-wrap gap-1">
                {dealType && dealTypeLabels[dealType] && (
                  <span className="text-[9px] font-medium bg-accent/50 text-accent-foreground px-1.5 py-0.5 rounded-full">
                    {dealTypeLabels[dealType].emoji} {dealTypeLabels[dealType].label}
                  </span>
                )}
                {dealValue && dealValue > 0 && (
                  <span className="text-[9px] font-medium bg-emerald-500/15 text-emerald-600 px-1.5 py-0.5 rounded-full">
                    R$ {(dealValue / 1000).toFixed(0)}k
                  </span>
                )}
                {creditStatus && creditStatus !== 'pending' && (
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                    creditStatus === 'approved' ? 'bg-green-500/15 text-green-600' :
                    creditStatus === 'denied' ? 'bg-red-500/15 text-red-600' :
                    'bg-blue-500/15 text-blue-600'
                  }`}>
                    🏦 {creditStatus === 'approved' ? '✅' : creditStatus === 'denied' ? '❌' : creditStatus === 'submitted' ? '📤' : '🔄'}
                  </span>
                )}
                {docsStatus && docsStatus !== 'incomplete' && (
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                    docsStatus === 'complete' ? 'bg-green-500/15 text-green-600' : 'bg-yellow-500/15 text-yellow-600'
                  }`}>
                    📄 {docsStatus === 'complete' ? '✅' : '⏳'}
                  </span>
                )}
              </div>

              {/* Objection + risk */}
              {(objType && objType !== 'none' || riskInfo) && (
                <div className="flex gap-1 flex-wrap">
                  {objType && objType !== 'none' && objectionLabels[objType] && (
                    <span className="text-[9px] font-medium bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded-full">
                      {objectionLabels[objType]}
                    </span>
                  )}
                  {riskInfo && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${riskInfo.color}`}>
                            {riskInfo.emoji} {riskInfo.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Risco de perda: {churnRisk}%</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              )}

              {/* Next action / promise alerts */}
              {(isActionOverdue || isPromiseBroken || (!nextAction && client.pipeline_stage !== 'new' && client.pipeline_stage !== 'closed_won' && client.pipeline_stage !== 'closed_lost')) && (
                <div className="flex gap-1">
                  {!nextAction && client.pipeline_stage !== 'new' && client.pipeline_stage !== 'closed_won' && client.pipeline_stage !== 'closed_lost' && (
                    <span className="text-[9px] font-medium bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" /> Sem ação
                    </span>
                  )}
                  {isActionOverdue && (
                    <span className="text-[9px] font-medium bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> Ação atrasada
                    </span>
                  )}
                  {isPromiseBroken && (
                    <span className="text-[9px] font-medium bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded-full">
                      ⏰ Promessa {clientPromiseStatus === 'broken' ? 'quebrada' : 'vencida'}
                    </span>
                  )}
                </div>
              )}

              {client.interest && (
                <p className="text-[11px] text-muted-foreground truncate">{client.interest}</p>
              )}

              <TagManager clientId={client.id} compact />

              <div className="flex gap-1.5">
                {client.phone && (
                  <Button
                    size="sm"
                    className="h-7 rounded-full text-[10px] gap-1 flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://wa.me/55${client.phone?.replace(/\D/g, "")}`);
                    }}
                  >
                    <MessageCircle className="w-3 h-3" /> WhatsApp
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-full text-[10px] gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/admin/client/${client.id}`);
                  }}
                >
                  <Eye className="w-3 h-3" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default KanbanCard;
