import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Bike, ArrowLeft, SearchX } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm space-y-6"
      >
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
          <SearchX className="w-10 h-10 text-primary" />
        </div>

        <div>
          <h1 className="text-5xl font-display font-bold text-primary mb-2">404</h1>
          <p className="text-lg font-medium">Página não encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            A página <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">{location.pathname}</code> não existe.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={() => navigate("/")} className="w-full rounded-xl h-11 glow-red">
            <Bike className="w-4 h-4 mr-2" />
            Voltar ao início
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)} className="w-full rounded-xl h-11">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar à página anterior
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
