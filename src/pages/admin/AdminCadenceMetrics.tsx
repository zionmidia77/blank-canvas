import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCadenceMetrics, MetricsPeriod } from "@/hooks/useCadenceMetrics";
import { MessageSquare, TrendingUp, CheckCircle, Lightbulb, AlertTriangle, ArrowRight, BarChart3 } from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
  new: "Novo",
  contacted: "Contatado",
  interested: "Interessado",
  negotiating: "Negociando",
  first_contact: "1º Contato",
  qualification: "Qualificação",
  proposal: "Proposta",
  negotiation: "Negociação",
  closing: "Fechamento",
  attending: "Em Atendimento",
  thinking: "Pensando",
  waiting_response: "Aguardando Resposta",
  scheduled: "Agendado",
  proposal_sent: "Proposta Enviada",
  financing_analysis: "Análise de Financiamento",
  approved: "Aprovado",
  rejected: "Rejeitado",
  reactivation: "Reativação",
};

const periods: { label: string; value: MetricsPeriod }[] = [
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
  { label: "90 dias", value: "90d" },
];

const AdminCadenceMetrics = () => {
  const [period, setPeriod] = useState<MetricsPeriod>("30d");
  const { data: metrics, isLoading } = useCadenceMetrics(period);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const noData = !metrics || metrics.totalSteps === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Métricas da Cadência
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Performance do follow-up automático
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {periods.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(p.value)}
              className="text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {noData ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum dado de cadência no período selecionado.</p>
            <p className="text-xs text-muted-foreground mt-1">
              As métricas aparecerão conforme a cadência executar steps e tarefas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
              icon={<MessageSquare className="h-5 w-5" />}
              title="Taxa média de resposta"
              value={`${metrics.avgResponseRate}%`}
              subtitle={`Baseado em ${metrics.stepRankings.length} steps com ≥5 execuções`}
              color="text-blue-500"
            />
            <KPICard
              icon={<TrendingUp className="h-5 w-5" />}
              title="Taxa média de avanço"
              value={`${metrics.avgMovementRate}%`}
              subtitle={`${metrics.stageRankings.length} stages com ≥3 leads analisados`}
              color="text-emerald-500"
            />
            <KPICard
              icon={<CheckCircle className="h-5 w-5" />}
              title="Taxa de execução das tarefas"
              value={`${metrics.taskExecutionRate}%`}
              subtitle={`${metrics.completedTasks}/${metrics.totalTasks} tarefas concluídas`}
              color="text-amber-500"
            />
          </div>

          {/* Insights */}
          {metrics.insights.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {metrics.insights.map((insight, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                      insight.type === "success"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : insight.type === "warning"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                    }`}
                  >
                    {insight.type === "success" ? (
                      <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : insight.type === "warning" ? (
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mt-0.5 shrink-0" />
                    )}
                    {insight.text}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Rankings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Step Ranking */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ranking por Step</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.stepRankings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Amostra insuficiente (mín. 5 execuções por step)
                  </p>
                ) : (
                  <div className="space-y-2">
                    {metrics.stepRankings.map((s) => (
                      <div
                        key={s.stepNumber}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Badge variant="outline" className="shrink-0">
                            Step {s.stepNumber}
                          </Badge>
                          <span className="text-sm truncate">{s.taskReason}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-sm font-semibold">{s.responseRate}%</span>
                          <span className="text-xs text-muted-foreground">
                            ({s.responded}/{s.totalExecuted})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stage Ranking */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Movimentação por Stage</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.stageRankings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Amostra insuficiente (mín. 3 leads por stage)
                  </p>
                ) : (
                  <div className="space-y-2">
                    {metrics.stageRankings.map((s) => (
                      <div
                        key={s.stage}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <span className="text-sm">{STAGE_LABELS[s.stage] || s.stage}</span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-sm font-semibold">{s.movementRate}%</span>
                          <span className="text-xs text-muted-foreground">
                            ({s.movedOut}/{s.totalClients})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

function KPICard({
  icon,
  title,
  value,
  subtitle,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-2">
          <div className={color}>{icon}</div>
          <span className="text-sm text-muted-foreground">{title}</span>
        </div>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

export default AdminCadenceMetrics;
