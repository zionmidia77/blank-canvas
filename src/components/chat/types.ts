export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  vehicles?: StockVehicle[];
  photos?: string[];
  thumbnail?: string;
}

export interface StockVehicle {
  brand: string;
  model: string;
  year?: number;
  km?: number;
  color?: string;
  price: number;
  condition: string;
  description?: string;
  features?: string[];
  photos?: string[];
}
