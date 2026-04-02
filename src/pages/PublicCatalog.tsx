import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Car, MessageCircle, Filter, ChevronLeft, ChevronRight, X, ZoomIn, Camera, GitCompareArrows, Trash2, Eye, Fuel, Gauge, Palette, Calendar, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// ── Lightbox with carousel + zoom ──
const PhotoLightbox = ({
  photos,
  initialIndex,
  open,
  onClose,
}: {
  photos: string[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  const prev = useCallback(() => { setIndex(i => (i > 0 ? i - 1 : photos.length - 1)); setZoomed(false); }, [photos.length]);
  const next = useCallback(() => { setIndex(i => (i < photos.length - 1 ? i + 1 : 0)); setZoomed(false); }, [photos.length]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/95 overflow-hidden">
        <div className="relative w-full h-[85vh] flex items-center justify-center">
          {/* Close */}
          <button onClick={onClose} className="absolute top-3 right-3 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition">
            <X className="h-5 w-5" />
          </button>

          {/* Counter */}
          <div className="absolute top-3 left-3 z-50 px-3 py-1 rounded-full bg-black/50 text-white text-sm flex items-center gap-1">
            <Camera className="h-3.5 w-3.5" /> {index + 1}/{photos.length}
          </div>

          {/* Prev */}
          {photos.length > 1 && (
            <button onClick={prev} className="absolute left-2 z-40 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition">
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Image */}
          <AnimatePresence mode="wait">
            <motion.img
              key={photos[index]}
              src={photos[index]}
              alt={`Foto ${index + 1}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`max-h-full max-w-full object-contain cursor-pointer transition-transform duration-300 ${zoomed ? "scale-150" : ""}`}
              onClick={() => setZoomed(z => !z)}
            />
          </AnimatePresence>

          {/* Next */}
          {photos.length > 1 && (
            <button onClick={next} className="absolute right-2 z-40 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition">
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Zoom hint */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-black/50 text-white/70 text-xs">
            <ZoomIn className="h-3 w-3" /> Clique para {zoomed ? "reduzir" : "ampliar"}
          </div>

          {/* Thumbnails */}
          {photos.length > 1 && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[80vw] overflow-x-auto p-1">
              {photos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => { setIndex(i); setZoomed(false); }}
                  className={`flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition ${i === index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
                >
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Card thumbnail carousel ──
const CardCarousel = ({ photos, alt }: { photos: string[]; alt: string }) => {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStart = useRef<number | null>(null);
  const touchEnd = useRef<number | null>(null);
  const minSwipe = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchEnd.current = null;
    touchStart.current = e.targetTouches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEnd.current = e.targetTouches[0].clientX;
  };
  const handleTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const diff = touchStart.current - touchEnd.current;
    if (Math.abs(diff) >= minSwipe) {
      if (diff > 0) setCurrent(i => (i < photos.length - 1 ? i + 1 : 0));
      else setCurrent(i => (i > 0 ? i - 1 : photos.length - 1));
    }
    touchStart.current = null;
    touchEnd.current = null;
  };

  if (photos.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Car className="h-16 w-16 text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="relative w-full h-full group/carousel" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <img
          src={photos[current]}
          alt={alt}
          className="w-full h-full object-cover cursor-pointer transition-transform duration-300"
          onClick={() => setLightboxOpen(true)}
          loading="lazy"
        />

        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); setCurrent(i => (i > 0 ? i - 1 : photos.length - 1)); }}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white opacity-100 md:opacity-0 md:group-hover/carousel:opacity-100 transition hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setCurrent(i => (i < photos.length - 1 ? i + 1 : 0)); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white opacity-100 md:opacity-0 md:group-hover/carousel:opacity-100 transition hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Dots */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.slice(0, 7).map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
                  className={`w-2 h-2 rounded-full transition ${i === current ? "bg-white scale-125" : "bg-white/50 hover:bg-white/80"}`}
                />
              ))}
              {photos.length > 7 && (
                <span className="text-white/70 text-[10px] leading-none self-center">+{photos.length - 7}</span>
              )}
            </div>
          </>
        )}

        {/* Photo count badge */}
        {photos.length > 1 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-xs">
            <Camera className="h-3 w-3" /> {photos.length}
          </div>
        )}
      </div>

      <PhotoLightbox photos={photos} initialIndex={current} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </>
  );
};

