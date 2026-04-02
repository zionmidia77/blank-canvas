import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Global query error handler – shows a toast for any React Query error
 * and provides a retry action.
 */
const QueryErrorHandler = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const defaults = queryClient.getDefaultOptions();
    queryClient.setDefaultOptions({
      ...defaults,
      queries: {
        ...defaults.queries,
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      },
      mutations: {
        ...defaults.mutations,
        onError: (error: any) => {
          const msg =
            error?.message || "Erro inesperado. Tente novamente.";
          toast.error("Erro", {
            description: msg.length > 120 ? msg.slice(0, 120) + "…" : msg,
            action: {
              label: "Tentar novamente",
              onClick: () => queryClient.invalidateQueries(),
            },
          });
        },
      },
    });
  }, [queryClient]);

  return null;
};

export default QueryErrorHandler;
