import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type MetricsPeriod = "7d" | "30d" | "90d";

interface StepMetric {
  stepNumber: number;
  taskReason: string;
  totalExecuted: number;
  responded: number;
  responseRate: number;
}

interface StageMetric {
  stage: string;
  totalClients: number;
  movedOut: number;
  movementRate: number;
}

interface CadenceMetrics {
  // KPIs
  avgResponseRate: number;
  avgMovementRate: number;
  taskExecutionRate: number;
  // Step rankings
  stepRankings: StepMetric[];
  // Stage rankings
  stageRankings: StageMetric[];
  // Insights (max 3)
  insights: { type: "success" | "warning" | "action"; text: string }[];
  // Raw counts
  totalSteps: number;
  totalTasks: number;
  completedTasks: number;
}

function getDaysAgo(period: MetricsPeriod): string {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export const useCadenceMetrics = (period: MetricsPeriod = "30d") => {
  const { user } = useAuth();
  const since = getDaysAgo(period);

  return useQuery({
    queryKey: ["cadence-metrics", period],
    queryFn: async (): Promise<CadenceMetrics> => {
      // 1. Fetch cadence steps within period
      const { data: steps } = await supabase
        .from("cadence_steps")
        .select("*, cadence_templates(step_number, task_reason, pipeline_stage)")
        .gte("created_at", since)
        .order("step_number");

      // 2. Fetch cadence tasks within period
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, status, completed_at, client_id")
        .eq("source", "cadence")
        .gte("created_at", since);

      // 3. Fetch clients who had cadence steps (for stage movement)
      const clientIds = [...new Set((steps || []).map(s => s.client_id))];
      let clients: any[] = [];
      if (clientIds.length > 0) {
        // Fetch in batches of 100
        for (let i = 0; i < clientIds.length; i += 100) {
          const batch = clientIds.slice(i, i + 100);
          const { data } = await supabase
            .from("clients")
            .select("id, pipeline_stage, last_contact_at")
            .in("id", batch);
          if (data) clients.push(...data);
        }
      }

      const clientMap = new Map(clients.map(c => [c.id, c]));
      const allSteps = steps || [];
      const allTasks = tasks || [];

      // === STEP METRICS ===
      const stepGroups = new Map<number, { reason: string; total: number; responded: number }>();
      for (const s of allSteps) {
        if (!s.task_id && !s.completed_at && !s.skipped) continue; // not yet executed
        const num = s.step_number;
        if (!stepGroups.has(num)) {
          const reason = (s as any).cadence_templates?.task_reason || `Step ${num}`;
          stepGroups.set(num, { reason, total: 0, responded: 0 });
        }
        const g = stepGroups.get(num)!;
        g.total++;

        // Response = client's last_contact_at is after the step's scheduled_for
        const client = clientMap.get(s.client_id);
        if (client?.last_contact_at && new Date(client.last_contact_at) > new Date(s.scheduled_for)) {
          g.responded++;
        }
      }

      const stepRankings: StepMetric[] = [];
      let totalResponseRate = 0;
      let validStepCount = 0;
      for (const [stepNumber, g] of stepGroups) {
        if (g.total < 5) continue; // minimum sample
        const rate = Math.round((g.responded / g.total) * 100);
        stepRankings.push({ stepNumber, taskReason: g.reason, totalExecuted: g.total, responded: g.responded, responseRate: rate });
        totalResponseRate += rate;
        validStepCount++;
      }
      stepRankings.sort((a, b) => b.responseRate - a.responseRate);

      // === STAGE METRICS (movement, not causality) ===
      // Group by the pipeline_stage the cadence was created for
      // Check if the client's current stage differs from the cadence stage
      const stageGroups = new Map<string, { clients: Set<string>; moved: Set<string> }>();
      for (const s of allSteps) {
        const stage = s.pipeline_stage;
        if (!stageGroups.has(stage)) {
          stageGroups.set(stage, { clients: new Set(), moved: new Set() });
        }
        const g = stageGroups.get(stage)!;
        g.clients.add(s.client_id);

        const client = clientMap.get(s.client_id);
        if (client && client.pipeline_stage !== stage && client.pipeline_stage !== "closed_lost") {
          g.moved.add(s.client_id);
        }
      }

      const stageRankings: StageMetric[] = [];
      let totalMovementRate = 0;
      let validStageCount = 0;
      for (const [stage, g] of stageGroups) {
        if (g.clients.size < 3) continue; // minimum sample
        const rate = Math.round((g.moved.size / g.clients.size) * 100);
        stageRankings.push({ stage, totalClients: g.clients.size, movedOut: g.moved.size, movementRate: rate });
        totalMovementRate += rate;
        validStageCount++;
      }
      stageRankings.sort((a, b) => b.movementRate - a.movementRate);

      // === TASK EXECUTION ===
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter(t => t.status === "completed" || t.completed_at).length;
      const taskExecutionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // === KPIs ===
      const avgResponseRate = validStepCount > 0 ? Math.round(totalResponseRate / validStepCount) : 0;
      const avgMovementRate = validStageCount > 0 ? Math.round(totalMovementRate / validStageCount) : 0;

      // === INSIGHTS (max 3) ===
      const insights: CadenceMetrics["insights"] = [];
      const totalExecutions = allSteps.filter(s => s.task_id || s.completed_at || s.skipped).length;

      if (totalExecutions >= 10) {
        // Best point
        if (stepRankings.length > 0) {
          const best = stepRankings[0];
          insights.push({
            type: "success",
            text: `Melhor step: Step ${best.stepNumber} com ${best.responseRate}% de resposta (${best.totalExecuted} execuções)`,
          });
        }

        // Biggest bottleneck
        if (stageRankings.length > 0) {
          const worst = stageRankings[stageRankings.length - 1];
          insights.push({
            type: "warning",
            text: `Stage mais travado: "${worst.stage}" — apenas ${worst.movementRate}% saíram (${worst.totalClients} leads)`,
          });
        }

        // Suggested action
        if (taskExecutionRate < 70) {
          insights.push({
            type: "action",
            text: `Execução de tarefas em ${taskExecutionRate}%. Priorize concluir tarefas de cadência pendentes.`,
          });
        } else if (stepRankings.length > 0) {
          const worst = stepRankings[stepRankings.length - 1];
          if (worst.responseRate < 20) {
            insights.push({
              type: "action",
              text: `Step ${worst.stepNumber} tem ${worst.responseRate}% de resposta. Considere revisar o template.`,
            });
          } else {
            insights.push({
              type: "action",
              text: `Cadência operando bem. Mantenha a consistência de execução.`,
            });
          }
        }
      }

      return {
        avgResponseRate,
        avgMovementRate,
        taskExecutionRate,
        stepRankings,
        stageRankings,
        insights,
        totalSteps: allSteps.length,
        totalTasks,
        completedTasks,
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });
};
