import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListOrdered, CalendarPlus, Trash2, RefreshCw, CheckSquare, Layers } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type QueueItem = any;
type StockVehicle = {
  id: string;
  brand: string;
  model: string;
  year: number | null;
  local_bot_id: string | null;
};

export const PostingQueueEnhanced = ({
  queueItems,
  stockVehicles,
}: {
  queueItems: QueueItem[] | undefined;
  stockVehicles: StockVehicle[] | undefined;
}) => {
  const qc = useQueryClient();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [scheduleTime, setScheduleTime] = useState("");

  const schedulePosting = useMutation({
    mutationFn: async ({ vehicleIds, scheduledFor }: { vehicleIds: string[]; scheduledFor: string | null }) => {
      const items = vehicleIds.map((vehicleId) => {
        const vehicle = stockVehicles?.find((v) => v.id === vehicleId);
        if (!vehicle?.local_bot_id) throw new Error(`Veículo sem local_bot_id: ${vehicleId}`);
        return {
          vehicle_id: vehicleId,
          local_bot_id: vehicle.local_bot_id,
          scheduled_for: scheduledFor || new Date().toISOString(),
        };
      });
      const { error } = await supabase.from("bot_posting_queue" as any).insert(items as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posting-queue"] });
      setScheduleOpen(false);
      setSelectedVehicles([]);
      setScheduleTime("");
      toast.success("Postagens agendadas!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeQueueItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bot_posting_queue" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posting-queue"] });
      toast.success("Removido da fila!");
    },
  });

  const batchRemove = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const { error } = await supabase.from("bot_posting_queue" as any).delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posting-queue"] });
      setSelectedIds(new Set());
      setBatchMode(false);
      toast.success("Itens removidos!");
    },
  });

  const batchRetry = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const { error } = await supabase
          .from("bot_posting_queue" as any)
          .update({ status: "pending", error_msg: null, posted_at: null } as any)
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["posting-queue"] });
      setSelectedIds(new Set());
      setBatchMode(false);
      toast.success("Itens reagendados!");
    },
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const pendingItems = queueItems?.filter((q) => q.status === "pending") || [];
  const errorItems = queueItems?.filter((q) => q.status === "error") || [];

  const toggleVehicle = (id: string) => {
    setSelectedVehicles((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-primary" />
            Fila de Postagem
            <Badge variant="secondary" className="text-xs">
              {pendingItems.length} pendentes
            </Badge>
          </CardTitle>
          <div className="flex gap-1">
            {batchMode && selectedIds.size > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => {
                    const errorSelected = Array.from(selectedIds).filter((id) =>
                      queueItems?.find((q) => q.id === id && q.status === "error")
                    );
                    if (errorSelected.length) batchRetry.mutate(errorSelected);
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Reagendar ({Array.from(selectedIds).filter((id) => queueItems?.find((q) => q.id === id && q.status === "error")).length})
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => {
                    const pendingSelected = Array.from(selectedIds).filter((id) =>
                      queueItems?.find((q) => q.id === id && q.status === "pending")
                    );
                    if (pendingSelected.length) batchRemove.mutate(pendingSelected);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remover ({Array.from(selectedIds).filter((id) => queueItems?.find((q) => q.id === id && (q.status === "pending" || q.status === "error"))).length})
                </Button>
              </>
            )}
            <Button
              variant={batchMode ? "secondary" : "ghost"}
              size="sm"
              className="gap-1 text-xs"
              onClick={() => { setBatchMode(!batchMode); setSelectedIds(new Set()); }}
            >
              <CheckSquare className="w-3.5 h-3.5" /> Lote
            </Button>
            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <CalendarPlus className="w-3.5 h-3.5" /> Agendar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Agendar Postagens
                  </DialogTitle>
                  <DialogDescription>Selecione um ou mais veículos para publicar no Marketplace</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Veículos *</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => {
                          if (selectedVehicles.length === (stockVehicles?.length || 0)) {
                            setSelectedVehicles([]);
                          } else {
                            setSelectedVehicles(stockVehicles?.map((v) => v.id) || []);
                          }
                        }}
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        {selectedVehicles.length === (stockVehicles?.length || 0) ? "Desmarcar todos" : "Selecionar todos"}
                      </Button>
                    </div>
                    <ScrollArea className="h-[200px] rounded-md border p-2">
                      {stockVehicles?.map((v) => (
                        <div
                          key={v.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent ${selectedVehicles.includes(v.id) ? "bg-primary/10" : ""}`}
                          onClick={() => toggleVehicle(v.id)}
                        >
                          <Checkbox checked={selectedVehicles.includes(v.id)} />
                          <span className="text-sm">[{v.local_bot_id}] {v.brand} {v.model} {v.year}</span>
                        </div>
                      ))}
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground">{selectedVehicles.length} de {stockVehicles?.length || 0} selecionados</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Horário (opcional — vazio = agora)</Label>
                    <Input
                      type="datetime-local"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={!selectedVehicles.length || schedulePosting.isPending}
                    onClick={() => schedulePosting.mutate({
                      vehicleIds: selectedVehicles,
                      scheduledFor: scheduleTime ? new Date(scheduleTime).toISOString() : null,
                    })}
                  >
                    {schedulePosting.isPending ? "Agendando..." : `Agendar ${selectedVehicles.length} veículo(s)`}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <Table>
            <TableHeader>
              <TableRow>
                {batchMode && <TableHead className="w-[40px]"></TableHead>}
                <TableHead>ID Bot</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Agendado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!queueItems?.length ? (
                <TableRow>
                  <TableCell colSpan={batchMode ? 6 : 5} className="text-center text-muted-foreground py-8">
                    <ListOrdered className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Fila vazia
                  </TableCell>
                </TableRow>
              ) : (
                queueItems.map((item) => {
                  const sv = item.stock_vehicles;
                  return (
                    <TableRow
                      key={item.id}
                      className={item.status === "error" ? "bg-destructive/5" : item.status === "posted" ? "bg-green-500/5" : ""}
                    >
                      {batchMode && (
                        <TableCell>
                          {(item.status === "pending" || item.status === "error") && (
                            <Checkbox
                              checked={selectedIds.has(item.id)}
                              onCheckedChange={() => toggleSelect(item.id)}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-xs">{item.local_bot_id}</TableCell>
                      <TableCell className="text-sm">
                        {sv ? `${sv.brand} ${sv.model} ${sv.year}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(item.scheduled_for), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={item.status === "posted" ? "default" : item.status === "error" ? "destructive" : "secondary"}
                          className="text-xs capitalize"
                        >
                          {item.status === "posted" ? "✓ Publicado" : item.status === "error" ? `❌ Erro` : "⏳ Pendente"}
                        </Badge>
                        {item.status === "error" && item.error_msg && (
                          <p className="text-[10px] text-destructive mt-0.5 truncate max-w-[150px]">{item.error_msg}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.status === "pending" && !batchMode && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeQueueItem.mutate(item.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {item.status === "error" && !batchMode && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary"
                            onClick={() => batchRetry.mutate([item.id])}
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default PostingQueueEnhanced;
