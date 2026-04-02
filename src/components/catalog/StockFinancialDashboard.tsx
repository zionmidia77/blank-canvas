import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign, Clock, Package, Target, Bike } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const StockFinancialDashboard = () => {
  const { data: vehicles = [] } = useQuery({
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

  const { data: costs = [] } = useQuery({
    queryKey: ["all-vehicle-costs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_costs")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const stats = useMemo(() => {
    const available = vehicles.filter((v: any) => v.status === "available");
    const sold = vehicles.filter((v: any) => v.status === "sold");
    const now = Date.now();

    // Days in stock per vehicle
    const daysInStock = available.map((v: any) => ({
      name: `${v.brand} ${v.model}`.substring(0, 20),
      days: Math.floor((now - new Date(v.purchase_date || v.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      id: v.id,
      full: `${v.brand} ${v.model} ${v.year || ""}`,
    }));

    const avgDaysInStock = daysInStock.length > 0
      ? Math.round(daysInStock.reduce((s, v) => s + v.days, 0) / daysInStock.length)
      : 0;

    // Stale alerts (>30 days)
    const staleVehicles = daysInStock.filter(v => v.days > 30).sort((a, b) => b.days - a.days);

    // Margin per vehicle (available)
    const marginData = available.map((v: any) => {
      const sellingPrice = Number(v.selling_price) || Number(v.price) || 0;
      const totalCost = (Number(v.purchase_price) || 0) + (Number(v.documents_cost) || 0) + (Number(v.total_costs) || 0);
      const margin = sellingPrice - totalCost;
      const marginPct = totalCost > 0 ? Math.round((margin / totalCost) * 100) : 0;
      return {
        name: `${v.brand} ${v.model}`.substring(0, 15),
        margin,
        marginPct,
        sellingPrice,
        totalCost,
        full: `${v.brand} ${v.model} ${v.year || ""}`,
      };
    }).sort((a, b) => b.margin - a.margin);

    // Total invested vs total selling value
    const totalInvested = available.reduce((s: number, v: any) =>
      s + (Number(v.purchase_price) || 0) + (Number(v.documents_cost) || 0) + (Number(v.total_costs) || 0), 0);
    const totalSellingValue = available.reduce((s: number, v: any) =>
      s + (Number(v.selling_price) || Number(v.price) || 0), 0);
    const totalPotentialProfit = totalSellingValue - totalInvested;
    const overallROI = totalInvested > 0 ? Math.round((totalPotentialProfit / totalInvested) * 100) : 0;

    // Sold stats
    const totalSoldRevenue = sold.reduce((s: number, v: any) =>
      s + (Number(v.selling_price) || Number(v.price) || 0), 0);
    const totalSoldCost = sold.reduce((s: number, v: any) =>
      s + (Number(v.purchase_price) || 0) + (Number(v.documents_cost) || 0) + (Number(v.total_costs) || 0), 0);
    const totalSoldProfit = totalSoldRevenue - totalSoldCost;

    // By brand
    const brandMap: Record<string, { count: number; value: number; invested: number }> = {};
    available.forEach((v: any) => {
      const b = v.brand || "Outros";
      if (!brandMap[b]) brandMap[b] = { count: 0, value: 0, invested: 0 };
      brandMap[b].count++;
      brandMap[b].value += Number(v.selling_price) || Number(v.price) || 0;
      brandMap[b].invested += (Number(v.purchase_price) || 0) + (Number(v.documents_cost) || 0) + (Number(v.total_costs) || 0);
    });
    const brandData = Object.entries(brandMap).map(([name, d]) => ({
      name, ...d, margin: d.value - d.invested,
    })).sort((a, b) => b.count - a.count);

    // Cost breakdown
    const costByCategory: Record<string, number> = {};
    costs.forEach((c: any) => {
      const cat = c.category || "other";
      costByCategory[cat] = (costByCategory[cat] || 0) + Number(c.amount);
    });
    const categoryLabels: Record<string, string> = {
      parts: "Peças", paint: "Pintura", repair: "Manutenção",
      document: "Documentação", cleaning: "Limpeza", accessories: "Acessórios", other: "Outros",
    };
    const costBreakdown = Object.entries(costByCategory).map(([key, value]) => ({
      name: categoryLabels[key] || key, value,
    })).sort((a, b) => b.value - a.value);

    // FIPE comparison
    const fipeData = available
      .filter((v: any) => v.fipe_value && (v.selling_price || v.price))
      .map((v: any) => ({
        name: `${v.brand} ${v.model}`.substring(0, 15),
        fipe: Number(v.fipe_value),
        venda: Number(v.selling_price) || Number(v.price),
        diff: (Number(v.selling_price) || Number(v.price)) - Number(v.fipe_value),
      }));

    return {
      available: available.length,
      sold: sold.length,
      total: vehicles.length,
      avgDaysInStock,
      staleVehicles,
      marginData,
      totalInvested,
      totalSellingValue,
      totalPotentialProfit,
      overallROI,
      totalSoldProfit,
      totalSoldRevenue,
      brandData,
      costBreakdown,
      daysInStock: daysInStock.sort((a, b) => b.days - a.days).slice(0, 10),
      fipeData,
    };
  }, [vehicles, costs]);

  const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{stats.available}</p>
            <p className="text-xs text-muted-foreground">Disponíveis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <p className="text-lg font-bold">{fmt(stats.totalInvested)}</p>
            <p className="text-xs text-muted-foreground">Investido</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-lg font-bold">{fmt(stats.totalSellingValue)}</p>
            <p className="text-xs text-muted-foreground">Valor de Venda</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className={`text-lg font-bold ${stats.totalPotentialProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {fmt(stats.totalPotentialProfit)}
            </p>
            <p className="text-xs text-muted-foreground">Lucro Potencial</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className={`text-2xl font-bold ${stats.overallROI >= 0 ? "text-green-600" : "text-destructive"}`}>
              {stats.overallROI}%
            </p>
            <p className="text-xs text-muted-foreground">ROI Estoque</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-2xl font-bold">{stats.avgDaysInStock}d</p>
            <p className="text-xs text-muted-foreground">Tempo Médio</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {stats.staleVehicles.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              ⚠️ Motos paradas há mais de 30 dias ({stats.staleVehicles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.staleVehicles.map((v) => (
                <Badge key={v.id} variant="outline" className={`${v.days > 60 ? "border-destructive text-destructive" : "border-yellow-500 text-yellow-600"}`}>
                  {v.full} — <strong>{v.days} dias</strong>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sold summary */}
      {stats.sold > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <Bike className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Vendidos: <strong>{stats.sold} motos</strong> · Faturamento: <strong>{fmt(stats.totalSoldRevenue)}</strong></p>
              <p className={`text-lg font-bold ${stats.totalSoldProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                Lucro realizado: {fmt(stats.totalSoldProfit)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Margin per vehicle */}
        {stats.marginData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">💰 Margem por Moto (Disponíveis)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.marginData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => fmt(value)}
                    labelFormatter={(label) => {
                      const item = stats.marginData.find(m => m.name === label);
                      return item?.full || label;
                    }}
                  />
                  <Bar dataKey="margin" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Days in stock */}
        {stats.daysInStock.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">⏱️ Tempo em Estoque (Top 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.daysInStock} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" unit=" dias" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => `${value} dias`}
                    labelFormatter={(label) => {
                      const item = stats.daysInStock.find(d => d.name === label);
                      return item?.full || label;
                    }}
                  />
                  <Bar dataKey="days" radius={[0, 4, 4, 0]}>
                    {stats.daysInStock.map((entry, i) => (
                      <Cell key={i} fill={entry.days > 60 ? "hsl(var(--destructive))" : entry.days > 30 ? "hsl(40, 90%, 50%)" : "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Brand distribution */}
        {stats.brandData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🏭 Estoque por Marca</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.brandData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={100}
                    label={({ name, count }) => `${name} (${count})`}
                  >
                    {stats.brandData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string, props: any) => {
                    const item = stats.brandData.find(b => b.name === props.payload.name);
                    return [`${value} motos · ${fmt(item?.value || 0)}`, props.payload.name];
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Cost breakdown */}
        {stats.costBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🔧 Custos por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.costBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={100}
                    label={({ name, value }) => `${name}: ${fmt(value)}`}
                  >
                    {stats.costBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => fmt(value)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* FIPE comparison */}
        {stats.fipeData.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">📊 Preço de Venda vs Tabela FIPE</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.fipeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => fmt(value)} />
                  <Bar dataKey="fipe" name="FIPE" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="venda" name="Venda" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default StockFinancialDashboard;
