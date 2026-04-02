import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

const RED = [220, 38, 38] as const;
const DARK = [40, 40, 40] as const;
const GRAY = [120, 120, 120] as const;

const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

interface MonthlyData {
  month: number;
  year: number;
  // Leads
  totalLeads: number;
  newLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  convertedLeads: number;
  lostLeads: number;
  conversionRate: number;
  leadsBySource: { source: string; count: number }[];
  leadsByStage: { stage: string; count: number }[];
  // Sales / stock
  vehiclesSold: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMarginPct: number;
  soldVehicles: { name: string; selling: number; cost: number; margin: number; days: number }[];
  // Current stock
  stockCount: number;
  stockValue: number;
  stockInvested: number;
  stockPotentialProfit: number;
  avgDaysInStock: number;
  staleCount: number;
  // Goals
  goals: { target_sales: number; target_revenue: number; target_leads: number; target_contacts: number } | null;
  // Interactions
  totalInteractions: number;
  interactionsByType: { type: string; count: number }[];
  // Tasks
  totalTasks: number;
  completedTasks: number;
  taskCompletionRate: number;
}

const STAGE_LABELS: Record<string, string> = {
  new: "Novo", contacted: "Contatado", interested: "Interessado",
  attending: "Atendimento", thinking: "Pensando", waiting_response: "Aguardando",
  scheduled: "Agendado", negotiating: "Negociação", closed_won: "Fechado ✅", closed_lost: "Perdido ❌",
};

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export async function fetchMonthlyData(month: number, year: number): Promise<MonthlyData> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  // Fetch all data in parallel
  const [clientsRes, allClientsRes, stockRes, goalsRes, interactionsRes, tasksRes, costsRes] = await Promise.all([
    supabase.from("clients").select("*").gte("created_at", startDate).lt("created_at", endDate),
    supabase.from("clients").select("id, pipeline_stage, temperature, source, status"),
    supabase.from("stock_vehicles").select("*"),
    supabase.from("monthly_goals").select("*").eq("month", month).eq("year", year).limit(1),
    supabase.from("interactions").select("type").gte("created_at", startDate).lt("created_at", endDate),
    supabase.from("tasks").select("status, completed_at").gte("created_at", startDate).lt("created_at", endDate),
    supabase.from("vehicle_costs").select("amount, vehicle_id"),
  ]);

  const newClients = clientsRes.data || [];
  const allClients = allClientsRes.data || [];
  const vehicles = stockRes.data || [];
  const interactions = interactionsRes.data || [];
  const tasks = tasksRes.data || [];
  const costs = costsRes.data || [];
  const goals = goalsRes.data?.[0] || null;

  // Leads
  const totalLeads = allClients.length;
  const newLeads = newClients.length;
  const hotLeads = allClients.filter(c => c.temperature === "hot").length;
  const warmLeads = allClients.filter(c => c.temperature === "warm").length;
  const coldLeads = allClients.filter(c => c.temperature === "cold").length;
  const convertedLeads = allClients.filter(c => c.pipeline_stage === "closed_won").length;
  const lostLeads = allClients.filter(c => c.pipeline_stage === "closed_lost").length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  // By source
  const sourceMap: Record<string, number> = {};
  newClients.forEach((c: any) => { const s = c.source || "outros"; sourceMap[s] = (sourceMap[s] || 0) + 1; });
  const leadsBySource = Object.entries(sourceMap).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);

  // By stage
  const stageMap: Record<string, number> = {};
  allClients.forEach((c: any) => { stageMap[c.pipeline_stage] = (stageMap[c.pipeline_stage] || 0) + 1; });
  const leadsByStage = Object.entries(stageMap).map(([stage, count]) => ({ stage, count })).sort((a, b) => b.count - a.count);

  // Stock & sales
  const sold = vehicles.filter((v: any) => v.status === "sold");
  const available = vehicles.filter((v: any) => v.status === "available");
  const now = Date.now();

  const costMap: Record<string, number> = {};
  costs.forEach((c: any) => { costMap[c.vehicle_id] = (costMap[c.vehicle_id] || 0) + Number(c.amount); });

  const soldVehicles = sold.map((v: any) => {
    const sellingPrice = Number(v.selling_price) || Number(v.price) || 0;
    const totalCost = (Number(v.purchase_price) || 0) + (Number(v.documents_cost) || 0) + (Number(v.total_costs) || 0);
    const days = Math.floor((now - new Date(v.purchase_date || v.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return {
      name: `${v.brand} ${v.model} ${v.year || ""}`,
      selling: sellingPrice,
      cost: totalCost,
      margin: sellingPrice - totalCost,
      days,
    };
  });

  const totalRevenue = soldVehicles.reduce((s, v) => s + v.selling, 0);
  const totalCost = soldVehicles.reduce((s, v) => s + v.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const avgMarginPct = totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : 0;

  // Stock health
  const daysArr = available.map((v: any) =>
    Math.floor((now - new Date(v.purchase_date || v.created_at).getTime()) / (1000 * 60 * 60 * 24))
  );
  const avgDaysInStock = daysArr.length > 0 ? Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length) : 0;
  const staleCount = daysArr.filter(d => d > 30).length;

  const stockValue = available.reduce((s: number, v: any) => s + (Number(v.selling_price) || Number(v.price) || 0), 0);
  const stockInvested = available.reduce((s: number, v: any) =>
    s + (Number(v.purchase_price) || 0) + (Number(v.documents_cost) || 0) + (Number(v.total_costs) || 0), 0);

  // Interactions
  const intMap: Record<string, number> = {};
  interactions.forEach((i: any) => { intMap[i.type] = (intMap[i.type] || 0) + 1; });
  const interactionsByType = Object.entries(intMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

  // Tasks
  const completedTasks = tasks.filter((t: any) => t.status === "completed").length;

  return {
    month, year,
    totalLeads, newLeads, hotLeads, warmLeads, coldLeads,
    convertedLeads, lostLeads, conversionRate,
    leadsBySource, leadsByStage,
    vehiclesSold: sold.length, totalRevenue, totalCost, totalProfit, avgMarginPct, soldVehicles,
    stockCount: available.length, stockValue, stockInvested,
    stockPotentialProfit: stockValue - stockInvested,
    avgDaysInStock, staleCount,
    goals,
    totalInteractions: interactions.length, interactionsByType,
    totalTasks: tasks.length, completedTasks,
    taskCompletionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
  };
}

export function generateMonthlyPDF(data: MonthlyData) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
  const monthLabel = `${MONTH_NAMES[data.month - 1]} ${data.year}`;

  const header = (title: string) => {
    doc.setFillColor(...RED);
    doc.rect(0, 0, pageW, 36, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Arsenal Motors", 14, 16);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(title, 14, 24);
    doc.setFontSize(8);
    doc.text(`Período: ${monthLabel}`, 14, 31);
    doc.text(`Gerado em ${dateStr}`, pageW - 14, 31, { align: "right" });
  };

  const sectionTitle = (title: string, y: number) => {
    doc.setTextColor(...DARK);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, y);
    return y + 8;
  };

  const checkPage = (y: number, needed = 60) => {
    if (y > doc.internal.pageSize.getHeight() - needed) {
      doc.addPage();
      header("Relatório Mensal (cont.)");
      return 46;
    }
    return y;
  };

  // ═══════════════ PAGE 1 — RESUMO EXECUTIVO ═══════════════
  header("Relatório Mensal Completo");
  let y = 46;

  y = sectionTitle("📊 Resumo Executivo", y);

  const summaryKpis = [
    ["Novos Leads no Mês", String(data.newLeads)],
    ["Total de Leads (acumulado)", String(data.totalLeads)],
    ["Taxa de Conversão", `${data.conversionRate}%`],
    ["Leads Quentes", `🔥 ${data.hotLeads}`],
    ["Motos Vendidas", String(data.vehiclesSold)],
    ["Faturamento", fmt(data.totalRevenue)],
    ["Lucro Bruto", fmt(data.totalProfit)],
    ["Margem Média", `${data.avgMarginPct}%`],
    ["Estoque Atual", `${data.stockCount} motos`],
    ["Valor do Estoque", fmt(data.stockValue)],
    ["Interações no Mês", String(data.totalInteractions)],
    ["Tarefas Concluídas", `${data.completedTasks}/${data.totalTasks} (${data.taskCompletionRate}%)`],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: summaryKpis,
    theme: "striped",
    headStyles: { fillColor: [...RED], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 85 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // ═══════════════ METAS ═══════════════
  if (data.goals) {
    y = checkPage(y, 70);
    y = sectionTitle("🎯 Metas vs Realizado", y);

    const g = data.goals;
    const goalsRows = [
      ["Vendas", String(g.target_sales), String(data.vehiclesSold), `${g.target_sales > 0 ? Math.round((data.vehiclesSold / g.target_sales) * 100) : 0}%`],
      ["Faturamento", fmt(g.target_revenue), fmt(data.totalRevenue), `${g.target_revenue > 0 ? Math.round((data.totalRevenue / g.target_revenue) * 100) : 0}%`],
      ["Leads", String(g.target_leads), String(data.newLeads), `${g.target_leads > 0 ? Math.round((data.newLeads / g.target_leads) * 100) : 0}%`],
      ["Contatos", String(g.target_contacts), String(data.totalInteractions), `${g.target_contacts > 0 ? Math.round((data.totalInteractions / g.target_contacts) * 100) : 0}%`],
    ];

    autoTable(doc, {
      startY: y,
      head: [["Meta", "Objetivo", "Realizado", "Atingimento"]],
      body: goalsRows,
      theme: "striped",
      headStyles: { fillColor: [...RED], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
      didParseCell: (hookData: any) => {
        if (hookData.section === "body" && hookData.column.index === 3) {
          const pct = parseInt(hookData.cell.raw);
          if (pct >= 100) hookData.cell.styles.textColor = [22, 163, 74];
          else if (pct >= 70) hookData.cell.styles.textColor = [202, 138, 4];
          else hookData.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ═══════════════ VENDAS DETALHADAS ═══════════════
  if (data.soldVehicles.length > 0) {
    y = checkPage(y, 80);
    y = sectionTitle("💰 Vendas do Mês", y);

    const salesRows = data.soldVehicles.map(v => [
      v.name, fmt(v.cost), fmt(v.selling), fmt(v.margin),
      `${v.cost > 0 ? Math.round((v.margin / v.cost) * 100) : 0}%`,
      `${v.days}d`,
    ]);

    salesRows.push([
      "TOTAL", fmt(data.totalCost), fmt(data.totalRevenue), fmt(data.totalProfit),
      `${data.avgMarginPct}%`, "—",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Veículo", "Custo", "Venda", "Margem", "%", "Dias"]],
      body: salesRows,
      theme: "striped",
      headStyles: { fillColor: [...RED], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
      margin: { left: 14, right: 14 },
      didParseCell: (hookData: any) => {
        if (hookData.section === "body" && hookData.row.index === salesRows.length - 1) {
          hookData.cell.styles.fontStyle = "bold";
          hookData.cell.styles.fillColor = [245, 245, 245];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ═══════════════ SAÚDE DO ESTOQUE ═══════════════
  y = checkPage(y, 60);
  y = sectionTitle("📦 Saúde do Estoque", y);

  const stockKpis = [
    ["Motos Disponíveis", String(data.stockCount)],
    ["Capital Investido", fmt(data.stockInvested)],
    ["Valor Total de Venda", fmt(data.stockValue)],
    ["Lucro Potencial", fmt(data.stockPotentialProfit)],
    ["Tempo Médio em Estoque", `${data.avgDaysInStock} dias`],
    ["Motos Paradas (+30 dias)", `${data.staleCount} ⚠️`],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: stockKpis,
    theme: "striped",
    headStyles: { fillColor: [...RED], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 85 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 14;

  // ═══════════════ LEADS POR ORIGEM ═══════════════
  if (data.leadsBySource.length > 0) {
    y = checkPage(y, 60);
    y = sectionTitle("📡 Leads por Origem", y);

    autoTable(doc, {
      startY: y,
      head: [["Canal", "Leads", "% do Total"]],
      body: data.leadsBySource.map(s => [
        s.source, String(s.count),
        `${data.newLeads > 0 ? Math.round((s.count / data.newLeads) * 100) : 0}%`,
      ]),
      theme: "striped",
      headStyles: { fillColor: [...RED], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ═══════════════ FUNIL ═══════════════
  if (data.leadsByStage.length > 0) {
    y = checkPage(y, 60);
    y = sectionTitle("🔄 Pipeline / Funil", y);

    autoTable(doc, {
      startY: y,
      head: [["Etapa", "Leads", "% do Total"]],
      body: data.leadsByStage.map(s => [
        STAGE_LABELS[s.stage] || s.stage, String(s.count),
        `${data.totalLeads > 0 ? Math.round((s.count / data.totalLeads) * 100) : 0}%`,
      ]),
      theme: "striped",
      headStyles: { fillColor: [...RED], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ═══════════════ INTERAÇÕES ═══════════════
  if (data.interactionsByType.length > 0) {
    y = checkPage(y, 60);
    y = sectionTitle("💬 Interações por Tipo", y);

    const typeLabels: Record<string, string> = {
      whatsapp: "WhatsApp", call: "Ligação", visit: "Visita", system: "Sistema", email: "E-mail", sms: "SMS",
    };

    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Quantidade", "% do Total"]],
      body: data.interactionsByType.map(i => [
        typeLabels[i.type] || i.type, String(i.count),
        `${data.totalInteractions > 0 ? Math.round((i.count / data.totalInteractions) * 100) : 0}%`,
      ]),
      theme: "striped",
      headStyles: { fillColor: [...RED], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
  }

  // ═══════════════ FOOTER ═══════════════
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    const ph = doc.internal.pageSize.getHeight();
    doc.text(`Arsenal Motors · Relatório Mensal ${monthLabel}`, 14, ph - 8);
    doc.text(`Página ${i}/${pageCount}`, pageW - 14, ph - 8, { align: "right" });
  }

  doc.save(`arsenal-relatorio-${monthLabel.replace(" ", "-")}.pdf`);
}
