import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Helper to invalidate all client-related queries
const invalidateAllClients = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["clients"] });
  qc.invalidateQueries({ queryKey: ["clients-all"] });
  qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  qc.invalidateQueries({ queryKey: ["tasks-pending"] });
  qc.invalidateQueries({ queryKey: ["tasks-overdue"] });
  qc.invalidateQueries({ queryKey: ["tasks"] });
};

// ============ CLIENTS ============
export const useClients = (filters?: { status?: string; temperature?: string; pipeline_stage?: string }) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["clients", filters],
    queryFn: async () => {
      let query = supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status as any);
      if (filters?.temperature) query = query.eq("temperature", filters.temperature as any);
      if (filters?.pipeline_stage) query = query.eq("pipeline_stage", filters.pipeline_stage as any);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};

export const useClient = (id: string) => {
  return useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (client: TablesInsert<"clients">) => {
      const { data, error } = await supabase.from("clients").insert(client).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAllClients(qc);
      toast.success("Lead criado com sucesso!");
    },
    onError: (e: any) => toast.error("Erro ao criar lead", { description: e.message }),
  });
};

export const useUpdateClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"clients"> & { id: string }) => {
      const { data, error } = await supabase.from("clients").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      invalidateAllClients(qc);
      qc.invalidateQueries({ queryKey: ["client", vars.id] });
    },
    onError: (e: any) => toast.error("Erro ao atualizar lead", { description: e.message }),
  });
};

// ============ ALL CLIENTS FOR KANBAN ============
export const useAllClients = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["clients-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("lead_score", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};

// ============ VEHICLES ============
export const useClientVehicles = (clientId: string) => {
  return useQuery({
    queryKey: ["vehicles", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
};

// ============ INTERACTIONS ============
export const useClientInteractions = (clientId: string) => {
  return useQuery({
    queryKey: ["interactions", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("interactions").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
};

export const useCreateInteraction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (interaction: TablesInsert<"interactions">) => {
      const { data, error } = await supabase.from("interactions").insert(interaction).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["interactions", vars.client_id] });
      // Interactions trigger lead_score recalc, so refresh client data
      invalidateAllClients(qc);
    },
  });
};

// ============ TASKS ============
export const useTasks = (filters?: { status?: string; due_date?: string }) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: async () => {
      let query = supabase.from("tasks").select("*, clients(name, phone, temperature, pipeline_stage, interest)").order("due_date", { ascending: true });
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.due_date) query = query.eq("due_date", filters.due_date);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};

export const useAllPendingTasks = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tasks-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, clients(name, phone, temperature, pipeline_stage, interest)")
        .eq("status", "pending")
        .order("due_date", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};

export const useOverdueTasks = () => {
  const { user } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["tasks-overdue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, clients(name, phone, temperature, pipeline_stage, interest)")
        .eq("status", "pending")
        .lt("due_date", today)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};

// Helper to invalidate all task-related queries
const invalidateAllTasks = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["tasks"] });
  qc.invalidateQueries({ queryKey: ["tasks-pending"] });
  qc.invalidateQueries({ queryKey: ["tasks-overdue"] });
  qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
};

export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: TablesInsert<"tasks">) => {
      const { data, error } = await supabase.from("tasks").insert(task).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAllTasks(qc);
      toast.success("Tarefa criada!");
    },
    onError: (e: any) => toast.error("Erro ao criar tarefa", { description: e.message }),
  });
};

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<TablesUpdate<"tasks">>) => {
      const { data, error } = await supabase.from("tasks").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateAllTasks(qc),
    onError: (e: any) => toast.error("Erro ao atualizar tarefa", { description: e.message }),
  });
};

// ============ OPPORTUNITIES ============
export const useOpportunities = (filters?: { status?: string }) => {
  return useQuery({
    queryKey: ["opportunities", filters],
    queryFn: async () => {
      let query = supabase.from("opportunities").select("*, clients(name, phone)").order("priority", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

// ============ MESSAGE TEMPLATES ============
export const useMessageTemplates = (category?: string) => {
  return useQuery({
    queryKey: ["message_templates", category],
    queryFn: async () => {
      let query = supabase.from("message_templates").select("*").order("usage_count", { ascending: false });
      if (category && category !== "all") query = query.eq("category", category);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useCreateMessageTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: TablesInsert<"message_templates">) => {
      const { data, error } = await supabase.from("message_templates").insert(template).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["message_templates"] }),
  });
};

export const useDeleteMessageTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("message_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["message_templates"] }),
  });
};

// ============ STATS ============
export const useDashboardStats = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const [clients, hotLeads, activeTasks, overdueTasks, opportunities, todayTasks, closedWon, closedLost] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("temperature", "hot"),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "pending").lt("due_date", today),
        supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "pending").eq("due_date", today),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("pipeline_stage", "closed_won"),
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("pipeline_stage", "closed_lost"),
      ]);
      const total = clients.count || 0;
      const won = closedWon.count || 0;
      const lost = closedLost.count || 0;
      return {
        totalLeads: total,
        hotLeads: hotLeads.count || 0,
        activeClients: activeTasks.count || 0,
        overdueTasks: overdueTasks.count || 0,
        opportunities: opportunities.count || 0,
        todayTasks: todayTasks.count || 0,
        closedWon: won,
        closedLost: lost,
        conversionRate: total > 0 ? Math.round((won / total) * 100) : 0,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
};

// ============ CHART DATA ============
export const useLeadsChartData = () => {
  return useQuery({
    queryKey: ["leads-chart"],
    queryFn: async () => {
      const days = 7;
      const result = [];
      const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const { count } = await supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .gte("created_at", dateStr)
          .lt("created_at", nextDate.toISOString().split("T")[0]);
        result.push({ day: dayNames[date.getDay()], leads: count || 0 });
      }
      return result;
    },
  });
};

// ============ TAGS ============
export const useTags = () => {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
};

export const useClientTags = (clientId: string) => {
  return useQuery({
    queryKey: ["client-tags", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_tag_assignments")
        .select("*, client_tags(*)")
        .eq("client_id", clientId);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
};

export const useToggleClientTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, tagId, assigned }: { clientId: string; tagId: string; assigned: boolean }) => {
      if (assigned) {
        const { error } = await supabase.from("client_tag_assignments").delete().eq("client_id", clientId).eq("tag_id", tagId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_tag_assignments").insert({ client_id: clientId, tag_id: tagId });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["client-tags", vars.clientId] });
    },
  });
};

export const useCreateTag = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data, error } = await supabase.from("client_tags").insert({ name, color }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
};
