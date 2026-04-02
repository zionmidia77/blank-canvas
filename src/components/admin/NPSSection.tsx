import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquare, Star, Send, ChevronDown, ChevronUp, TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface NPSSectionProps {
  client: any;
}

const useNPSResponses = (clientId: string) =>
  useQuery({
    queryKey: ["nps", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nps_responses")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

const scoreColor = (s: number) => {
  if (s >= 9) return "text-green-400";
  if (s >= 7) return "text-amber-400";
  return "text-red-400";
};

const scoreLabel = (s: number) => {
  if (s >= 9) return "Promotor";
  if (s >= 7) return "Neutro";
  return "Detrator";
};

const NPSSection = ({ client }: NPSSectionProps) => {
  const qc = useQueryClient();
  const { data: responses } = useNPSResponses(client.id);
  const [expanded, setExpanded] = useState(true);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [showForm, setShowForm] = useState(false);

  const submitNPS = useMutation({
    mutationFn: async (data: { score: number; feedback: string }) => {
      const { error } = await supabase.from("nps_responses").insert({
        client_id: client.id,
        score: data.score,
        feedback: data.feedback || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nps", client.id] });
      setScore(null);
      setFeedback("");
      setShowForm(false);
      toast.success("NPS registrado!");
    },
  });

  const lastScore = responses?.[0]?.score;
  const avgScore = responses && responses.length > 0
    ? (responses.reduce((s, r) => s + r.score, 0) / responses.length).toFixed(1)
    : null;

  const sendNPSWhatsApp = () => {
    if (!client.phone) { toast.error("Cliente sem telefone"); return; }
    const phone = client.phone.replace(/\D/g, "");
    const msg = `Fala ${client.name.split(" ")[0]}! 😊 Queremos saber como foi sua experiência com a Arsenal Motors.\n\nDe 0 a 10, quanto você recomendaria a gente para um amigo?\n\nSua opinião é muito importante pra gente! 🙏`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`);
    toast.success("Pesquisa NPS enviada via WhatsApp!");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <p className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" /> Satisfação (NPS)
        </p>
        <div className="flex items-center gap-2">
          {lastScore !== undefined && lastScore !== null && (
            <span className={`text-sm font-bold font-mono ${scoreColor(lastScore)}`}>
              {lastScore}/10
            </span>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-secondary/50 rounded-xl p-2.5 text-center">
              <TrendingUp className="w-3.5 h-3.5 mx-auto text-primary mb-1" />
              <p className="text-lg font-bold font-mono">{avgScore || "—"}</p>
              <p className="text-[9px] text-muted-foreground">Média</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-2.5 text-center">
              <Star className="w-3.5 h-3.5 mx-auto text-amber-400 mb-1" />
              <p className={`text-lg font-bold font-mono ${lastScore != null ? scoreColor(lastScore) : ""}`}>
                {lastScore != null ? lastScore : "—"}
              </p>
              <p className="text-[9px] text-muted-foreground">Último</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-2.5 text-center">
              <MessageSquare className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
              <p className="text-lg font-bold font-mono">{responses?.length || 0}</p>
              <p className="text-[9px] text-muted-foreground">Respostas</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl h-8 text-xs gap-1.5 border-primary/30"
              onClick={sendNPSWhatsApp}
            >
              <Send className="w-3 h-3" /> Enviar NPS via WhatsApp
            </Button>
            <Button
              variant="outline"
              className="rounded-xl h-8 text-xs gap-1.5"
              onClick={() => setShowForm(!showForm)}
            >
              ✍️ Registrar
            </Button>
          </div>

          {/* Manual score form */}
          {showForm && (
            <div className="bg-secondary/30 rounded-xl p-3 space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Registrar resposta NPS
              </p>
              <div className="flex gap-1">
                {[...Array(11)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setScore(i)}
                    className={`flex-1 h-8 rounded-lg text-xs font-bold transition-all ${
                      score === i
                        ? i >= 9 ? "bg-green-500 text-white" : i >= 7 ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                        : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
              {score !== null && (
                <p className={`text-[10px] text-center font-medium ${scoreColor(score)}`}>
                  {scoreLabel(score)} ({score}/10)
                </p>
              )}
              <Input
                placeholder="Feedback do cliente (opcional)"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
              />
              <Button
                size="sm"
                className="w-full rounded-xl h-8 text-xs"
                disabled={score === null}
                onClick={() => score !== null && submitNPS.mutate({ score, feedback })}
              >
                Registrar NPS
              </Button>
            </div>
          )}

          {/* History */}
          {responses && responses.length > 0 && (
            <div className="space-y-1">
              {responses.slice(0, 3).map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-1">
                  <span className={`text-xs font-bold font-mono ${scoreColor(r.score)}`}>
                    {r.score}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate flex-1">
                    {r.feedback || "Sem feedback"}
                  </span>
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default NPSSection;