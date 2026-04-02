import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, Users, TrendingUp, UserCheck, ArrowRight } from "lucide-react";

const ChatConversionDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ["chat-conversion-stats"],
    queryFn: async () => {
      const { data: conversations } = await supabase
        .from("chat_conversations")
        .select("id, client_id, status, created_at, messages");

      const { data: clients } = await supabase
        .from("clients")
        .select("id, pipeline_stage, source")
        .eq("source", "ai-chat");

      const total = conversations?.length || 0;
      const withLead = conversations?.filter((c) => c.client_id).length || 0;
      const transferred = conversations?.filter((c) => c.status === "transferred" || c.status === "attended").length || 0;
      const attended = conversations?.filter((c) => c.status === "attended").length || 0;

      const totalLeads = clients?.length || 0;
      const negotiating = clients?.filter((c) => ["negotiating", "scheduled", "closed_won"].includes(c.pipeline_stage)).length || 0;
      const closedWon = clients?.filter((c) => c.pipeline_stage === "closed_won").length || 0;

      const avgMsgs = total > 0
        ? Math.round(
            (conversations?.reduce((sum, c) => sum + (Array.isArray(c.messages) ? (c.messages as any[]).length : 0), 0) || 0) / total
          )
        : 0;

      return {
        total,
        withLead,
        transferred,
        attended,
        totalLeads,
        negotiating,
        closedWon,
        avgMsgs,
        conversionRate: total > 0 ? Math.round((withLead / total) * 100) : 0,
        qualificationRate: withLead > 0 ? Math.round((negotiating / withLead) * 100) : 0,
        closeRate: totalLeads > 0 ? Math.round((closedWon / totalLeads) * 100) : 0,
      };
    },
    refetchInterval: 30000,
  });

  if (!stats) return null;

  const metrics = [
    {
      label: "Conversas totais",
      value: stats.total,
      icon: MessageSquare,
      color: "text-primary",
    },
    {
      label: "Viraram Lead",
      value: stats.withLead,
      icon: Users,
      color: "text-emerald-400",
      sub: `${stats.conversionRate}% conversão`,
    },
    {
      label: "Em negociação",
      value: stats.negotiating,
      icon: TrendingUp,
      color: "text-amber-400",
      sub: `${stats.qualificationRate}% qualificação`,
    },
    {
      label: "Vendas fechadas",
      value: stats.closedWon,
      icon: UserCheck,
      color: "text-emerald-500",
      sub: `${stats.closeRate}% fechamento`,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Funil do Chat IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="bg-secondary/30 rounded-lg p-3 text-center">
              <m.icon className={`w-5 h-5 mx-auto mb-1 ${m.color}`} />
              <p className="text-2xl font-bold">{m.value}</p>
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
              {m.sub && (
                <p className={`text-[10px] font-medium mt-0.5 ${m.color}`}>{m.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* Visual funnel */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Conversas</span>
            <ArrowRight className="w-3 h-3" />
            <span>Leads</span>
            <ArrowRight className="w-3 h-3" />
            <span>Negociação</span>
            <ArrowRight className="w-3 h-3" />
            <span>Venda</span>
          </div>
          <div className="space-y-1.5">
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span>Conversão Chat → Lead</span>
                <span className="font-medium">{stats.conversionRate}%</span>
              </div>
              <Progress value={stats.conversionRate} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span>Qualificação Lead → Negociação</span>
                <span className="font-medium">{stats.qualificationRate}%</span>
              </div>
              <Progress value={stats.qualificationRate} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span>Fechamento Lead → Venda</span>
                <span className="font-medium">{stats.closeRate}%</span>
              </div>
              <Progress value={stats.closeRate} className="h-2" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-secondary/20 rounded-lg px-3 py-2 text-xs">
          <span className="text-muted-foreground">Média de mensagens por conversa</span>
          <span className="font-bold">{stats.avgMsgs} msgs</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChatConversionDashboard;
