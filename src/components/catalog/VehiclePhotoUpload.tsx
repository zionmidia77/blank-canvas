import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Upload, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

interface Props {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  vehicleId?: string;
  coverPhoto?: string | null;
  onCoverPhotoChange?: (photo: string | null) => void;
}

const VehiclePhotoUpload = ({
  photos,
  onPhotosChange,
  vehicleId,
  coverPhoto,
  onCoverPhotoChange,
}: Props) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadSinglePhoto = async (file: File) => {
    const ext = file.name.split(".").pop();
    const fileName = `${vehicleId || "temp"}-${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from("vehicle-photos")
      .upload(fileName, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage
      .from("vehicle-photos")
      .getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const MAX_PHOTOS_PER_UPLOAD = 10;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const selected = Array.from(files);
    if (selected.length > MAX_PHOTOS_PER_UPLOAD) {
      toast.error(`Máximo de ${MAX_PHOTOS_PER_UPLOAD} fotos por vez. Você selecionou ${selected.length}.`);
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const uploadedUrls = await Promise.all(selected.map((file) => uploadSinglePhoto(file)));
      const dedupedPhotos = [...new Set([...photos, ...uploadedUrls])];
      onPhotosChange(dedupedPhotos);
      if (!coverPhoto || !dedupedPhotos.includes(coverPhoto)) {
        onCoverPhotoChange?.(dedupedPhotos[0] || null);
      }
      toast.success(`${uploadedUrls.length} foto(s) enviada(s)!`);
    } catch (error: any) {
      toast.error(`Erro ao enviar foto: ${error.message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removePhoto = (index: number) => {
    const removedPhoto = photos[index];
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
    if (removedPhoto === coverPhoto) {
      onCoverPhotoChange?.(newPhotos[0] || null);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;
    const reordered = Array.from(photos);
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    onPhotosChange(reordered);
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="photos" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="grid grid-cols-2 md:grid-cols-3 gap-4"
            >
              {photos.map((url, i) => (
                <Draggable key={url} draggableId={url} index={i}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`relative group aspect-video rounded-lg overflow-hidden border bg-card transition-shadow ${
                        snapshot.isDragging ? "shadow-xl ring-2 ring-primary/50 z-50" : "border-border"
                      }`}
                    >
                      <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />

                      {/* Drag handle */}
                      <div
                        {...dragProvided.dragHandleProps}
                        className="absolute top-2 right-2 p-1 rounded-md bg-background/80 text-muted-foreground cursor-grab active:cursor-grabbing opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      >
                        <GripVertical className="h-4 w-4" />
                      </div>

                      {/* Position badge */}
                      <span className="absolute top-2 left-2 text-[10px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full bg-background/80 text-foreground font-medium">
                        {i + 1}
                      </span>

                      {coverPhoto === url && (
                        <span className="absolute top-8 left-2 text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                          Capa
                        </span>
                      )}

                      <div className="absolute inset-x-2 bottom-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onCoverPhotoChange?.(url)}
                          className="flex-1 text-[10px] px-2 py-1 rounded-md bg-background/90 text-foreground border border-border hover:bg-accent"
                        >
                          {coverPhoto === url ? "Foto de capa" : "Usar como capa"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="p-1.5 rounded-md bg-destructive text-destructive-foreground hover:opacity-90"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              {/* Add photo button (outside draggable) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-video rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors cursor-pointer bg-card"
              >
                {uploading ? (
                  <span className="text-sm text-muted-foreground">Enviando...</span>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Adicionar fotos</span>
                  </>
                )}
              </button>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <p className="text-xs text-muted-foreground">
        Arraste as fotos para reordenar a galeria. A foto de capa aparece primeiro no catálogo público.
      </p>
    </div>
  );
};

export default VehiclePhotoUpload;
