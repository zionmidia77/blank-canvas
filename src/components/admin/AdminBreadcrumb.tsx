import { useLocation, Link } from "react-router-dom";
import { ChevronRight, LayoutDashboard, Users, Kanban, ListChecks, MessageSquare, BarChart3, CalendarDays, User } from "lucide-react";
import { motion } from "framer-motion";

const routeMap: Record<string, { label: string; icon: any }> = {
  "/admin": { label: "Dashboard", icon: LayoutDashboard },
  "/admin/leads": { label: "Leads", icon: Users },
  "/admin/pipeline": { label: "Pipeline", icon: Kanban },
  "/admin/tasks": { label: "Tarefas", icon: ListChecks },
  "/admin/calendar": { label: "Agenda", icon: CalendarDays },
  "/admin/messages": { label: "Mensagens", icon: MessageSquare },
  "/admin/metrics": { label: "Métricas", icon: BarChart3 },
};

const AdminBreadcrumb = () => {
  const location = useLocation();
  const path = location.pathname;

  // Don't show on dashboard root
  if (path === "/admin") return null;

  const crumbs: { label: string; to?: string; icon?: any }[] = [
    { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  ];

  // Client detail page
  const clientMatch = path.match(/^\/admin\/client\/(.+)$/);
  if (clientMatch) {
    crumbs.push({ label: "Leads", to: "/admin/leads", icon: Users });
    crumbs.push({ label: "Ficha do cliente", icon: User });
  } else if (routeMap[path]) {
    crumbs.push({ label: routeMap[path].label, icon: routeMap[path].icon });
  }

  return (
    <motion.nav
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-1 px-5 pt-4 pb-1 text-xs"
      aria-label="Breadcrumb"
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        const Icon = crumb.icon;

        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
            {crumb.to && !isLast ? (
              <Link
                to={crumb.to}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {Icon && <Icon className="w-3 h-3" />}
                {crumb.label}
              </Link>
            ) : (
              <span className="flex items-center gap-1 text-foreground font-medium">
                {Icon && <Icon className="w-3 h-3 text-primary" />}
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </motion.nav>
  );
};

export default AdminBreadcrumb;
