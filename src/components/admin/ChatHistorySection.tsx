import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bot, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Json } from "@/integrations/supabase/types";

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatHistorySectionProps {
  clientId: string;
}

const ChatHistorySection = ({ clientId }: ChatHistorySectionProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["client-chat-history", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="glass-card p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-3" />
        <div className="h-20 bg-muted rounded" />
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="glass-card p-4">
        <p className="text-sm font-medium flex items-center gap-2 mb-2">
          <Bot className="w-4 h-4 text-primary" /> Histórico de Conversas com IA
        </p>
        <p className="text-xs text-muted-foreground text-center py-4">
          Nenhuma conversa com a IA registrada para este lead.
        </p>
      </div>
    );
  }

  const parseMessages = (msgs: Json): ChatMessage[] => {
    if (Array.isArray(msgs)) {
      return msgs as unknown as ChatMessage[];
    }
    return [];
  };

  return (
    <div className="glass-card p-4">
      <p className="text-sm font-medium flex items-center gap-2 mb-3">
        <Bot className="w-4 h-4 text-primary" /> Histórico de Conversas com IA
        <span className="text-[10px] text-muted-foreground ml-auto">
          {conversations.length} conversa{conversations.length > 1 ? "s" : ""}
        </span>
      </p>

      <div className="space-y-2">
        {conversations.map((conv) => {
          const msgs = parseMessages(conv.messages);
          const isExpanded = expandedId === conv.id;
          const preview = msgs.find((m) => m.role === "user")?.content || "Conversa sem mensagens";
          const date = new Date(conv.created_at).toLocaleString("pt-BR");

          return (
            <div key={conv.id} className="bg-secondary/30 rounded-xl border border-border/30 overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : conv.id)}
                className="w-full flex items-center gap-2 p-3 text-left hover:bg-secondary/50 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate">{preview}</p>
                  <p className="text-[10px] text-muted-foreground">{date} · {msgs.length} mensagens</p>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                  conv.status === "transferred" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
                }`}>
                  {conv.status === "transferred" ? "Transferido" : "Concluído"}
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 max-h-80 overflow-y-auto space-y-1.5 border-t border-border/20 pt-2">
                  {msgs.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <span
                        className={`inline-block px-3 py-1.5 rounded-xl text-xs max-w-[85%] ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border/50"
                        }`}
                      >
                        {msg.content}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChatHistorySection;
