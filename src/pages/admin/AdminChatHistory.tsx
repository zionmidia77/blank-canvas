import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquare, User, Clock, UserCheck, X, Search, CalendarIcon, Filter, Send, Phone, Mail, MapPin, Bike, DollarSign, Flame, Thermometer, FileText, ExternalLink, Sparkles, Link2, Columns3 } from "lucide-react";
import { toast } from "sonner";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import ChatConversionDashboard from "@/components/admin/ChatConversionDashboard";
import PageTour from "@/components/admin/PageTour";
import { MessageSquare as MsgIcon2, Filter as FilterIcon3, Link2 as LinkIcon } from "lucide-react";

const PIPELINE_STAGES = [
  { key: "new", label: "Novo", emoji: "🆕" },
  { key: "contacted", label: "Contatado", emoji: "📞" },
  { key: "interested", label: "Interessado", emoji: "🔥" },
  { key: "attending", label: "Em atendimento", emoji: "🤝" },
  { key: "thinking", label: "Pensando", emoji: "🤔" },
  { key: "waiting_response", label: "Aguardando", emoji: "⏳" },
  { key: "scheduled", label: "Agendado", emoji: "📅" },
  { key: "negotiating", label: "Negociação", emoji: "💰" },
  { key: "closed_won", label: "Fechado ✅", emoji: "🏆" },
  { key: "closed_lost", label: "Perdido", emoji: "❌" },
];

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  session_id: string;
  client_id: string | null;
  messages: ConversationMessage[];
  status: string;
  transferred_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    name: string;
    phone: string | null;
    email: string | null;
    city: string | null;
    interest: string | null;
    budget_range: string | null;
    temperature: string;
    pipeline_stage: string;
    has_trade_in: boolean | null;
    has_clean_credit: boolean | null;
    has_down_payment: boolean | null;
    down_payment_amount: number | null;
    salary: number | null;
    employer: string | null;
    financing_status: string | null;
    lead_score: number;
    source: string | null;
    notes: string | null;
    birthdate: string | null;
  } | null;
}