// ── Main Page ──
const COEFS: Record<number, number> = { 12: 0.095, 24: 0.070, 36: 0.065, 48: 0.060, 60: 0.058 };
const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const PublicCatalog = () => {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [detailVehicle, setDetailVehicle] = useState<any>(null);
  const navigate = useNavigate();

  const toggleCompare = (id: string) => {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["public-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_vehicles")
        .select("id, brand, model, year, km, color, price, selling_price, condition, photos, image_url, description, features, fipe_value, fuel")
        .eq("status", "available")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const brands = [...new Set(vehicles.map((v: any) => v.brand))].sort();

  const filtered = vehicles.filter((v: any) => {
    const matchSearch = `${v.brand} ${v.model} ${v.color || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchBrand = brandFilter === "all" || v.brand === brandFilter;
    return matchSearch && matchBrand;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-8 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">🚗 Arsenal Motors</h1>
          <p className="text-primary-foreground/80 text-lg">Veículos novos e seminovos com as melhores condições</p>
          <p className="text-sm mt-2 text-primary-foreground/60">{vehicles.length} veículos disponíveis</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar veículo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as marcas</SelectItem>
              {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando catálogo...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Car className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Nenhum veículo encontrado</h3>
            <p className="text-muted-foreground">Tente buscar com outros termos</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((v: any) => {
              const allPhotos = v.image_url
                ? [v.image_url, ...(v.photos || []).filter((p: string) => p !== v.image_url)]
                : (v.photos || []);
              const displayPrice = Number(v.selling_price || v.price || 0);

              return (
                <Card key={v.id} className={`overflow-hidden hover:shadow-xl transition-shadow ${compareIds.includes(v.id) ? "ring-2 ring-primary" : ""}`}>
                  <div className="h-56 bg-muted relative overflow-hidden">
                    <CardCarousel photos={allPhotos} alt={`${v.brand} ${v.model}`} />
                    <Badge className="absolute top-3 left-3 z-10" variant={v.condition === "new" ? "default" : "secondary"}>
                      {v.condition === "new" ? "0km" : "Seminovo"}
                    </Badge>
                    {/* Compare checkbox */}
                    <div className="absolute bottom-2 right-2 z-10">
                      <button
                        onClick={() => toggleCompare(v.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition ${compareIds.includes(v.id) ? "bg-primary text-primary-foreground" : "bg-black/50 text-white hover:bg-black/70"}`}
                      >
                        <GitCompareArrows className="h-3 w-3" />
                        {compareIds.includes(v.id) ? "✓" : "Comparar"}
                      </button>
                    </div>
                  </div>

                  <CardContent className="p-5 space-y-3">
                    <div>
                      <h3 className="font-bold text-xl">{v.brand} {v.model}</h3>
                      <p className="text-sm text-muted-foreground">
                        {v.year && `${v.year}`}{v.km ? ` · ${v.km.toLocaleString()} km` : ""}{v.color ? ` · ${v.color}` : ""}
                      </p>
                    </div>

                    <div>
                      <p className="text-2xl font-bold text-primary">
                        R$ {displayPrice.toLocaleString("pt-BR")}
                      </p>
                      {v.fipe_value && (
                        <p className="text-xs text-muted-foreground mt-1">
                          FIPE: R$ {Number(v.fipe_value).toLocaleString("pt-BR")}
                        </p>
                      )}
                    </div>

                    {v.features?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {v.features.slice(0, 3).map((f: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 gap-1.5" onClick={() => setDetailVehicle({ ...v, allPhotos })}>
                        <Eye className="h-4 w-4" /> Ver detalhes
                      </Button>
                      <Button className="flex-1 gap-1.5" onClick={() => navigate(`/chat?veiculo=${encodeURIComponent(`${v.brand} ${v.model} ${v.year || ""}`)}`)}>
                        <MessageCircle className="h-4 w-4" /> Interesse
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="bg-muted py-8 px-4 mt-8 text-center">
        <h2 className="text-xl font-bold mb-2">Não encontrou o que procura?</h2>
        <p className="text-muted-foreground mb-4">Fale com nosso consultor e encontramos o veículo ideal pra você!</p>
        <Button size="lg" onClick={() => navigate("/chat")} className="gap-2">
          <MessageCircle className="h-5 w-5" /> Falar com Consultor
        </Button>
      </div>

      {/* Floating compare bar */}
      <AnimatePresence>
        {compareIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4"
          >
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5" />
              <span className="font-semibold text-sm">{compareIds.length}/3 selecionados</span>
            </div>
            <Button size="sm" variant="secondary" className="gap-1" onClick={() => setShowCompare(true)} disabled={compareIds.length < 2}>
              Comparar
            </Button>
            <button onClick={() => setCompareIds([])} className="p-1 rounded-full hover:bg-primary-foreground/20 transition">
              <Trash2 className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compare Dialog */}
      <Dialog open={showCompare} onOpenChange={setShowCompare}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5" /> Comparar Veículos
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const selected = compareIds.map(id => vehicles.find((v: any) => v.id === id)).filter(Boolean) as any[];
            if (selected.length < 2) return null;

            const rows: { label: string; values: string[]; highlight?: boolean }[] = [
              { label: "Marca / Modelo", values: selected.map(v => `${v.brand} ${v.model}`) },
              { label: "Ano", values: selected.map(v => v.year ? String(v.year) : "—") },
              { label: "Km", values: selected.map(v => v.km ? `${v.km.toLocaleString()} km` : "—") },
              { label: "Cor", values: selected.map(v => v.color || "—") },
              { label: "Condição", values: selected.map(v => v.condition === "new" ? "0km" : "Seminovo") },
              { label: "Preço", values: selected.map(v => fmt(Number(v.selling_price || v.price || 0))), highlight: true },
              { label: "FIPE", values: selected.map(v => v.fipe_value ? fmt(Number(v.fipe_value)) : "—") },
              ...Object.entries(COEFS).map(([months, coef]) => ({
                label: `Parcela ${months}x`,
                values: selected.map(v => fmt(Number(v.selling_price || v.price || 0) * coef)),
              })),
              { label: "Diferenciais", values: selected.map(v => (v.features || []).slice(0, 4).join(", ") || "—") },
            ];

            // Find best (lowest) price index
            const prices = selected.map(v => Number(v.selling_price || v.price || 0));
            const minPrice = Math.min(...prices);

            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left p-2 w-32"></th>
                      {selected.map((v: any) => {
                        const photo = (v.photos || [])[0] || v.image_url;
                        return (
                          <th key={v.id} className="p-2 text-center">
                            {photo && <img src={photo} alt="" className="w-20 h-14 object-cover rounded mx-auto mb-1" />}
                            <p className="font-bold text-xs">{v.brand} {v.model}</p>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-muted/50" : ""}>
                        <td className="p-2 font-medium text-muted-foreground text-xs">{row.label}</td>
                        {row.values.map((val, vi) => (
                          <td key={vi} className={`p-2 text-center text-xs ${row.highlight && Number(selected[vi].selling_price || selected[vi].price || 0) === minPrice ? "text-primary font-bold" : ""}`}>
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex gap-2 mt-4 justify-center">
                  {selected.map((v: any) => (
                    <Button key={v.id} size="sm" className="gap-1" onClick={() => { setShowCompare(false); navigate(`/chat?veiculo=${encodeURIComponent(`${v.brand} ${v.model} ${v.year || ""}`)}`); }}>
                      <MessageCircle className="h-3 w-3" /> {v.brand} {v.model}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Vehicle Detail Dialog */}
      <Dialog open={!!detailVehicle} onOpenChange={(open) => !open && setDetailVehicle(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto p-0">
          {detailVehicle && (() => {
            const v = detailVehicle;
            const photos = v.allPhotos || [];
            const displayPrice = Number(v.selling_price || v.price || 0);
            const specs = [
              { icon: Calendar, label: "Ano", value: v.year || "—" },
              { icon: Gauge, label: "Quilometragem", value: v.km != null ? `${v.km.toLocaleString("pt-BR")} km` : "—" },
              { icon: Palette, label: "Cor", value: v.color || "—" },
              { icon: Fuel, label: "Combustível", value: v.fuel || "—" },
              { icon: Info, label: "Condição", value: v.condition === "new" ? "0km" : "Seminovo" },
            ];

            return (
              <>
                {/* Photo carousel */}
                <div className="h-72 sm:h-80 bg-muted relative">
                  <CardCarousel photos={photos} alt={`${v.brand} ${v.model}`} />
                </div>

                <div className="p-6 space-y-5">
                  {/* Title & price */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={v.condition === "new" ? "default" : "secondary"}>
                          {v.condition === "new" ? "0km" : "Seminovo"}
                        </Badge>
                      </div>
                      <h2 className="text-2xl font-bold">{v.brand} {v.model}</h2>
                      <p className="text-sm text-muted-foreground">
                        {v.year && `${v.year}`}{v.km ? ` · ${v.km.toLocaleString()} km` : ""}{v.color ? ` · ${v.color}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">R$ {displayPrice.toLocaleString("pt-BR")}</p>
                      {v.fipe_value && (
                        <p className="text-xs text-muted-foreground">FIPE: R$ {Number(v.fipe_value).toLocaleString("pt-BR")}</p>
                      )}
                    </div>
                  </div>

                  {/* Parcelas */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {Object.entries(COEFS).map(([months, coef]) => (
                      <div key={months} className="text-center p-2 rounded-lg bg-muted/50 border border-border/40">
                        <p className="text-[10px] text-muted-foreground font-medium">{months}x</p>
                        <p className="text-xs font-bold text-foreground">R$ {(displayPrice * coef).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                    ))}
                  </div>

                  {/* Ficha técnica */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                      <Info className="h-4 w-4 text-primary" /> Ficha Técnica
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {specs.map((s) => (
                        <div key={s.label} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40 border border-border/30">
                          <s.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-[10px] text-muted-foreground leading-none">{s.label}</p>
                            <p className="text-sm font-medium">{s.value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Diferenciais */}
                  {v.features?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">✨ Diferenciais</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {v.features.map((f: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Descrição */}
                  {v.description && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">📝 Descrição</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{v.description}</p>
                    </div>
                  )}

                  {/* CTA */}
                  <Button className="w-full gap-2" size="lg" onClick={() => { setDetailVehicle(null); navigate(`/chat?veiculo=${encodeURIComponent(`${v.brand} ${v.model} ${v.year || ""}`)}`); }}>
                    <MessageCircle className="h-5 w-5" /> Tenho interesse nesse veículo!
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicCatalog;
