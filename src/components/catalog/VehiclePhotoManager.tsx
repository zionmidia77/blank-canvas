import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Camera, Upload, Loader2, X, Image as ImageIcon,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId?: string | null; // local_bot_id
}

const DAYS = [1, 2, 3, 4, 5, 6];
const SUPABASE_URL = "https://baxpayrwcfdoapnihwhk.supabase.co";

async function callVehiclePhotos(method: string, params: Record<string, any>) {
  if (method === "GET") {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/vehicle-photos?${qs}`, {
      headers: {
        apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJheHBheXJ3Y2Zkb2Fwbmlod2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTkxODcsImV4cCI6MjA5MDczNTE4N30.7KopOVyGviDdRIFb6R-xkp5kHcIPvzukoPcrY2wY_f8",
      },
    });
    return res.json();
  }

  if (method === "POST") {
    const formData = new FormData();
    formData.append("vehicle_id", params.vehicle_id);
    formData.append("day", params.day);
    formData.append("file", params.file);
    const res = await fetch(`${SUPABASE_URL}/functions/v1/vehicle-photos`, {
      method: "POST",
      headers: {
        apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJheHBheXJ3Y2Zkb2Fwbmlod2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTkxODcsImV4cCI6MjA5MDczNTE4N30.7KopOVyGviDdRIFb6R-xkp5kHcIPvzukoPcrY2wY_f8",
      },
      body: formData,
    });
    return res.json();
  }

  if (method === "DELETE") {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/vehicle-photos`, {
      method: "DELETE",
      headers: {
        apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJheHBheXJ3Y2Zkb2Fwbmlod2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTkxODcsImV4cCI6MjA5MDczNTE4N30.7KopOVyGviDdRIFb6R-xkp5kHcIPvzukoPcrY2wY_f8",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
    return res.json();
  }
}

const VehiclePhotoManager = ({ open, onOpenChange, vehicleId }: Props) => {
  const [activeDay, setActiveDay] = useState("1");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch vehicle_foto_rotacao record
  const { data: rotacao } = useQuery({
    queryKey: ["foto-rotacao", vehicleId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicle_foto_rotacao")
        .select("*")
        .eq("vehicle_id", vehicleId!)
        .maybeSingle();
      return data;
    },
    enabled: open && !!vehicleId,
  });

  const indiceAtual = rotacao?.indice_atual ?? 0;

  // Fetch photo counts for all 6 days
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

  // Fetch photos for active day
  const { data: photos = [], isLoading: loadingPhotos } = useQuery({
    queryKey: ["foto-day-photos", vehicleId, activeDay],
    queryFn: async () => {
      const result = await callVehiclePhotos("GET", { vehicle_id: vehicleId, day: activeDay });
      return result?.ok ? (result.files || []) : [];
    },
    enabled: open && !!vehicleId,
  });

  // Sync vehicle_foto_rotacao after changes
  const syncRotacao = async () => {
    if (!vehicleId) return;
    const activeDays: string[] = [];
    for (const day of DAYS) {
      const result = await callVehiclePhotos("GET", { vehicle_id: vehicleId, day: String(day) });
      if (result?.ok && result.files?.length > 0) {
        activeDays.push(`${vehicleId}/local_${day}`);
      }
    }

    const { data: existing } = await supabase
      .from("vehicle_foto_rotacao")
      .select("indice_atual")
      .eq("vehicle_id", vehicleId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("vehicle_foto_rotacao")
        .update({ pastas: activeDays as any, updated_at: new Date().toISOString() })
        .eq("vehicle_id", vehicleId);
    } else {
      await supabase
        .from("vehicle_foto_rotacao")
        .insert({ vehicle_id: vehicleId, pastas: activeDays as any, indice_atual: 0 });
    }

    queryClient.invalidateQueries({ queryKey: ["foto-rotacao", vehicleId] });
    queryClient.invalidateQueries({ queryKey: ["foto-day-counts", vehicleId] });
  };

  // Upload handler
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

  // Delete handler
  const deletePhoto = async (filename: string) => {
    if (!vehicleId) return;
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
      toast.error(`Erro: ${err.message}`);
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
                <div className="flex gap-2">
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
                </div>

                {loadingPhotos ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : photos.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Nenhuma foto no Dia {day}.</p>
                    <p className="text-xs">Clique em "Adicionar fotos" para enviar.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {photos.map((photo: any) => (
                      <div key={photo.name} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                        <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" loading="lazy" />
                        <button
                          onClick={() => {
                            if (confirm("Excluir esta foto?")) deletePhoto(photo.name);
                          }}
                          className="absolute top-1 right-1 p-1.5 rounded-md bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
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
