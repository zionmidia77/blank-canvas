import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Cake, RefreshCw, Phone, Sparkles, Check, Clock, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface LTVOpportunitiesProps {
  clientId: string;
  clientName: string;
  clientPhone?: string | null;
}

const TYPE_CONFIG: Record<string, { icon: typeof Cake; label: string; color: string; bg: string }> = {
  birthday: { icon: Cake, label: "Aniversário", color: "text-pink-400", bg: "bg-pink-500/10" },
  trade: { icon: RefreshCw, label: "Troca/Upgrade", color: "text-blue-400", bg: "bg-blue-500/10" },
  reactivation: { icon: Phone, label: "Reativação", color: "text-amber-400", bg: "bg-amber-500/10" },
  upsell: { icon: Sparkles, label: "Upsell", color: "text-purple-400", bg: "bg-purple-500/10" },
  refinance: { icon: RefreshCw, label: "Refinanciamento", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  milestone: { icon: Clock, label: "Milestone", color: "text-green-400", bg: "bg-green-500/10" },
};

const LTVOpportunities = ({ clientId, clientName, clientPhone }: LTVOpportunitiesProps) => {
  const qc = useQueryClient();

  const { data: opportunities } = useQuery({
    queryKey: ["opportunities", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const actOnOpportunity = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("opportunities")
        .update({ status, acted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities", clientId] });
      toast.success("Oportunidade atualizada!");
    },
  });

  const pending = (opportunities || []).filter((o) => o.status === "pending");
  const acted = (opportunities || []).filter((o) => o.status !== "pending");

  if (!opportunities || opportunities.length === 0) return null;

  const sendWhatsApp = (msg: string) => {
    if (!clientPhone) { toast.error("Cliente sem telefone"); return; }
    const phone = clientPhone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Oportunidades de LTV
        </p>
        {pending.length > 0 && (
          <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
            {pending.length} pendentes
          </span>
        )}
      </div>

      {pending.length > 0 && (
        <div className="space-y-2 mb-3">
          {pending.map((opp) => {
            const config = TYPE_CONFIG[opp.type] || TYPE_CONFIG.milestone;
            const Icon = config.icon;

            const quickMsg = opp.type === "birthday"
              ? `Fala ${clientName.split(" ")[0]}! 🎂 Parabéns pelo seu aniversário! Tudo de bom pra você. Passa aqui na Arsenal que temos uma surpresa especial pra você!`
              : opp.type === "trade"
              ? `E aí ${clientName.split(" ")[0]}! Já faz um tempo que você tá com sua moto. Que tal um upgrade? Temos condições especiais pra quem já é cliente! 🔥`
              : `Fala ${clientName.split(" ")[0]}! Passando pra ver como você tá. Precisa de algo?`;

            return (
              <div key={opp.id} className="bg-secondary/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full ${config.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{opp.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{opp.message}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {clientPhone && (
                    <Button
                      size="sm"
                      className="h-6 rounded-full text-[10px] gap-1 flex-1"
                      onClick={() => {
                        sendWhatsApp(quickMsg);
                        actOnOpportunity.mutate({ id: opp.id, status: "acted" });
                      }}
                    >
                      💬 Enviar WhatsApp
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 rounded-full text-[10px] gap-1"
                    onClick={() => actOnOpportunity.mutate({ id: opp.id, status: "acted" })}
                  >
                    <Check className="w-2.5 h-2.5" /> Feito
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 rounded-full text-[10px]"
                    onClick={() => actOnOpportunity.mutate({ id: opp.id, status: "dismissed" })}
                  >
                    Ignorar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {acted.length > 0 && (
        <details className="group">
          <summary className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1 hover:text-foreground transition-colors">
            <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
            {acted.length} oportunidades anteriores
          </summary>
          <div className="mt-2 space-y-1">
            {acted.slice(0, 5).map((opp) => {
              const config = TYPE_CONFIG[opp.type] || TYPE_CONFIG.milestone;
              return (
                <div key={opp.id} className="flex items-center gap-2 py-1 opacity-60">
                  <span className={`text-[10px] ${config.color}`}>{config.label}</span>
                  <span className="text-[10px] text-muted-foreground truncate flex-1">{opp.title}</span>
                  <span className="text-[9px] text-muted-foreground">
                    {opp.acted_at ? new Date(opp.acted_at).toLocaleDateString("pt-BR") : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </motion.div>
  );
};

export default LTVOpportunities;