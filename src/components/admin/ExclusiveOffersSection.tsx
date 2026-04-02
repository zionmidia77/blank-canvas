import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Gift, Plus, Send, Check, Percent, Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface ExclusiveOffersSectionProps {
  client: any;
}

const useActiveOffers = () =>
  useQuery({
    queryKey: ["exclusive-offers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exclusive_offers")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

const useClientClaims = (clientId: string) =>
  useQuery({
    queryKey: ["offer-claims", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offer_claims")
        .select("*")
        .eq("client_id", clientId);
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

const ExclusiveOffersSection = ({ client }: ExclusiveOffersSectionProps) => {
  const qc = useQueryClient();
  const { data: offers } = useActiveOffers();
  const { data: claims } = useClientClaims(client.id);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", discount: "", validUntil: "" });

  const claimedIds = new Set((claims || []).map((c) => c.offer_id));

  const createOffer = useMutation({
    mutationFn: async (data: { title: string; description: string; discount: number; validUntil: string }) => {
      const { error } = await supabase.from("exclusive_offers").insert({
        title: data.title,
        description: data.description || null,
        discount_percent: data.discount || null,
        valid_until: data.validUntil || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exclusive-offers"] });
      setForm({ title: "", description: "", discount: "", validUntil: "" });
      setShowCreate(false);
      toast.success("Oferta criada!");
    },
  });

  const claimOffer = useMutation({
    mutationFn: async (offerId: string) => {
      const { error } = await supabase.from("offer_claims").insert({
        offer_id: offerId,
        client_id: client.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["offer-claims", client.id] });
      toast.success("Oferta enviada ao cliente!");
    },
  });

  const sendOfferWhatsApp = (offer: any) => {
    if (!client.phone) { toast.error("Cliente sem telefone"); return; }
    const phone = client.phone.replace(/\D/g, "");
    const msg = [
      `🎁 *OFERTA EXCLUSIVA* para você, ${client.name.split(" ")[0]}!`,
      "",
      `*${offer.title}*`,
      offer.description ? offer.description : "",
      offer.discount_percent ? `💰 *${offer.discount_percent}% de desconto*` : "",
      offer.valid_until ? `⏰ Válido até ${new Date(offer.valid_until).toLocaleDateString("pt-BR")}` : "",
      "",
      "Essa oferta é exclusiva para clientes Arsenal! 🏍️",
      "Responde essa mensagem pra garantir a sua! 🔥",
    ].filter(Boolean).join("\n");

    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`);
    claimOffer.mutate(offer.id);
  };

  const isClientEligible = client.pipeline_stage === "closed_won" || client.status === "active";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" /> Ofertas Exclusivas
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full text-[10px] h-7 gap-1"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="w-3 h-3" /> Nova oferta
        </Button>
      </div>

      {!isClientEligible && (
        <div className="bg-secondary/30 rounded-xl p-3 text-center mb-3">
          <p className="text-[10px] text-muted-foreground">
            🔒 Ofertas exclusivas disponíveis apenas para clientes que já compraram
          </p>
        </div>
      )}

      {/* Create offer form */}
      {showCreate && (
        <div className="bg-secondary/30 rounded-xl p-3 space-y-2 mb-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Nova oferta exclusiva
          </p>
          <Input
            placeholder="Título da oferta"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
          />
          <Input
            placeholder="Descrição (opcional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Desconto %"
              type="number"
              value={form.discount}
              onChange={(e) => setForm({ ...form, discount: e.target.value })}
              className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
            />
            <Input
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 rounded-xl h-8 text-xs"
              disabled={!form.title.trim()}
              onClick={() => createOffer.mutate({
                title: form.title,
                description: form.description,
                discount: parseInt(form.discount) || 0,
                validUntil: form.validUntil,
              })}
            >
              Criar oferta
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Offers list */}
      {isClientEligible && offers && offers.length > 0 && (
        <div className="space-y-2">
          {offers.map((offer) => {
            const claimed = claimedIds.has(offer.id);
            return (
              <div key={offer.id} className="bg-secondary/30 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  {offer.discount_percent && (
                    <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                      <Percent className="w-2.5 h-2.5" /> {offer.discount_percent}%
                    </span>
                  )}
                  <p className="text-xs font-medium flex-1">{offer.title}</p>
                </div>
                {offer.description && (
                  <p className="text-[10px] text-muted-foreground mb-2">{offer.description}</p>
                )}
                <div className="flex items-center justify-between">
                  {offer.valid_until && (
                    <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5" />
                      Até {new Date(offer.valid_until).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {claimed ? (
                    <span className="text-[10px] text-green-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Enviada
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      className="h-6 rounded-full text-[10px] gap-1"
                      onClick={() => sendOfferWhatsApp(offer)}
                    >
                      <Send className="w-2.5 h-2.5" /> Enviar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isClientEligible && (!offers || offers.length === 0) && (
        <p className="text-[10px] text-muted-foreground text-center py-2">
          Nenhuma oferta ativa. Crie uma oferta exclusiva!
        </p>
      )}
    </motion.div>
  );
};

export default ExclusiveOffersSection;