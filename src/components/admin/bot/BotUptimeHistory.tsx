import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, Activity } from "lucide-react";
import { format, subHours, eachHourOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

type BotConfig = {
  id: string;
  seller_name: string;
  bot_type: string | null;
};

const useBotLogsForUptime = () =>
  useQuery({
    queryKey: ["bot-logs-uptime"],
    queryFn: async () => {
      const since = subHours(new Date(), 24).toISOString();
      const { data, error } = await supabase
        .from("bot_logs")
        .select("bot_config_id, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

const getStatusColor = (hasActivity: boolean) =>
  hasActivity ? "bg-green-500" : "bg-muted-foreground/20";

export const BotUptimeHistory = ({ configs }: { configs: BotConfig[] }) => {
  const { data: logs } = useBotLogsForUptime();

  const uptimeData = useMemo(() => {
    if (!logs || !configs?.length) return [];

    const hours = eachHourOfInterval({ start: subHours(new Date(), 23), end: new Date() });

    return configs.map((bot) => {
      const botLogs = logs.filter((l) => l.bot_config_id === bot.id);
      const hourlyStatus = hours.map((hour) => {
        const hourStart = hour.getTime();
        const hourEnd = hourStart + 3600000;
        const hasActivity = botLogs.some((l) => {
          const t = new Date(l.created_at).getTime();
          return t >= hourStart && t < hourEnd;
        });
        return { hour, hasActivity };
      });

      const activeHours = hourlyStatus.filter((h) => h.hasActivity).length;
      const uptimePercent = (activeHours / hours.length) * 100;

      return { bot, hourlyStatus, uptimePercent, activeHours };
    });
  }, [logs, configs]);

  if (!uptimeData.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Histórico de Uptime — 24h
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TooltipProvider delayDuration={100}>
          {uptimeData.map(({ bot, hourlyStatus, uptimePercent, activeHours }) => (
            <div key={bot.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{bot.seller_name}</span>
                <Badge variant={uptimePercent >= 80 ? "default" : uptimePercent >= 50 ? "secondary" : "destructive"} className="text-[10px]">
                  {uptimePercent.toFixed(0)}% — {activeHours}h ativas
                </Badge>
              </div>
              <div className="flex gap-0.5">
                {hourlyStatus.map(({ hour, hasActivity }, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <div
                        className={`h-5 flex-1 rounded-sm transition-colors cursor-default ${getStatusColor(hasActivity)}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <p>{format(hour, "HH:mm", { locale: ptBR })}</p>
                      <p className={hasActivity ? "text-green-400" : "text-muted-foreground"}>
                        {hasActivity ? "Online" : "Sem atividade"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          ))}
        </TooltipProvider>

        <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-green-500" />
            Online
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-muted-foreground/20" />
            Sem atividade
          </div>
          <span className="ml-auto flex items-center gap-1">
            <Clock className="w-3 h-3" /> Últimas 24 horas
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default BotUptimeHistory;
