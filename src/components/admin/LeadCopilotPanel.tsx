import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Copy, Clipboard, ChevronDown, ChevronUp, Sparkles, Target, AlertTriangle, MessageCircle, Zap, ThermometerSun, Tag, Clock, ImagePlus, X, FileDown, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLeadCopilot, useLeadMemory } from "@/hooks/useLeadCopilot";
import ReactMarkdown from "react-markdown";
import { generateProposalPdf } from "@/lib/generateProposalPdf";
import OfflineSalesScripts from "./OfflineSalesScripts";

interface LeadCopilotPanelProps {
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientInterest?: string;
  clientBudget?: string;
  vehiclePhotos?: string[];
}

const QUICK_COMMANDS = [
  { label: "📝 Proposta completa", cmd: "Monte uma proposta comercial COMPLETA para este cliente. Escolha o melhor veículo do estoque baseado no perfil, calcule financiamento com múltiplas opções de entrada e parcelas, compare com FIPE, adicione gatilhos de urgência e gere a mensagem WhatsApp pronta." },
  { label: "📊 Comparativo", cmd: "Monte uma proposta COMPARATIVA com 2-3 opções de veículos do estoque para este cliente, com simulações de financiamento lado a lado e análise de custo-benefício." },
  { label: "💰 Simular parcelas", cmd: "Simule diferentes cenários de financiamento: com e sem entrada, em 24x, 36x, 48x e 60x. Verifique se cabe no bolso (máx 30% da renda). Sugira a melhor opção." },
  { label: "🔄 Proposta c/ troca", cmd: "Monte proposta considerando o veículo de troca do cliente. Estime valor da troca, calcule restante e simule parcelas com gatilhos mentais." },
  { label: "⚡ Quebrar objeção", cmd: "Identifique a principal objeção deste lead (preço, parcela, entrada, pensar, nome sujo, concorrência) e me dê o SCRIPT COMPLETO de como quebrar, com mensagem WhatsApp pronta usando técnicas SPIN + gatilhos mentais." },
  { label: "📅 Follow-up 24/48/72h", cmd: "Gere a SEQUÊNCIA COMPLETA de follow-up pós-proposta: mensagens para 24h (lembrete), 48h (escassez), 72h (última chance) e 7 dias (reengajamento). Todas prontas para copiar no WhatsApp." },
  { label: "🏆 Fechar agora", cmd: "Crie uma ESTRATÉGIA DE FECHAMENTO completa para este lead usando Sandler + SPIN + gatilhos mentais. Inclua: perguntas de qualificação, script de fechamento, mensagem WhatsApp com urgência e plano B se disser não." },
  { label: "📈 Arsenal vs Mercado", cmd: "Faça uma análise comparativa Arsenal vs mercado para este lead: compare preços com FIPE, destaque diferenciais, crie argumentos competitivos e monte uma tabela Arsenal vs Concorrência." },
  { label: "📊 Análise SPIN", cmd: "Faça uma análise SPIN completa deste lead: Situação atual, Problemas identificados, Implicações de não agir e Necessidade de solução. Gere as perguntas que o vendedor deve fazer." },
  { label: "🌡️ Diagnóstico", cmd: "Faça um diagnóstico completo: temperatura, objeções, estágio do funil, próxima ação e mensagem pronta." },
  { label: "🏍️ Sugerir veículo", cmd: "Qual o melhor veículo do estoque para este cliente? Considere orçamento, renda, interesse e perfil. Justifique a escolha e monte uma mini-proposta." },
  { label: "🔄 Reativação", cmd: "Crie uma estratégia de reativação com 3 mensagens progressivas usando gatilhos de escassez, novidade e prova social." },
];

