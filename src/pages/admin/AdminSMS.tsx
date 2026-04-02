import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  MessageSquare, Send, TrendingUp, Clock, CheckCircle2, XCircle, 
  RefreshCw, Zap, Users, BarChart3, AlertTriangle, Phone, Edit2, Plus
} from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import PageTour from "@/components/admin/PageTour";

// ============ Hooks ============
const useSMSStats = () => {
  return useQuery({
    queryKey: ["sms-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const week = subDays(new Date(), 7).toISOString();
      const month = subDays(new Date(), 30).toISOString();

      const [total, sent, failed, todayCount, weekCount, monthCount] = await Promise.all([
        supabase.from("sms_logs").select("id", { count: "exact", head: true }),
        supabase.from("sms_logs").select("id", { count: "exact", head: true }).eq("status", "sent"),
        supabase.from("sms_logs").select("id", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("sms_logs").select("id", { count: "exact", head: true }).gte("sent_at", today),
        supabase.from("sms_logs").select("id", { count: "exact", head: true }).gte("sent_at", week),
        supabase.from("sms_logs").select("id", { count: "exact", head: true }).gte("sent_at", month),
      ]);

      return {
        total: total.count || 0,
        sent: sent.count || 0,
        failed: failed.count || 0,
        today: todayCount.count || 0,
        week: weekCount.count || 0,
        month: monthCount.count || 0,
        successRate: (total.count || 0) > 0 ? Math.round(((sent.count || 0) / (total.count || 1)) * 100) : 0,
      };
    },
  });
};

const useSMSLogs = (limit = 50) => {
  return useQuery({
    queryKey: ["sms-logs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_logs")
        .select("*, clients(name, phone)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
};

const useSMSAutomations = () => {
  return useQuery({
    queryKey: ["sms-automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_automations")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
};

const useSMSChartData = () => {
  return useQuery({
    queryKey: ["sms-chart-data"],
    queryFn: async () => {
      const days = 7;
      const result = [];
      const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const { count: sentCount } = await supabase
          .from("sms_logs")
          .select("id", { count: "exact", head: true })
          .eq("status", "sent")
          .gte("sent_at", dateStr)
          .lt("sent_at", nextDate.toISOString().split("T")[0]);
        const { count: failedCount } = await supabase
          .from("sms_logs")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed")
          .gte("sent_at", dateStr)
          .lt("sent_at", nextDate.toISOString().split("T")[0]);
        result.push({ day: dayNames[date.getDay()], enviados: sentCount || 0, falhas: failedCount || 0 });
      }
      return result;
    },
  });
};

// ============ Components ============
const StatCard = ({ icon: Icon, label, value, color, subtitle }: any) => (
  <Card className="border-border/50">
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(142 71% 45%)", "hsl(45 93% 47%)"];

const SendManualSMS = () => {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [clientId, setClientId] = useState("");
  const qc = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ["clients-for-sms"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, phone")
        .not("phone", "is", null)
        .order("name")
        .limit(200);
      return data || [];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { client_id: clientId || undefined, phone, message, trigger_type: "manual" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("SMS enviado com sucesso!");
        setPhone("");
        setMessage("");
        setClientId("");
        qc.invalidateQueries({ queryKey: ["sms-logs"] });
        qc.invalidateQueries({ queryKey: ["sms-stats"] });
      } else {
        toast.error("Falha ao enviar SMS", { description: JSON.stringify(data.details) });
      }
    },
    onError: (err: any) => toast.error("Erro ao enviar SMS", { description: err.message }),
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" /> Enviar SMS Manual
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={clientId} onValueChange={(v) => {
          setClientId(v);
          const client = clients?.find(c => c.id === v);
          if (client?.phone) setPhone(client.phone);
        }}>
          <SelectTrigger><SelectValue placeholder="Selecionar cliente (opcional)" /></SelectTrigger>
          <SelectContent>
            {clients?.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name} - {c.phone}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="Telefone (ex: 11999998888)" value={phone} onChange={e => setPhone(e.target.value)} />
        <Textarea placeholder="Mensagem (máx 160 caracteres)" value={message} onChange={e => setMessage(e.target.value)} maxLength={160} rows={3} />
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{message.length}/160 caracteres</span>
          <Button onClick={() => sendMutation.mutate()} disabled={!phone || !message || sendMutation.isPending} size="sm">
            {sendMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            Enviar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const AutomationCard = ({ automation, onToggle, onEdit }: any) => (
  <Card className={`border-border/50 ${!automation.is_active ? "opacity-60" : ""}`}>
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm">{automation.name}</h4>
            <Badge variant={automation.trigger_type === "inactivity" ? "default" : automation.trigger_type === "birthday" ? "secondary" : "outline"} className="text-[10px]">
              {automation.trigger_type === "inactivity" ? "Inatividade" : automation.trigger_type === "birthday" ? "Aniversário" : "Pós-venda"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{automation.message_template}</p>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            {automation.trigger_type === "inactivity" && (
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {automation.days_inactive} dias</span>
            )}
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {automation.target_segment}</span>
            <span className="flex items-center gap-1"><Send className="w-3 h-3" /> {automation.sends_today}/{automation.max_sends_per_day} hoje</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(automation)}>
            <Edit2 className="w-3 h-3" />
          </Button>
          <Switch checked={automation.is_active} onCheckedChange={() => onToggle(automation)} />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ============ Main Page ============
const AdminSMS = () => {
  const { data: stats } = useSMSStats();
  const { data: logs } = useSMSLogs();
  const { data: automations } = useSMSAutomations();
  const { data: chartData } = useSMSChartData();
  const qc = useQueryClient();
  const [editAutomation, setEditAutomation] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editDays, setEditDays] = useState(1);
  const [editMaxSends, setEditMaxSends] = useState(50);

  const toggleAutomation = useMutation({
    mutationFn: async (automation: any) => {
      const { error } = await supabase
        .from("sms_automations")
        .update({ is_active: !automation.is_active })
        .eq("id", automation.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sms-automations"] });
      toast.success("Automação atualizada!");
    },
  });

  const updateAutomation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("sms_automations")
        .update({
          name: editName,
          message_template: editMessage,
          days_inactive: editDays,
          max_sends_per_day: editMaxSends,
        })
        .eq("id", editAutomation.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sms-automations"] });
      toast.success("Automação atualizada!");
      setEditAutomation(null);
    },
  });

  const runAutomation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sms-automation");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Automação executada: ${data.totalSent} SMS enviados`, {
        description: data.results?.map((r: any) => `${r.automation}: ${r.sent || 0} enviados`).join(", "),
      });
      qc.invalidateQueries({ queryKey: ["sms-logs"] });
      qc.invalidateQueries({ queryKey: ["sms-stats"] });
      qc.invalidateQueries({ queryKey: ["sms-automations"] });
    },
    onError: (err: any) => toast.error("Erro na automação", { description: err.message }),
  });

  const openEdit = (automation: any) => {
    setEditAutomation(automation);
    setEditName(automation.name);
    setEditMessage(automation.message_template);
    setEditDays(automation.days_inactive);
    setEditMaxSends(automation.max_sends_per_day);
  };

  const triggerPieData = logs ? [
    { name: "Manual", value: logs.filter(l => l.trigger_type === "manual").length },
    { name: "Inatividade", value: logs.filter(l => l.trigger_type === "inactivity").length },
    { name: "Aniversário", value: logs.filter(l => l.trigger_type === "birthday").length },
    { name: "Pós-venda", value: logs.filter(l => l.trigger_type === "post_sale").length },
  ].filter(d => d.value > 0) : [];

  const smsTourSteps = [
    { target: '[data-tour="sms-stats"]', title: "Estatísticas de SMS", description: "Veja enviados hoje, taxa de sucesso, envios na semana e mês.", icon: Send, position: "bottom" as const },
    { target: '[data-tour="sms-tabs"]', title: "Seções do SMS", description: "Dashboard com gráficos, automações configuráveis, envio manual e histórico.", icon: MessageSquare, position: "bottom" as const },
    { target: '[data-tour="sms-run"]', title: "Executar automações", description: "Dispare todas as automações ativas de uma vez para recuperar leads inativos.", icon: Zap, position: "bottom" as const },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageTour tourKey="sms" steps={smsTourSteps} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" /> SMS Marketing
          </h1>
          <p className="text-sm text-muted-foreground">Automação de recuperação de leads via SMSdev</p>
        </div>
        <Button onClick={() => runAutomation.mutate()} disabled={runAutomation.isPending} size="sm" className="gap-1" data-tour="sms-run">
          {runAutomation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Executar Automações
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-tour="sms-stats">
        <StatCard icon={Send} label="Enviados Hoje" value={stats?.today || 0} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle2} label="Taxa de Sucesso" value={`${stats?.successRate || 0}%`} color="bg-green-500/10 text-green-500" />
        <StatCard icon={TrendingUp} label="Semana" value={stats?.week || 0} color="bg-blue-500/10 text-blue-500" />
        <StatCard icon={BarChart3} label="Mês" value={stats?.month || 0} color="bg-amber-500/10 text-amber-500" />
      </div>

      <Tabs defaultValue="dashboard" data-tour="sms-tabs">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="automations">Automações</TabsTrigger>
          <TabsTrigger value="send">Enviar SMS</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">SMS Enviados (7 dias)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="enviados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="falhas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Distribuição por Gatilho</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={triggerPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                      {triggerPieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Atividade Recente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {logs?.slice(0, 10).map((log: any) => (
                  <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg bg-accent/30">
                    {log.status === "sent" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{log.clients?.name || log.phone}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{log.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                ))}
                {(!logs || logs.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum SMS enviado ainda</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automations Tab */}
        <TabsContent value="automations" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Regras de automação para envio de SMS</p>
          </div>
          {automations?.map((a: any) => (
            <AutomationCard key={a.id} automation={a} onToggle={(auto: any) => toggleAutomation.mutate(auto)} onEdit={openEdit} />
          ))}

          {/* Edit Dialog */}
          <Dialog open={!!editAutomation} onOpenChange={(o) => !o && setEditAutomation(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Automação</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Nome</label>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Mensagem (use {"{nome}"} para personalizar)</label>
                  <Textarea value={editMessage} onChange={e => setEditMessage(e.target.value)} rows={3} maxLength={160} />
                  <span className="text-[10px] text-muted-foreground">{editMessage.length}/160</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Dias de inatividade</label>
                    <Input type="number" value={editDays} onChange={e => setEditDays(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Máx. envios/dia</label>
                    <Input type="number" value={editMaxSends} onChange={e => setEditMaxSends(Number(e.target.value))} />
                  </div>
                </div>
                <Button onClick={() => updateAutomation.mutate()} disabled={updateAutomation.isPending} className="w-full">
                  Salvar Alterações
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Send Tab */}
        <TabsContent value="send" className="mt-4">
          <SendManualSMS />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Histórico Completo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {logs?.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
                    {log.status === "sent" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : log.status === "failed" ? (
                      <XCircle className="w-4 h-4 text-destructive shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium">{log.clients?.name || "Desconhecido"}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {log.trigger_type === "manual" ? "Manual" : log.trigger_type === "inactivity" ? "Auto" : log.trigger_type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{log.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{log.phone}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(log.created_at), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
                {(!logs || logs.length === 0) && (
                  <div className="text-center py-12">
                    <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum SMS no histórico</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSMS;
