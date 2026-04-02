import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Users, MessageCircle, ArrowRight, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Activity = {
  id: string;
  type: "new_lead" | "stage_change" | "interaction" | "task_done";
  message: string;
  client_name: string;
  client_id: string;
  created_at: string;
};

const iconMap = {
  new_lead: Users,
  stage_change: ArrowRight,
  interaction: MessageCircle,
  task_done: Clock,
};

const colorMap = {
  new_lead: "text-info bg-info/10",
  stage_change: "text-warning bg-warning/10",
  interaction: "text-success bg-success/10",
  task_done: "text-primary bg-primary/10",
};

const formatTimeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const ActivityFeed = () => {
  const navigate = useNavigate();
  const [realtimeActivities, setRealtimeActivities] = useState<Activity[]>([]);

  // Fetch recent interactions as activity
  const { data: activities } = useQuery({
    queryKey: ["activity-feed"],
    queryFn: async () => {
      const [interactionsRes, clientsRes] = await Promise.all([
        supabase.from("interactions").select("*, clients(name)").order("created_at", { ascending: false }).limit(20),
        supabase.from("clients").select("id, name, created_at, pipeline_stage").order("created_at", { ascending: false }).limit(10),
      ]);

      const items: Activity[] = [];

      // Recent clients as "new_lead"
      (clientsRes.data || []).forEach(c => {
        items.push({
          id: `client-${c.id}`,
          type: "new_lead",
          message: `Novo lead capturado`,
          client_name: c.name,
          client_id: c.id,
          created_at: c.created_at,
        });
      });

      // Interactions
      (interactionsRes.data || []).forEach(i => {
        const clientData = i.clients as any;
        items.push({
          id: `interaction-${i.id}`,
          type: i.type === "system" ? "stage_change" : "interaction",
          message: i.content.length > 60 ? i.content.slice(0, 60) + "..." : i.content,
          client_name: clientData?.name || "Cliente",
          client_id: i.client_id,
          created_at: i.created_at,
        });
      });

      // Sort by date
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return items.slice(0, 15);
    },
    refetchInterval: 30000, // refresh every 30s
  });

  // Realtime subscription for new clients
  useEffect(() => {
    const channel = supabase
      .channel("activity-feed-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "clients" }, (payload) => {
        const newClient = payload.new as any;
        setRealtimeActivities(prev => [{
          id: `rt-client-${newClient.id}`,
          type: "new_lead" as const,
          message: "Novo lead capturado agora!",
          client_name: newClient.name,
          client_id: newClient.id,
          created_at: new Date().toISOString(),
        }, ...prev].slice(0, 5));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "interactions" }, (payload) => {
        const newInt = payload.new as any;
        setRealtimeActivities(prev => [{
          id: `rt-int-${newInt.id}`,
          type: "interaction" as const,
          message: (newInt.content || "").slice(0, 60),
          client_name: "",
          client_id: newInt.client_id,
          created_at: new Date().toISOString(),
        }, ...prev].slice(0, 5));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const allActivities = [...realtimeActivities, ...(activities || [])].slice(0, 15);

  if (allActivities.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        Nenhuma atividade recente
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
      <AnimatePresence>
        {allActivities.map((activity) => {
          const Icon = iconMap[activity.type];
          const colors = colorMap[activity.type];
          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/admin/client/${activity.client_id}`)}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${colors}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs">
                  <span className="font-medium">{activity.client_name}</span>
                  {activity.client_name && " · "}
                  <span className="text-muted-foreground">{activity.message}</span>
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{formatTimeAgo(activity.created_at)}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ActivityFeed;
