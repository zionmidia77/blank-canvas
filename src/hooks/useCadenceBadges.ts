import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CadenceBadgeInfo {
  currentStep: number;
  totalSteps: number;
  status: "active" | "paused_promise" | "paused_responded" | "overdue" | "completed";
  nextStepDueToday: boolean;
}

/** Fetches cadence info for multiple clients at once */
export function useCadenceBadges(clientIds: string[]) {
  return useQuery({
    queryKey: ["cadence-badges", clientIds.sort().join(",")],
    queryFn: async () => {
      if (!clientIds.length) return {};
      const { data, error } = await supabase
        .from("cadence_steps")
        .select("client_id, step_number, completed_at, skipped, scheduled_for, pipeline_stage")
        .in("client_id", clientIds)
        .order("step_number", { ascending: true });
      if (error) throw error;

      // Get client promise statuses and last_contact_at
      const { data: clients } = await supabase
        .from("clients")
        .select("id, client_promise_status, last_contact_at")
        .in("id", clientIds);

      const clientMap = new Map((clients || []).map(c => [c.id, c]));
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

      const result: Record<string, CadenceBadgeInfo> = {};

      // Group by client_id and take latest stage
      const byClient = new Map<string, typeof data>();
      for (const step of data || []) {
        if (!byClient.has(step.client_id)) byClient.set(step.client_id, []);
        byClient.get(step.client_id)!.push(step);
      }

      for (const [clientId, steps] of byClient) {
        // Latest cadence stage
        const latestStage = steps[steps.length - 1]?.pipeline_stage;
        const currentSteps = steps.filter(s => s.pipeline_stage === latestStage);
        const activeSteps = currentSteps.filter(s => !s.skipped);
        const completedSteps = activeSteps.filter(s => s.completed_at);
        const pendingSteps = activeSteps.filter(s => !s.completed_at);
        const nextStep = pendingSteps[0];

        if (activeSteps.length === 0) continue;

        const client = clientMap.get(clientId);

        // Determine status
        let status: CadenceBadgeInfo["status"] = "active";
        if (pendingSteps.length === 0) {
          status = "completed";
        } else if (client?.client_promise_status === "pending") {
          status = "paused_promise";
        } else if (nextStep) {
          // Check if cadence was created before last_contact_at
          const cadenceStart = currentSteps[0]?.scheduled_for;
          if (client?.last_contact_at && cadenceStart && new Date(client.last_contact_at) > new Date(cadenceStart)) {
            status = "paused_responded";
          } else if (new Date(nextStep.scheduled_for) < now) {
            status = "overdue";
          }
        }

        const nextStepDueToday = nextStep
          ? new Date(nextStep.scheduled_for) >= todayStart && new Date(nextStep.scheduled_for) <= todayEnd
          : false;

        result[clientId] = {
          currentStep: completedSteps.length + 1,
          totalSteps: activeSteps.length,
          status,
          nextStepDueToday,
        };
      }

      return result;
    },
    enabled: clientIds.length > 0,
    staleTime: 30000,
  });
}
