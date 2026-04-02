import { Skeleton } from "@/components/ui/skeleton";

/** Dashboard stat card skeleton */
export const StatCardSkeleton = () => (
  <div className="glass-card p-4">
    <div className="flex items-center justify-between mb-3">
      <Skeleton className="w-9 h-9 rounded-xl" />
    </div>
    <Skeleton className="h-7 w-14 mb-1" />
    <Skeleton className="h-3 w-20" />
  </div>
);

/** Lead card skeleton matching real lead card layout */
export const LeadCardSkeleton = () => (
  <div className="glass-card p-4 border-l-4 border-l-muted">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div>
          <Skeleton className="h-4 w-28 mb-1.5" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
    <div className="flex items-center gap-2 mb-3">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-4 w-12 ml-auto" />
    </div>
    <div className="flex gap-2">
      <Skeleton className="h-8 w-24 rounded-full" />
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
  </div>
);

/** Pipeline kanban column skeleton */
export const KanbanColumnSkeleton = () => (
  <div className="min-w-[260px] w-[260px] rounded-2xl border border-border/50 bg-card/30 p-3 space-y-3">
    <div className="flex items-center gap-2 mb-2">
      <Skeleton className="h-5 w-5 rounded" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-5 w-6 rounded-full ml-auto" />
    </div>
    {[1, 2, 3].map((i) => (
      <div key={i} className="glass-card p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-3.5 w-24 mb-1" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-4 w-12 rounded-full" />
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

/** Task card skeleton */
export const TaskCardSkeleton = () => (
  <div className="glass-card p-3 flex items-center gap-3">
    <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
    <div className="flex-1 min-w-0">
      <Skeleton className="h-3.5 w-32 mb-1.5" />
      <Skeleton className="h-2.5 w-24" />
    </div>
    <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
  </div>
);

/** Message template card skeleton */
export const MessageCardSkeleton = () => (
  <div className="glass-card p-4 space-y-3">
    <div className="flex items-center gap-2">
      <Skeleton className="w-8 h-8 rounded-lg" />
      <div className="flex-1">
        <Skeleton className="h-4 w-32 mb-1" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <Skeleton className="h-12 w-full rounded-lg" />
    <div className="flex gap-2">
      <Skeleton className="h-8 w-20 rounded-full" />
      <Skeleton className="h-8 w-20 rounded-full" />
    </div>
  </div>
);

/** Chat history conversation skeleton */
export const ChatHistorySkeleton = () => (
  <div className="glass-card p-4 space-y-3">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-28 mb-1.5" />
        <Skeleton className="h-3 w-36" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <div className="space-y-2 pl-13">
      <Skeleton className="h-8 w-3/4 rounded-xl" />
      <Skeleton className="h-8 w-1/2 rounded-xl ml-auto" />
      <Skeleton className="h-8 w-2/3 rounded-xl" />
    </div>
  </div>
);

/** Calendar day skeleton */
export const CalendarSkeleton = () => (
  <div className="space-y-2">
    <div className="flex items-center justify-between mb-3">
      <Skeleton className="h-5 w-32" />
      <div className="flex gap-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 35 }).map((_, i) => (
        <Skeleton key={i} className="h-10 rounded-lg" />
      ))}
    </div>
  </div>
);

/** Metrics chart skeleton */
export const MetricsChartSkeleton = () => (
  <div className="glass-card p-5 space-y-4">
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-32" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-14 rounded-full" />
        <Skeleton className="h-7 w-14 rounded-full" />
        <Skeleton className="h-7 w-14 rounded-full" />
      </div>
    </div>
    <Skeleton className="h-48 w-full rounded-xl" />
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  </div>
);

/** Simulation card skeleton */
export const SimulationCardSkeleton = () => (
  <div className="glass-card p-4 space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <div className="grid grid-cols-3 gap-2">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <Skeleton className="h-2.5 w-14 mb-1" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  </div>
);

/** Vehicle catalog card skeleton */
export const VehicleCardSkeleton = () => (
  <div className="glass-card overflow-hidden">
    <Skeleton className="h-40 w-full" />
    <div className="p-4 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  </div>
);
