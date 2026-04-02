import { useMemo } from "react";
import { useClients } from "@/hooks/useSupabase";

export const useOverdueLeads = () => {
  const { data: allClients } = useClients();

  const overdueCount = useMemo(() => {
    if (!allClients) return 0;
    const now = new Date();
    return allClients.filter(
      (c) =>
        !["closed_won", "closed_lost"].includes(c.pipeline_stage) &&
        c.next_action_due &&
        new Date(c.next_action_due) < now
    ).length;
  }, [allClients]);

  return overdueCount;
};
