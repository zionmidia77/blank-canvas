import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Car, CreditCard, Calendar, Send, Copy,
} from "lucide-react";
import { toast } from "sonner";

interface ClientReportSectionProps {
  client: any;
  vehicles: any[] | undefined;
}

const ClientReportSection = ({ client, vehicles }: ClientReportSectionProps) => {
  const currentVehicles = (vehicles || []).filter((v) => v.status === "current");
  const totalValue = currentVehicles.reduce((s, v) => s + (Number(v.estimated_value) || 0), 0);
  const totalMonthly = currentVehicles
    .filter((v) => v.is_financed)
    .reduce((s, v) => s + (Number(v.monthly_payment) || 0), 0);
  const totalRemaining = currentVehicles
    .filter((v) => v.is_financed)
    .reduce((s, v) => {
      const remaining = (v.installments_total || 0) - (v.installments_paid || 0);
      return s + remaining * (Number(v.monthly_payment) || 0);
    }, 0);

  const daysSinceContact = client.last_contact_at
    ? Math.floor((Date.now() - new Date(client.last_contact_at).getTime()) / 86400000)
    : null;

  const buildReport = () => {
    const lines = [
      `📊 *RELATÓRIO MENSAL - ${client.name}*`,
      "━━━━━━━━━━━━━━━━━━",
      "",
      "🏍️ *Seus veículos:*",
      ...currentVehicles.map((v) =>
        `  • ${v.brand} ${v.model} ${v.year || ""} — R$ ${(v.estimated_value || 0).toLocaleString("pt-BR")}`
      ),
      currentVehicles.length === 0 ? "  Nenhum veículo registrado" : "",
      "",
      `💰 *Valor total estimado:* R$ ${totalValue.toLocaleString("pt-BR")}`,
      totalMonthly > 0 ? `💳 *Parcela mensal:* R$ ${totalMonthly.toLocaleString("pt-BR")}` : "",
      totalRemaining > 0 ? `📋 *Saldo restante:* R$ ${totalRemaining.toLocaleString("pt-BR")}` : "",
      "",
      "━━━━━━━━━━━━━━━━━━",
      `📅 *Status:* ${client.pipeline_stage === "closed_won" ? "Cliente ativo ✅" : client.pipeline_stage}`,
      daysSinceContact !== null ? `📞 *Último contato:* ${daysSinceContact === 0 ? "hoje" : `${daysSinceContact} dias atrás`}` : "",
      "",
      "Qualquer dúvida, estamos à disposição! 🤝",
      "— Arsenal Motors 🏍️",
    ].filter(Boolean);

    return lines.join("\n");
  };

  const sendReport = () => {
    if (!client.phone) { toast.error("Cliente sem telefone"); return; }
    const phone = client.phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(buildReport())}`);
    toast.success("Relatório enviado via WhatsApp!");
  };

  const copyReport = () => {
    navigator.clipboard.writeText(buildReport());
    toast.success("Relatório copiado!");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
    >
      <p className="text-sm font-medium flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-primary" /> Relatório do Cliente
      </p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-secondary/50 rounded-xl p-2.5">
          <Car className="w-3.5 h-3.5 text-primary mb-1" />
          <p className="text-sm font-bold font-mono">{currentVehicles.length}</p>
          <p className="text-[9px] text-muted-foreground">Veículos</p>
        </div>
        <div className="bg-secondary/50 rounded-xl p-2.5">
          <CreditCard className="w-3.5 h-3.5 text-green-400 mb-1" />
          <p className="text-sm font-bold font-mono text-green-400">
            {totalValue > 0 ? `R$${(totalValue / 1000).toFixed(0)}k` : "—"}
          </p>
          <p className="text-[9px] text-muted-foreground">Valor total</p>
        </div>
      </div>

      {totalMonthly > 0 && (
        <div className="bg-secondary/30 rounded-xl p-2.5 mb-3 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Parcela mensal</span>
          <span className="text-xs font-bold font-mono">
            R$ {totalMonthly.toLocaleString("pt-BR")}
          </span>
        </div>
      )}

      {daysSinceContact !== null && daysSinceContact > 30 && (
        <div className="bg-amber-500/10 rounded-xl p-2.5 mb-3 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-[10px] text-amber-400">
            Último contato há {daysSinceContact} dias — hora de enviar o relatório!
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          className="flex-1 rounded-xl h-8 text-xs gap-1.5"
          onClick={sendReport}
        >
          <Send className="w-3 h-3" /> Enviar via WhatsApp
        </Button>
        <Button
          variant="outline"
          className="rounded-xl h-8 text-xs gap-1.5"
          onClick={copyReport}
        >
          <Copy className="w-3 h-3" /> Copiar
        </Button>
      </div>
    </motion.div>
  );
};

export default ClientReportSection;