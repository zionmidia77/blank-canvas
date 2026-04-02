import { useState } from "react";
import EmptyState from "@/components/EmptyState";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageCircle, Copy, Check, Search, Eye, SortAsc, SortDesc, Filter, CalendarIcon, X, GitMerge, CheckSquare, Phone, CalendarPlus, ChevronDown, FileDown, LayoutList, LayoutGrid } from "lucide-react";
import { useClients, useTags, useMessageTemplates } from "@/hooks/useSupabase";
import { useNavigate } from "react-router-dom";
import { LeadCardSkeleton } from "@/components/admin/SkeletonLoaders";
import PageTour from "@/components/admin/PageTour";
import { Users as UsersIcon, Search as SearchIcon, Filter as FilterIcon, FileDown as FileDownIcon, LayoutGrid as LayoutGridIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import MergeLeadsDialog from "@/components/admin/MergeLeadsDialog";
import SwipeableLeadCard from "@/components/admin/SwipeableLeadCard";
import CadenceBadge from "@/components/admin/CadenceBadge";
import { useCadenceBadges } from "@/hooks/useCadenceBadges";
import { toast } from "sonner";

const tempStyles: Record<string, string> = {
  hot: "border-l-primary bg-primary/5",
  warm: "border-l-warning bg-warning/5",
  cold: "border-l-info bg-info/5",
  frozen: "border-l-muted bg-muted/5",
};
const tempBadge: Record<string, string> = {
  hot: "bg-primary/15 text-primary",
  warm: "bg-warning/15 text-warning",
  cold: "bg-info/15 text-info",
  frozen: "bg-muted/15 text-muted-foreground",
};
const tempLabel: Record<string, string> = { hot: "Quente", warm: "Morno", cold: "Frio", frozen: "Inativo" };

const STAGE_LABELS: Record<string, string> = {
  new: "🆕 Novo", contacted: "📞 Contatado", interested: "🔥 Interessado",
  attending: "🤝 Em atendimento", thinking: "🤔 Pensando", waiting_response: "⏳ Aguardando",
  scheduled: "📅 Agendado", negotiating: "💰 Negociação", closed_won: "🏆 Fechado", closed_lost: "❌ Perdido",
};

const sourceBadge: Record<string, string> = {
  funnel: "bg-info/15 text-info",
  whatsapp: "bg-success/15 text-success",
  facebook: "bg-blue-500/15 text-blue-400",
  manual: "bg-muted/15 text-muted-foreground",
};

const sourceLabel: Record<string, string> = {
  funnel: "Funil", whatsapp: "WhatsApp", facebook: "Facebook", manual: "Manual",
};

const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

type SortField = "created_at" | "lead_score" | "name";

const AdminLeads = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "hot" | "warm" | "cold">("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"expanded" | "compact">("expanded");
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useClients(
    filter !== "all" ? { temperature: filter } : undefined
  );

  const { data: tags } = useTags();

  // Fetch tag assignments for filtering
  const { data: tagAssignments } = useQuery({
    queryKey: ["all-tag-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_tag_assignments").select("client_id, tag_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: templates } = useMessageTemplates("all");

  const replaceVars = (msg: string, client: Tables<"clients">) => {
    const firstName = client.name.split(" ")[0];
    return msg
      .replace(/\{nome\}/gi, firstName)
      .replace(/\{interesse\}/gi, (client.interest || "motos").toLowerCase())
      .replace(/\{orcamento\}/gi, client.budget_range || "a combinar");
  };

  const sendWhatsApp = (client: Tables<"clients">, msg: string) => {
    if (!client.phone) { toast.error("Cliente sem telefone"); return; }
    const phone = client.phone.replace(/\D/g, "");
    const finalMsg = replaceVars(msg, client);
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(finalMsg)}`);
    toast.success("Abrindo WhatsApp...");
  };

  const copyMsg = (client: Tables<"clients">) => {
    const firstName = client.name.split(" ")[0];
    navigator.clipboard.writeText(
      `Fala ${firstName}! Aqui é da Arsenal Motors 🏍️ Vi que você tem interesse em ${(client.interest || "motos").toLowerCase()}. Posso te ajudar?`
    );
    setCopiedId(client.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const clearFilters = () => {
    setFilter("all");
    setStageFilter("all");
    setSourceFilter("all");
    setTagFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setSearch("");
  };

  const hasActiveFilters = filter !== "all" || stageFilter !== "all" || sourceFilter !== "all" || tagFilter !== "all" || dateFrom || dateTo;

  const exportCSV = () => {
    if (!filtered.length) { toast.error("Nenhum lead para exportar"); return; }
    const headers = ["Nome", "Telefone", "Email", "Interesse", "Orçamento", "Temperatura", "Etapa", "Fonte", "Score", "Data"];
    const rows = filtered.map(c => [
      c.name, c.phone || "", c.email || "", c.interest || "", c.budget_range || "",
      tempLabel[c.temperature] || c.temperature, STAGE_LABELS[c.pipeline_stage] || c.pipeline_stage,
      sourceLabel[c.source || ""] || c.source || "", String(c.lead_score),
      new Date(c.created_at).toLocaleDateString("pt-BR"),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-arsenal-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`${filtered.length} leads exportados!`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };


  const selectedLeads = (clients || []).filter((c) => selectedIds.has(c.id));

  const clientIdsWithTag = tagFilter !== "all" && tagAssignments
    ? tagAssignments.filter(a => a.tag_id === tagFilter).map(a => a.client_id)
    : null;

  const filtered = (clients || [])
    .filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search) || l.interest?.toLowerCase().includes(search.toLowerCase()))
    .filter(l => stageFilter === "all" || l.pipeline_stage === stageFilter)
    .filter(l => sourceFilter === "all" || l.source === sourceFilter)
    .filter(l => !clientIdsWithTag || clientIdsWithTag.includes(l.id))
    .filter(l => {
      if (!dateFrom && !dateTo) return true;
      const created = new Date(l.created_at);
      if (dateFrom && created < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59);
        if (created > end) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "lead_score") cmp = a.lead_score - b.lead_score;
      else if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortAsc ? cmp : -cmp;
    });

  // Cadence badges for filtered clients
  const filteredIds = filtered.map(c => c.id);
  const { data: cadenceBadges } = useCadenceBadges(filteredIds);

  const leadsTourSteps = [
    { target: '[data-tour="leads-search"]', title: "Buscar leads", description: "Pesquise por nome, telefone ou interesse para encontrar leads rapidamente.", icon: SearchIcon, position: "bottom" as const },
    { target: '[data-tour="leads-filters"]', title: "Filtros avançados", description: "Filtre por temperatura, etapa, fonte, tags e data para segmentar seus leads.", icon: FilterIcon, position: "bottom" as const },
    { target: '[data-tour="leads-export"]', title: "Exportar dados", description: "Exporte a lista filtrada de leads em formato CSV para análise externa.", icon: FileDownIcon, position: "bottom" as const },
    { target: '[data-tour="leads-view-mode"]', title: "Modo de visualização", description: "Alterne entre visualização expandida (cards detalhados) ou compacta (lista).", icon: LayoutGridIcon, position: "bottom" as const },
  ];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="p-4 md:p-6 space-y-4 md:space-y-5 max-w-5xl xl:max-w-6xl">
      <PageTour tourKey="leads" steps={leadsTourSteps} />
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">{clients?.length || 0} leads capturados</p>
        </div>
        <div className="flex gap-2">
          <div data-tour="leads-view-mode" className="flex rounded-full border border-border/50 overflow-hidden">
            <button
              onClick={() => setViewMode("expanded")}
              className={`p-2 transition-colors ${viewMode === "expanded" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              title="Visualização expandida"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("compact")}
              className={`p-2 transition-colors ${viewMode === "compact" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              title="Visualização compacta"
            >
              <LayoutList className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-xs gap-1.5 h-9"
            onClick={exportCSV}
            data-tour="leads-export"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          <Button
            variant={selectMode ? "default" : "outline"}
            size="sm"
            className="rounded-full text-xs gap-1.5 h-9"
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{selectMode ? "Cancelar" : "Selecionar"}</span>
          </Button>
        </div>
      </motion.div>

      {/* Merge action bar */}
      {selectMode && selectedIds.size >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30"
        >
          <GitMerge className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium flex-1">
            {selectedIds.size} leads selecionados
          </span>
          <Button
            size="sm"
            className="rounded-full text-xs gap-1.5 h-8 glow-red"
            onClick={() => setMergeOpen(true)}
          >
            <GitMerge className="w-3.5 h-3.5" /> Mesclar
          </Button>
        </motion.div>
      )}

      <motion.div variants={fadeUp} className="relative" data-tour="leads-search">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, telefone ou interesse..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl bg-secondary border-border/50 h-11 md:h-10 text-base md:text-sm" />
      </motion.div>

      {/* Temperature filter */}
      <motion.div variants={fadeUp} className="flex gap-2 overflow-x-auto">
        {(["all", "hot", "warm", "cold"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="rounded-full shrink-0 text-xs min-h-[40px] md:min-h-[32px] px-4 md:px-3">
            {f === "all" ? "Todos" : f === "hot" ? "🔥 Quentes" : f === "warm" ? "🟡 Mornos" : "🔵 Frios"}
          </Button>
        ))}
        <Button
          variant={showAdvanced ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="rounded-full shrink-0 text-xs gap-1 ml-auto"
        >
          <Filter className="w-3 h-3" />
          Filtros
          {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
        </Button>
      </motion.div>

      {/* Advanced filters */}
      {showAdvanced && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="glass-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Filtros avançados</p>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-6 text-destructive">
                <X className="w-3 h-3 mr-1" /> Limpar
              </Button>
            )}
          </div>

          {/* Source filter */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-1.5">Fonte</p>
            <div className="flex gap-1.5 flex-wrap">
              {["all", "funnel", "whatsapp", "facebook", "manual"].map(s => (
                <Button key={s} variant={sourceFilter === s ? "default" : "outline"} size="sm"
                  onClick={() => setSourceFilter(s)} className="rounded-full text-[10px] h-7">
                  {s === "all" ? "Todas" : sourceLabel[s] || s}
                </Button>
              ))}
            </div>
          </div>

          {/* Tag filter */}
          {tags && tags.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5">Tags</p>
              <div className="flex gap-1.5 flex-wrap">
                <Button variant={tagFilter === "all" ? "default" : "outline"} size="sm"
                  onClick={() => setTagFilter("all")} className="rounded-full text-[10px] h-7">
                  Todas
                </Button>
                {tags.map(tag => (
                  <Button key={tag.id} variant={tagFilter === tag.id ? "default" : "outline"} size="sm"
                    onClick={() => setTagFilter(tagFilter === tag.id ? "all" : tag.id)}
                    className="rounded-full text-[10px] h-7 gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Date range */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-1.5">Período</p>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("rounded-full text-[10px] h-7 gap-1", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="w-3 h-3" />
                    {dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("rounded-full text-[10px] h-7 gap-1", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="w-3 h-3" />
                    {dateTo ? format(dateTo, "dd/MM/yy") : "Até"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stage filter */}
      <motion.div variants={fadeUp} className="flex gap-1.5 overflow-x-auto pb-1">
        <Button variant={stageFilter === "all" ? "default" : "ghost"} size="sm" onClick={() => setStageFilter("all")} className="rounded-full shrink-0 text-[10px] h-7">
          Todas etapas
        </Button>
        {Object.entries(STAGE_LABELS).map(([key, label]) => (
          <Button key={key} variant={stageFilter === key ? "default" : "ghost"} size="sm" onClick={() => setStageFilter(stageFilter === key ? "all" : key)} className="rounded-full shrink-0 text-[10px] h-7">
            {label}
          </Button>
        ))}
      </motion.div>

      {/* Sort buttons */}
      <motion.div variants={fadeUp} className="flex gap-2">
        {([["created_at", "Data"], ["lead_score", "Score"], ["name", "Nome"]] as [SortField, string][]).map(([field, label]) => (
          <Button key={field} variant="ghost" size="sm" className={`rounded-full text-[10px] h-7 gap-1 ${sortField === field ? "text-primary" : ""}`} onClick={() => toggleSort(field)}>
            {sortField === field ? (sortAsc ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />) : null}
            {label}
          </Button>
        ))}
        <span className="text-[10px] text-muted-foreground ml-auto self-center">{filtered.length} resultados</span>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map(i => <LeadCardSkeleton key={i} />)}</div>
      ) : viewMode === "compact" ? (
        /* ── COMPACT VIEW ── */
        <div className="glass-card overflow-hidden divide-y divide-border/30">
          {filtered.map((client) => (
            <motion.div
              key={client.id}
              variants={fadeUp}
              className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer ${selectedIds.has(client.id) ? "bg-primary/5" : ""}`}
              onClick={() => selectMode ? toggleSelect(client.id) : navigate(`/admin/client/${client.id}`)}
            >
              {selectMode && (
                <Checkbox
                  checked={selectedIds.has(client.id)}
                  onCheckedChange={() => toggleSelect(client.id)}
                  onClick={e => e.stopPropagation()}
                />
              )}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${tempBadge[client.temperature]}`}>
                {client.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{client.name}</p>
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 hidden sm:inline ${sourceBadge[client.source || "funnel"]}`}>
                {sourceLabel[client.source || ""] || client.source || "Funil"}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0 hidden md:inline">
                {STAGE_LABELS[client.pipeline_stage] || client.pipeline_stage}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0 w-8 text-right">{client.lead_score}</span>
              <CadenceBadge info={cadenceBadges?.[client.id]} compact />
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${tempBadge[client.temperature]}`}>
                {tempLabel[client.temperature]}
              </span>
              <div className="flex gap-1 shrink-0">
                {client.phone && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full" onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/55${client.phone?.replace(/\D/g, "")}`); }}>
                    <MessageCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full" onClick={(e) => { e.stopPropagation(); navigate(`/admin/client/${client.id}`); }}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <EmptyState
              icon={Search}
              title={search || hasActiveFilters ? "Nenhum lead encontrado" : "Nenhum lead ainda"}
              description={search || hasActiveFilters ? "Tente ajustar seus filtros ou termos de busca." : "Compartilhe o funil de captura para começar a receber leads!"}
              actionLabel={search || hasActiveFilters ? "Limpar filtros" : "Copiar link do funil"}
              onAction={search || hasActiveFilters ? clearFilters : () => {
                navigator.clipboard.writeText(`${window.location.origin}/chat`);
                toast.success("Link copiado!");
              }}
            />
          )}
        </div>
      ) : (
        /* ── EXPANDED VIEW ── */
        <div className="space-y-3">
          {filtered.map((client) => (
            <motion.div key={client.id} variants={fadeUp}>
              <SwipeableLeadCard
                onWhatsApp={client.phone ? () => window.open(`https://wa.me/55${client.phone?.replace(/\D/g, "")}`) : undefined}
                onView={() => navigate(`/admin/client/${client.id}`)}
                disabled={selectMode}
              >
              <div className={`glass-card-hover p-4 border-l-4 ${tempStyles[client.temperature]} ${selectedIds.has(client.id) ? "ring-1 ring-primary/50 bg-primary/5" : ""}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  {selectMode && (
                    <Checkbox
                      checked={selectedIds.has(client.id)}
                      onCheckedChange={() => toggleSelect(client.id)}
                      className="mt-0.5"
                    />
                  )}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${tempBadge[client.temperature]}`}>
                    {client.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{client.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{client.interest || "Sem interesse definido"}</p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tempBadge[client.temperature]}`}>
                    {tempLabel[client.temperature]}
                  </span>
                  <p className="text-[10px] text-muted-foreground">{new Date(client.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${sourceBadge[client.source || "funnel"]}`}>
                  {client.source || "funnel"}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {STAGE_LABELS[client.pipeline_stage] || client.pipeline_stage}
                </span>
                <CadenceBadge info={cadenceBadges?.[client.id]} />
                <span className="text-[9px] text-muted-foreground font-mono ml-auto">{client.lead_score}pts</span>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {client.phone && (
                  <>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" className="rounded-full text-xs gap-1 flex-1 h-8">
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                          <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-2" align="start">
                        <p className="text-[10px] font-medium text-muted-foreground px-2 py-1 uppercase tracking-wider">Enviar com template</p>
                        <button
                          onClick={() => sendWhatsApp(client, `Fala ${client.name.split(" ")[0]}! Aqui é da Arsenal Motors 🏍️ Vi que você tem interesse em ${(client.interest || "motos").toLowerCase()}. Posso te ajudar?`)}
                          className="w-full text-left px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <p className="text-xs font-medium">💬 1° Contato</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">Mensagem padrão de primeiro contato</p>
                        </button>
                        {(templates || []).slice(0, 5).map(t => (
                          <button
                            key={t.id}
                            onClick={() => sendWhatsApp(client, t.message)}
                            className="w-full text-left px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <p className="text-xs font-medium">{t.emoji} {t.title}</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-1">{replaceVars(t.message, client)}</p>
                          </button>
                        ))}
                        <div className="border-t border-border/30 mt-1 pt-1">
                          <button
                            onClick={() => {
                              const phone = client.phone?.replace(/\D/g, "");
                              window.open(`https://wa.me/55${phone}`);
                            }}
                            className="w-full text-left px-2 py-2 rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <p className="text-xs font-medium text-muted-foreground">Abrir sem mensagem</p>
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button size="sm" variant="outline" className="rounded-full text-xs gap-1 h-8" onClick={() => window.open(`tel:${client.phone?.replace(/\D/g, "")}`)}>
                      <Phone className="w-3.5 h-3.5" /> Ligar
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" className="rounded-full text-xs gap-1 h-8" onClick={() => navigate(`/admin/calendar?client=${client.id}&name=${encodeURIComponent(client.name)}`)}>
                  <CalendarPlus className="w-3.5 h-3.5" /> Agendar
                </Button>
                <Button size="sm" variant="ghost" className="rounded-full text-xs gap-1 h-8" onClick={() => navigate(`/admin/client/${client.id}`)}>
                  <Eye className="w-3.5 h-3.5" /> Ver
                </Button>
                <Button size="sm" variant="ghost" className="rounded-full text-xs gap-1 h-8 px-2" onClick={() => copyMsg(client)}>
                  {copiedId === client.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>
              </div>
              {/* Swipe hint - mobile only, first card */}
              </SwipeableLeadCard>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <EmptyState
              icon={Search}
              title={search || hasActiveFilters ? "Nenhum lead encontrado" : "Nenhum lead ainda"}
              description={search || hasActiveFilters ? "Tente ajustar seus filtros ou termos de busca." : "Compartilhe o funil de captura para começar a receber leads!"}
              actionLabel={search || hasActiveFilters ? "Limpar filtros" : "Copiar link do funil"}
              onAction={search || hasActiveFilters ? clearFilters : () => {
                navigator.clipboard.writeText(`${window.location.origin}/chat`);
                toast.success("Link copiado!");
              }}
            />
          )}
        </div>
      )}

      <MergeLeadsDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        selectedLeads={selectedLeads}
        onComplete={exitSelectMode}
      />

    </motion.div>
  );
};

export default AdminLeads;
