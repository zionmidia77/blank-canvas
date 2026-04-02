import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Bot, Plus, Users, Zap, AlertTriangle, MessageSquare, Settings2, Clock, Radio, Send, Activity, BarChart3, Shield, ListOrdered, Bell } from "lucide-react";
import BotPerformanceDashboard from "@/components/admin/BotPerformanceDashboard";
import BotHealthCard from "@/components/admin/bot/BotHealthCard";
import BotAlerts from "@/components/admin/bot/BotAlerts";
import BotUptimeHistory from "@/components/admin/bot/BotUptimeHistory";
import BotLogsEnhanced from "@/components/admin/bot/BotLogsEnhanced";
import PostingQueueEnhanced from "@/components/admin/bot/PostingQueueEnhanced";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type BotConfig = {
  id: string;
  seller_name: string;
  seller_email: string | null;
  facebook_account: string | null;
  platform: string;
  is_active: boolean;
  max_per_cycle: number;
  delay_seconds: number;
  dry_mode: boolean;
  leads_captured_today: number;
  last_reset_at: string | null;
  created_at: string;
  updated_at: string;
  bot_type: string | null;
  bot_id: string | null;
  schedule_time: string | null;
  last_heartbeat_at: string | null;
  last_run_at: string | null;
};

type BotLog = {
  id: string;
  bot_config_id: string;
  event_type: string;
  platform: string;
  contact_name: string | null;
  message_in: string | null;
  message_out: string | null;
  lead_created: boolean;
  client_id: string | null;
  error: string | null;
  created_at: string;
};

const getHeartbeatStatus = (lastHeartbeat: string | null) => {
  if (!lastHeartbeat) return { color: "bg-destructive", label: "Nunca conectou", bgClass: "bg-destructive/10" };
  const diffMin = (Date.now() - new Date(lastHeartbeat).getTime()) / 60000;
  if (diffMin < 5) return { color: "bg-green-500", label: `Visto ${formatDistanceToNow(new Date(lastHeartbeat), { locale: ptBR, addSuffix: true })}`, bgClass: "bg-green-500/10" };
  if (diffMin < 15) return { color: "bg-yellow-500", label: `Visto ${formatDistanceToNow(new Date(lastHeartbeat), { locale: ptBR, addSuffix: true })}`, bgClass: "bg-yellow-500/10" };
  return { color: "bg-destructive", label: `Offline — visto ${formatDistanceToNow(new Date(lastHeartbeat), { locale: ptBR, addSuffix: true })}`, bgClass: "bg-destructive/10" };
};

const getBotTypeLabel = (botType: string | null) => {
  if (botType === "posting") return { label: "Postagem", icon: Send, color: "text-orange-500" };
  return { label: "Mensageria", icon: MessageSquare, color: "text-blue-500" };
};

const useBotConfigs = () =>
  useQuery({
    queryKey: ["bot-configs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bot_configs").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]).map((d) => ({ ...d, bot_type: d.bot_type ?? "messaging", bot_id: d.bot_id ?? null, schedule_time: d.schedule_time ?? null, last_heartbeat_at: d.last_heartbeat_at ?? null, last_run_at: d.last_run_at ?? null })) as BotConfig[];
    },
  });

