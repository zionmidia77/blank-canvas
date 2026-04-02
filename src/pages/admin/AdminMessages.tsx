import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, Search, MessageCircle, Users, Send, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { useMessageTemplates, useClients, useCreateMessageTemplate, useDeleteMessageTemplate } from "@/hooks/useSupabase";
import { MessageCardSkeleton } from "@/components/admin/SkeletonLoaders";
import PageTour from "@/components/admin/PageTour";
import { MessageCircle as MsgIcon, Users as UsersIcon2, Copy as CopyIcon, Plus as PlusIcon } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const categoryBadge: Record<string, string> = {
  lead: "bg-blue-400/15 text-blue-400",
  relacionamento: "bg-pink-400/15 text-pink-400",
  oportunidade: "bg-amber-400/15 text-amber-400",
  aniversario: "bg-fuchsia-400/15 text-fuchsia-400",
};

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const AVAILABLE_VARS = [
  { key: "nome", label: "Nome", example: "Carlos" },
  { key: "interesse", label: "Interesse", example: "comprar uma moto" },
  { key: "orcamento", label: "Orçamento", example: "R$ 15 a 30 mil" },
];

const AdminMessages = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Tables<"clients"> | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  // Create template state
  const [createOpen, setCreateOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ title: "", message: "", category: "lead", emoji: "💬" });

  const { data: templates, isLoading } = useMessageTemplates(filter);
  const { data: allClients } = useClients();
  const createTemplate = useCreateMessageTemplate();
  const deleteTemplate = useDeleteMessageTemplate();

  const replaceVars = (msg: string, client?: Tables<"clients"> | null) => {
    if (!client) return msg;
    const firstName = client.name.split(" ")[0];
    return msg
      .replace(/\{nome\}/gi, firstName)
      .replace(/\{interesse\}/gi, (client.interest || "motos").toLowerCase())
      .replace(/\{orcamento\}/gi, client.budget_range || "a combinar");
  };

  const extractVars = (msg: string): string[] => {
    const matches = msg.match(/\{(\w+)\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, "")))];
  };

  const copy = (id: string, msg: string) => {
    const finalMsg = replaceVars(msg, selectedClient);
    navigator.clipboard.writeText(finalMsg);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Mensagem copiada!");
  };

  const sendWhatsApp = (msg: string) => {
    if (!selectedClient?.phone) {
      toast.error("Selecione um cliente com telefone");
      return;
    }
    const finalMsg = replaceVars(msg, selectedClient);
    const phone = selectedClient.phone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(finalMsg)}`);
    toast.success("Abrindo WhatsApp...");
  };

  const handleCreateTemplate = () => {
    if (!newTemplate.title.trim() || !newTemplate.message.trim()) {
      toast.error("Preencha título e mensagem");
      return;
    }
    const vars = extractVars(newTemplate.message);
    createTemplate.mutate(
      {
        title: newTemplate.title,
        message: newTemplate.message,
        category: newTemplate.category,
        emoji: newTemplate.emoji || "💬",
        variables: vars,
      },
      {
        onSuccess: () => {
          toast.success("Template criado!");
          setNewTemplate({ title: "", message: "", category: "lead", emoji: "💬" });
          setCreateOpen(false);
        },
        onError: () => toast.error("Erro ao criar template"),
      }
    );
  };

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Excluir o template "${title}"?`)) return;
    deleteTemplate.mutate(id, {
      onSuccess: () => toast.success("Template excluído"),
      onError: () => toast.error("Erro ao excluir"),
    });
  };

  const insertVar = (varKey: string) => {
    setNewTemplate(prev => ({
      ...prev,
      message: prev.message + `{${varKey}}`,
    }));
  };

  const filteredClients = (allClients || []).filter(c =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone?.includes(clientSearch)
  ).slice(0, 10);

  const filtered = (templates || []).filter(
    (t) => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.message.toLowerCase().includes(search.toLowerCase())
  );

  const EMOJIS = ["💬", "👋", "🔥", "⚡", "🏍️", "🎉", "💰", "📅", "🤝", "🏆", "📞", "🛒", "✅", "💫", "🔄", "🎁"];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-5 md:p-6 space-y-5 max-w-4xl">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Mensagens</h1>
          <p className="text-sm text-muted-foreground">
            {templates?.length || 0} templates · Variáveis dinâmicas
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full gap-1.5 h-9 text-xs">
              <Plus className="w-3.5 h-3.5" /> Novo template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Criar template de mensagem</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="flex gap-2">
                <Select value={newTemplate.emoji} onValueChange={v => setNewTemplate(p => ({ ...p, emoji: v }))}>
                  <SelectTrigger className="w-20 rounded-xl bg-secondary border-border/50 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMOJIS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Título do template"
                  value={newTemplate.title}
                  onChange={e => setNewTemplate(p => ({ ...p, title: e.target.value }))}
                  className="rounded-xl bg-secondary border-border/50 h-10 flex-1"
                />
              </div>

              <Select value={newTemplate.category} onValueChange={v => setNewTemplate(p => ({ ...p, category: v }))}>
                <SelectTrigger className="rounded-xl bg-secondary border-border/50 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="relacionamento">Relacionamento</SelectItem>
                  <SelectItem value="oportunidade">Oportunidade</SelectItem>
                  <SelectItem value="aniversario">🎂 Aniversário</SelectItem>
                </SelectContent>
              </Select>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs text-muted-foreground">Inserir variável:</span>
                  {AVAILABLE_VARS.map(v => (
                    <button
                      key={v.key}
                      onClick={() => insertVar(v.key)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono hover:bg-primary/20 transition-colors"
                    >
                      {`{${v.key}}`}
                    </button>
                  ))}
                </div>
                <Textarea
                  placeholder="Fala {nome}! Vi que você quer {interesse}..."
                  value={newTemplate.message}
                  onChange={e => setNewTemplate(p => ({ ...p, message: e.target.value }))}
                  className="rounded-xl bg-secondary border-border/50 min-h-[100px] text-sm"
                />
              </div>

              {newTemplate.message && (
                <div className="bg-muted/30 rounded-xl p-3 border border-border/30">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Pré-visualização</p>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                    {newTemplate.message
                      .replace(/\{nome\}/gi, "Carlos")
                      .replace(/\{interesse\}/gi, "comprar uma moto")
                      .replace(/\{orcamento\}/gi, "R$ 15 a 30 mil")}
                  </p>
                </div>
              )}

              <Button onClick={handleCreateTemplate} disabled={createTemplate.isPending} className="w-full rounded-xl h-11">
                {createTemplate.isPending ? "Salvando..." : "Criar template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Client selector */}
      <motion.div variants={fadeUp} className="glass-card gradient-border p-4">
        <p className="text-sm font-medium mb-2 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          {selectedClient ? `Enviando para: ${selectedClient.name}` : "Selecione um cliente para personalizar"}
        </p>
        {selectedClient ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-secondary/50 rounded-xl px-3 py-2">
              <p className="text-sm font-medium">{selectedClient.name}</p>
              <p className="text-[10px] text-muted-foreground">{selectedClient.phone || "Sem telefone"} · {selectedClient.interest || "Sem interesse"}</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-full text-xs h-8" onClick={() => setSelectedClient(null)}>
              Trocar
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder="Buscar cliente por nome ou telefone..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="rounded-xl bg-secondary border-border/50 h-9 text-sm"
            />
            {clientSearch && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {filteredClients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedClient(c); setClientSearch(""); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-accent/50 text-left transition-colors"
                  >
                    <span className="text-sm font-medium truncate">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{c.phone || ""}</span>
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum cliente encontrado</p>
                )}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Search + filters */}
      <div className="flex gap-2">
        <motion.div variants={fadeUp} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar mensagem..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl bg-secondary border-border/50 h-10" />
        </motion.div>
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl h-10 w-10 shrink-0"
          onClick={() => setShowPreview(!showPreview)}
          title={showPreview ? "Ocultar preview" : "Mostrar preview"}
        >
          {showPreview ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </Button>
      </div>

      <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto">
        {["all", "lead", "relacionamento", "oportunidade", "aniversario"].map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="rounded-full shrink-0 text-xs capitalize">
            {f === "all" ? "Todas" : f === "aniversario" ? "🎂 Aniversário" : f}
          </Button>
        ))}
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <MessageCardSkeleton key={i} />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const previewMsg = replaceVars(t.message, selectedClient);
            const hasVars = t.variables && t.variables.length > 0;
            return (
              <motion.div key={t.id} variants={fadeUp} className="glass-card-hover p-4 group">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{t.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.title}</p>
                    {hasVars && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {t.variables!.map(v => (
                          <span key={v} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                            {`{${v}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full capitalize ${categoryBadge[t.category] || 'bg-muted/15 text-muted-foreground'}`}>
                    {t.category}
                  </span>
                  <button
                    onClick={() => handleDelete(t.id, t.title)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                {showPreview && (
                  <div className="bg-secondary/50 rounded-xl p-3 mb-3">
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{previewMsg}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-full text-xs gap-1.5 flex-1 h-9" onClick={() => copy(t.id, t.message)}>
                    {copiedId === t.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === t.id ? "Copiado!" : "Copiar"}
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full text-xs gap-1.5 h-9 flex-1"
                    disabled={!selectedClient?.phone}
                    onClick={() => sendWhatsApp(t.message)}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {selectedClient?.phone ? "WhatsApp" : "Selecione cliente"}
                  </Button>
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma mensagem encontrada</div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default AdminMessages;
