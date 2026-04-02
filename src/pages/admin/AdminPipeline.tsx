import { useState, useEffect, useMemo } from "react";
import { LayoutList, LayoutGrid } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAllClients, useUpdateClient } from "@/hooks/useSupabase";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanColumnSkeleton } from "@/components/admin/SkeletonLoaders";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import KanbanColumn from "@/components/pipeline/KanbanColumn";
import type { Tables } from "@/integrations/supabase/types";
import PageTour from "@/components/admin/PageTour";
import { Kanban, Filter, LayoutList as LayoutListIcon } from "lucide-react";

// Grouped pipeline: 7 main groups, each containing sub-stages
const STAGE_GROUPS = [
  {
    key: "new",
    label: "Novo Lead",
    emoji: "📥",
    color: "border-t-blue-500",
    stages: ["new"],
  },
  {
    key: "contacted",
    label: "Contatado",
    emoji: "📞",
    color: "border-t-sky-500",
    stages: ["contacted", "first_contact"],
  },
  {
    key: "qualification",
    label: "Qualificação",
    emoji: "🔍",
    color: "border-t-amber-500",
    stages: ["interested", "qualification", "attending", "scheduled"],
  },
  {
    key: "proposal",
    label: "Proposta",
    emoji: "📋",
    color: "border-t-purple-500",
    stages: ["proposal", "proposal_sent"],
  },
  {
    key: "negotiation",
    label: "Negociação",
    emoji: "💰",
    color: "border-t-emerald-500",
    stages: ["negotiation", "negotiating", "thinking", "waiting_response", "financing_analysis", "approved", "closing"],
  },
  {
    key: "closed_won",
    label: "Ganho ✅",
    emoji: "🏆",
    color: "border-t-green-500",
    stages: ["closed_won"],
  },
  {
    key: "closed_lost",
    label: "Perdido",
    emoji: "❌",
    color: "border-t-red-500",
    stages: ["closed_lost", "rejected", "reactivation"],
  },
];

// Map any old stage to its group key (for drag-drop target)
const stageToGroup: Record<string, string> = {};
STAGE_GROUPS.forEach((g) => g.stages.forEach((s) => (stageToGroup[s] = g.key)));

// Sub-stage labels for badges inside cards
const SUB_STAGE_LABELS: Record<string, string> = {
  first_contact: "1º Contato",
  interested: "Interessado",
  attending: "Atendendo",
  scheduled: "Agendado",
  proposal_sent: "Proposta Enviada",
  negotiating: "Negociando",
  thinking: "Pensando",
  waiting_response: "Aguardando",
  financing_analysis: "Análise Crédito",
  approved: "Aprovado",
  closing: "Fechamento",
  rejected: "Rejeitado",
  reactivation: "Reativação",
};

