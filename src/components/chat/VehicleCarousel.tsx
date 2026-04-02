import { useRef } from "react";
import { motion } from "framer-motion";
import { Car, ChevronLeft, ChevronRight } from "lucide-react";
import VehicleCard from "./VehicleCard";
import type { StockVehicle } from "./types";

const VehicleCarousel = ({ vehicles }: { vehicles: StockVehicle[] }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    scrollContainerRef.current?.scrollBy({
      left: direction === "left" ? -240 : 240,
      behavior: "smooth",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 pl-10"
    >
      <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
        <Car className="w-3.5 h-3.5 text-primary" />
        <span className="font-medium">Veículos do estoque</span>
        <span>• {vehicles.length} opções</span>
      </div>
      <div className="relative">
        {vehicles.length > 2 && (
          <>
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 border border-border/50 flex items-center justify-center shadow-sm hover:bg-accent transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 border border-border/50 flex items-center justify-center shadow-sm hover:bg-accent transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
        <div
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 px-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {vehicles.map((v, i) => (
            <VehicleCard key={`${v.brand}-${v.model}-${i}`} vehicle={v} />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default VehicleCarousel;
