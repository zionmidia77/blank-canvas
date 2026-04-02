import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Heart, Wifi, Zap, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type BotConfig = {
  id: string;
  seller_name: string;
  bot_type: string | null;
  is_active: boolean;
  last_heartbeat_at: string | null;
  leads_captured_today: number;
  dry_mode: boolean;
};

type BotLog = {
  id: string;
  bot_config_id: string;
  error: string | null;
  lead_created: boolean;
  created_at: string;
};

const calculateHealthScore = (bot: BotConfig, logs: BotLog[]): { score: number; uptime: number; successRate: number; responseSpeed: number } => {
  const botLogs = logs.filter((l) => l.bot_config_id === bot.id);
  const total = botLogs.length;

  // Uptime: based on heartbeat
  let uptime = 0;
  if (bot.last_heartbeat_at) {
    const diffMin = (Date.now() - new Date(bot.last_heartbeat_at).getTime()) / 60000;
    if (diffMin < 5) uptime = 100;
    else if (diffMin < 15) uptime = 70;
    else if (diffMin < 60) uptime = 30;
    else uptime = 0;
  }

  // Success rate
  const errors = botLogs.filter((l) => l.error).length;
  const successRate = total > 0 ? ((total - errors) / total) * 100 : 100;

  // Response speed: leads per event
  const leads = botLogs.filter((l) => l.lead_created).length;
  const responseSpeed = total > 0 ? Math.min((leads / total) * 100 * 3, 100) : 50;

  const score = Math.round(uptime * 0.4 + successRate * 0.35 + responseSpeed * 0.25);

  return { score, uptime, successRate, responseSpeed };
};

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-destructive";
};

const getScoreLabel = (score: number) => {
  if (score >= 90) return "Excelente";
  if (score >= 75) return "Bom";
  if (score >= 50) return "Atenção";
  if (score >= 25) return "Crítico";
  return "Offline";
};

const getProgressColor = (value: number) => {
  if (value >= 80) return "bg-green-500";
  if (value >= 50) return "bg-yellow-500";
  return "bg-destructive";
};

export const BotHealthCard = ({ bot, logs }: { bot: BotConfig; logs: BotLog[] }) => {
  const health = useMemo(() => calculateHealthScore(bot, logs), [bot, logs]);

  return (
    <Card className="relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-1 ${getProgressColor(health.score)}`} />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className={`w-5 h-5 ${getScoreColor(health.score)}`} />
            <span className="font-semibold text-sm">{bot.seller_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-2xl font-bold ${getScoreColor(health.score)}`}>{health.score}</span>
            <span className="text-[10px] text-muted-foreground">/100</span>
          </div>
        </div>

        <Badge variant="outline" className={`text-[10px] ${getScoreColor(health.score)}`}>
          {getScoreLabel(health.score)}
        </Badge>

        <div className="space-y-2">
          <MetricBar icon={Wifi} label="Uptime" value={health.uptime} />
          <MetricBar icon={Zap} label="Taxa de Sucesso" value={health.successRate} />
          <MetricBar icon={TrendingUp} label="Conversão" value={health.responseSpeed} />
        </div>

        {bot.last_heartbeat_at && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Último heartbeat: {formatDistanceToNow(new Date(bot.last_heartbeat_at), { locale: ptBR, addSuffix: true })}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const MetricBar = ({ icon: Icon, label, value }: { icon: any; label: string; value: number }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1 text-muted-foreground">
        <Icon className="w-3 h-3" />
        {label}
      </span>
      <span className="font-medium">{value.toFixed(0)}%</span>
    </div>
    <div className="h-1.5 rounded-full bg-accent overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${getProgressColor(value)}`}
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

export default BotHealthCard;
