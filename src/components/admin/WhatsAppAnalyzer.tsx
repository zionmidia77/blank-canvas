import { useState, useCallback, useEffect } from "react";
import { ChevronDown, ChevronUp, Zap, Copy, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

interface WhatsAppAnalyzerProps {
  client: Tables<"clients">;
  onSendWhatsApp?: (msg: string) => void;
}

interface AnalysisResult {
  situation: string;
  strategy: string;
  priority: string;
  response_objective: string;
  next_action: string;
  suggested_message: string;
}

const ANALYZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-whatsapp-message`;

const strategyLabels: Record<string, { emoji: string; label: string; color: string }> = {
  pressionar_forte: { emoji: "⚡", label: "Pressionar forte", color: "text-primary" },
  pressionar_medio: { emoji: "💪", label: "Pressionar médio", color: "text-primary" },
  pressionar_leve: { emoji: "👉", label: "Pressionar leve", color: "text-primary" },
  educar_medio: { emoji: "📚", label: "Educar médio", color: "text-amber-600" },
  educar_leve: { emoji: "📖", label: "Educar leve", color: "text-amber-600" },
  fechar_direto: { emoji: "🏆", label: "Fechar direto", color: "text-green-600" },
  recuperar: { emoji: "🔄", label: "Recuperar", color: "text-info" },
  aguardar: { emoji: "⏳", label: "Aguardar", color: "text-muted-foreground" },
  qualificar: { emoji: "🔍", label: "Qualificar", color: "text-blue-600" },
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  urgente: { label: "🔴 Urgente", color: "text-destructive" },
  normal: { label: "🟡 Normal", color: "text-warning" },
  baixo: { label: "🟢 Baixo", color: "text-green-600" },
};

const MAX_REGENERATIONS = 3;
const COOLDOWN_MS = 30_000;

const WhatsAppAnalyzer = ({ client, onSendWhatsApp }: WhatsAppAnalyzerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [editableMessage, setEditableMessage] = useState("");
  const [regenCount, setRegenCount] = useState(0);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(0);

  const qc = useQueryClient();

  // Restore last analysis from lead_timeline_events on mount
  useEffect(() => {
    const restoreLastAnalysis = async () => {
      try {
        const { data } = await supabase
          .from("lead_timeline_events")
          .select("metadata, created_at")
          .eq("client_id", client.id)
          .eq("source", "whatsapp_analyzer")
          .eq("event_type", "message_received")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.metadata && typeof data.metadata === "object" && "analysis_result" in data.metadata) {
          const saved = (data.metadata as any).analysis_result;
          if (saved?.suggested_message) {
            setAnalysis({
              situation: saved.situation || "",
              strategy: saved.strategy || "",
              priority: saved.priority || "",
              response_objective: saved.response_objective || "",
              next_action: saved.next_action || "",
              suggested_message: saved.suggested_message || "",
            });
            setEditableMessage(saved.suggested_message);
          }
        }
      } catch (e) {
        console.error("Error restoring analysis:", e);
      }
    };
    restoreLastAnalysis();
  }, [client.id]);

  const analyze = useCallback(async () => {
    if (!message.trim()) {
      toast.error("Cole a mensagem do cliente antes de analisar.");
      return;
    }

    const now = Date.now();
    if (now - lastAnalyzedAt < COOLDOWN_MS && lastAnalyzedAt > 0) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - lastAnalyzedAt)) / 1000);
      toast.error(`Aguarde ${remaining}s antes de analisar novamente.`);
      return;
    }

    setIsLoading(true);

    try {
      const resp = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ client_id: client.id, new_message: message.trim() }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 429) throw new Error("Muitas requisições. Aguarde e tente novamente.");
        if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage.");
        throw new Error(err.error || "Erro na análise");
      }

      const { analysis: result } = await resp.json();
      const mapped: AnalysisResult = {
        situation: result.situation || "",
        strategy: result.strategy || "",
        priority: result.priority || "",
        response_objective: result.response_objective || "",
        next_action: result.next_action || "",
        suggested_message: result.suggested_message || "",
      };
      setAnalysis(mapped);
      setEditableMessage(mapped.suggested_message);
      setRegenCount(0);
      setLastAnalyzedAt(Date.now());

      qc.invalidateQueries({ queryKey: ["client-interactions", client.id] });
      qc.invalidateQueries({ queryKey: ["lead-timeline", client.id] });
      qc.invalidateQueries({ queryKey: ["lead-memory", client.id] });

      toast.success("Análise concluída!");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Erro ao analisar mensagem");
    } finally {
      setIsLoading(false);
    }
  }, [message, client.id, lastAnalyzedAt, qc]);

  const regenerateMessage = useCallback(async (tone: "suave" | "direto" | "forte") => {
    if (regenCount >= MAX_REGENERATIONS) {
      toast.error("Limite de regenerações atingido. Analise uma nova mensagem.");
      return;
    }
    if (!analysis) return;

    setIsLoading(true);
    try {
      const tonePrompts: Record<string, string> = {
        suave: "Reescreva de forma mais suave, empática e acolhedora, mas ainda focada em avançar a venda:",
        direto: "Reescreva de forma mais direta e objetiva, sem rodeios, focada em conversão:",
        forte: "Reescreva com urgência e pressão positiva, usando gatilhos de escassez e decisão:",
      };

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          client_id: client.id,
          messages: [
            {
              role: "user",
              content: `${tonePrompts[tone]}\n\nMensagem original: "${analysis.suggested_message}"\n\nContexto: ${analysis.situation}. Objetivo: ${analysis.response_objective}.\n\nRetorne APENAS a mensagem reescrita, sem explicações.`,
            },
          ],
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Erro ao regenerar");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) result += content;
          } catch { break; }
        }
      }

      if (result.trim()) {
        const newMsg = result.trim();
        setEditableMessage(newMsg);
        setRegenCount(prev => prev + 1);
        toast.success(`Mensagem reescrita (tom ${tone})`);

        // Persist regenerated message to lead_memory
        await supabase
          .from("lead_memory")
          .update({ recommended_message: newMsg, updated_at: new Date().toISOString() })
          .eq("client_id", client.id);
      }
    } catch (e) {
      toast.error("Erro ao regenerar mensagem");
    } finally {
      setIsLoading(false);
    }
  }, [analysis, regenCount, client.id]);

  const copyMsg = () => {
    navigator.clipboard.writeText(editableMessage);
    toast.success("Mensagem copiada!");
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium">📱 Atualizar com mensagem do WhatsApp</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/40">
          {/* Input area */}
          <div className="pt-3 space-y-2">
            <Textarea
              placeholder="Cole aqui a última mensagem do cliente..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[80px] text-sm resize-none"
              disabled={isLoading}
            />
            <Button
              onClick={analyze}
              disabled={isLoading || !message.trim()}
              className="w-full gap-2 rounded-xl"
              size="sm"
            >
              {isLoading ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
              ) : (
                <><Zap className="w-3.5 h-3.5" /> Analisar agora</>
              )}
            </Button>
          </div>

          {/* Analysis results */}
          {analysis && (
            <div className="space-y-3 pt-2">
              {/* Strategy + Priority */}
              <div className="flex items-center gap-2 flex-wrap">
                {strategyLabels[analysis.strategy] && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border border-border/50 bg-secondary/50 ${strategyLabels[analysis.strategy].color}`}>
                    {strategyLabels[analysis.strategy].emoji} {strategyLabels[analysis.strategy].label}
                  </span>
                )}
                {priorityLabels[analysis.priority] && (
                  <span className={`text-xs font-medium ${priorityLabels[analysis.priority].color}`}>
                    {priorityLabels[analysis.priority].label}
                  </span>
                )}
              </div>

              {/* Objective */}
              <div className="bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">🎯 Objetivo da resposta</p>
                <p className="text-sm font-medium text-foreground">{analysis.response_objective}</p>
              </div>

              {/* Situation + Next action */}
              <div className="space-y-1.5">
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">📍 Situação</p>
                  <p className="text-sm">{analysis.situation}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">🎯 O que fazer</p>
                  <p className="text-sm font-medium">{analysis.next_action}</p>
                </div>
              </div>

              {/* Suggested message */}
              <div className="bg-secondary/50 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">💬 Como falar</p>
                <Textarea
                  value={editableMessage}
                  onChange={(e) => setEditableMessage(e.target.value)}
                  className="min-h-[80px] text-xs bg-background/50 resize-none"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {onSendWhatsApp && client.phone && (
                    <Button size="sm" className="h-7 rounded-full text-[10px] gap-1 flex-1" onClick={() => onSendWhatsApp(editableMessage)}>
                      <MessageCircle className="w-2.5 h-2.5" /> WhatsApp
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 rounded-full text-[10px] gap-1" onClick={copyMsg}>
                    <Copy className="w-2.5 h-2.5" /> Copiar
                  </Button>
                </div>

                {/* Tone variations */}
                <div className="flex gap-1.5 pt-1">
                  <p className="text-[9px] text-muted-foreground self-center mr-1">Tom:</p>
                  {(["suave", "direto", "forte"] as const).map(tone => (
                    <Button
                      key={tone}
                      size="sm"
                      variant="ghost"
                      className="h-6 rounded-full text-[9px] px-2"
                      disabled={isLoading || regenCount >= MAX_REGENERATIONS}
                      onClick={() => regenerateMessage(tone)}
                    >
                      {tone === "suave" ? "🕊️" : tone === "direto" ? "🎯" : "💥"} {tone.charAt(0).toUpperCase() + tone.slice(1)}
                    </Button>
                  ))}
                  {regenCount > 0 && (
                    <span className="text-[9px] text-muted-foreground self-center ml-auto">
                      {regenCount}/{MAX_REGENERATIONS}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WhatsAppAnalyzer;