const AdminChatHistory = () => {
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkConvoId, setLinkConvoId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [isLinking, setIsLinking] = useState(false);

  const navigate = useNavigate();
  // Search leads for linking
  const { data: searchedLeads = [] } = useQuery({
    queryKey: ["link-lead-search", linkSearch],
    queryFn: async () => {
      if (!linkSearch.trim() || linkSearch.length < 2) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone, city, interest")
        .or(`name.ilike.%${linkSearch}%,phone.ilike.%${linkSearch}%`)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: linkDialogOpen && linkSearch.length >= 2,
  });

  const handleLinkLead = async (clientId: string, clientName: string) => {
    if (!linkConvoId || isLinking) return;
    setIsLinking(true);
    try {
      const { error } = await supabase
        .from("chat_conversations")
        .update({ client_id: clientId })
        .eq("id", linkConvoId);
      if (error) throw error;

      await supabase.from("interactions").insert({
        client_id: clientId,
        type: "system" as const,
        content: "Conversa IA vinculada manualmente pelo admin",
        created_by: "admin",
      });

      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      toast.success(`Conversa vinculada a "${clientName}"!`);
      setLinkDialogOpen(false);
      setLinkConvoId(null);
      setLinkSearch("");
      if (selectedConvo?.id === linkConvoId) {
        setSelectedConvo(null);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao vincular conversa");
    } finally {
      setIsLinking(false);
    }
  };

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*, clients(name, phone, email, city, interest, budget_range, temperature, pipeline_stage, has_trade_in, has_clean_credit, has_down_payment, down_payment_amount, salary, employer, financing_status, lead_score, source, notes, birthdate)")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as Conversation[];
    },
    refetchInterval: 5000,
  });

  // Notification sound for admin
  const playAdminNotification = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      // Two-tone notification
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.setValueAtTime(900, audioCtx.currentTime + 0.1);
      osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {}
  }, []);

  // Realtime subscription for live updates + notifications
  const prevConvoCountRef = useRef(conversations.length);
  useEffect(() => {
    // Check if new conversations appeared
    if (conversations.length > prevConvoCountRef.current && prevConvoCountRef.current > 0) {
      playAdminNotification();
      const newConvo = conversations[0]; // Most recent
      if (newConvo?.status === "transferred") {
        toast("🔔 Nova conversa transferida!", {
          description: `${(newConvo as any).clients?.name || "Visitante"} aguardando atendimento`,
        });
      }
    }
    prevConvoCountRef.current = conversations.length;
  }, [conversations, playAdminNotification]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-chat-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_conversations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((convo) => {
      // Status filter
      if (statusFilter !== "all" && convo.status !== statusFilter) return false;

      // Search by client name
      if (searchQuery.trim()) {
        const name = (convo.clients?.name || "Visitante").toLowerCase();
        const phone = (convo.clients?.phone || "").toLowerCase();
        const q = searchQuery.toLowerCase();
        if (!name.includes(q) && !phone.includes(q)) return false;
      }

      // Date range filter
      const convoDate = new Date(convo.created_at);
      if (dateFrom && isBefore(convoDate, startOfDay(dateFrom))) return false;
      if (dateTo && isAfter(convoDate, endOfDay(dateTo))) return false;

      return true;
    });
  }, [conversations, statusFilter, searchQuery, dateFrom, dateTo]);

  const hasActiveFilters = statusFilter !== "all" || searchQuery.trim() || dateFrom || dateTo;

  const clearFilters = () => {
    setStatusFilter("all");
    setSearchQuery("");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-emerald-500/20 text-emerald-400";
      case "transferred": return "bg-amber-500/20 text-amber-400";
      case "attended": return "bg-blue-500/20 text-blue-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "active": return "Ativo";
      case "transferred": return "Transferido";
      case "attended": return "Atendido";
      default: return s;
    }
  };

  const chatTourSteps = [
    { target: '[data-tour="chat-dashboard"]', title: "Dashboard de conversão", description: "Métricas de conversão do chat IA: quantas conversas foram convertidas em leads.", icon: MsgIcon2, position: "bottom" as const },
    { target: '[data-tour="chat-filters"]', title: "Filtros de conversas", description: "Filtre por status, data e pesquise por nome ou telefone.", icon: FilterIcon3, position: "bottom" as const },
    { target: '[data-tour="chat-list"]', title: "Lista de conversas", description: "Clique em uma conversa para ver o histórico completo e vincular a um lead.", icon: LinkIcon, position: "bottom" as const },
  ];

  return (
    <div className="space-y-6">
      <PageTour tourKey="chat-history" steps={chatTourSteps} />
      {/* Conversion Dashboard */}
      <div data-tour="chat-dashboard"><ChatConversionDashboard /></div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Histórico de Conversas IA</h2>
          <p className="text-muted-foreground text-sm">Conversas do Consultor Arsenal com leads</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <MessageSquare className="w-3 h-3" />
          {filteredConversations.length} conversa{filteredConversations.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Filters */}
      <Card data-tour="chat-filters">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <Filter className="w-3 h-3 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="transferred">Transferido</SelectItem>
                <SelectItem value="attended">Atendido</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 text-sm gap-1.5", dateFrom && "text-primary border-primary/30")}>
                  <CalendarIcon className="w-3 h-3" />
                  {dateFrom ? format(dateFrom, "dd/MM") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 text-sm gap-1.5", dateTo && "text-primary border-primary/30")}>
                  <CalendarIcon className="w-3 h-3" />
                  {dateTo ? format(dateTo, "dd/MM") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
              </PopoverContent>
            </Popover>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
                <X className="w-3 h-3" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Conversation list */}
        <div className="lg:col-span-3 space-y-2">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Carregando...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {hasActiveFilters ? "Nenhuma conversa encontrada com esses filtros" : "Nenhuma conversa ainda"}
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2 pr-2">
                {filteredConversations.map((convo) => {
                  const msgCount = Array.isArray(convo.messages) ? convo.messages.length : 0;
                  const lastMsg = Array.isArray(convo.messages) ? convo.messages[convo.messages.length - 1] : null;
                  
                  // Determine name source
                  let clientName = convo.clients?.name || "";
                  let nameSource: "linked" | "extracted" | "unknown" = convo.clients?.name ? "linked" : "unknown";
                  if (!clientName && Array.isArray(convo.messages)) {
                    for (const msg of convo.messages) {
                      if (msg.role === "assistant") {
                        const nameFieldMatch = msg.content.match(/\*?\*?Nome:?\*?\*?\s+([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]+?)(?:\n|$)/);
                        if (nameFieldMatch) {
                          clientName = nameFieldMatch[1].trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                          nameSource = "extracted";
                          break;
                        }
                        const greetMatch = msg.content.match(/(?:fala|e aí|oi|olá|eai)\s+([A-ZÀ-Ú][a-zà-ú]+)/i);
                        if (greetMatch) {
                          clientName = greetMatch[1];
                          nameSource = "extracted";
                          break;
                        }
                      }
                    }
                  }
                  if (!clientName) clientName = "Visitante";

                  return (
                    <Card
                      key={convo.id}
                      className={`cursor-pointer transition-all hover:border-primary/30 ${selectedConvo?.id === convo.id ? "border-primary/50 bg-primary/5" : ""}`}
                      onClick={() => setSelectedConvo(convo)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  {nameSource === "linked" ? (
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  ) : nameSource === "extracted" ? (
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  ) : (
                                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  )}
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs max-w-[180px]">
                                  {nameSource === "linked"
                                    ? "Lead vinculado no CRM"
                                    : nameSource === "extracted"
                                    ? "Nome extraído automaticamente pela IA"
                                    : "Visitante — lead não identificado"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <span className="text-sm font-medium truncate max-w-[120px]">{clientName}</span>
                            {nameSource === "extracted" && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0 cursor-help">IA</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    Nome detectado por IA nas mensagens
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <Badge className={`text-[10px] ${statusColor(convo.status)}`}>
                            {statusLabel(convo.status)}
                          </Badge>
                        </div>
                        {lastMsg && (
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {lastMsg.content.slice(0, 60)}...
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {format(new Date(convo.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {!convo.client_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1.5 text-[9px] gap-0.5 text-primary hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLinkConvoId(convo.id);
                                  setLinkSearch("");
                                  setLinkDialogOpen(true);
                                }}
                              >
                                <Link2 className="w-2.5 h-2.5" />
                                Vincular
                              </Button>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {msgCount} msgs
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Conversation detail */}
        <div className={`${selectedConvo?.client_id ? "lg:col-span-6" : "lg:col-span-9"}`}>
          {selectedConvo ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    {(() => {
                      let name = selectedConvo.clients?.name || "";
                      if (!name && Array.isArray(selectedConvo.messages)) {
                        for (const msg of selectedConvo.messages) {
                          if (msg.role === "assistant") {
                            const nameFieldMatch = msg.content.match(/\*?\*?Nome:?\*?\*?\s+([A-ZÀ-Ú][A-ZÀ-Úa-zà-ú\s]+?)(?:\n|$)/);
                            if (nameFieldMatch) {
                              name = nameFieldMatch[1].trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                              break;
                            }
                            const m = msg.content.match(/(?:fala|e aí|oi|olá|eai)\s+([A-ZÀ-Ú][a-zà-ú]+)/i);
                            if (m) { name = m[1]; break; }
                          }
                        }
                      }
                      return name || "Visitante";
                    })()}
                    {selectedConvo.clients?.phone && (
                      <span className="text-sm font-normal text-muted-foreground">
                        · {selectedConvo.clients.phone}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {!selectedConvo.client_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] gap-1"
                        onClick={() => {
                          setLinkConvoId(selectedConvo.id);
                          setLinkSearch("");
                          setLinkDialogOpen(true);
                        }}
                      >
                        <Link2 className="w-3 h-3" /> Vincular lead
                      </Button>
                    )}
                    {selectedConvo.client_id && (
                      <>
                        {/* Pipeline stage quick-change */}
                        <Select
                          value={selectedConvo.clients?.pipeline_stage || "new"}
                          onValueChange={async (val) => {
                            try {
                              await supabase
                                .from("clients")
                                .update({ pipeline_stage: val as any })
                                .eq("id", selectedConvo.client_id!);
                              queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
                              const label = PIPELINE_STAGES.find(s => s.key === val)?.label || val;
                              toast.success(`Pipeline: ${label}`);
                            } catch {
                              toast.error("Erro ao mudar estágio");
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 w-auto text-[10px] gap-1 border-dashed">
                            <Columns3 className="w-3 h-3" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PIPELINE_STAGES.map(s => (
                              <SelectItem key={s.key} value={s.key} className="text-xs">
                                {s.emoji} {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* Ver no Pipeline */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] gap-1"
                          onClick={() => navigate(`/admin/pipeline?highlight=${selectedConvo.client_id}`)}
                        >
                          <Columns3 className="w-3 h-3" /> Pipeline
                        </Button>
                        {/* Desvincular lead */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] gap-1 text-destructive hover:text-destructive"
                          onClick={async () => {
                            if (!confirm("Desvincular este lead da conversa?")) return;
                            try {
                              await supabase
                                .from("chat_conversations")
                                .update({ client_id: null })
                                .eq("id", selectedConvo.id);
                              queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
                              toast.success("Lead desvinculado da conversa");
                              setSelectedConvo(null);
                            } catch {
                              toast.error("Erro ao desvincular");
                            }
                          }}
                        >
                          <Link2 className="w-3 h-3" /> Desvincular
                        </Button>
                      </>
                    )}
                    {(selectedConvo.status === "transferred" || selectedConvo.status === "attended") && (
                      <Badge className={`gap-1 ${statusColor(selectedConvo.status)}`}>
                        <UserCheck className="w-3 h-3" /> {statusLabel(selectedConvo.status)}
                      </Badge>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setSelectedConvo(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Iniciada em {format(new Date(selectedConvo.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[440px]" ref={scrollRef}>
                  <div className="space-y-3 pr-4">
                    {Array.isArray(selectedConvo.messages) && selectedConvo.messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-secondary rounded-bl-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <p className={`text-[9px] mt-1 ${msg.role === "user" ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
                            {msg.timestamp ? format(new Date(msg.timestamp), "HH:mm") : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Manual reply input — available for all conversations */}
                {selectedConvo.status !== "closed" && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!replyText.trim() || isSending) return;
                        setIsSending(true);
                        try {
                          const newMsg = {
                            role: "assistant" as const,
                            content: `[Vendedor] ${replyText.trim()}`,
                            timestamp: new Date().toISOString(),
                          };
                          const currentMsgs = Array.isArray(selectedConvo.messages) ? selectedConvo.messages : [];
                          const updatedMsgs = [...currentMsgs, newMsg];

                          const { error } = await supabase
                            .from("chat_conversations")
                            .update({
                              messages: updatedMsgs as any,
                              status: "attended",
                              updated_at: new Date().toISOString(),
                            })
                            .eq("id", selectedConvo.id);

                          if (error) throw error;

                          if (selectedConvo.client_id) {
                            await supabase.from("interactions").insert({
                              client_id: selectedConvo.client_id,
                              type: "system" as const,
                              content: `Resposta do vendedor no chat: ${replyText.trim().slice(0, 100)}`,
                              created_by: "vendedor",
                            });
                          }

                          setSelectedConvo({ ...selectedConvo, messages: updatedMsgs, status: "attended" });
                          setReplyText("");
                          queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
                          toast.success("Mensagem enviada!");
                          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 100);
                        } catch (err) {
                          console.error(err);
                          toast.error("Erro ao enviar mensagem");
                        } finally {
                          setIsSending(false);
                        }
                      }}
                      className="flex gap-2 items-end"
                    >
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            e.currentTarget.form?.requestSubmit();
                          }
                        }}
                        placeholder="Responder ao cliente (aparece em tempo real)..."
                        rows={1}
                        disabled={isSending}
                        className="flex-1 resize-none text-sm min-h-[40px] max-h-[100px]"
                      />
                      <Button type="submit" size="icon" disabled={!replyText.trim() || isSending} className="shrink-0 h-10 w-10">
                        <Send className="w-4 h-4" />
                      </Button>
                    </form>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      A resposta será salva no histórico da conversa
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="flex items-center justify-center h-[560px]">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione uma conversa para ver os detalhes</p>
              </div>
            </Card>
          )}
        </div>

        {/* Lead Profile Sidebar */}
        {selectedConvo?.client_id && selectedConvo.clients && (
          <div className="lg:col-span-3">
            <Card className="border-border/50 sticky top-20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-primary" />
                    Perfil do Lead
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] gap-1"
                    onClick={() => navigate(`/admin/client/${selectedConvo.client_id}`)}
                  >
                    <ExternalLink className="w-3 h-3" /> Abrir ficha
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Name & Score */}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{selectedConvo.clients.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    Score: {selectedConvo.clients.lead_score}
                  </Badge>
                </div>

                {/* Temperature */}
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-muted-foreground" />
                  <Badge className={`text-[10px] ${
                    selectedConvo.clients.temperature === "hot" ? "bg-destructive/20 text-destructive" :
                    selectedConvo.clients.temperature === "warm" ? "bg-warning/20 text-warning" :
                    selectedConvo.clients.temperature === "cold" ? "bg-info/20 text-info" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {selectedConvo.clients.temperature === "hot" ? "🔥 Quente" :
                     selectedConvo.clients.temperature === "warm" ? "☀️ Morno" :
                     selectedConvo.clients.temperature === "cold" ? "❄️ Frio" : "🧊 Congelado"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {selectedConvo.clients.pipeline_stage?.replace("_", " ")}
                  </Badge>
                </div>

                <div className="h-px bg-border/50" />

                {/* Contact Info */}
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Contato</p>
                  {selectedConvo.clients.phone && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span>{selectedConvo.clients.phone}</span>
                      </div>
                      <a
                        href={`https://wa.me/55${selectedConvo.clients.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-[10px] font-medium transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        WhatsApp
                      </a>
                    </div>
                  )}
                  {selectedConvo.clients.email && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Mail className="w-3 h-3 text-muted-foreground" />
                      <span className="truncate">{selectedConvo.clients.email}</span>
                    </div>
                  )}
                  {selectedConvo.clients.city && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span>{selectedConvo.clients.city}</span>
                    </div>
                  )}
                  {selectedConvo.clients.birthdate && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <CalendarIcon className="w-3 h-3 text-muted-foreground" />
                      <span>{format(new Date(selectedConvo.clients.birthdate + "T12:00:00"), "dd/MM/yyyy")}</span>
                    </div>
                  )}
                </div>

                {/* Interest & Budget */}
                {(selectedConvo.clients.interest || selectedConvo.clients.budget_range) && (
                  <>
                    <div className="h-px bg-border/50" />
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Interesse</p>
                      {selectedConvo.clients.interest && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Bike className="w-3 h-3 text-muted-foreground" />
                          <span>{selectedConvo.clients.interest}</span>
                        </div>
                      )}
                      {selectedConvo.clients.budget_range && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <DollarSign className="w-3 h-3 text-muted-foreground" />
                          <span>{selectedConvo.clients.budget_range}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Financing Info */}
                <div className="h-px bg-border/50" />
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Financiamento</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border ${selectedConvo.clients.has_trade_in ? "bg-success/10 border-success/30 text-success" : "bg-muted/50 border-border/50 text-muted-foreground"}`}>
                      {selectedConvo.clients.has_trade_in ? "✅" : "—"} Troca
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border ${selectedConvo.clients.has_clean_credit ? "bg-success/10 border-success/30 text-success" : "bg-muted/50 border-border/50 text-muted-foreground"}`}>
                      {selectedConvo.clients.has_clean_credit ? "✅" : "—"} Nome limpo
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border ${selectedConvo.clients.has_down_payment ? "bg-success/10 border-success/30 text-success" : "bg-muted/50 border-border/50 text-muted-foreground"}`}>
                      {selectedConvo.clients.has_down_payment ? "✅" : "—"} Entrada
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border ${selectedConvo.clients.financing_status === "complete" ? "bg-success/10 border-success/30 text-success" : "bg-muted/50 border-border/50 text-muted-foreground"}`}>
                      <FileText className="w-2.5 h-2.5" /> {selectedConvo.clients.financing_status === "complete" ? "Docs OK" : "Docs"}
                    </div>
                  </div>
                  {selectedConvo.clients.down_payment_amount && (
                    <p className="text-xs text-muted-foreground">
                      Entrada: R$ {Number(selectedConvo.clients.down_payment_amount).toLocaleString("pt-BR")}
                    </p>
                  )}
                  {selectedConvo.clients.salary && (
                    <p className="text-xs text-muted-foreground">
                      Renda: R$ {Number(selectedConvo.clients.salary).toLocaleString("pt-BR")}
                    </p>
                  )}
                  {selectedConvo.clients.employer && (
                    <p className="text-xs text-muted-foreground">
                      Trabalha: {selectedConvo.clients.employer}
                    </p>
                  )}
                </div>

                {/* Notes */}
                {selectedConvo.clients.notes && (
                  <>
                    <div className="h-px bg-border/50" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Observações</p>
                      <p className="text-xs text-muted-foreground line-clamp-4">{selectedConvo.clients.notes}</p>
                    </div>
                  </>
                )}

                {/* Source */}
                {selectedConvo.clients.source && (
                  <p className="text-[10px] text-muted-foreground">
                    Origem: <span className="capitalize">{selectedConvo.clients.source}</span>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Link conversation to lead dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={(open) => { setLinkDialogOpen(open); if (!open) { setLinkConvoId(null); setLinkSearch(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" />
              Vincular conversa a um lead
            </DialogTitle>
            <DialogDescription>
              Busque por nome ou telefone para vincular esta conversa a um lead existente no CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar lead por nome ou telefone..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="pl-8"
                autoFocus
              />
            </div>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1.5">
                {linkSearch.length < 2 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Digite pelo menos 2 caracteres para buscar
                  </p>
                ) : searchedLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum lead encontrado
                  </p>
                ) : (
                  searchedLeads.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => handleLinkLead(lead.id, lead.name)}
                      disabled={isLinking}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/80 transition-colors text-left border border-transparent hover:border-border/50"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lead.name}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {lead.phone && <span>{lead.phone}</span>}
                          {lead.city && <span>· {lead.city}</span>}
                          {lead.interest && <span>· {lead.interest}</span>}
                        </div>
                      </div>
                      <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminChatHistory;
