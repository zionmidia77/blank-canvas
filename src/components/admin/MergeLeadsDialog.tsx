import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GitMerge, Crown, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

interface MergeLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeads: Client[];
  onComplete: () => void;
}

const MergeLeadsDialog = ({ open, onOpenChange, selectedLeads, onComplete }: MergeLeadsDialogProps) => {
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [done, setDone] = useState(false);
  const qc = useQueryClient();

  const primary = selectedLeads.find((l) => l.id === primaryId);
  const secondary = selectedLeads.filter((l) => l.id !== primaryId);

  const previewMerged = () => {
    if (!primary) return null;
    const merged = { ...primary };
    for (const s of secondary) {
      if (!merged.phone && s.phone) merged.phone = s.phone;
      if (!merged.email && s.email) merged.email = s.email;
      if (!merged.city && s.city) merged.city = s.city;
      if (!merged.interest && s.interest) merged.interest = s.interest;
      if (!merged.budget_range && s.budget_range) merged.budget_range = s.budget_range;
      if (s.lead_score > merged.lead_score) merged.lead_score = s.lead_score;
    }
    return merged;
  };

  const handleMerge = async () => {
    if (!primaryId || secondary.length === 0) return;
    setMerging(true);

    try {
      const merged = previewMerged();
      if (!merged) throw new Error("Erro ao calcular dados mesclados");

      // 1. Update primary lead with merged data
      const updates: Record<string, any> = {};
      if (merged.phone && merged.phone !== primary!.phone) updates.phone = merged.phone;
      if (merged.email && merged.email !== primary!.email) updates.email = merged.email;
      if (merged.city && merged.city !== primary!.city) updates.city = merged.city;
      if (merged.interest && merged.interest !== primary!.interest) updates.interest = merged.interest;
      if (merged.budget_range && merged.budget_range !== primary!.budget_range) updates.budget_range = merged.budget_range;

      // Merge notes from all secondary leads
      const allNotes = secondary
        .filter((s) => s.notes)
        .map((s) => `[Mesclado de ${s.name}] ${s.notes}`)
        .join("\n---\n");
      if (allNotes) {
        updates.notes = (primary!.notes ? `${primary!.notes}\n---\n` : "") + allNotes;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("clients")
          .update(updates)
          .eq("id", primaryId);
        if (error) throw error;
      }

      // 2. Transfer all interactions from secondary leads to primary
      for (const s of secondary) {
        const { error: interError } = await supabase
          .from("interactions")
          .update({ client_id: primaryId })
          .eq("client_id", s.id);
        if (interError) console.error("Error transferring interactions:", interError);

        // Transfer tasks
        const { error: taskError } = await supabase
          .from("tasks")
          .update({ client_id: primaryId })
          .eq("client_id", s.id);
        if (taskError) console.error("Error transferring tasks:", taskError);

        // Transfer tag assignments
        const { error: tagError } = await supabase
          .from("client_tag_assignments")
          .update({ client_id: primaryId })
          .eq("client_id", s.id);
        if (tagError) console.error("Error transferring tags:", tagError);

        // Transfer vehicles
        const { error: vehError } = await supabase
          .from("vehicles")
          .update({ client_id: primaryId })
          .eq("client_id", s.id);
        if (vehError) console.error("Error transferring vehicles:", vehError);
      }

      // 3. Add system interaction logging the merge
      await supabase.from("interactions").insert({
        client_id: primaryId,
        type: "system" as const,
        content: `Lead mesclado manualmente. ${secondary.length} lead(s) absorvido(s): ${secondary.map((s) => s.name).join(", ")}`,
        created_by: "system",
      });

      // 4. Delete secondary leads
      for (const s of secondary) {
        await supabase.from("clients").delete().eq("id", s.id);
      }

      setDone(true);
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients-all"] });
      toast.success(`${secondary.length} lead(s) mesclado(s) com sucesso!`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao mesclar leads");
    } finally {
      setMerging(false);
    }
  };

  const handleClose = () => {
    setPrimaryId(null);
    setDone(false);
    onOpenChange(false);
    if (done) onComplete();
  };

  const mergedPreview = primaryId ? previewMerged() : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-primary" />
            Mesclar {selectedLeads.length} leads
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-8 text-center space-y-4"
          >
            <CheckCircle2 className="w-14 h-14 mx-auto text-green-400" />
            <div>
              <p className="text-lg font-bold">Leads mesclados!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Todas as interações, tarefas e veículos foram transferidos.
              </p>
            </div>
            <Button className="rounded-xl" onClick={handleClose}>
              Fechar
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-4 mt-2">
            {/* Step 1: Choose primary */}
            <div>
              <p className="text-sm font-medium mb-2">
                1. Escolha o lead <strong>principal</strong> (que será mantido):
              </p>
              <div className="space-y-2">
                {selectedLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => setPrimaryId(lead.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      primaryId === lead.id
                        ? "border-primary bg-primary/10 ring-1 ring-primary/50"
                        : "border-border/50 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {primaryId === lead.id && <Crown className="w-4 h-4 text-primary" />}
                        <span className="font-medium text-sm">{lead.name}</span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{lead.lead_score}pts</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      {lead.phone && <span>📞 {lead.phone}</span>}
                      {lead.email && <span>✉️ {lead.email}</span>}
                      {lead.city && <span>📍 {lead.city}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2: Preview */}
            {primaryId && mergedPreview && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <p className="text-sm font-medium">2. Preview do resultado:</p>

                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold">{mergedPreview.name}</span>
                  </div>

                  {[
                    ["📞 Telefone", mergedPreview.phone],
                    ["✉️ Email", mergedPreview.email],
                    ["📍 Cidade", mergedPreview.city],
                    ["🎯 Interesse", mergedPreview.interest],
                    ["💰 Orçamento", mergedPreview.budget_range],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-24">{label}</span>
                      <span className={value ? "text-foreground" : "text-muted-foreground/50"}>
                        {String(value || "—")}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-2 rounded-lg bg-secondary/50 space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground">O que será transferido:</p>
                  {secondary.map((s) => (
                    <div key={s.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ArrowRight className="w-3 h-3" />
                      <span>{s.name}</span>
                      <span className="text-destructive text-[10px]">(será excluído)</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    ✅ Interações, tarefas, veículos e tags serão transferidos
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={handleClose}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 rounded-xl glow-red"
                    onClick={handleMerge}
                    disabled={merging}
                  >
                    {merging ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <GitMerge className="w-4 h-4 mr-1" />
                    )}
                    {merging ? "Mesclando..." : "Confirmar merge"}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MergeLeadsDialog;
