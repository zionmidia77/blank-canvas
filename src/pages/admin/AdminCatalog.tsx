import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Camera, Search, Package, DollarSign, Clock, TrendingUp, Trash2, Edit, Eye, QrCode, ChevronLeft, ChevronRight, X, ZoomIn, FolderOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { VehicleCardSkeleton } from "@/components/admin/SkeletonLoaders";
import VehicleFormDialog from "@/components/catalog/VehicleFormDialog";
import VehiclePhotoUpload from "@/components/catalog/VehiclePhotoUpload";
import VehicleCostManager from "@/components/catalog/VehicleCostManager";
import FipeLookup from "@/components/catalog/FipeLookup";
import VehicleDocOCR from "@/components/catalog/VehicleDocOCR";
import VehiclePhotoManager from "@/components/catalog/VehiclePhotoManager";
import StockFinancialDashboard from "@/components/catalog/StockFinancialDashboard";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import PageTour from "@/components/admin/PageTour";
import { Package as PackageIcon, Camera as CameraIcon, DollarSign as DollarIcon, Search as SearchIcon2 } from "lucide-react";

// ── Lightbox with carousel + zoom ──
const AdminPhotoLightbox = ({ photos, initialIndex, open, onClose }: { photos: string[]; initialIndex: number; open: boolean; onClose: () => void }) => {
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const prev = useCallback(() => { setIndex(i => (i > 0 ? i - 1 : photos.length - 1)); setZoomed(false); }, [photos.length]);
  const next = useCallback(() => { setIndex(i => (i < photos.length - 1 ? i + 1 : 0)); setZoomed(false); }, [photos.length]);
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-black/95 overflow-hidden">
        <div className="relative w-full h-[85vh] flex items-center justify-center">
          <button onClick={onClose} className="absolute top-3 right-3 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"><X className="h-5 w-5" /></button>
          <div className="absolute top-3 left-3 z-50 px-3 py-1 rounded-full bg-black/50 text-white text-sm flex items-center gap-1"><Camera className="h-3.5 w-3.5" /> {index + 1}/{photos.length}</div>
          {photos.length > 1 && <button onClick={prev} className="absolute left-2 z-40 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"><ChevronLeft className="h-6 w-6" /></button>}
          <AnimatePresence mode="wait">
            <motion.img key={photos[index]} src={photos[index]} alt={`Foto ${index + 1}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className={`max-h-full max-w-full object-contain cursor-pointer transition-transform duration-300 ${zoomed ? "scale-150" : ""}`} onClick={() => setZoomed(z => !z)} />
          </AnimatePresence>
          {photos.length > 1 && <button onClick={next} className="absolute right-2 z-40 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"><ChevronRight className="h-6 w-6" /></button>}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-black/50 text-white/70 text-xs"><ZoomIn className="h-3 w-3" /> Clique para {zoomed ? "reduzir" : "ampliar"}</div>
          {photos.length > 1 && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[80vw] overflow-x-auto p-1">
              {photos.map((p, i) => (
                <button key={i} onClick={() => { setIndex(i); setZoomed(false); }} className={`flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition ${i === index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}>
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

const AdminCatalog = () => {
  const [activeTab, setActiveTab] = useState("catalog");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [showPhotoManager, setShowPhotoManager] = useState(false);
  const [photoManagerVehicleId, setPhotoManagerVehicleId] = useState<string | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["stock-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_vehicles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stock_vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-vehicles"] });
      toast.success("Veículo removido!");
    },
  });

  const filtered = vehicles.filter((v: any) => {
    const matchSearch = `${v.brand} ${v.model} ${v.plate || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: vehicles.length,
    available: vehicles.filter((v: any) => v.status === "available").length,
    totalInvested: vehicles.reduce((sum: number, v: any) => sum + (Number(v.purchase_price) || 0) + (Number(v.documents_cost) || 0) + (Number(v.total_costs) || 0), 0),
    totalSellingValue: vehicles.filter((v: any) => v.status === "available").reduce((sum: number, v: any) => sum + (Number(v.selling_price) || Number(v.price) || 0), 0),
  };

  const getDaysInStock = (purchaseDate: string) => {
    if (!purchaseDate) return 0;
    return Math.floor((Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
  };

  const catalogTourSteps = [
    { target: '[data-tour="catalog-tabs"]', title: "Abas do catálogo", description: "Alterne entre visualizar o estoque de veículos e o dashboard financeiro.", icon: PackageIcon, position: "bottom" as const },
    { target: '[data-tour="catalog-add"]', title: "Cadastrar veículo", description: "Adicione veículos manualmente ou via foto do documento com reconhecimento automático (OCR).", icon: CameraIcon, position: "bottom" as const },
    { target: '[data-tour="catalog-stats"]', title: "Resumo do estoque", description: "Veja total de veículos, disponíveis, valor investido e valor de venda.", icon: DollarIcon, position: "bottom" as const },
  ];

  return (
    <div className="space-y-6">
      <PageTour tourKey="catalog" steps={catalogTourSteps} />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">🏍️ Catálogo de Estoque</h1>
          <p className="text-muted-foreground">Gerencie seu estoque com fotos, custos e FIPE</p>
        </div>
        <div className="flex gap-2" data-tour="catalog-add">
          <Tabs value={activeTab} onValueChange={setActiveTab} data-tour="catalog-tabs">
            <TabsList>
              <TabsTrigger value="catalog">📋 Estoque</TabsTrigger>
              <TabsTrigger value="dashboard">📊 Financeiro</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setShowPhotoManager(true)} variant="outline" className="gap-2">
            <FolderOpen className="h-4 w-4" /> Gerenciar Fotos
          </Button>
          <Button onClick={() => setShowOCR(true)} variant="outline" className="gap-2">
            <Camera className="h-4 w-4" /> Cadastro por Foto
          </Button>
          <Button onClick={() => { setSelectedVehicle(null); setShowForm(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Cadastro Manual
          </Button>
        </div>
      </div>

      {activeTab === "dashboard" ? (
        <StockFinancialDashboard />
      ) : (
      <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Estoque</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Disponíveis</p>
                <p className="text-2xl font-bold">{stats.available}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Investido</p>
                <p className="text-lg font-bold">R$ {stats.totalInvested.toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Valor de Venda</p>
                <p className="text-lg font-bold">R$ {stats.totalSellingValue.toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar marca, modelo ou placa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="available">Disponível</SelectItem>
            <SelectItem value="reserved">Reservado</SelectItem>
            <SelectItem value="sold">Vendido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vehicle Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <VehicleCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nenhum veículo no estoque</h3>
            <p className="text-muted-foreground mb-4">Cadastre sua primeira moto por foto ou manualmente</p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => setShowOCR(true)} variant="outline" className="gap-2">
                <Camera className="h-4 w-4" /> Por Foto
              </Button>
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Manual
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((vehicle: any) => {
            const days = getDaysInStock(vehicle.purchase_date);
            const profit = (Number(vehicle.selling_price) || Number(vehicle.price) || 0) - (Number(vehicle.purchase_price) || 0) - (Number(vehicle.documents_cost) || 0) - (Number(vehicle.total_costs) || 0);
            const photos = vehicle.photos || [];
            const coverPhoto = vehicle.image_url || photos[0] || null;

            return (
              <Card key={vehicle.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* Photo */}
                <div className="h-48 bg-muted relative group/photo cursor-pointer"
                  onClick={() => {
                    const allPhotos = coverPhoto
                      ? [coverPhoto, ...photos.filter((p: string) => p !== coverPhoto)]
                      : photos;
                    if (allPhotos.length > 0) {
                      setLightboxPhotos(allPhotos);
                      setLightboxOpen(true);
                    }
                  }}
                >
                  {coverPhoto ? (
                    <img src={coverPhoto} alt={`${vehicle.brand} ${vehicle.model}`} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Package className="h-12 w-12" />
                    </div>
                  )}
                  {photos.length > 1 && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-xs">
                      <Camera className="h-3 w-3" /> {photos.length} fotos
                    </div>
                  )}
                  {coverPhoto && (
                    <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/20 transition flex items-center justify-center">
                      <Eye className="h-8 w-8 text-white opacity-0 group-hover/photo:opacity-100 transition" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Badge variant={vehicle.status === "available" ? "default" : vehicle.status === "reserved" ? "secondary" : "outline"}>
                      {vehicle.status === "available" ? "Disponível" : vehicle.status === "reserved" ? "Reservado" : "Vendido"}
                    </Badge>
                  </div>
                  {days > 0 && (
                    <div className="absolute bottom-2 left-2">
                      <Badge variant="outline" className={`bg-background/80 ${days > 30 ? "text-destructive border-destructive" : days > 15 ? "text-yellow-500 border-yellow-500" : ""}`}>
                        <Clock className="h-3 w-3 mr-1" /> {days} dias
                      </Badge>
                    </div>
                  )}
                </div>

                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-lg">{vehicle.brand} {vehicle.model}</h3>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.year && `${vehicle.year} · `}{vehicle.km ? `${vehicle.km.toLocaleString()} km` : ""}{vehicle.color ? ` · ${vehicle.color}` : ""}
                    </p>
                    {vehicle.plate && <p className="text-xs text-muted-foreground">Placa: {vehicle.plate}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Compra:</span>
                      <span className="ml-1 font-medium">R$ {(Number(vehicle.purchase_price) || 0).toLocaleString("pt-BR")}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Venda:</span>
                      <span className="ml-1 font-medium">R$ {(Number(vehicle.selling_price) || Number(vehicle.price) || 0).toLocaleString("pt-BR")}</span>
                    </div>
                    {vehicle.fipe_value && (
                      <div>
                        <span className="text-muted-foreground">FIPE:</span>
                        <span className="ml-1 font-medium">R$ {Number(vehicle.fipe_value).toLocaleString("pt-BR")}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Custos:</span>
                      <span className="ml-1 font-medium">R$ {((Number(vehicle.documents_cost) || 0) + (Number(vehicle.total_costs) || 0)).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>

                  <div className={`text-sm font-bold ${profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                    Margem: R$ {profit.toLocaleString("pt-BR")}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setSelectedVehicle(vehicle); setShowForm(true); }}>
                      <Edit className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <QrCode className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-xs">
                        <DialogHeader>
                          <DialogTitle className="text-center">QR Code</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col items-center gap-3 py-4">
                          <QRCodeSVG
                            value={`${window.location.origin}/chat?moto=${encodeURIComponent(`${vehicle.brand} ${vehicle.model} ${vehicle.year || ""}`)}`}
                            size={200}
                            level="M"
                          />
                          <p className="text-sm font-semibold text-center">{vehicle.brand} {vehicle.model} {vehicle.year || ""}</p>
                          <p className="text-xs text-muted-foreground text-center">Escaneie para falar sobre esta moto</p>
                          <Button size="sm" variant="outline" onClick={() => {
                            const svg = document.querySelector('.qr-print-area svg');
                            if (!svg) return;
                            const svgData = new XMLSerializer().serializeToString(svg);
                            const blob = new Blob([svgData], { type: 'image/svg+xml' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `qr-${vehicle.brand}-${vehicle.model}.svg`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}>
                            Baixar QR Code
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="destructive" onClick={() => {
                      if (confirm("Remover este veículo?")) deleteMutation.mutate(vehicle.id);
                    }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      </>
      )}

      {/* Dialogs */}
      <VehicleFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        vehicle={selectedVehicle}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["stock-vehicles"] });
          setShowForm(false);
          setSelectedVehicle(null);
        }}
      />

      <VehicleDocOCR
        open={showOCR}
        onOpenChange={setShowOCR}
        onExtracted={(data) => {
          setSelectedVehicle({
            brand: data.brand || "",
            model: data.model || "",
            year: data.year_manufacture || data.year_model,
            color: data.color,
            plate: data.plate,
            chassis: data.chassis,
            renavam: data.renavam,
            fuel: data.fuel,
            condition: "used",
            status: "available",
            seller_name: data.owner_name,
          });
          setShowOCR(false);
          setShowForm(true);
        }}
      />


      <AdminPhotoLightbox photos={lightboxPhotos} initialIndex={0} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />
      <VehiclePhotoManager open={showPhotoManager} onOpenChange={setShowPhotoManager} />
    </div>
  );
};

export default AdminCatalog;
