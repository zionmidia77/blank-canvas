import { useState } from "react";
import { Camera, Car, ChevronLeft, ChevronRight } from "lucide-react";
import type { StockVehicle } from "./types";

const VehicleCard = ({ vehicle }: { vehicle: StockVehicle }) => {
  const [photoIdx, setPhotoIdx] = useState(0);
  const photos = vehicle.photos || [];
  const hasPhotos = photos.length > 0;

  return (
    <div className="min-w-[220px] max-w-[240px] rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden shrink-0 snap-center">
      <div className="relative h-32 bg-gradient-to-br from-primary/10 to-primary/5 overflow-hidden">
        {hasPhotos ? (
          <>
            <img src={photos[photoIdx]} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full h-full object-cover" />
            {photos.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => (i > 0 ? i - 1 : photos.length - 1)); }}
                  className="absolute left-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setPhotoIdx(i => (i < photos.length - 1 ? i + 1 : 0)); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {photos.map((_, i) => (
                    <span key={i} className={`w-1 h-1 rounded-full ${i === photoIdx ? "bg-white" : "bg-white/50"}`} />
                  ))}
                </div>
                <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-black/50 text-white text-[9px] flex items-center gap-0.5">
                  <Camera className="h-2.5 w-2.5" /> {photos.length}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Car className="w-12 h-12 text-primary/60" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <h4 className="font-semibold text-sm text-foreground leading-tight">
          {vehicle.brand} {vehicle.model}
        </h4>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {vehicle.year && <span>{vehicle.year}</span>}
          {vehicle.km != null && <span>• {vehicle.km.toLocaleString("pt-BR")} km</span>}
          {vehicle.color && <span>• {vehicle.color}</span>}
        </div>
        <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
          {vehicle.condition}
        </span>
        <p className="text-base font-bold text-primary">
          R$ {Number(vehicle.price).toLocaleString("pt-BR")}
        </p>
        {vehicle.features && vehicle.features.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {vehicle.features.slice(0, 3).map((f, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-accent/50 text-accent-foreground">
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleCard;
