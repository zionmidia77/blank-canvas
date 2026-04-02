import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Clock, SkipForward, Zap, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";

interface CadenceTrackerProps {
  clientId: string;
}

const actionIcons: Record<string, string> = {
  call: "📞",
  send_message: "💬",
  send_proposal: "📋",
  follow_up: "🔁",
  send_content: "📤",
};

const CadenceTracker = ({ clientId }: CadenceTrackerProps) => {
  const { data: steps, isLoading } = useQuery({
    queryKey: ["cadence-steps", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cadence_steps")
        .select("*, cadence_templates(*)")
        .eq("client_id", clientId)
        .order("step_number", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: client } = useQuery({
    queryKey: ["cadence-client-status", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("client_promise_status, last_contact_at")
        .eq("id", clientId)
        .single();
      return data;
    },
  });

  if (isLoading) return null;

  const activeSteps = (steps || []).filter((s: any) => !s.skipped || s.completed_at);
  const latestStage = activeSteps.length > 0 ? activeSteps[activeSteps.length - 1]?.pipeline_stage : null;
  const currentCadence = activeSteps.filter((s: any) => s.pipeline_stage === latestStage);

  if (currentCadence.length === 0) return null;

  const completedCount = currentCadence.filter((s: any) => s.completed_at).length;
  const skippedCount = currentCadence.filter((s: any) => s.skipped).length;
  const totalActive = currentCadence.length - skippedCount;
  const nextStep = currentCadence.find((s: any) => !s.completed_at && !s.skipped);
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  // Determine pause status
  let pauseStatus: { label: string; color: string; icon: string } | null = null;
  if (completedCount === totalActive) {
    pauseStatus = { label: "Cadência concluída", color: "text-muted-foreground bg-muted/50", icon: "✅" };
  } else if (client?.client_promise_status === "pending") {
    pauseStatus = { label: "Pausada — aguardando promessa do cliente", color: "text-warning bg-warning/10", icon: "⏸️" };
  } else if (client?.last_contact_at && currentCadence[0] && new Date(client.last_contact_at) > new Date(currentCadence[0].scheduled_for)) {
    pauseStatus = { label: "Pausada — cliente respondeu", color: "text-info bg-info/10", icon: "💬" };
  } else if (nextStep && new Date(nextStep.scheduled_for) < now) {
    pauseStatus = { label: "Cadência atrasada!", color: "text-destructive bg-destructive/10 animate-pulse", icon: "🔴" };
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Cadência Ativa
        </h3>
        <span className="text-xs text-muted-foreground">
          Step {completedCount + 1}/{totalActive}
        </span>
      </div>

      {/* Pause status banner */}
      {pauseStatus && (
        <div className={cn("text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-2", pauseStatus.color)}>
          <span>{pauseStatus.icon}</span>
          {pauseStatus.label}
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${(completedCount / Math.max(totalActive, 1)) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Steps timeline */}
      <div className="space-y-1">
        {currentCadence.filter((s: any) => !s.skipped).map((step: any) => {
          const template = step.cadence_templates;
          const isCompleted = !!step.completed_at;
          const isNext = step.id === nextStep?.id;
          const scheduledDate = new Date(step.scheduled_for);
          const isPast = scheduledDate < now && !isCompleted;
          const isDueToday = scheduledDate >= todayStart && scheduledDate <= todayEnd && !isCompleted;

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-2 py-1.5 px-2 rounded-md text-xs transition-colors",
                isCompleted && "text-muted-foreground",
                isNext && !isPast && !isDueToday && "bg-info/10 text-info font-medium",
                isDueToday && "bg-warning/10 text-warning font-medium",
                isPast && !isDueToday && "bg-destructive/10 text-destructive font-medium",
              )}
            >
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Clock className={cn(
                    "h-3.5 w-3.5",
                    isPast && !isDueToday ? "text-destructive" : isDueToday ? "text-warning" : isNext ? "text-info" : "text-muted-foreground"
                  )} />
                )}
              </div>
              <span className="flex-shrink-0">{actionIcons[template?.action_type] || "📌"}</span>
              <span className="truncate flex-1">{template?.task_reason || `Step ${step.step_number}`}</span>
              <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                {isCompleted
                  ? format(new Date(step.completed_at), "dd/MM", { locale: ptBR })
                  : format(scheduledDate, "dd/MM", { locale: ptBR })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Next step highlight */}
      {nextStep && !pauseStatus?.label.includes("concluída") && (
        <div className="p-2 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-xs font-medium text-primary">
            ⏭️ Próximo: {nextStep.cadence_templates?.task_reason}
          </p>
          {nextStep.cadence_templates?.suggested_message && (
            <p className="text-[11px] text-muted-foreground mt-1 italic">
              💬 "{nextStep.cadence_templates.suggested_message}"
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CadenceTracker;
