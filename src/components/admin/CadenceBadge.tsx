import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CadenceBadgeInfo } from "@/hooks/useCadenceBadges";

interface CadenceBadgeProps {
  info: CadenceBadgeInfo | undefined;
  compact?: boolean;
}

const CadenceBadge = ({ info, compact = false }: CadenceBadgeProps) => {
  if (!info) return null;

  const { currentStep, totalSteps, status, nextStepDueToday } = info;

  if (status === "completed") return null;

  const colorMap = {
    active: "bg-info/15 text-info",
    paused_promise: "bg-warning/15 text-warning",
    paused_responded: "bg-info/15 text-info",
    overdue: "bg-destructive/15 text-destructive animate-pulse",
  };

  const labelMap = {
    active: nextStepDueToday ? `⚡ Step ${currentStep}/${totalSteps}` : `⚡ Step ${currentStep}/${totalSteps}`,
    paused_promise: `⏸️ Step ${currentStep}/${totalSteps}`,
    paused_responded: `✅ Step ${currentStep}/${totalSteps}`,
    overdue: `🔴 Step ${currentStep}/${totalSteps}`,
  };

  const tooltipMap = {
    active: nextStepDueToday ? "Cadência: step vence hoje" : "Cadência ativa",
    paused_promise: "Cadência pausada: aguardando promessa",
    paused_responded: "Cadência pausada: cliente respondeu",
    overdue: "Cadência atrasada!",
  };

  const badgeColor = nextStepDueToday && status === "active"
    ? "bg-warning/15 text-warning"
    : colorMap[status];

  return (
    <span
      className={cn(
        "font-medium rounded-full inline-flex items-center gap-0.5",
        badgeColor,
        compact ? "text-[8px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5"
      )}
      title={tooltipMap[status]}
    >
      {compact ? `${currentStep}/${totalSteps}` : labelMap[status]}
    </span>
  );
};

export default CadenceBadge;