const LeadCopilotPanel = ({ clientId, clientName, clientPhone, clientInterest, clientBudget, vehiclePhotos }: LeadCopilotPanelProps) => {
  const copilot = useLeadCopilot(clientId);
  const { data: memory } = useLeadMemory(clientId);
  const [isExporting, setIsExporting] = useState(false);
  const [copilotMode, setCopilotMode] = useState<"ai" | "scripts">("ai");
  const [input, setInput] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showMemory, setShowMemory] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if ((!input.trim() && selectedImages.length === 0) || copilot.isLoading) return;
    copilot.sendMessage(input.trim(), selectedImages.length > 0 ? selectedImages : undefined);
    setInput("");
    setSelectedImages([]);
    setImagePreviews([]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const total = selectedImages.length + files.length;
    if (total > 10) {
      toast.error("Máximo 10 imagens por envio");
      return;
    }

    const newFiles = [...selectedImages, ...files].slice(0, 10);
    setSelectedImages(newFiles);

    // Generate previews
    const newPreviews: string[] = [];
    newFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      newPreviews.push(url);
    });
    // Revoke old previews
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
    setImagePreviews(newPreviews);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    copilot.pasteWhatsApp(pasteText.trim());
    setPasteText("");
    setShowPaste(false);
  };

  const copyToClipboard = (text: string) => {
    const msgMatch = text.match(/(?:mensagem pronta|💬.*?mensagem|copie.*?envie)[:\s]*\n*([^]*?)(?:\n\n\*\*|$)/i);
    const toCopy = msgMatch ? msgMatch[1].trim() : text;
    navigator.clipboard.writeText(toCopy);
    toast.success("Mensagem copiada!");
  };

  const handleExportPdf = async (content: string) => {
    setIsExporting(true);
    try {
      const catalogUrl = `${window.location.origin}/catalogo`;
      const blob = await generateProposalPdf({
        clientName,
        clientPhone,
        proposalText: content,
        vehiclePhotos,
        qrUrl: catalogUrl,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Proposta_${clientName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF exportado com sucesso!");
    } catch (e) {
      console.error("PDF export error:", e);
      toast.error("Erro ao exportar PDF");
    } finally {
      setIsExporting(false);
    }
  };
  const tempColors: Record<string, string> = {
    hot: "text-primary bg-primary/10",
    warm: "text-warning bg-warning/10",
    cold: "text-info bg-info/10",
    frozen: "text-muted-foreground bg-muted/10",
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-4 hover:bg-accent/50 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold">AI Copilot</p>
          <p className="text-[10px] text-muted-foreground">Assistente exclusivo para {clientName}</p>
        </div>
        {memory?.lead_temperature_ai && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tempColors[memory.lead_temperature_ai] || ""}`}>
            {memory.lead_temperature_ai === "hot" ? "🔥 Quente" : memory.lead_temperature_ai === "warm" ? "🟡 Morno" : memory.lead_temperature_ai === "cold" ? "🔵 Frio" : "⚪ Inativo"}
          </span>
        )}
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Mode Toggle */}
            <div className="px-4 pb-3 flex gap-1.5">
              <button
                onClick={() => setCopilotMode("ai")}
                className={`text-[10px] px-3 py-1.5 rounded-full font-medium transition-colors ${
                  copilotMode === "ai" ? "bg-primary/15 text-primary" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Sparkles className="w-3 h-3 inline mr-1" />AI Copilot
              </button>
              <button
                onClick={() => setCopilotMode("scripts")}
                className={`text-[10px] px-3 py-1.5 rounded-full font-medium transition-colors ${
                  copilotMode === "scripts" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <BookOpen className="w-3 h-3 inline mr-1" />Scripts Offline
              </button>
            </div>

            {copilotMode === "scripts" ? (
              <div className="px-4 pb-4">
                <OfflineSalesScripts
                  clientName={clientName}
                  clientPhone={clientPhone}
                  clientInterest={clientInterest}
                  clientBudget={clientBudget}
                />
              </div>
            ) : (
            <>
            {/* Memory Summary Card */}
            {memory && (
              <div className="px-4 pb-3">
                <button onClick={() => setShowMemory(!showMemory)} className="w-full text-left">
                  <div className="bg-secondary/50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                      Memória do Lead
                      {showMemory ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                    </div>

                    {memory.recommended_action && (
                      <div className="flex items-start gap-2 bg-primary/5 rounded-lg p-2">
                        <Target className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                        <p className="text-[11px] text-foreground/80">{memory.recommended_action}</p>
                      </div>
                    )}

                    {memory.objections && (memory.objections as string[]).length > 0 && (
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-3 h-3 text-warning shrink-0 mt-0.5" />
                        <p className="text-[10px] text-muted-foreground">{(memory.objections as string[]).join(" · ")}</p>
                      </div>
                    )}

                    {memory.ai_tags && (memory.ai_tags as string[]).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(memory.ai_tags as string[]).map((tag, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <AnimatePresence>
                      {showMemory && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-2 pt-2 border-t border-border/30"
                        >
                          {memory.summary && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Resumo</p>
                              <p className="text-[11px]">{memory.summary}</p>
                            </div>
                          )}
                          {memory.interests && (memory.interests as string[]).length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Interesses</p>
                              <p className="text-[11px]">{(memory.interests as string[]).join(", ")}</p>
                            </div>
                          )}
                          {memory.behavior_patterns && (memory.behavior_patterns as string[]).length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Padrões</p>
                              <p className="text-[11px]">{(memory.behavior_patterns as string[]).join(", ")}</p>
                            </div>
                          )}
                          {memory.recommended_message && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Mensagem sugerida</p>
                              <div className="bg-card rounded-lg p-2 border border-border/30">
                                <p className="text-[11px]">{memory.recommended_message}</p>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] mt-1 gap-1" onClick={() => copyToClipboard(memory.recommended_message!)}>
                                  <Copy className="w-3 h-3" /> Copiar
                                </Button>
                              </div>
                            </div>
                          )}
                          {memory.last_analyzed_at && (
                            <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Última análise: {new Date(memory.last_analyzed_at).toLocaleString("pt-BR")}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </button>
              </div>
            )}

            {/* Quick Commands */}
            <div className="px-4 pb-3">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {QUICK_COMMANDS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => copilot.sendMessage(q.cmd)}
                    disabled={copilot.isLoading}
                    className="text-[10px] px-2.5 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0 disabled:opacity-50"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* WhatsApp Paste */}
            <div className="px-4 pb-3">
              <button
                onClick={() => setShowPaste(!showPaste)}
                className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Clipboard className="w-3.5 h-3.5" />
                Colar conversa do WhatsApp
              </button>
              <AnimatePresence>
                {showPaste && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-2 space-y-2"
                  >
                    <Textarea
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                      placeholder="Cole aqui a conversa do WhatsApp..."
                      className="min-h-[100px] text-xs rounded-xl bg-secondary border-border/50"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-xl text-xs gap-1" onClick={handlePaste} disabled={!pasteText.trim() || copilot.isLoading}>
                        <Sparkles className="w-3 h-3" /> Analisar
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => { setShowPaste(false); setPasteText(""); }}>
                        Cancelar
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Chat Messages */}
            {copilot.messages.length > 0 && (
              <div className="px-4 pb-3">
                <div className="bg-secondary/30 rounded-xl p-3 max-h-96 overflow-y-auto space-y-3">
                  {copilot.messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[90%] ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3 py-2"
                          : "bg-card border border-border/50 rounded-2xl rounded-bl-md px-3 py-2"
                      }`}>
                        {/* Show image thumbnails in user messages */}
                        {msg.images && msg.images.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {msg.images.map((src, imgIdx) => (
                              <img
                                key={imgIdx}
                                src={src}
                                alt={`Imagem ${imgIdx + 1}`}
                                className="w-16 h-16 rounded-lg object-cover border border-white/20"
                              />
                            ))}
                          </div>
                        )}
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none text-xs [&_p]:mb-1 [&_ul]:mb-1 [&_li]:mb-0.5 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_strong]:text-foreground">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                            <div className="flex gap-1 mt-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                                onClick={() => copyToClipboard(msg.content)}
                              >
                                <Copy className="w-3 h-3" /> Copiar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                                onClick={() => handleExportPdf(msg.content)}
                                disabled={isExporting}
                              >
                                <FileDown className="w-3 h-3" /> {isExporting ? "Gerando..." : "PDF"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {copilot.isLoading && copilot.messages[copilot.messages.length - 1]?.role !== "assistant" && (
                    <div className="flex gap-1.5 px-3 py-2">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Image Previews */}
            {selectedImages.length > 0 && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-2 p-2 bg-secondary/30 rounded-xl">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative group">
                      <img src={src} alt={`Preview ${i + 1}`} className="w-14 h-14 rounded-lg object-cover border border-border/50" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground self-end ml-1">{selectedImages.length}/10</p>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="px-4 pb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="rounded-xl h-10 w-10 shrink-0 border-border/50"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={copilot.isLoading || selectedImages.length >= 10}
                  title="Anexar imagens (até 10)"
                >
                  <ImagePlus className="w-4 h-4" />
                </Button>
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  placeholder={selectedImages.length > 0 ? "Descreva o que analisar nas imagens..." : "Pergunte sobre este lead..."}
                  className="rounded-xl bg-secondary border-border/50 h-10 text-xs"
                  disabled={copilot.isLoading}
                />
                <Button
                  size="icon"
                  className="rounded-xl h-10 w-10 shrink-0"
                  disabled={(!input.trim() && selectedImages.length === 0) || copilot.isLoading}
                  onClick={handleSend}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
            </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeadCopilotPanel;
