import { useEffect, useState, useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { NavLink } from "@/components/NavLink";
import { LayoutDashboard, Users, ListChecks, MessageSquare, Menu, X, Bike, ChevronLeft, Kanban, LogOut, BarChart3, CalendarDays, Target, MessagesSquare, Calculator, Package, Smartphone, Zap, Sun, Bot, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import BottomTabBar from "@/components/BottomTabBar";
import { useRealtimeLeads } from "@/hooks/useRealtimeLeads";
import { useAuth } from "@/hooks/useAuth";
import NotificationCenter from "@/components/admin/NotificationCenter";
import GlobalSearch from "@/components/admin/GlobalSearch";
import AddLeadDialog from "@/components/admin/AddLeadDialog";
import PhotoLeadCapture from "@/components/admin/PhotoLeadCapture";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";
import KeyboardShortcuts from "@/components/admin/KeyboardShortcuts";
import OnboardingTour from "@/components/admin/OnboardingTour";
import { useOverdueLeads } from "@/hooks/useOverdueLeads";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/briefing", icon: Sun, label: "Briefing do Dia" },
  { to: "/admin/queue", icon: Zap, label: "Fila Inteligente" },
  { to: "/admin/leads", icon: Users, label: "Leads" },
  { to: "/admin/pipeline", icon: Kanban, label: "Pipeline" },
  { to: "/admin/tasks", icon: ListChecks, label: "Tarefas" },
  { to: "/admin/calendar", icon: CalendarDays, label: "Agenda" },
  { to: "/admin/messages", icon: MessageSquare, label: "Mensagens" },
  { to: "/admin/chat-history", icon: MessagesSquare, label: "Conversas IA" },
  { to: "/admin/metrics", icon: BarChart3, label: "Métricas" },
  { to: "/admin/goals", icon: Target, label: "Metas" },
  { to: "/admin/simulations", icon: Calculator, label: "Simulações" },
  { to: "/admin/catalog", icon: Package, label: "Catálogo" },
  { to: "/admin/sms", icon: Smartphone, label: "SMS Marketing" },
  { to: "/admin/bots", icon: Bot, label: "Painel de Bots" },
  { to: "/admin/cadence-metrics", icon: Activity, label: "Métricas Cadência" },
];

const AdminLayout = () => {
  const [open, setOpen] = useState(false);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const location = useLocation();
  const isClientDetail = location.pathname.includes("/admin/client/");
  const { signOut, user } = useAuth();
  const overdueLeadCount = useOverdueLeads();
  useRealtimeLeads();

  const handleNewLead = useCallback(() => {
    setAddLeadOpen(true);
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Real-time notification for transferred conversations
  useEffect(() => {
    // Create notification sound using Web Audio API
    const playNotificationSound = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playTone = (freq: number, start: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = "sine";
          gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + duration);
        };
        playTone(880, 0, 0.15);
        playTone(1100, 0.18, 0.15);
        playTone(1320, 0.36, 0.25);
      } catch {}
    };

    const channel = supabase
      .channel('chat-transfers')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_conversations',
          filter: 'status=eq.transferred',
        },
        (payload) => {
          playNotificationSound();

          toast.info("🔔 Nova conversa transferida do chat IA!", {
            description: "Um lead qualificado foi transferido para atendimento humano.",
            action: {
              label: "Ver",
              onClick: () => window.location.href = "/admin/chat-history",
            },
            duration: 15000,
          });

          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Arsenal CRM - Conversa Transferida", {
              body: "Um lead foi transferido do chat IA para atendimento humano.",
              icon: "/favicon.ico",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex">
      {open && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-card/50 backdrop-blur-xl border-r border-border/50 z-40 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 flex flex-col`}>
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-border/50">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Bike className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display font-bold text-sm">Arsenal <span className="text-primary">CRM</span></span>
        </div>

        <nav data-tour="sidebar-nav" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isQueue = item.to === "/admin/queue";
            const showBadge = isQueue && overdueLeadCount > 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin"}
                className="flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-accent transition-all duration-200 min-h-[44px] relative"
                activeClassName="bg-primary/10 text-primary font-medium"
                onClick={() => setOpen(false)}
              >
                <span className="relative shrink-0">
                  <item.icon className={`w-5 h-5 md:w-4 md:h-4 ${showBadge ? "text-destructive" : ""}`} />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold animate-pulse">
                      {overdueLeadCount}
                    </span>
                  )}
                </span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/50 space-y-1">
          {user && (
            <div className="px-3 py-1.5 mb-1">
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
          )}
          <NavLink
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-accent transition-all duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar ao site
          </NavLink>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200 w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-3 border-b border-border/50 backdrop-blur-xl bg-background/80 sticky top-0 z-20">
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="rounded-full md:hidden min-h-[44px] min-w-[44px]">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2 md:hidden">
            <Bike className="w-4 h-4 text-primary" />
            <span className="font-display font-bold text-sm">Arsenal <span className="text-primary">CRM</span></span>
          </div>
          
          <div className="flex-1" />
          
          <div data-tour="global-search"><GlobalSearch /></div>
          <PhotoLeadCapture />
          <div data-tour="add-lead"><AddLeadDialog externalOpen={addLeadOpen} onExternalOpenChange={setAddLeadOpen} /></div>
          <div data-tour="notifications"><NotificationCenter /></div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full md:hidden text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={signOut}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <main className={`flex-1 overflow-y-auto ${!isClientDetail ? "pb-20 md:pb-0" : ""}`}>
          <div data-tour="breadcrumb"><AdminBreadcrumb /></div>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {!isClientDetail && <BottomTabBar />}
      <KeyboardShortcuts onNewLead={handleNewLead} />
      <OnboardingTour />
    </div>
  );
};

export default AdminLayout;
