import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Activity, CheckCircle2, XCircle, MessageSquare, RefreshCw, Download, Filter, Search, ExternalLink, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type BotLog = {
  id: string;
  bot_config_id: string;
  event_type: string;
  platform: string;
  contact_name: string | null;
  message_in: string | null;
  message_out: string | null;
  lead_created: boolean;
  client_id: string | null;
  error: string | null;
  created_at: string;
};

type BotConfig = {
  id: string;
  seller_name: string;
};

export const BotLogsEnhanced = ({
  logs,
  configs,
  selectedBot,
  onSelectBot,
  onRefresh,
}: {
  logs: BotLog[] | undefined;
  configs: BotConfig[] | undefined;
  selectedBot: string | undefined;
  onSelectBot: (id: string | undefined) => void;
  onRefresh: () => void;
}) => {
  const [eventFilter, setEventFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [detailLog, setDetailLog] = useState<BotLog | null>(null);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter((log) => {
      if (eventFilter !== "all" && log.event_type !== eventFilter) return false;
      if (statusFilter === "error" && !log.error) return false;
      if (statusFilter === "success" && log.error) return false;
      if (statusFilter === "lead" && !log.lead_created) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !(log.contact_name?.toLowerCase().includes(q) ||
            log.message_in?.toLowerCase().includes(q) ||
            log.message_out?.toLowerCase().includes(q) ||
            log.error?.toLowerCase().includes(q))
        ) return false;
      }
      if (dateFilter) {
        const logDate = format(new Date(log.created_at), "yyyy-MM-dd");
        if (logDate !== dateFilter) return false;
      }
      return true;
    });
  }, [logs, eventFilter, statusFilter, searchQuery, dateFilter]);

  const eventTypes = useMemo(() => {
    const types = new Set(logs?.map((l) => l.event_type) || []);
    return Array.from(types);
  }, [logs]);

  const exportCSV = () => {
    const headers = ["Data/Hora", "Tipo", "Contato", "Mensagem Entrada", "Mensagem Saída", "Lead Criado", "Erro"];
    const rows = filteredLogs.map((l) => [
      format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss"),
      l.event_type,
      l.contact_name || "",
      l.message_in || "",
      l.message_out || "",
      l.lead_created ? "Sim" : "Não",
      l.error || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bot-logs-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredLogs.length} registros exportados!`);
  };

  const hasActiveFilters = eventFilter !== "all" || statusFilter !== "all" || searchQuery || dateFilter;

  const clearFilters = () => {
    setEventFilter("all");
    setStatusFilter("all");
    setSearchQuery("");
    setDateFilter("");
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Logs em Tempo Real
                <Badge variant="secondary" className="text-xs">
                  {filteredLogs.length} registros
                </Badge>
              </CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1 text-xs">
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
                <Button variant="ghost" size="sm" onClick={onRefresh} className="gap-1 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[150px]">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar contato, mensagem..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Select value={selectedBot || "all"} onValueChange={(v) => onSelectBot(v === "all" ? undefined : v)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Bot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os bots</SelectItem>
                  {configs?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.seller_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos tipos</SelectItem>
                  {eventTypes.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">✓ Sucesso</SelectItem>
                  <SelectItem value="error">❌ Erros</SelectItem>
                  <SelectItem value="lead">🎯 Com lead</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-[140px] h-8 text-xs"
              />
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1 text-xs text-muted-foreground">
                  <X className="w-3 h-3" /> Limpar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="hidden md:table-cell">Mensagem</TableHead>
                  <TableHead className="text-center">Lead?</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filteredLogs.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      {hasActiveFilters ? "Nenhum log encontrado com esses filtros" : "Nenhum log registrado ainda"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow
                      key={log.id}
                      className={`cursor-pointer hover:bg-accent/50 ${log.error ? "bg-destructive/5" : log.lead_created ? "bg-green-500/5" : ""}`}
                      onClick={() => setDetailLog(log)}
                    >
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.event_type === "error" ? "destructive" : "secondary"} className="text-xs capitalize">
                          {log.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium truncate max-w-[120px]">{log.contact_name || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground truncate max-w-[200px]">
                        {log.message_in || log.message_out || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.lead_created ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell>
                        {log.error ? (
                          <span className="text-xs text-destructive truncate block max-w-[150px]" title={log.error}>
                            ❌ {log.error}
                          </span>
                        ) : (
                          <span className="text-xs text-green-600">✓ OK</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Detalhes do Log
            </SheetTitle>
          </SheetHeader>
          {detailLog && (
            <div className="space-y-4 mt-4">
              <DetailField label="Data/Hora" value={format(new Date(detailLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })} />
              <DetailField label="Tipo de Evento" value={detailLog.event_type} />
              <DetailField label="Plataforma" value={detailLog.platform} />
              <DetailField label="Contato" value={detailLog.contact_name || "Não identificado"} />
              <DetailField label="Lead Criado" value={detailLog.lead_created ? "✅ Sim" : "❌ Não"} />

              {detailLog.message_in && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Mensagem Recebida</span>
                  <div className="p-3 rounded-lg bg-accent text-sm whitespace-pre-wrap">{detailLog.message_in}</div>
                </div>
              )}

              {detailLog.message_out && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Resposta Enviada</span>
                  <div className="p-3 rounded-lg bg-primary/10 text-sm whitespace-pre-wrap">{detailLog.message_out}</div>
                </div>
              )}

              {detailLog.error && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-destructive">Erro</span>
                  <div className="p-3 rounded-lg bg-destructive/10 text-sm text-destructive whitespace-pre-wrap">{detailLog.error}</div>
                </div>
              )}

              {detailLog.client_id && (
                <DetailField label="ID do Lead" value={detailLog.client_id} mono />
              )}

              <DetailField label="Bot Config ID" value={detailLog.bot_config_id} mono />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

const DetailField = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="space-y-0.5">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <p className={`text-sm ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
  </div>
);

export default BotLogsEnhanced;
