import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trophy, Gift, Plus, Users, Phone, Check, X, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ReferralSectionProps {
  client: any;
}

const useClientReferrals = (clientId: string) =>
  useQuery({
    queryKey: ["referrals", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*, referred_client:referred_client_id(name, phone, pipeline_stage)")
        .eq("referrer_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Check }> = {
  pending: { label: "Pendente", color: "text-amber-400", icon: Loader2 },
  converted: { label: "Convertido", color: "text-green-400", icon: Check },
  lost: { label: "Perdido", color: "text-muted-foreground", icon: X },
};

const ReferralSection = ({ client }: ReferralSectionProps) => {
  const qc = useQueryClient();
  const { data: referrals, isLoading } = useClientReferrals(client.id);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", reward: "" });

  const createReferral = useMutation({
    mutationFn: async (data: { name: string; phone: string; reward: number }) => {
      const { error } = await supabase.from("referrals").insert({
        referrer_id: client.id,
        referred_name: data.name,
        referred_phone: data.phone,
        reward_amount: data.reward || 0,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["referrals", client.id] });
      setForm({ name: "", phone: "", reward: "" });
      setShowForm(false);
      toast.success("Indicação registrada!");
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { status };
      // Auto R$200 bonus on conversion
      if (status === "converted") {
        updateData.reward_amount = 200;
      }
      const { error } = await supabase
        .from("referrals")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["referrals", client.id] });
      if (variables.status === "converted") {
        toast.success("🎉 Indicação convertida! Bônus de R$200 aplicado automaticamente!");
      } else {
        toast.success("Status atualizado!");
      }
    },
  });

  const totalReward = (referrals || [])
    .filter((r) => r.status === "converted")
    .reduce((sum, r) => sum + (Number(r.reward_amount) || 0), 0);

  const convertedCount = (referrals || []).filter((r) => r.status === "converted").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <p className="text-sm font-medium flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" /> Programa de Indicação
        </p>
        <div className="flex items-center gap-3">
          {referrals && referrals.length > 0 && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-muted-foreground">
                {referrals.length} indicações
              </span>
              {convertedCount > 0 && (
                <span className="text-green-400 font-medium">
                  {convertedCount} ✅
                </span>
              )}
            </div>
          )}
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-secondary/50 rounded-xl p-2.5 text-center">
              <Users className="w-3.5 h-3.5 mx-auto text-primary mb-1" />
              <p className="text-lg font-bold font-mono">{referrals?.length || 0}</p>
              <p className="text-[9px] text-muted-foreground">Indicações</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-2.5 text-center">
              <Check className="w-3.5 h-3.5 mx-auto text-green-400 mb-1" />
              <p className="text-lg font-bold font-mono text-green-400">{convertedCount}</p>
              <p className="text-[9px] text-muted-foreground">Convertidos</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-2.5 text-center">
              <Gift className="w-3.5 h-3.5 mx-auto text-amber-400 mb-1" />
              <p className="text-lg font-bold font-mono text-amber-400">
                {totalReward > 0 ? `R$${totalReward}` : "—"}
              </p>
              <p className="text-[9px] text-muted-foreground">Recompensa</p>
            </div>
          </div>

          {/* Referral list */}
          {referrals && referrals.length > 0 && (
            <div className="space-y-1.5">
              {referrals.map((ref) => {
                const st = STATUS_MAP[ref.status] || STATUS_MAP.pending;
                return (
                  <div
                    key={ref.id}
                    className="flex items-center gap-2 bg-secondary/30 rounded-xl p-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {ref.referred_name || (ref.referred_client as any)?.name || "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Phone className="w-2.5 h-2.5" />
                        {ref.referred_phone || "sem telefone"}
                      </p>
                    </div>
                    <span className={`text-[10px] font-medium ${st.color}`}>
                      {st.label}
                    </span>
                    {ref.status === "pending" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 rounded-full"
                          onClick={() => updateStatus.mutate({ id: ref.id, status: "converted" })}
                        >
                          <Check className="w-3 h-3 text-green-400" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 rounded-full"
                          onClick={() => updateStatus.mutate({ id: ref.id, status: "lost" })}
                        >
                          <X className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    )}
                    {ref.reward_amount && Number(ref.reward_amount) > 0 && (
                      <span className="text-[10px] text-amber-400 font-mono">
                        R${ref.reward_amount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add referral form */}
          {showForm ? (
            <div className="space-y-2 bg-secondary/30 rounded-xl p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Nova indicação
              </p>
              <Input
                placeholder="Nome do indicado"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
              />
              <Input
                placeholder="Telefone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
              />
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2 text-center">
                <p className="text-[10px] text-green-400 font-medium">
                  💰 Bônus automático: R$ 200 por indicação convertida
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 rounded-xl h-8 text-xs"
                  disabled={!form.name.trim()}
                  onClick={() =>
                    createReferral.mutate({
                      name: form.name,
                      phone: form.phone,
                      reward: parseFloat(form.reward) || 0,
                    })
                  }
                >
                  Registrar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl h-8 text-xs"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full rounded-xl h-8 text-xs gap-1.5 border-primary/30"
              onClick={() => setShowForm(true)}
            >
              <Plus className="w-3 h-3" /> Registrar indicação
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ReferralSection;