import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const CATEGORIES = [
  { value: "parts", label: "🔧 Peças" },
  { value: "paint", label: "🎨 Pintura" },
  { value: "repair", label: "🛠️ Manutenção" },
  { value: "document", label: "📄 Documentação" },
  { value: "cleaning", label: "🧹 Limpeza/Polimento" },
  { value: "accessories", label: "🏍️ Acessórios" },
  { value: "other", label: "📦 Outros" },
];

interface Props {
  vehicleId: string;
}

const VehicleCostManager = ({ vehicleId }: Props) => {
  const [newCost, setNewCost] = useState({ category: "parts", description: "", amount: "", date: new Date().toISOString().split("T")[0] });
  const queryClient = useQueryClient();

  const { data: costs = [] } = useQuery({
    queryKey: ["vehicle-costs", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_costs")
        .select("*")
        .eq("vehicle_id", vehicleId)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vehicle_costs").insert({
        vehicle_id: vehicleId,
        category: newCost.category,
        description: newCost.description,
        amount: Number(newCost.amount),
        date: newCost.date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle-costs", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["stock-vehicles"] });
      setNewCost({ category: "parts", description: "", amount: "", date: new Date().toISOString().split("T")[0] });
      toast.success("Custo adicionado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_costs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle-costs", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["stock-vehicles"] });
      toast.success("Custo removido!");
    },
  });

  const total = costs.reduce((sum: number, c: any) => sum + Number(c.amount), 0);

  return (
    <div className="space-y-4">
      {/* Add new cost */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-semibold">Adicionar Custo</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={newCost.category} onValueChange={v => setNewCost(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" value={newCost.amount} onChange={e => setNewCost(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Input value={newCost.description} onChange={e => setNewCost(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Troca de pneu traseiro" />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={newCost.date} onChange={e => setNewCost(p => ({ ...p, date: e.target.value }))} />
            </div>
          </div>
          <Button onClick={() => addMutation.mutate()} disabled={!newCost.description || !newCost.amount} className="gap-2">
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </CardContent>
      </Card>

      {/* Cost list */}
      <div className="space-y-2">
        <h4 className="font-semibold">Custos Registrados (Total: R$ {total.toLocaleString("pt-BR")})</h4>
        {costs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum custo registrado</p>
        ) : (
          costs.map((cost: any) => {
            const cat = CATEGORIES.find(c => c.value === cost.category);
            return (
              <div key={cost.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span>{cat?.label || "📦"}</span>
                    <span className="font-medium">{cost.description}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{cost.date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">R$ {Number(cost.amount).toLocaleString("pt-BR")}</span>
                  <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(cost.id)}>
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default VehicleCostManager;
