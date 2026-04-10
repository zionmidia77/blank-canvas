import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Camera, Upload, Loader2, X, Image as ImageIcon, GripVertical, Star,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** local_bot_id do veículo, ex: "v1", "v13" */
  vehicleId?: string | null;
}

interface VehiclePhotoFile {
  name: string;
  url: string;
}

interface VehicleFotoRotacaoRecord {
  vehicle_id: string;
  pastas: unknown;
  indice_atual: number;
  updated_at: string | null;
  ordem?: Record<string, string[]> | null;
}

const DAYS = [1, 2, 3, 4, 5, 6];
const SUPABASE_URL = "https://baxpayrwcfdoapnihwhk.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJheHBheXJ3Y2Zkb2Fwbmlod2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTkxODcsImV4cCI6MjA5MDczNTE4N30.7KopOVyGviDdRIFb6R-xkp5kHcIPvzukoPcrY2wY_f8";

async function callVehiclePhotos(method: string, params: Record<string, any>) {
  const headers: Record<string, string> = { apikey: ANON_KEY };

  if (method === "GET") {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/vehicle-photos?${qs}`, { headers });
    return res.json();
  }

  if (method === "POST") {
    const formData = new FormData();
    formData.append("vehicle_id", params.vehicle_id);
    formData.append("day", params.day);
    formData.append("file", params.file);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/vehicle-photos`, {
      method: "POST",
      headers,
      body: formData,
    });
    return res.json();
  }

  if (method === "DELETE") {
    const qs = new URLSearchParams({
      vehicle_id: params.vehicle_id,
      day: params.day,
      filename: params.filename,
    }).toString();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/vehicle-photos?${qs}`, {
      method: "DELETE",
      headers,
    });
    return res.json();
  }
}

const getFolderKey = (vehicleId: string, day: string | number) => `${vehicleId}/local_${day}`;

const normalizeOrderMap = (value: unknown): Record<string, string[]> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string[]>>(
    (acc, [folderKey, names]) => {
      if (Array.isArray(names)) {
        const validNames = names.filter(
          (name): name is string => typeof name === "string" && name.length > 0
        );

        if (validNames.length > 0) {
          acc[folderKey] = validNames;
        }
      }

      return acc;
    },
    {}
  );
};

const sortPhotosByOrder = (files: VehiclePhotoFile[], savedOrder: string[] = []) => {
  const alphabetical = [...files].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
  );

  if (!savedOrder.length) return alphabetical;

  const orderIndex = new Map(savedOrder.map((name, index) => [name, index]));

  return alphabetical.sort((a, b) => {
    const indexA = orderIndex.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const indexB = orderIndex.get(b.name) ?? Number.MAX_SAFE_INTEGER;

    if (indexA !== indexB) return indexA - indexB;

    return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
  });
};

const VehiclePhotoManager = ({ open, onOpenChange, vehicleId }: Props) => {
  const [activeDay, setActiveDay] = useState("1");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: rotacao } = useQuery<VehicleFotoRotacaoRecord | null>({
    queryKey: ["foto-rotacao", vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_foto_rotacao")
        .select("*")
        .eq("vehicle_id", vehicleId!)
        .maybeSingle();

      if (error) throw error;
      if (data) return data as unknown as VehicleFotoRotacaoRecord;

      // Auto-create if missing
      const { data: inserted, error: insertError } = await supabase
        .from("vehicle_foto_rotacao")
        .insert({ vehicle_id: vehicleId!, pastas: [] as any, indice_atual: 0 })
        .select()
        .single();

      if (insertError) throw insertError;
      return inserted as unknown as VehicleFotoRotacaoRecord;
    },
    enabled: open && !!vehicleId,
  });

  const indiceAtual = rotacao?.indice_atual ?? 0;
  const currentFolderKey = vehicleId ? getFolderKey(vehicleId, activeDay) : "";
  const photoOrderMap = useMemo(() => normalizeOrderMap(rotacao?.ordem), [rotacao?.ordem]);

  const { data: dayCounts = {} } = useQuery({
    queryKey: ["foto-day-counts", vehicleId],
    queryFn: async () => {
      const counts: Record<number, number> = {};
      await Promise.all(
        DAYS.map(async (day) => {
          const result = await callVehiclePhotos("GET", { vehicle_id: vehicleId, day: String(day) });
          counts[day] = result?.ok ? (result.files?.length || 0) : 0;
        })
      );
      return counts;
    },
    enabled: open && !!vehicleId,
  });

  const { data: photos = [], isLoading: loadingPhotos } = useQuery<VehiclePhotoFile[]>({
    queryKey: ["foto-day-photos", vehicleId, activeDay],
    queryFn: async () => {
      const result = await callVehiclePhotos("GET", { vehicle_id: vehicleId, day: activeDay });
      const files = result?.ok ? (result.files || []) : [];
      return sortPhotosByOrder(files, []);
    },
    enabled: open && !!vehicleId,
  });

  const orderedPhotos = useMemo(
    () => sortPhotosByOrder(photos, photoOrderMap[currentFolderKey]),
    [photos, photoOrderMap, currentFolderKey]
  );

  const syncRotacao = async () => {
    if (!vehicleId) return;
    const activeDays: string[] = [];
    for (const day of DAYS) {
      const result = await callVehiclePhotos("GET", { vehicle_id: vehicleId, day: String(day) });
      if (result?.ok && result.files?.length > 0) {
        activeDays.push(`${vehicleId}/local_${day}`);
      }
    }

    const { data: existing, error: existingError } = await supabase
      .from("vehicle_foto_rotacao")
      .select("indice_atual")
      .eq("vehicle_id", vehicleId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      const { error } = await supabase
        .from("vehicle_foto_rotacao")
        .update({ pastas: activeDays as any, updated_at: new Date().toISOString() })
        .eq("vehicle_id", vehicleId);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("vehicle_foto_rotacao")
        .insert({ vehicle_id: vehicleId, pastas: activeDays as any, indice_atual: 0 });

      if (error) throw error;
    }

    queryClient.invalidateQueries({ queryKey: ["foto-rotacao", vehicleId] });
    queryClient.invalidateQueries({ queryKey: ["foto-day-counts", vehicleId] });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !vehicleId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await callVehiclePhotos("POST", {
          vehicle_id: vehicleId,
          day: activeDay,
          file,
        });
        if (!result?.ok) throw new Error(result?.error || "Upload failed");
      }
      toast.success(`${files.length} foto(s) enviada(s)!`);
      queryClient.invalidateQueries({ queryKey: ["foto-day-photos", vehicleId, activeDay] });
      await syncRotacao();
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const deletePhoto = async (filename: string) => {
    if (!vehicleId) return;
    setDeleting(filename);
    try {
      const result = await callVehiclePhotos("DELETE", {
        vehicle_id: vehicleId,
        day: activeDay,
        filename,
      });
      if (!result?.ok) throw new Error(result?.error || "Delete failed");
      toast.success("Foto excluída!");
      queryClient.invalidateQueries({ queryKey: ["foto-day-photos", vehicleId, activeDay] });
      await syncRotacao();
    } catch (err: any) {
      toast.error(`Erro ao excluir: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !vehicleId) return;

    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;

    const reordered = Array.from(orderedPhotos);
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);

    const orderedNames = reordered.map((photo) => photo.name);
    const nextUpdatedAt = new Date().toISOString();
    const previousRotacao = queryClient.getQueryData<VehicleFotoRotacaoRecord | null>([
      "foto-rotacao",
      vehicleId,
    ]);
    const nextOrderMap = {
      ...normalizeOrderMap(previousRotacao?.ordem),
      [currentFolderKey]: orderedNames,
    };

    queryClient.setQueryData<VehicleFotoRotacaoRecord | null>(
      ["foto-rotacao", vehicleId],
      (old) => old
        ? { ...old, ordem: nextOrderMap, updated_at: nextUpdatedAt }
        : {
            vehicle_id: vehicleId,
            pastas: [],
            indice_atual: 0,
            updated_at: nextUpdatedAt,
            ordem: nextOrderMap,
          }
    );

    try {
      const { data, error } = await supabase
        .from("vehicle_foto_rotacao")
        .update({ ordem: nextOrderMap as any, updated_at: nextUpdatedAt } as any)
        .eq("vehicle_id", vehicleId)
        .select("vehicle_id")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { error: insertError } = await supabase
          .from("vehicle_foto_rotacao")
          .insert({
            vehicle_id: vehicleId,
            pastas: rotacao?.pastas ?? [],
            indice_atual: rotacao?.indice_atual ?? 0,
            ordem: nextOrderMap as any,
            updated_at: nextUpdatedAt,
          } as any);

        if (insertError) throw insertError;
      }

      toast.success("Ordem das fotos salva!");
      queryClient.invalidateQueries({ queryKey: ["foto-rotacao", vehicleId] });
    } catch (err: any) {
      queryClient.setQueryData(["foto-rotacao", vehicleId], previousRotacao ?? null);
      toast.error(`Erro ao salvar ordem: ${err.message}`);
    }
  };

  if (!vehicleId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Gerenciar Fotos Bot — {vehicleId}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeDay} onValueChange={setActiveDay} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
            {DAYS.map((day) => {
              const count = dayCounts[day] || 0;
              const isActive = indiceAtual === day - 1;
              return (
                <TabsTrigger
                  key={day}
                  value={String(day)}
                  className={`flex-1 min-w-[80px] flex flex-col gap-0.5 py-2 ${
                    isActive ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <span className="text-xs font-medium">Dia {day}</span>
                  <div className="flex items-center gap-1">
                    {isActive && (
                      <span className="text-[10px] text-primary font-bold">● Ativo</span>
                    )}
                    <Badge variant={count > 0 ? "default" : "secondary"} className="text-[10px] px-1 py-0">
                      {count > 0 ? `${count} foto${count > 1 ? "s" : ""}` : "Vazio"}
                    </Badge>
                  </div>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {DAYS.map((day) => (
            <TabsContent key={day} value={String(day)} className="flex-1 overflow-auto mt-3">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                    size="sm"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Enviando..." : "Adicionar fotos"}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    multiple
                    onChange={handleUpload}
                    className="hidden"
                  />
                  {orderedPhotos.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Arraste para reordenar • A 1ª foto será a capa
                    </p>
                  )}
                </div>

                {loadingPhotos ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : orderedPhotos.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhuma foto no Dia {day}.</p>
                    <p className="text-xs">Clique em "Adicionar fotos" para enviar.</p>
                  </div>
                ) : (
                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId={`photos-day-${day}`} direction="horizontal">
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className="grid grid-cols-3 gap-3"
                        >
                          {orderedPhotos.map((photo, i) => (
                            <Draggable key={photo.name} draggableId={photo.name} index={i}>
                              {(dragProvided, snapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={`relative group aspect-square rounded-lg overflow-hidden border bg-muted transition-shadow ${
                                    snapshot.isDragging ? "shadow-xl ring-2 ring-primary/50 z-50" : "border-border"
                                  }`}
                                >
                                  <img
                                    src={photo.url}
                                    alt={photo.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />

                                  {/* Cover badge */}
                                  {i === 0 && (
                                    <span className="absolute top-1 left-1 flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                                      <Star className="h-3 w-3" /> Capa
                                    </span>
                                  )}

                                  {/* Position badge */}
                                  {i > 0 && (
                                    <span className="absolute top-1 left-1 text-[10px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full bg-background/80 text-foreground font-medium">
                                      {i + 1}
                                    </span>
                                  )}

                                  {/* Drag handle */}
                                  <div
                                    {...dragProvided.dragHandleProps}
                                    className="absolute top-1 right-8 p-1 rounded-md bg-background/80 text-muted-foreground cursor-grab active:cursor-grabbing opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </div>

                                  {/* Delete button - always visible on mobile */}
                                  <button
                                    onClick={() => deletePhoto(photo.name)}
                                    disabled={deleting === photo.name}
                                    className="absolute top-1 right-1 p-1.5 rounded-md bg-destructive text-destructive-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity disabled:opacity-50"
                                  >
                                    {deleting === photo.name ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <X className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default VehiclePhotoManager;
