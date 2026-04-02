import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Calculator, DollarSign, Clock, User, Phone, Bike, CheckCircle2, XCircle, Eye, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { SimulationCardSkeleton } from "@/components/admin/SkeletonLoaders";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import PageTour from "@/components/admin/PageTour";
import { Calculator as CalcIcon, Filter as FilterIcon2, DollarSign as Dollar2 } from "lucide-react";

const statusMap: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pendente", color: "bg-warning/10 text-warning border-warning/20", icon: Clock },
  approved: { label: "Aprovada", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  rejected: { label: "Rejeitada", color: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  in_analysis: { label: "Em análise", color: "bg-info/10 text-info border-info/20", icon: Eye },
};

const AdminSimulations = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: simulations, isLoading } = useQuery({
    queryKey: ["financing-simulations", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("financing_simulations")
        .select("*")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("financing_simulations")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financing-simulations"] });
      toast.success("Status atualizado!");
    },
  });

  const totalSimulations = simulations?.length || 0;
  const totalFinanced = simulations?.reduce((sum, s) => sum + Number(s.financed_amount), 0) || 0;
  const avgMonthly = simulations?.length
    ? simulations.reduce((sum, s) => sum + Number(s.monthly_payment), 0) / simulations.length
    : 0;
  const pendingCount = simulations?.filter(s => s.status === "pending").length || 0;

  const simTourSteps = [
    { target: '[data-tour="sim-stats"]', title: "Indicadores", description: "Veja total de simulações, pendentes, valor financiado e parcela média.", icon: CalcIcon, position: "bottom" as const },
    { target: '[data-tour="sim-filter"]', title: "Filtrar por status", description: "Filtre simulações por status: pendente, aprovada, rejeitada ou em análise.", icon: FilterIcon2, position: "bottom" as const },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageTour tourKey="simulations" steps={simTourSteps} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold">Simulações de Financiamento</h1>
          <p className="text-sm text-muted-foreground">Acompanhe todas as simulações realizadas</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-tour="sim-stats">
        {[
          { label: "Total", value: totalSimulations, icon: Calculator, color: "text-primary" },
          { label: "Pendentes", value: pendingCount, icon: Clock, color: "text-warning" },
          { label: "Valor financiado", value: `R$ ${(totalFinanced / 1000).toFixed(0)}k`, icon: DollarSign, color: "text-success" },
          { label: "Parcela média", value: `R$ ${avgMonthly.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, icon: Bike, color: "text-info" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-lg font-display font-bold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2" data-tour="sim-filter">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovadas</SelectItem>
            <SelectItem value="rejected">Rejeitadas</SelectItem>
            <SelectItem value="in_analysis">Em análise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <SimulationCardSkeleton key={i} />
          ))}
        </div>
      ) : !simulations?.length ? (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <Calculator className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma simulação encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {simulations.map((sim, i) => {
            const st = statusMap[sim.status] || statusMap.pending;
            const StIcon = st.icon;
            return (
              <motion.div
                key={sim.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className="border-border/50 hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium text-sm truncate">
                              {sim.client_name || "Visitante"}
                            </span>
                          </div>
                          {sim.client_phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              {sim.client_phone}
                            </div>
                          )}
                          <Badge variant="outline" className={`text-[10px] ${st.color}`}>
                            <StIcon className="w-3 h-3 mr-1" />
                            {st.label}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Moto</span>
                            <p className="font-semibold tabular-nums">R$ {Number(sim.moto_value).toLocaleString("pt-BR")}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Entrada</span>
                            <p className="font-semibold tabular-nums">R$ {Number(sim.down_payment).toLocaleString("pt-BR")}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Parcela</span>
                            <p className="font-semibold text-primary tabular-nums">
                              {sim.months}x R$ {Number(sim.monthly_payment).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Juros total</span>
                            <p className="font-semibold text-warning tabular-nums">R$ {Number(sim.total_interest).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{format(new Date(sim.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          <span>•</span>
                          <span className="capitalize">{sim.source}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0">
                        {sim.client_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => navigate(`/admin/client/${sim.client_id}`)}
                          >
                            Ver lead
                          </Button>
                        )}
                        <Select
                          value={sim.status}
                          onValueChange={(status) => updateStatus.mutate({ id: sim.id, status })}
                        >
                          <SelectTrigger className="h-7 text-xs w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="in_analysis">Em análise</SelectItem>
                            <SelectItem value="approved">Aprovada</SelectItem>
                            <SelectItem value="rejected">Rejeitada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminSimulations;
