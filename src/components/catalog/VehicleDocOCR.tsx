import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Camera, Upload, Loader2, FileText } from "lucide-react";

interface ExtractedData {
  brand?: string;
  model?: string;
  year_manufacture?: number;
  year_model?: number;
  plate?: string;
  chassis?: string;
  renavam?: string;
  color?: string;
  fuel?: string;
  engine_cc?: string;
  owner_name?: string;
  owner_cpf?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtracted: (data: ExtractedData) => void;
}

const VehicleDocOCR = ({ open, onOpenChange, onExtracted }: Props) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = async (file: File) => {
    setLoading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(file);
      });

      setPreview(URL.createObjectURL(file));

      const { data, error } = await supabase.functions.invoke("extract-vehicle-doc", {
        body: { image_base64: base64 },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success("Dados extraídos com sucesso!");
      onExtracted(data.data);
    } catch (e: any) {
      toast.error(`Erro ao processar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" /> Cadastro por Foto do Documento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tire foto ou envie imagem do <strong>CRV, CRLV ou DUT</strong> da moto. 
            A IA vai extrair automaticamente: marca, modelo, ano, placa, chassi, Renavam, cor e combustível.
          </p>

          {preview ? (
            <div className="relative rounded-lg overflow-hidden border">
              <img src={preview} alt="Documento" className="w-full max-h-64 object-contain" />
              {loading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center flex-col gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm font-medium">Extraindo dados...</span>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors cursor-pointer"
            >
              <FileText className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">Clique para enviar foto</p>
                <p className="text-xs text-muted-foreground">ou arraste a imagem aqui</p>
              </div>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex gap-2">
            {preview && !loading && (
              <Button variant="outline" className="flex-1" onClick={() => { setPreview(null); fileInputRef.current?.click(); }}>
                Tentar outra foto
              </Button>
            )}
            {!preview && (
              <Button onClick={() => fileInputRef.current?.click()} className="flex-1 gap-2">
                <Upload className="h-4 w-4" /> Enviar Imagem
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VehicleDocOCR;