const useBotLogs = (configId?: string) =>
  useQuery({
    queryKey: ["bot-logs", configId],
    queryFn: async () => {
      let query = supabase.from("bot_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (configId) query = query.eq("bot_config_id", configId);
      const { data, error } = await query;
      if (error) throw error;
      return data as BotLog[];
    },
    refetchInterval: 5000,
  });

const AdminBotPanel = () => {
  const qc = useQueryClient();
  const { data: configs, isLoading } = useBotConfigs();
  const [selectedBot, setSelectedBot] = useState<string | undefined>();
  const { data: logs } = useBotLogs(selectedBot);
  const [addOpen, setAddOpen] = useState(false);
  const [editBot, setEditBot] = useState<BotConfig | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<BotConfig | null>(null);
  const [, setTick] = useState(0);

  const { data: queueItems } = useQuery({
    queryKey: ["posting-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bot_posting_queue" as any)
        .select("*, stock_vehicles(brand, model, year, local_bot_id)")
        .order("scheduled_for", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: stockVehicles } = useQuery({
    queryKey: ["stock-vehicles-queue"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_vehicles").select("id, brand, model, year, local_bot_id").not("local_bot_id", "is", null).order("brand");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("bot-panel-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_configs" }, () => qc.invalidateQueries({ queryKey: ["bot-configs"] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bot_logs" }, () => { qc.invalidateQueries({ queryKey: ["bot-logs"] }); qc.invalidateQueries({ queryKey: ["bot-configs"] }); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bot_posting_queue" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["posting-queue"] });
        const newRow = payload.new as any;
        const oldRow = payload.old as any;
        if (oldRow?.status === "pending" && newRow?.status === "posted") {
          toast.success(`✅ Veículo ${newRow.local_bot_id || ''} publicado com sucesso!`, { duration: 6000 });
        } else if (oldRow?.status === "pending" && newRow?.status === "error") {
          toast.error(`❌ Erro ao publicar ${newRow.local_bot_id || ''}: ${newRow.error_msg || 'erro desconhecido'}`, { duration: 8000 });
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bot_posting_queue" }, () => qc.invalidateQueries({ queryKey: ["posting-queue"] }))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "bot_posting_queue" }, () => qc.invalidateQueries({ queryKey: ["posting-queue"] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const toggleBot = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("bot_configs").update({ is_active, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["bot-configs"] }); toast.success(vars.is_active ? "Bot ativado!" : "Bot desativado!"); },
  });

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase.from("bot_configs").update({ [field]: value, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bot-configs"] }); toast.success("Atualizado!"); },
  });

  const createBot = useMutation({
    mutationFn: async (config: Partial<BotConfig>) => {
      const { error } = await supabase.from("bot_configs").insert(config as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bot-configs"] }); setAddOpen(false); toast.success("Bot criado!"); },
  });

  const updateBot = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BotConfig> & { id: string }) => {
      const { error } = await supabase.from("bot_configs").update({ ...updates, updated_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bot-configs"] }); setEditBot(null); toast.success("Configuração salva!"); },
  });

  const handleToggle = (bot: BotConfig, checked: boolean) => {
    if (!checked) setConfirmDeactivate(bot);
    else toggleBot.mutate({ id: bot.id, is_active: true });
  };

  const totalLeadsToday = configs?.reduce((s, c) => s + (c.leads_captured_today || 0), 0) || 0;
  const activeBots = configs?.filter((c) => c.is_active).length || 0;
  const totalBots = configs?.length || 0;
  const onlineBots = configs?.filter((c) => c.last_heartbeat_at && (Date.now() - new Date(c.last_heartbeat_at).getTime()) < 300000).length || 0;
  const alertCount = useMemo(() => {
    let count = 0;
    configs?.forEach((bot) => {
      if (!bot.is_active) return;
      if (!bot.last_heartbeat_at || (Date.now() - new Date(bot.last_heartbeat_at).getTime()) > 900000) count++;
    });
    return count;
  }, [configs]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            Centro de Comando — Bots
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Controle total dos bots de mensageria e postagem</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Bot</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar Bot</DialogTitle></DialogHeader>
            <BotForm onSubmit={(data) => createBot.mutate(data)} loading={createBot.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Bot} label="Bots Ativos" value={`${activeBots}/${totalBots}`} color="text-primary" />
        <StatCard icon={Radio} label="Online Agora" value={onlineBots.toString()} color="text-green-500" />
        <StatCard icon={Users} label="Leads Hoje" value={totalLeadsToday.toString()} color="text-blue-500" />
        <StatCard icon={AlertTriangle} label="Erros Recentes" value={(logs?.filter((l) => l.error).length || 0).toString()} color="text-destructive" />
        <StatCard icon={Bell} label="Alertas" value={alertCount.toString()} color={alertCount > 0 ? "text-destructive" : "text-green-500"} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="gap-1 text-xs"><Shield className="w-3.5 h-3.5" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="bots" className="gap-1 text-xs"><Bot className="w-3.5 h-3.5" /> Bots</TabsTrigger>
          <TabsTrigger value="queue" className="gap-1 text-xs"><ListOrdered className="w-3.5 h-3.5" /> Fila</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1 text-xs"><Activity className="w-3.5 h-3.5" /> Logs</TabsTrigger>
          <TabsTrigger value="performance" className="gap-1 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Performance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Alerts */}
          <BotAlerts configs={configs || []} logs={logs || []} />

          {/* Health Cards */}
          {configs && configs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Saúde dos Bots
              </h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {configs.map((bot) => (
                  <BotHealthCard key={bot.id} bot={bot} logs={logs || []} />
                ))}
              </div>
            </div>
          )}

          {/* Uptime History */}
          {configs && configs.length > 0 && (
            <BotUptimeHistory configs={configs} />
          )}
        </TabsContent>

        {/* Bots Tab */}
        <TabsContent value="bots" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Card key={i} className="animate-pulse"><CardContent className="p-6 h-56" /></Card>
              ))
            ) : configs?.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
                  <Bot className="w-12 h-12 text-muted-foreground/30" />
                  <p className="text-muted-foreground">Nenhum bot configurado</p>
                  <Button variant="outline" onClick={() => setAddOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Criar primeiro bot
                  </Button>
                </CardContent>
              </Card>
            ) : (
              configs?.map((bot) => {
                const heartbeat = getHeartbeatStatus(bot.last_heartbeat_at);
                const typeInfo = getBotTypeLabel(bot.bot_type);
                const TypeIcon = typeInfo.icon;
                return (
                  <Card key={bot.id} className="transition-all hover:border-primary/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TypeIcon className={`w-4 h-4 ${typeInfo.color}`} />
                          {bot.seller_name}
                          <Badge variant="outline" className="text-[10px] font-normal capitalize">{typeInfo.label}</Badge>
                          {bot.bot_id && <Badge variant="secondary" className="text-[10px] font-mono">{bot.bot_id}</Badge>}
                        </CardTitle>
                        <Switch checked={bot.is_active} onCheckedChange={(checked) => handleToggle(bot, checked)} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className={`flex items-center gap-2 p-2 rounded-lg ${heartbeat.bgClass}`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${heartbeat.color} ${heartbeat.color === "bg-green-500" ? "animate-pulse" : ""}`} />
                        <span className="text-xs font-medium">{heartbeat.label}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Leads capturados hoje</span>
                        <span className="font-bold text-primary text-2xl">{bot.leads_captured_today}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3" /> Modo Teste (Dry)</span>
                        <Switch checked={bot.dry_mode} onCheckedChange={(v) => updateField.mutate({ id: bot.id, field: "dry_mode", value: v })} />
                      </div>
                      {bot.bot_type === "posting" && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Horário</span>
                          <Input type="time" className="w-28 h-7 text-xs" value={bot.schedule_time || ""} onChange={(e) => updateField.mutate({ id: bot.id, field: "schedule_time", value: e.target.value || null })} />
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Settings2 className="w-3 h-3" />
                        <span>Max: {bot.max_per_cycle}/ciclo · Delay: {bot.delay_seconds}s</span>
                        {bot.dry_mode && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-600 border-yellow-300">DRY</Badge>}
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-2 gap-1" onClick={() => setEditBot(bot)}>
                        <Settings2 className="w-3.5 h-3.5" /> Configurar
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        {/* Queue Tab */}
        <TabsContent value="queue">
          <PostingQueueEnhanced queueItems={queueItems} stockVehicles={stockVehicles} />
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <BotLogsEnhanced
            logs={logs}
            configs={configs}
            selectedBot={selectedBot}
            onSelectBot={setSelectedBot}
            onRefresh={() => qc.invalidateQueries({ queryKey: ["bot-logs"] })}
          />
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <BotPerformanceDashboard />
        </TabsContent>
      </Tabs>

      {/* Deactivation confirmation */}
      <AlertDialog open={!!confirmDeactivate} onOpenChange={(open) => !open && setConfirmDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {confirmDeactivate?.seller_name}?</AlertDialogTitle>
            <AlertDialogDescription>O bot vai parar de operar na próxima verificação (até 60s). Você pode reativá-lo a qualquer momento.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (confirmDeactivate) toggleBot.mutate({ id: confirmDeactivate.id, is_active: false }); setConfirmDeactivate(null); }}>
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit dialog */}
      <Dialog open={!!editBot} onOpenChange={(open) => !open && setEditBot(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configurar Bot — {editBot?.seller_name}</DialogTitle></DialogHeader>
          {editBot && <BotForm initial={editBot} onSubmit={(data) => updateBot.mutate({ id: editBot.id, ...data })} loading={updateBot.isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-accent ${color}`}><Icon className="w-5 h-5" /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </CardContent>
  </Card>
);

const BotForm = ({ initial, onSubmit, loading }: { initial?: BotConfig; onSubmit: (data: any) => void; loading: boolean }) => {
  const [form, setForm] = useState({
    seller_name: initial?.seller_name || "",
    seller_email: initial?.seller_email || "",
    facebook_account: initial?.facebook_account || "",
    platform: initial?.platform || "facebook_marketplace",
    max_per_cycle: initial?.max_per_cycle || 5,
    delay_seconds: initial?.delay_seconds || 30,
    dry_mode: initial?.dry_mode || false,
    bot_type: initial?.bot_type || "messaging",
    bot_id: initial?.bot_id || "",
    schedule_time: initial?.schedule_time || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.seller_name.trim()) return toast.error("Nome do vendedor é obrigatório");
    onSubmit({ ...form, bot_id: form.bot_id.trim() || null, schedule_time: form.schedule_time || null });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do Bot / Vendedor *</Label>
        <Input value={form.seller_name} onChange={(e) => setForm({ ...form, seller_name: e.target.value })} placeholder="Ex: Facebook 1" />
      </div>
      <div className="space-y-2">
        <Label>Bot ID (identificador único usado pelo bot externo) *</Label>
        <Input value={form.bot_id} onChange={(e) => setForm({ ...form, bot_id: e.target.value })} placeholder="Ex: facebook1, facebook2" className="font-mono" />
        <p className="text-[11px] text-muted-foreground">Deve ser o mesmo valor configurado no BOT_ID do .env do bot</p>
      </div>
      <div className="space-y-2">
        <Label>Tipo do Bot</Label>
        <Select value={form.bot_type} onValueChange={(v) => setForm({ ...form, bot_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="messaging">Mensageria (responde mensagens)</SelectItem>
            <SelectItem value="posting">Postagem (publica anúncios)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={form.seller_email} onChange={(e) => setForm({ ...form, seller_email: e.target.value })} placeholder="lucas@empresa.com" />
      </div>
      <div className="space-y-2">
        <Label>Conta Facebook</Label>
        <Input value={form.facebook_account} onChange={(e) => setForm({ ...form, facebook_account: e.target.value })} placeholder="URL ou ID da conta" />
      </div>
      <div className="space-y-2">
        <Label>Plataforma</Label>
        <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="facebook_marketplace">Facebook Marketplace</SelectItem>
            <SelectItem value="facebook">Facebook Messenger</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="instagram">Instagram DM</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {form.bot_type === "posting" && (
        <div className="space-y-2">
          <Label>Horário de Postagem</Label>
          <Input type="time" value={form.schedule_time} onChange={(e) => setForm({ ...form, schedule_time: e.target.value })} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Max por Ciclo</Label>
          <Input type="number" value={form.max_per_cycle} onChange={(e) => setForm({ ...form, max_per_cycle: parseInt(e.target.value) || 5 })} />
        </div>
        <div className="space-y-2">
          <Label>Delay (seg)</Label>
          <Input type="number" value={form.delay_seconds} onChange={(e) => setForm({ ...form, delay_seconds: parseInt(e.target.value) || 30 })} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Label className="cursor-pointer">Modo Teste (não executa ações reais)</Label>
        <Switch checked={form.dry_mode} onCheckedChange={(v) => setForm({ ...form, dry_mode: v })} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Salvando..." : initial ? "Salvar Alterações" : "Criar Bot"}
      </Button>
    </form>
  );
};

export default AdminBotPanel;
