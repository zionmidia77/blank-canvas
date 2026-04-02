import jsPDF from "jspdf";
import arsenalLogoUrl from "@/assets/arsenal-logo.png";

interface ProposalData {
  clientName: string;
  clientPhone?: string;
  proposalText: string;
  vehiclePhotos?: string[]; // URLs
  qrUrl?: string;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawHeader(doc: jsPDF, logoData: string | null, pageWidth: number) {
  // Red accent bar
  doc.setFillColor(200, 30, 30);
  doc.rect(0, 0, pageWidth, 8, "F");

  // Logo
  if (logoData) {
    doc.addImage(logoData, "PNG", 14, 12, 40, 40);
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  doc.text("PROPOSTA COMERCIAL", logoData ? 60 : 14, 30);

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text("Arsenal Motors — Seu próximo veículo está aqui", logoData ? 60 : 14, 38);

  // Separator
  doc.setDrawColor(200, 30, 30);
  doc.setLineWidth(0.8);
  doc.line(14, 56, pageWidth - 14, 56);
}

function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  doc.setFillColor(240, 240, 240);
  doc.rect(0, pageHeight - 24, pageWidth, 24, "F");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Arsenal Motors • Proposta sujeita a disponibilidade e aprovação de crédito", pageWidth / 2, pageHeight - 14, { align: "center" });
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, pageWidth / 2, pageHeight - 8, { align: "center" });
}

function parseMarkdownToBlocks(text: string): { type: "heading" | "text" | "bullet" | "separator"; content: string }[] {
  const lines = text.split("\n");
  const blocks: { type: "heading" | "text" | "bullet" | "separator"; content: string }[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("---") || line.startsWith("===")) {
      blocks.push({ type: "separator", content: "" });
    } else if (line.startsWith("###")) {
      blocks.push({ type: "heading", content: line.replace(/^#{1,4}\s*/, "").replace(/\*\*/g, "") });
    } else if (line.startsWith("##")) {
      blocks.push({ type: "heading", content: line.replace(/^#{1,4}\s*/, "").replace(/\*\*/g, "") });
    } else if (line.startsWith("#")) {
      blocks.push({ type: "heading", content: line.replace(/^#{1,4}\s*/, "").replace(/\*\*/g, "") });
    } else if (line.startsWith("- ") || line.startsWith("• ") || /^\d+\.\s/.test(line)) {
      blocks.push({ type: "bullet", content: line.replace(/^[-•]\s*/, "").replace(/^\d+\.\s*/, "").replace(/\*\*/g, "") });
    } else {
      blocks.push({ type: "text", content: line.replace(/\*\*/g, "") });
    }
  }
  return blocks;
}

export async function generateProposalPdf(data: ProposalData): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const maxY = pageHeight - 30; // footer space

  // Load logo
  const logoData = await loadImageAsBase64(arsenalLogoUrl);

  // Draw first page header
  drawHeader(doc, logoData, pageWidth);

  let y = 62;

  // Client info
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.text(`Cliente: ${data.clientName}`, margin, y);
  y += 6;
  if (data.clientPhone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Telefone: ${data.clientPhone}`, margin, y);
    y += 6;
  }
  y += 4;

  // Vehicle photos (if any)
  if (data.vehiclePhotos && data.vehiclePhotos.length > 0) {
    const photosPerRow = Math.min(data.vehiclePhotos.length, 3);
    const photoWidth = (contentWidth - (photosPerRow - 1) * 4) / photosPerRow;
    const photoHeight = photoWidth * 0.65;

    for (let i = 0; i < Math.min(data.vehiclePhotos.length, 3); i++) {
      const imgData = await loadImageAsBase64(data.vehiclePhotos[i]);
      if (imgData) {
        const x = margin + i * (photoWidth + 4);
        if (y + photoHeight > maxY) {
          drawFooter(doc, pageWidth, pageHeight);
          doc.addPage();
          y = 20;
        }
        doc.addImage(imgData, "JPEG", x, y, photoWidth, photoHeight);
      }
    }
    y += (contentWidth / photosPerRow) * 0.65 + 8;
  }

  // Proposal content
  const blocks = parseMarkdownToBlocks(data.proposalText);

  for (const block of blocks) {
    if (y > maxY) {
      drawFooter(doc, pageWidth, pageHeight);
      doc.addPage();
      y = 20;
    }

    switch (block.type) {
      case "separator":
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;
        break;

      case "heading":
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(200, 30, 30);
        const headLines = doc.splitTextToSize(block.content, contentWidth);
        doc.text(headLines, margin, y);
        y += headLines.length * 6 + 3;
        break;

      case "bullet":
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        const bulletLines = doc.splitTextToSize(block.content, contentWidth - 8);
        doc.text("•", margin + 2, y);
        doc.text(bulletLines, margin + 8, y);
        y += bulletLines.length * 5 + 2;
        break;

      case "text":
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        const textLines = doc.splitTextToSize(block.content, contentWidth);
        doc.text(textLines, margin, y);
        y += textLines.length * 5 + 2;
        break;
    }
  }

  // QR Code section
  if (data.qrUrl) {
    if (y + 50 > maxY) {
      drawFooter(doc, pageWidth, pageHeight);
      doc.addPage();
      y = 20;
    }

    y += 6;
    doc.setDrawColor(200, 30, 30);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Generate QR using a canvas
    const qrSize = 35;
    const qrX = pageWidth / 2 - qrSize / 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text("📱 Escaneie para ver o catálogo completo", pageWidth / 2, y, { align: "center" });
    y += 8;

    // Simple QR placeholder — the actual QR is rendered via qrcode.react on frontend
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(qrX - 4, y - 4, qrSize + 8, qrSize + 8, 3, 3, "F");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(data.qrUrl, pageWidth / 2, y + qrSize + 10, { align: "center" });
    y += qrSize + 16;
  }

  // Final footer
  drawFooter(doc, pageWidth, pageHeight);

  return doc.output("blob");
}
