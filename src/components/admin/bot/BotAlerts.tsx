import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, WifiOff, TrendingDown, Bug, Bell, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type BotConfig = {
  id: string;
  seller_name: string;
  bot_type: string | null;
  is_active: boolean;
  last_heartbeat_at: string | null;
  leads_captured_today: number;
};

type BotLog = {
  id: string;
  bot_config_id: string;
  error: string | null;
  lead_created: boolean;
  created_at: string;
};

type Alert = {
  id: string;
  type: "offline" | "error_rate" | "lead_drop" | "no_leads";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  botName: string;
  timestamp: Date;
};

const getSeverityStyles = (severity: Alert["severity"]) => {
  switch (severity) {
    case "critical": return { bg: "bg-destructive/10 border-destructive/30", icon: "text-destructive", badge: "destructive" as const };
    case "warning": return { bg: "bg-yellow-500/10 border-yellow-500/30", icon: "text-yellow-500", badge: "secondary" as const };
    case "info": return { bg: "bg-blue-500/10 border-blue-500/30", icon: "text-blue-500", badge: "outline" as const };
  }
};

const getAlertIcon = (type: Alert["type"]) => {
  switch (type) {
    case "offline": return WifiOff;
    case "error_rate": return Bug;
    case "lead_drop": return TrendingDown;
    case "no_leads": return AlertTriangle;
  }
};

export const BotAlerts = ({ configs, logs }: { configs: BotConfig[]; logs: BotLog[] }) => {
  const alerts = useMemo(() => {
    const result: Alert[] = [];

    configs?.forEach((bot) => {
      if (!bot.is_active) return;

      // Offline check
      if (bot.last_heartbeat_at) {
        const diffMin = (Date.now() - new Date(bot.last_heartbeat_at).getTime()) / 60000;
        if (diffMin > 15) {
          result.push({
            id: `offline-${bot.id}`,
            type: "offline",
            severity: diffMin > 60 ? "critical" : "warning",
            title: `${bot.seller_name} está offline`,
            description: `Sem heartbeat há ${formatDistanceToNow(new Date(bot.last_heartbeat_at), { locale: ptBR })}`,
            botName: bot.seller_name,
            timestamp: new Date(bot.last_heartbeat_at),
          });
        }
      } else if (bot.is_active) {
        result.push({
          id: `never-${bot.id}`,
          type: "offline",
          severity: "critical",
          title: `${bot.seller_name} nunca conectou`,
          description: "O bot está ativo mas nunca enviou heartbeat",
          botName: bot.seller_name,
          timestamp: new Date(),
        });
      }

      // Error rate check
      const botLogs = logs?.filter((l) => l.bot_config_id === bot.id) || [];
      const recentLogs = botLogs.filter((l) => Date.now() - new Date(l.created_at).getTime() < 3600000);
      const recentErrors = recentLogs.filter((l) => l.error).length;
      const errorRate = recentLogs.length > 0 ? (recentErrors / recentLogs.length) * 100 : 0;

      if (errorRate > 20 && recentLogs.length >= 5) {
        result.push({
          id: `error-${bot.id}`,
          type: "error_rate",
          severity: errorRate > 50 ? "critical" : "warning",
          title: `Taxa de erro alta: ${errorRate.toFixed(0)}%`,
          description: `${recentErrors} erros em ${recentLogs.length} eventos na última hora`,
          botName: bot.seller_name,
          timestamp: new Date(),
        });
      }

      // No leads today
      if (bot.leads_captured_today === 0 && bot.is_active && botLogs.length > 10) {
        result.push({
          id: `nolead-${bot.id}`,
          type: "no_leads",
          severity: "info",
          title: `${bot.seller_name} sem leads hoje`,
          description: "Nenhum lead capturado hoje. Verifique se está tudo funcionando.",
          botName: bot.seller_name,
          timestamp: new Date(),
        });
      }
    });

    return result.sort((a, b) => {
      const sev = { critical: 0, warning: 1, info: 2 };
      return sev[a.severity] - sev[b.severity];
    });
  }, [configs, logs]);

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col items-center gap-2 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
          <p className="text-sm font-medium text-green-600">Tudo funcionando normalmente</p>
          <p className="text-xs text-muted-foreground">Nenhum alerta ativo no momento</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const styles = getSeverityStyles(alert.severity);
        const Icon = getAlertIcon(alert.type);
        return (
          <Card key={alert.id} className={`border ${styles.bg}`}>
            <CardContent className="p-3 flex items-start gap-3">
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${styles.icon}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium">{alert.title}</span>
                  <Badge variant={styles.badge} className="text-[10px] capitalize">
                    {alert.severity}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{alert.description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default BotAlerts;
