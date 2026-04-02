import { useLeadTimeline } from "@/hooks/useLeadCopilot";
import { useClientInteractions } from "@/hooks/useSupabase";
import { Clock, MessageCircle, Phone, Eye, Bot, Clipboard, ArrowUpDown, FileText, AlertCircle } from "lucide-react";
import { useMemo } from "react";

interface LeadTimelineProps {
  clientId: string;
}

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  message_sent: { icon: <MessageCircle className="w-3 h-3" />, color: "text-primary", label: "Mensagem enviada" },
  message_received: { icon: <MessageCircle className="w-3 h-3" />, color: "text-success", label: "Mensagem recebida" },
  whatsapp_paste: { icon: <Clipboard className="w-3 h-3" />, color: "text-success", label: "WhatsApp colado" },
  status_change: { icon: <ArrowUpDown className="w-3 h-3" />, color: "text-warning", label: "Mudança de status" },
  proposal_sent: { icon: <FileText className="w-3 h-3" />, color: "text-primary", label: "Proposta enviada" },
  document_uploaded: { icon: <FileText className="w-3 h-3" />, color: "text-info", label: "Documento enviado" },
  ai_analysis: { icon: <Bot className="w-3 h-3" />, color: "text-primary", label: "Análise IA" },
  inactivity_detected: { icon: <AlertCircle className="w-3 h-3" />, color: "text-destructive", label: "Inatividade" },
  note: { icon: <FileText className="w-3 h-3" />, color: "text-muted-foreground", label: "Nota" },
  call: { icon: <Phone className="w-3 h-3" />, color: "text-warning", label: "Ligação" },
  visit: { icon: <Eye className="w-3 h-3" />, color: "text-success", label: "Visita" },
  // Interaction types
  whatsapp: { icon: <MessageCircle className="w-3 h-3" />, color: "text-success", label: "WhatsApp" },
  system: { icon: <Bot className="w-3 h-3" />, color: "text-muted-foreground", label: "Sistema" },
  email: { icon: <MessageCircle className="w-3 h-3" />, color: "text-info", label: "Email" },
  sms: { icon: <Phone className="w-3 h-3" />, color: "text-warning", label: "SMS" },
};

const LeadTimeline = ({ clientId }: LeadTimelineProps) => {
  const { data: timelineEvents } = useLeadTimeline(clientId);
  const { data: interactions } = useClientInteractions(clientId);

  // Merge interactions and timeline events into a unified timeline
  const unified = useMemo(() => {
    const items: { id: string; type: string; content: string; source: string; created_at: string }[] = [];

    (interactions || []).forEach(i => {
      items.push({
        id: i.id,
        type: i.type,
        content: i.content,
        source: i.created_by || "manual",
        created_at: i.created_at,
      });
    });

    (timelineEvents || []).forEach(e => {
      items.push({
        id: e.id,
        type: e.event_type,
        content: e.content,
        source: e.source,
        created_at: e.created_at,
      });
    });

    // Deduplicate by similar content + timestamp proximity (within 5s)
    const deduped: typeof items = [];
    for (const item of items) {
      const isDup = deduped.some(d =>
        Math.abs(new Date(d.created_at).getTime() - new Date(item.created_at).getTime()) < 5000 &&
        d.content.slice(0, 50) === item.content.slice(0, 50)
      );
      if (!isDup) deduped.push(item);
    }

    return deduped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [interactions, timelineEvents]);

  if (unified.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {unified.map(item => {
        const config = EVENT_CONFIG[item.type] || { icon: <Clock className="w-3 h-3" />, color: "text-muted-foreground", label: item.type };
        const isAI = item.source === "ai" || item.type === "ai_analysis";

        return (
          <div key={item.id} className={`glass-card p-3 border-l-2 ${isAI ? "border-primary/50" : "border-border/30"}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[10px] flex items-center gap-1 ${config.color}`}>
                {config.icon} {config.label}
                {isAI && <Bot className="w-2.5 h-2.5 text-primary" />}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-muted-foreground capitalize">{item.source}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(item.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
            <p className="text-xs text-foreground/80 line-clamp-3">{item.content}</p>
          </div>
        );
      })}
    </div>
  );
};

export default LeadTimeline;