const AdminPipeline = () => {
  const { data: clients, isLoading } = useAllClients();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const updateClient = useUpdateClient();
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [compactMode, setCompactMode] = useState(false);

  // Fetch chat conversations to show badges on cards
  const { data: chatConvos = [] } = useQuery({
    queryKey: ["pipeline-chat-convos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("client_id, status")
        .not("client_id", "is", null);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Fetch interaction counts per client
  const { data: interactionCounts = [] } = useQuery({
    queryKey: ["pipeline-interaction-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interactions")
        .select("client_id");
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Build lookup maps
  const chatDataByClient = useMemo(() => {
    const map: Record<string, { count: number; hasActive: boolean }> = {};
    for (const c of chatConvos) {
      if (!c.client_id) continue;
      if (!map[c.client_id]) map[c.client_id] = { count: 0, hasActive: false };
      map[c.client_id].count++;
      if (c.status === "active" || c.status === "transferred") {
        map[c.client_id].hasActive = true;
      }
    }
    return map;
  }, [chatConvos]);

  const interactionsByClient = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of interactionCounts) {
      map[i.client_id] = (map[i.client_id] || 0) + 1;
    }
    return map;
  }, [interactionCounts]);

  // Auto-filter to the highlighted client's group
  useEffect(() => {
    if (highlightId && clients) {
      const c = clients.find((cl) => cl.id === highlightId);
      if (c) {
        const groupKey = stageToGroup[c.pipeline_stage] || c.pipeline_stage;
        setActiveFilter(groupKey);
        setTimeout(() => {
          const el = document.getElementById(`kanban-card-${highlightId}`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }
    }
  }, [highlightId, clients]);

  const getClientsForGroup = (group: typeof STAGE_GROUPS[number]) =>
    (clients || []).filter((c) => group.stages.includes(c.pipeline_stage));

  const onDragEnd = (result: DropResult) => {
    const { draggableId, destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const targetGroupKey = destination.droppableId;
    const targetGroup = STAGE_GROUPS.find((g) => g.key === targetGroupKey);
    if (!targetGroup) return;

    // Set to the main stage of the target group
    const newStage = targetGroup.key;

    updateClient.mutate({ id: draggableId, pipeline_stage: newStage as any });
    toast.success(`Movido para ${targetGroup.emoji} ${targetGroup.label}`);
  };

  const visibleGroups = activeFilter
    ? STAGE_GROUPS.filter((g) => g.key === activeFilter)
    : STAGE_GROUPS;

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <KanbanColumnSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const totalLeads = clients?.length || 0;

  const pipelineTourSteps = [
    { target: '[data-tour="pipeline-stages"]', title: "Colunas do pipeline", description: "7 etapas principais. Leads fluem da esquerda para a direita.", icon: Kanban, position: "bottom" as const },
    { target: '[data-tour="pipeline-filters"]', title: "Filtros por etapa", description: "Clique em uma etapa para focar apenas nela, ou veja todas de uma vez.", icon: Filter, position: "bottom" as const },
    { target: '[data-tour="pipeline-compact"]', title: "Modo compacto", description: "Alterne entre cards detalhados e uma visualização mais enxuta.", icon: LayoutListIcon, position: "bottom" as const },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      <PageTour tourKey="pipeline" steps={pipelineTourSteps} />
      {/* Header */}
      <div className="px-4 md:px-5 pt-4 md:pt-5 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              {totalLeads} clientes no funil · Arraste para mover
            </p>
          </div>
          <div className="flex rounded-full border border-border/50 overflow-hidden" data-tour="pipeline-compact">
            <button
              onClick={() => setCompactMode(false)}
              className={`p-2 transition-colors ${!compactMode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              title="Cards expandidos"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCompactMode(true)}
              className={`p-2 transition-colors ${compactMode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              title="Cards compactos"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide" data-tour="pipeline-filters">
          <Button
            variant={activeFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(null)}
            className="rounded-full shrink-0 text-xs min-h-[40px] md:min-h-[32px] h-auto px-4 md:px-3"
          >
            Todos
          </Button>
          {STAGE_GROUPS.map((group) => {
            const count = getClientsForGroup(group).length;
            return (
              <Button
                key={group.key}
                variant={activeFilter === group.key ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setActiveFilter(activeFilter === group.key ? null : group.key)
                }
                className="rounded-full shrink-0 text-xs gap-1 min-h-[40px] md:min-h-[32px] h-auto px-4 md:px-3"
              >
                {group.emoji} {group.label}
                {count > 0 && (
                  <span
                    className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                      activeFilter === group.key
                        ? "bg-primary-foreground/20"
                        : "bg-primary/15 text-primary"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto px-4 md:px-5 pb-24" data-tour="pipeline-stages">
          <div className={`flex gap-3 min-h-[400px] ${
            activeFilter ? "flex-col md:flex-row" : ""
          }`}>
            {visibleGroups.map((group) => (
              <KanbanColumn
                key={group.key}
                stage={group}
                clients={getClientsForGroup(group)}
                highlightId={highlightId}
                chatDataByClient={chatDataByClient}
                interactionsByClient={interactionsByClient}
                compact={compactMode}
                subStageLabels={SUB_STAGE_LABELS}
                groupStages={group.stages}
              />
            ))}
          </div>
        </div>
      </DragDropContext>
    </motion.div>
  );
};

export default AdminPipeline;
