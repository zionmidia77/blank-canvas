import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ReportMetrics {
  total: number;
  won: number;
  lost: number;
  conversionRate: number;
  lossRate: number;
  avgScore: number;
  avgResponse: number | null;
  thisWeekLeads: number;
  weekTrend: number;
  funnelData: { name: string; value: number; conversionRate: number }[];
  bySource: { name: string; value: number }[];
  tempData: { name: string; value: number }[];
  dayOfWeekData: { name: string; leads: number }[];
  bestDay: { name: string; leads: number };
}

export const generatePDFReport = (metrics: ReportMetrics) => {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;

  // ── Header ──
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageW, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Arsenal CRM", 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório de Métricas", 14, 24);
  doc.setFontSize(8);
  doc.text(`Gerado em ${dateStr}`, 14, 31);
  doc.text("Confidencial", pageW - 14, 31, { align: "right" });

  let y = 46;

  // ── KPIs ──
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Indicadores Principais", 14, y);
  y += 8;

  const kpis = [
    ["Total de Leads", String(metrics.total)],
    ["Leads Convertidos", `${metrics.won} (${metrics.conversionRate}%)`],
    ["Leads Perdidos", `${metrics.lost} (${metrics.lossRate}%)`],
    ["Score Médio", String(metrics.avgScore)],
    ["Tempo Médio Resposta", metrics.avgResponse !== null ? `${metrics.avgResponse}h` : "N/A"],
    ["Tendência Semanal", `${metrics.weekTrend >= 0 ? "+" : ""}${metrics.weekTrend}%`],
    ["Leads Esta Semana", String(metrics.thisWeekLeads)],
    ["Melhor Dia", `${metrics.bestDay.name} (${metrics.bestDay.leads} leads)`],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: kpis,
    theme: "striped",
    headStyles: { fillColor: [220, 38, 38], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // ── Funnel ──
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Funil de Conversão", 14, y);
  y += 8;

  const funnelRows = metrics.funnelData.map((s, i) => [
    s.name,
    String(s.value),
    i > 0 ? `${s.conversionRate}%` : "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Etapa", "Leads", "Taxa Passagem"]],
    body: funnelRows,
    theme: "striped",
    headStyles: { fillColor: [220, 38, 38], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // ── Check page space ──
  if (y > 220) {
    doc.addPage();
    y = 20;
  }

  // ── Sources ──
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Leads por Origem", 14, y);
  y += 8;

  const sourceRows = metrics.bySource.map(s => {
    const pct = metrics.total > 0 ? Math.round((s.value / metrics.total) * 100) : 0;
    return [s.name, String(s.value), `${pct}%`];
  });

  autoTable(doc, {
    startY: y,
    head: [["Canal", "Leads", "% do Total"]],
    body: sourceRows,
    theme: "striped",
    headStyles: { fillColor: [220, 38, 38], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  if (y > 220) {
    doc.addPage();
    y = 20;
  }

  // ── Temperature ──
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Temperatura dos Leads", 14, y);
  y += 8;

  const tempRows = metrics.tempData.map(t => {
    const pct = metrics.total > 0 ? Math.round((t.value / metrics.total) * 100) : 0;
    return [t.name, String(t.value), `${pct}%`];
  });

  autoTable(doc, {
    startY: y,
    head: [["Temperatura", "Leads", "% do Total"]],
    body: tempRows,
    theme: "striped",
    headStyles: { fillColor: [220, 38, 38], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  // ── Day of week ──
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Leads por Dia da Semana", 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["Dia", "Leads"]],
    body: metrics.dayOfWeekData.map(d => [d.name, String(d.leads)]),
    theme: "striped",
    headStyles: { fillColor: [220, 38, 38], fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  // ── Footer on each page ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Arsenal CRM · Relatório gerado em ${dateStr}`, 14, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Página ${i}/${pageCount}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }

  doc.save(`arsenal-crm-relatorio-${now.toISOString().split("T")[0]}.pdf`);
};
