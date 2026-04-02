import { Droppable } from "@hello-pangea/dnd";
import KanbanCard from "./KanbanCard";
import type { Tables } from "@/integrations/supabase/types";

interface KanbanColumnProps {
  stage: { key: string; label: string; emoji: string; color: string };
  clients: Tables<"clients">[];
  highlightId?: string | null;
  chatDataByClient?: Record<string, { count: number; hasActive: boolean }>;
  interactionsByClient?: Record<string, number>;
  compact?: boolean;
  subStageLabels?: Record<string, string>;
  groupStages?: string[];
}

const KanbanColumn = ({ stage, clients, highlightId, chatDataByClient = {}, interactionsByClient = {}, compact = false, subStageLabels = {}, groupStages = [] }: KanbanColumnProps) => {
  const showSubStage = groupStages.length > 1;

  return (
    <div className={`flex flex-col min-w-[260px] max-w-[280px] md:max-w-[280px] rounded-2xl border border-border/40 bg-secondary/30 backdrop-blur-sm ${compact ? "max-w-full" : ""}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2.5 border-b border-border/30 rounded-t-2xl border-t-2 ${stage.color}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{stage.emoji}</span>
          <span className="text-xs font-semibold">{stage.label}</span>
        </div>
        <span className="text-[10px] font-medium bg-background/60 text-muted-foreground px-2 py-0.5 rounded-full">
          {clients.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage.key}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-2 space-y-2 min-h-[120px] transition-colors rounded-b-2xl ${
              snapshot.isDraggingOver ? "bg-primary/5" : ""
            }`}
          >
            {clients.map((client, index) => (
              <KanbanCard
                key={client.id}
                client={client}
                index={index}
                highlight={highlightId === client.id}
                chatCount={chatDataByClient[client.id]?.count || 0}
                hasActiveChat={chatDataByClient[client.id]?.hasActive || false}
                interactionCount={interactionsByClient[client.id] || 0}
                compact={compact}
                subStageLabel={showSubStage ? subStageLabels[client.pipeline_stage] : undefined}
              />
            ))}
            {provided.placeholder}
            {clients.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center h-20">
                <p className="text-[11px] text-muted-foreground/50">Arraste leads aqui</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default KanbanColumn;
