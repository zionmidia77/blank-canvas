import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Gift, TrendingUp, Heart, MessageCircle, Calendar, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useTasks, useUpdateTask, useOverdueTasks, useAllPendingTasks } from "@/hooks/useSupabase";
import { useNavigate } from "react-router-dom";
import { TaskCardSkeleton } from "@/components/admin/SkeletonLoaders";
import PageTour from "@/components/admin/PageTour";
import { ListChecks, CalendarDays, AlertTriangle as AlertIcon, Filter as FilterIcon } from "lucide-react";

const typeIcon: Record<string, any> = { opportunity: TrendingUp, relationship: Heart, value: Gift, follow_up: TrendingUp };
const typeColor: Record<string, string> = { opportunity: "text-primary", relationship: "text-pink-400", value: "text-success", follow_up: "text-info" };
const typeBg: Record<string, string> = { opportunity: "bg-primary/10", relationship: "bg-pink-400/10", value: "bg-success/10", follow_up: "bg-info/10" };
const typeLabel: Record<string, string> = { opportunity: "Oportunidade", relationship: "Relacionamento", value: "Valor", follow_up: "Follow-up" };

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const formatDate = (d: Date) => d.toISOString().split("T")[0];
const formatDateBR = (s: string) => {
  const d = new Date(s + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
};

const AdminTasks = () => {
  const today = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeTab, setActiveTab] = useState<"day" | "overdue" | "upcoming">("day");
  const navigate = useNavigate();

  const { data: dayTasks, isLoading } = useTasks({ due_date: selectedDate });
  const { data: overdueTasks } = useOverdueTasks();
  const { data: pendingTasks } = useAllPendingTasks();
  const updateTask = useUpdateTask();
  const [filter, setFilter] = useState<string>("all");

  const toggleDone = (id: string, currentStatus: string) => {
    updateTask.mutate({
      id,
      status: currentStatus === "done" ? "pending" : "done",
      completed_at: currentStatus === "done" ? null : new Date().toISOString(),
    });
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(formatDate(d));
    setActiveTab("day");
  };

  const activeTasks = activeTab === "overdue"
    ? (overdueTasks || [])
    : activeTab === "upcoming"
      ? (pendingTasks || []).filter(t => t.due_date > today)
      : (dayTasks || []);

  const filtered = filter === "all" ? activeTasks : activeTasks.filter((t) => t.type === filter);
  const doneCount = activeTasks.filter((t) => t.status === "done").length;
  const progress = activeTasks.length > 0 ? (doneCount / activeTasks.length) * 100 : 0;

  const tasksTourSteps = [
    { target: '[data-tour="tasks-tabs"]', title: "Abas de tarefas", description: "Alterne entre tarefas do dia, atrasadas e próximas para priorizar seu trabalho.", icon: ListChecks, position: "bottom" as const },
    { target: '[data-tour="tasks-date-nav"]', title: "Navegação por data", description: "Use as setas para ver tarefas de outros dias. Clique em 'Hoje' para voltar.", icon: CalendarDays, position: "bottom" as const },
    { target: '[data-tour="tasks-filter"]', title: "Filtrar por tipo", description: "Filtre entre oportunidades, relacionamento, valor e follow-ups.", icon: FilterIcon, position: "bottom" as const },
  ];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5 max-w-4xl">
      <PageTour tourKey="tasks" steps={tasksTourSteps} />
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-display font-bold">Tarefas</h1>
        <p className="text-sm text-muted-foreground">
          {(overdueTasks?.length || 0) > 0
            ? `⚠️ ${overdueTasks?.length} atrasadas · ${activeTasks.length - doneCount} pendentes`
            : `${activeTasks.length - doneCount} tarefas pendentes`
          }
        </p>
      </motion.div>

      {/* Tab: Day / Overdue / Upcoming */}
      <motion.div variants={fadeUp} className="flex gap-2" data-tour="tasks-tabs">
        <Button
          variant={activeTab === "day" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("day")}
          className="rounded-full text-xs gap-1"
        >
          <Calendar className="w-3 h-3" />
          {selectedDate === today ? "Hoje" : formatDateBR(selectedDate)}
        </Button>
        <Button
          variant={activeTab === "overdue" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("overdue")}
          className="rounded-full text-xs gap-1"
        >
          <AlertTriangle className="w-3 h-3" />
          Atrasadas
          {(overdueTasks?.length || 0) > 0 && (
            <span className="bg-destructive text-destructive-foreground text-[10px] px-1.5 rounded-full">{overdueTasks?.length}</span>
          )}
        </Button>
        <Button
          variant={activeTab === "upcoming" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("upcoming")}
          className="rounded-full text-xs"
        >
          Próximas
        </Button>
      </motion.div>

      {/* Date navigation for "day" tab */}
      {activeTab === "day" && (
        <motion.div variants={fadeUp} className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => shiftDate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <button onClick={() => setSelectedDate(today)} className="text-sm font-medium hover:text-primary transition-colors">
            {selectedDate === today ? "📅 Hoje" : formatDateBR(selectedDate)}
          </button>
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => shiftDate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </motion.div>
      )}

      {/* Progress */}
      {activeTasks.length > 0 && (
        <motion.div variants={fadeUp} className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Progresso</span>
            <span className="font-display font-bold text-primary tabular-nums">{doneCount}/{activeTasks.length}</span>
          </div>
          <Progress value={progress} className="h-2.5 bg-secondary" />
          {doneCount === activeTasks.length && activeTasks.length > 0 && (
            <p className="text-xs text-success text-center font-medium">🎉 Todas concluídas!</p>
          )}
        </motion.div>
      )}

      {/* Type filter */}
      <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto">
        {["all", "follow_up", "opportunity", "relationship", "value"].map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="rounded-full shrink-0 text-xs">
            {f === "all" ? "Todos" : typeLabel[f] || f}
          </Button>
        ))}
      </motion.div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map(i => <TaskCardSkeleton key={i} />)}</div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((task) => {
              const Icon = typeIcon[task.type] || TrendingUp;
              const clientData = task.clients as any;
              const isDone = task.status === "done";
              const isOverdue = task.due_date < today && !isDone;
              return (
                <motion.div key={task.id} layout variants={fadeUp} className={`glass-card-hover p-4 flex items-center gap-3 transition-all ${isDone ? "opacity-50" : ""} ${isOverdue ? "border-l-2 border-destructive" : ""}`}>
                  <Button
                    size="icon"
                    variant={isDone ? "default" : "outline"}
                    className={`rounded-full h-9 w-9 shrink-0 transition-all ${isDone ? "scale-95" : ""}`}
                    onClick={() => toggleDone(task.id, task.status)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => clientData && navigate(`/admin/client/${task.client_id}`)}>
                    <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>
                      {clientData?.name || "Cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{task.reason}</p>
                    {activeTab !== "day" && (
                      <p className={`text-[10px] mt-0.5 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                        {formatDateBR(task.due_date)}
                        {task.scheduled_time && ` às ${task.scheduled_time}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {clientData?.phone && (
                      <Button size="icon" variant="ghost" className="rounded-full h-8 w-8" onClick={() => window.open(`https://wa.me/55${clientData.phone.replace(/\D/g, "")}`)}>
                        <MessageCircle className="w-3.5 h-3.5 text-success" />
                      </Button>
                    )}
                    <div className={`w-7 h-7 rounded-full ${typeBg[task.type] || "bg-muted"} flex items-center justify-center`}>
                      <Icon className={`w-3.5 h-3.5 ${typeColor[task.type] || "text-muted-foreground"}`} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {activeTab === "overdue" ? "✅ Nenhuma tarefa atrasada!" :
               activeTab === "upcoming" ? "Nenhuma tarefa futura agendada" :
               "Nenhuma tarefa para esta data"}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AdminTasks;
