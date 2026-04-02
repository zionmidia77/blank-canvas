import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Kanban, ListChecks, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { useDashboardStats } from "@/hooks/useSupabase";

const tabs = [
  { to: "/admin", icon: LayoutDashboard, label: "Home", badgeKey: null },
  { to: "/admin/leads", icon: Users, label: "Leads", badgeKey: "hotLeads" as const },
  { to: "/admin/pipeline", icon: Kanban, label: "Pipeline", badgeKey: null },
  { to: "/admin/tasks", icon: ListChecks, label: "Tarefas", badgeKey: "overdueTasks" as const },
  { to: "/admin/messages", icon: MessageSquare, label: "Msgs", badgeKey: null },
];

const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: stats } = useDashboardStats();

  const isActive = (path: string) => {
    if (path === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(path);
  };

  const getBadge = (key: "hotLeads" | "overdueTasks" | null) => {
    if (!key || !stats) return 0;
    return stats[key] || 0;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="bg-background/90 backdrop-blur-xl border-t border-border/50 px-1 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-[60px]">
          {tabs.map((tab) => {
            const active = isActive(tab.to);
            const badge = getBadge(tab.badgeKey);
            return (
              <button
                key={tab.to}
                onClick={() => navigate(tab.to)}
                className="relative flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[48px] rounded-xl active:scale-95 transition-transform"
              >
                {active && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -top-1 left-3 right-3 h-[3px] bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <div className="relative">
                  <tab.icon
                    className={`w-[22px] h-[22px] transition-colors ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  {badge > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold"
                    >
                      {badge > 9 ? "9+" : badge}
                    </motion.span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomTabBar;
