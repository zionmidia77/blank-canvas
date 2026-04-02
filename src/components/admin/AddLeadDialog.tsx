import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { useCreateClient } from "@/hooks/useSupabase";
import { toast } from "sonner";

const SOURCES = ["whatsapp", "facebook", "marketplace", "indicação", "loja", "telefone"];
const INTERESTS = ["Quero comprar uma moto", "Quero trocar minha moto", "Quero vender minha moto", "Preciso de dinheiro"];
const BUDGETS = ["Até R$ 15 mil", "R$ 15 a 30 mil", "R$ 30 a 50 mil", "Acima de R$ 50 mil"];

interface AddLeadDialogProps {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

const AddLeadDialog = ({ externalOpen, onExternalOpenChange }: AddLeadDialogProps = {}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onExternalOpenChange || setInternalOpen;
  const [form, setForm] = useState({ name: "", phone: "", interest: "", budget_range: "", source: "", notes: "", birthdate: "" });
  const createClient = useCreateClient();

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    createClient.mutate(
      {
        name: form.name,
        phone: form.phone || null,
        interest: form.interest || null,
        budget_range: form.budget_range || null,
        source: form.source || "manual",
        status: "lead",
        temperature: "warm",
        pipeline_stage: "new",
        notes: form.notes || null,
        birthdate: form.birthdate || null,
      },
      {
        onSuccess: () => {
          toast.success("Lead adicionado!");
          setForm({ name: "", phone: "", interest: "", budget_range: "", source: "", notes: "", birthdate: "" });
          setOpen(false);
        },
        onError: () => toast.error("Erro ao adicionar lead"),
      }
    );
  };

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full gap-1.5 h-9 text-xs">
          <UserPlus className="w-3.5 h-3.5" /> Novo lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Adicionar lead manualmente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <Input placeholder="Nome do cliente *" value={form.name} onChange={e => update("name", e.target.value)} className="rounded-xl bg-secondary border-border/50 h-10" />
          <Input placeholder="Telefone (WhatsApp)" value={form.phone} onChange={e => update("phone", e.target.value)} className="rounded-xl bg-secondary border-border/50 h-10" />
          
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Data de nascimento</label>
            <Input type="date" value={form.birthdate} onChange={e => update("birthdate", e.target.value)} className="rounded-xl bg-secondary border-border/50 h-10" />
          </div>
          <Select value={form.interest} onValueChange={v => update("interest", v)}>
            <SelectTrigger className="rounded-xl bg-secondary border-border/50 h-10">
              <SelectValue placeholder="Interesse" />
            </SelectTrigger>
            <SelectContent>
              {INTERESTS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={form.budget_range} onValueChange={v => update("budget_range", v)}>
            <SelectTrigger className="rounded-xl bg-secondary border-border/50 h-10">
              <SelectValue placeholder="Faixa de orçamento" />
            </SelectTrigger>
            <SelectContent>
              {BUDGETS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={form.source} onValueChange={v => update("source", v)}>
            <SelectTrigger className="rounded-xl bg-secondary border-border/50 h-10">
              <SelectValue placeholder="Origem do lead" />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <Input placeholder="Observações (opcional)" value={form.notes} onChange={e => update("notes", e.target.value)} className="rounded-xl bg-secondary border-border/50 h-10" />

          <Button onClick={handleSubmit} disabled={createClient.isPending} className="w-full rounded-xl h-11 glow-red">
            {createClient.isPending ? "Salvando..." : "Adicionar lead"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddLeadDialog;
