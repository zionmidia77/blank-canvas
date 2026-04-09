import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FolderOpen, FolderPlus, Trash2, Upload, ArrowLeft, Image as ImageIcon, Loader2, X,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BUCKET = "veiculos";

const VehiclePhotoManager = ({ open, onOpenChange }: Props) => {
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // 1. List all vehicles from vehicle_foto_rotacao
  const { data: vehicles = [], isLoading: loadingVehicles } = useQuery({
    queryKey: ["foto-rotacao-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_foto_rotacao")
        .select("*")
        .order("vehicle_id");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const currentVehicle = vehicles.find((v) => v.vehicle_id === selectedVehicle);
  const folders: string[] = currentVehicle
    ? (currentVehicle.pastas as string[] ?? [])
    : [];

  // 2. List photos in a folder
  const { data: photos = [], isLoading: loadingPhotos } = useQuery({
    queryKey: ["folder-photos", selectedVehicle, selectedFolder],
    queryFn: async () => {
      const path = `${selectedVehicle}/${selectedFolder}`;
      const { data, error } = await supabase.storage.from(BUCKET).list(path);
      if (error) throw error;
      return (data || [])
        .filter((f) => f.name && !f.name.startsWith("."))
        .map((f) => ({
          name: f.name,
          url: supabase.storage.from(BUCKET).getPublicUrl(`${path}/${f.name}`).data.publicUrl,
        }));
    },
    enabled: !!selectedVehicle && !!selectedFolder,
  });

  // 3. Upload photos
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !selectedVehicle || !selectedFolder) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fileName = `${crypto.randomUUID()}.jpg`;
        const path = `${selectedVehicle}/${selectedFolder}/${fileName}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          upsert: true,
          contentType: file.type || "image/jpeg",
        });
        if (error) throw error;
      }
      toast.success(`${files.length} foto(s) enviada(s)!`);
      queryClient.invalidateQueries({ queryKey: ["folder-photos", selectedVehicle, selectedFolder] });
    } catch (err: any) {
      toast.error(`Erro no upload: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // 4. Delete photo
  const deletePhotoMut = useMutation({
    mutationFn: async (name: string) => {
      const path = `${selectedVehicle}/${selectedFolder}/${name}`;
      const { error } = await supabase.storage.from(BUCKET).remove([path]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folder-photos", selectedVehicle, selectedFolder] });
      toast.success("Foto excluída!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 5. Add folder
  const addFolder = async () => {
    if (!newFolderName.trim() || !selectedVehicle) return;
    const updated = [...folders, newFolderName.trim()];
    const { error } = await supabase
      .from("vehicle_foto_rotacao")
      .update({ pastas: updated as any })
      .eq("vehicle_id", selectedVehicle);
    if (error) { toast.error(error.message); return; }
    setNewFolderName("");
    queryClient.invalidateQueries({ queryKey: ["foto-rotacao-vehicles"] });
    toast.success("Pasta criada!");
  };

  // 6. Delete folder (remove from array + delete storage files)
  const deleteFolder = async (folder: string) => {
    if (!confirm(`Excluir a pasta "${folder}" e todas as fotos?`)) return;
    if (!selectedVehicle) return;
    // delete all files in folder
    const path = `${selectedVehicle}/${folder}`;
    const { data: files } = await supabase.storage.from(BUCKET).list(path);
    if (files?.length) {
      await supabase.storage.from(BUCKET).remove(files.map((f) => `${path}/${f.name}`));
    }
    // update pastas array
    const updated = folders.filter((f) => f !== folder);
    await supabase
      .from("vehicle_foto_rotacao")
      .update({ pastas: updated as any })
      .eq("vehicle_id", selectedVehicle);
    if (selectedFolder === folder) setSelectedFolder(null);
    queryClient.invalidateQueries({ queryKey: ["foto-rotacao-vehicles"] });
    toast.success("Pasta excluída!");
  };

  const goBack = () => {
    if (selectedFolder) setSelectedFolder(null);
    else if (selectedVehicle) setSelectedVehicle(null);
  };

  const title = selectedFolder
    ? `${selectedVehicle} / ${selectedFolder}`
    : selectedVehicle
      ? `Pastas de ${selectedVehicle}`
      : "Gerenciar Fotos (Bot)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(selectedVehicle || selectedFolder) && (
              <Button size="icon" variant="ghost" onClick={goBack} className="h-7 w-7">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {title}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          {/* Level 1: Vehicle list */}
          {!selectedVehicle && (
            <div className="space-y-2">
              {loadingVehicles ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : vehicles.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Nenhum veículo com rotação de fotos cadastrado.</p>
              ) : (
                vehicles.map((v) => (
                  <button
                    key={v.vehicle_id}
                    onClick={() => setSelectedVehicle(v.vehicle_id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition text-left"
                  >
                    <FolderOpen className="h-5 w-5 text-primary" />
                    <span className="font-medium">{v.vehicle_id}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {(v.pastas as string[] ?? []).length} pasta(s)
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Level 2: Folder list */}
          {selectedVehicle && !selectedFolder && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da nova pasta..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addFolder()}
                />
                <Button onClick={addFolder} disabled={!newFolderName.trim()} className="gap-1">
                  <FolderPlus className="h-4 w-4" /> Criar
                </Button>
              </div>
              {folders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma pasta. Crie uma acima.</p>
              ) : (
                folders.map((folder) => (
                  <div key={folder} className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedFolder(folder)}
                      className="flex-1 flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition text-left"
                    >
                      <FolderOpen className="h-5 w-5 text-primary" />
                      <span className="font-medium">{folder}</span>
                    </button>
                    <Button size="icon" variant="destructive" className="h-9 w-9 shrink-0" onClick={() => deleteFolder(folder)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Level 3: Photo grid */}
          {selectedVehicle && selectedFolder && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Enviando..." : "Upload de fotos"}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
              </div>

              {loadingPhotos ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : photos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="h-10 w-10 mx-auto mb-2" />
                  <p>Nenhuma foto nesta pasta.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.name} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
                      <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" loading="lazy" />
                      <button
                        onClick={() => {
                          if (confirm("Excluir esta foto?")) deletePhotoMut.mutate(photo.name);
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
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default VehiclePhotoManager;
