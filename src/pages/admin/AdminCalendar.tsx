import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MessageCircle, Check } from "lucide-react";
import { useAllPendingTasks, useUpdateTask } from "@/hooks/useSupabase";
import { useNavigate } from "react-router-dom";
import { CalendarSkeleton } from "@/components/admin/SkeletonLoaders";
import PageTour from "@/components/admin/PageTour";
import { CalendarDays, Eye, ListChecks } from "lucide-react";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const typeColor: Record<string, string> = {
  opportunity: "bg-primary",
  relationship: "bg-pink-400",
  value: "bg-success",
  follow_up: "bg-info",
};

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const AdminCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(new Date().toISOString().split("T")[0]);
  const navigate = useNavigate();
  const { data: tasks, isLoading } = useAllPendingTasks();
  const updateTask = useUpdateTask();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  const tasksByDate = useMemo(() => {
    const map: Record<string, typeof tasks> = {};
    (tasks || []).forEach(t => {
      if (!map[t.due_date]) map[t.due_date] = [];
      map[t.due_date]!.push(t);
    });
    return map;
  }, [tasks]);

  const shiftMonth = (dir: number) => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + dir);
    setCurrentMonth(d);
  };

  const selectedTasks = selectedDate ? (tasksByDate[selectedDate] || []) : [];

  const toggleDone = (id: string, currentStatus: string) => {
    updateTask.mutate({
      id,
      status: currentStatus === "done" ? "pending" : "done",
      completed_at: currentStatus === "done" ? null : new Date().toISOString(),
    });
  };

  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const calendarTourSteps = [
    { target: '[data-tour="calendar-grid"]', title: "Calendário visual", description: "Veja suas tarefas distribuídas no mês. Dias com bolinhas coloridas possuem tarefas agendadas.", icon: CalendarDays, position: "bottom" as const },
    { target: '[data-tour="calendar-tasks"]', title: "Tarefas do dia", description: "Clique em um dia para ver e gerenciar as tarefas daquela data.", icon: ListChecks, position: "bottom" as const },
  ];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5 max-w-4xl">
      <PageTour tourKey="calendar" steps={calendarTourSteps} />
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-display font-bold">Agenda</h1>
        <p className="text-sm text-muted-foreground">Calendário de follow-ups e tarefas</p>
      </motion.div>

      {/* Month navigation */}
      <motion.div variants={fadeUp} className="glass-card p-4" data-tour="calendar-grid">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-sm font-display font-semibold">
            {MONTHS[month]} {year}
          </h2>
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => shiftMonth(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {isLoading ? (
          <CalendarSkeleton />
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayTasks = tasksByDate[dateStr] || [];
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`relative flex flex-col items-center py-1.5 rounded-lg text-xs transition-all
                    ${isSelected ? "bg-primary text-primary-foreground" : isToday ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}
                  `}
                >
                  <span className="font-medium">{day}</span>
                  {dayTasks.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayTasks.slice(0, 3).map((t, j) => (
                        <span key={j} className={`w-1 h-1 rounded-full ${isSelected ? "bg-primary-foreground" : typeColor[t.type] || "bg-muted-foreground"}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Selected date tasks */}
      <motion.div variants={fadeUp}>
        <h3 className="text-sm font-display font-semibold mb-3">
          {selectedDate === today
            ? "📅 Hoje"
            : selectedDate
              ? new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
              : "Selecione uma data"
          }
          {selectedTasks.length > 0 && (
            <span className="text-muted-foreground font-normal ml-2">({selectedTasks.length} tarefas)</span>
          )}
        </h3>

        {selectedTasks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm glass-card rounded-2xl">
            Nenhuma tarefa para esta data
          </div>
        ) : (
          <div className="space-y-2">
            {selectedTasks.map(task => {
              const clientData = task.clients as any;
              const isDone = task.status === "done";
              return (
                <motion.div
                  key={task.id}
                  variants={fadeUp}
                  className={`glass-card-hover p-3.5 flex items-center gap-3 ${isDone ? "opacity-50" : ""}`}
                >
                  <Button
                    size="icon"
                    variant={isDone ? "default" : "outline"}
                    className="rounded-full h-8 w-8 shrink-0"
                    onClick={() => toggleDone(task.id, task.status)}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => clientData && navigate(`/admin/client/${task.client_id}`)}
                  >
                    <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : ""}`}>
                      {clientData?.name || "Cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{task.reason}</p>
                    {task.scheduled_time && (
                      <p className="text-[10px] text-primary mt-0.5">🕐 {task.scheduled_time}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {clientData?.phone && (
                      <Button size="icon" variant="ghost" className="rounded-full h-7 w-7"
                        onClick={() => window.open(`https://wa.me/55${clientData.phone.replace(/\D/g, "")}`)}>
                        <MessageCircle className="w-3.5 h-3.5 text-success" />
                      </Button>
                    )}
                    <div className={`w-2 h-2 rounded-full ${typeColor[task.type] || "bg-muted"}`} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AdminCalendar;
