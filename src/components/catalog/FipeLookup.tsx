import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, Loader2 } from "lucide-react";

interface FipeCodes {
  brandCode: string;
  modelCode: string;
  yearCode: string;
  vehicleType: string;
}

interface Props {
  brand: string;
  model: string;
  year: string | number;
  onFipeValue: (value: number, codes: FipeCodes) => void;
  vehicleType?: string;
  onVehicleTypeChange?: (type: string) => void;
}

const FipeLookup = ({ brand, model, year, onFipeValue, vehicleType = "carros", onVehicleTypeChange }: Props) => {
  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [fipeResult, setFipeResult] = useState<any>(null);

  const callFipe = async (action: string, params: any = {}) => {
    const { data, error } = await supabase.functions.invoke("fipe-lookup", {
      body: { action, vehicle_type: vehicleType, ...params },
    });
    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    return data.data;
  };

  useEffect(() => {
    callFipe("brands").then(setBrands).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedBrand) return;
    setModels([]);
    setSelectedModel("");
    setYears([]);
    setSelectedYear("");
    setFipeResult(null);
    callFipe("models", { brand_code: selectedBrand }).then(d => setModels(d.modelos || [])).catch(() => {});
  }, [selectedBrand]);

  useEffect(() => {
    if (!selectedBrand || !selectedModel) return;
    setYears([]);
    setSelectedYear("");
    setFipeResult(null);
    callFipe("years", { brand_code: selectedBrand, model_code: selectedModel }).then(setYears).catch(() => {});
  }, [selectedModel]);

  const lookupPrice = async () => {
    if (!selectedBrand || !selectedModel || !selectedYear) {
      toast.error("Selecione marca, modelo e ano");
      return;
    }
    setLoading(true);
    try {
      const result = await callFipe("price", { brand_code: selectedBrand, model_code: selectedModel, year_code: selectedYear });
      setFipeResult(result);
      const priceStr = result.Valor?.replace("R$ ", "").replace(/\./g, "").replace(",", ".");
      const price = parseFloat(priceStr);
      if (!isNaN(price)) onFipeValue(price, {
        brandCode: selectedBrand,
        modelCode: selectedModel,
        yearCode: selectedYear,
        vehicleType,
      });
      toast.success(`FIPE encontrado: ${result.Valor}`);
    } catch (e: any) {
      toast.error(`Erro ao buscar FIPE: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-3">
      <h4 className="font-semibold flex items-center gap-2">
        <Search className="h-4 w-4" /> Consulta Tabela FIPE
      </h4>
      <div className="grid grid-cols-4 gap-3">
        <div>
          <Label className="text-xs">Tipo</Label>
          <Select value={vehicleType} onValueChange={(v) => {
            onVehicleTypeChange?.(v);
            setSelectedBrand("");
            setModels([]);
            setSelectedModel("");
            setYears([]);
            setSelectedYear("");
            setFipeResult(null);
            callFipe("brands").then(setBrands).catch(() => {});
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="carros">Carros</SelectItem>
              <SelectItem value="motos">Motos</SelectItem>
              <SelectItem value="caminhoes">Caminhões</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Marca</Label>
          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent className="max-h-60">
              {brands.map((b: any) => (
                <SelectItem key={b.codigo} value={String(b.codigo)}>{b.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Modelo</Label>
          <Select value={selectedModel} onValueChange={setSelectedModel} disabled={!models.length}>
            <SelectTrigger><SelectValue placeholder="Modelo" /></SelectTrigger>
            <SelectContent className="max-h-60">
              {models.map((m: any) => (
                <SelectItem key={m.codigo} value={String(m.codigo)}>{m.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Ano</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear} disabled={!years.length}>
            <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              {years.map((y: any) => (
                <SelectItem key={y.codigo} value={String(y.codigo)}>{y.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={lookupPrice} disabled={loading || !selectedYear} className="gap-2" size="sm">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        Buscar FIPE
      </Button>
      {fipeResult && (
        <div className="text-sm bg-muted p-3 rounded">
          <div><strong>{fipeResult.Marca} {fipeResult.Modelo}</strong></div>
          <div>Ano: {fipeResult.AnoModelo} · Combustível: {fipeResult.Combustivel}</div>
          <div className="text-lg font-bold text-primary mt-1">{fipeResult.Valor}</div>
          <div className="text-xs text-muted-foreground">Ref: {fipeResult.MesReferencia} · Código FIPE: {fipeResult.CodigoFipe}</div>
        </div>
      )}
    </div>
  );
};

export default FipeLookup;
