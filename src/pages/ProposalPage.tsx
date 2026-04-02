import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Bike, Calendar, Fuel, Gauge, MessageCircle, Shield, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ProposalPage = () => {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["proposal", id],
    queryFn: async () => {
      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();
      if (!client) throw new Error("Proposta não encontrada");

      const bankProposal = (client.funnel_data as any)?.bank_proposal || {};
      
      // Try to find associated vehicle from interest
      let vehicle = null;
      if (client.interest) {
        const { data: vehicles } = await supabase
          .from("stock_vehicles")
          .select("*")
          .eq("status", "available")
          .limit(1);
        if (vehicles?.length) vehicle = vehicles[0];
      }

      return { client, bankProposal, vehicle };
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground">Proposta não encontrada</p>
      </div>
    );
  }

  const { client, bankProposal, vehicle } = data;
  const firstName = client.name.split(" ")[0];
  const installments = bankProposal.installments || {};
  const hasInstallments = Object.values(installments).some((v: any) => v);
  const statusLabel = client.financing_status === "approved" ? "✅ APROVADO" 
    : client.financing_status === "pre_approved" ? "🟡 PRÉ-APROVADO" 
    : null;

  const statusColor = client.financing_status === "approved" 
    ? "from-green-500/20 to-emerald-500/10 border-green-500/30" 
    : "from-amber-500/20 to-yellow-500/10 border-amber-500/30";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Arsenal Motors</p>
          <h1 className="text-2xl font-bold">Proposta para {firstName}</h1>
          {statusLabel && (
            <motion.span
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className={`inline-block mt-3 px-4 py-1.5 rounded-full text-sm font-bold border bg-gradient-to-r ${statusColor}`}
            >
              {statusLabel}
            </motion.span>
          )}
        </motion.div>
      </div>

      <div className="px-5 -mt-3 space-y-4 pb-32 max-w-lg mx-auto">
        {/* Vehicle card */}
        {vehicle && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl overflow-hidden border border-border/50 bg-card shadow-lg"
          >
            {vehicle.image_url && (
              <img src={vehicle.image_url} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full h-48 object-cover" />
            )}
            <div className="p-4">
              <h2 className="text-lg font-bold">{vehicle.brand} {vehicle.model}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                {vehicle.year && (
                  <span className="text-xs bg-secondary px-2 py-1 rounded-full flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {vehicle.year}
                  </span>
                )}
                {vehicle.km != null && (
                  <span className="text-xs bg-secondary px-2 py-1 rounded-full flex items-center gap-1">
                    <Gauge className="w-3 h-3" /> {vehicle.km.toLocaleString("pt-BR")} km
                  </span>
                )}
                {vehicle.fuel && (
                  <span className="text-xs bg-secondary px-2 py-1 rounded-full flex items-center gap-1">
                    <Fuel className="w-3 h-3" /> {vehicle.fuel}
                  </span>
                )}
                {vehicle.color && (
                  <span className="text-xs bg-secondary px-2 py-1 rounded-full flex items-center gap-1">
                    🎨 {vehicle.color}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-primary mt-3">
                R$ {vehicle.price.toLocaleString("pt-BR")}
              </p>
            </div>
          </motion.div>
        )}

        {/* Interest (if no vehicle) */}
        {!vehicle && client.interest && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border/50 bg-card p-5 text-center"
          >
            <Bike className="w-10 h-10 text-primary mx-auto mb-2" />
            <h2 className="text-lg font-bold">{client.interest}</h2>
          </motion.div>
        )}

        {/* Bank info */}
        {bankProposal.approved_amount && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-primary" />
              <p className="font-semibold">Condições do Financiamento</p>
            </div>
            
            {bankProposal.bank_name && (
              <p className="text-sm text-muted-foreground mb-2">
                🏦 {bankProposal.bank_name}
              </p>
            )}
            
            <p className="text-3xl font-bold text-primary mb-4">
              R$ {Number(bankProposal.approved_amount).toLocaleString("pt-BR")}
              <span className="text-sm font-normal text-muted-foreground ml-2">liberado</span>
            </p>

            {/* Installments table */}
            {hasInstallments && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Opções de parcela
                </p>
                <div className="grid gap-2">
                  {Object.entries(installments)
                    .filter(([_, v]: any) => v)
                    .sort(([a]: any, [b]: any) => Number(a) - Number(b))
                    .map(([months, value]: any) => (
                      <motion.div
                        key={months}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + Number(months) * 0.02 }}
                        className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-3 border border-border/30"
                      >
                        <span className="text-sm font-bold text-primary">{months}x</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold">
                            R$ {Number(value).toLocaleString("pt-BR")}
                          </span>
                          <span className="text-xs text-muted-foreground">/mês</span>
                        </div>
                      </motion.div>
                    ))}
                </div>
              </div>
            )}

            {bankProposal.notes && (
              <p className="text-xs text-muted-foreground mt-3 italic">
                📝 {bankProposal.notes}
              </p>
            )}
          </motion.div>
        )}

        {/* No financial data message */}
        {!bankProposal.approved_amount && !hasInstallments && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border/50 bg-card p-5 text-center"
          >
            <p className="text-sm text-muted-foreground">
              Dados do financiamento sendo processados. Em breve você terá as condições aqui!
            </p>
          </motion.div>
        )}
      </div>

      {/* Fixed bottom CTA */}
      {client.phone && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
          className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent"
        >
          <div className="max-w-lg mx-auto">
            <Button
              size="lg"
              className="w-full rounded-2xl h-14 text-base gap-2 shadow-lg shadow-primary/20"
              onClick={() => {
                const phone = client.phone!.replace(/\D/g, "");
                window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(`Oi! Vi a proposta e quero saber mais!`)}`);
              }}
            >
              <MessageCircle className="w-5 h-5" />
              Falar com a Arsenal Motors
              <ChevronRight className="w-4 h-4" />
            </Button>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Arsenal Motors · Proposta válida por 7 dias
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ProposalPage;
