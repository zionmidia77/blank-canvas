import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  FileCheck, Upload, CheckCircle2, Circle, AlertTriangle, Send, Eye, Trash2,
  MessageCircle, Crown, Shield, Briefcase, DollarSign, Loader2, Edit2, Save,
  Building2, Search, ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, History, Clock, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateClient } from "@/hooks/useSupabase";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type FinancingDocs = {
  cnh: boolean;
  proof_of_residence: boolean;
  pay_stub: boolean;
  reference: boolean;
};

interface FinancingSectionProps {
  client: any;
}

const DOC_LABELS: { key: keyof FinancingDocs; label: string; emoji: string }[] = [
  { key: "cnh", label: "CNH ou RG com CPF", emoji: "🪪" },
  { key: "proof_of_residence", label: "Comprovante de Residência", emoji: "🏠" },
  { key: "pay_stub", label: "Holerite / Info Trabalho", emoji: "💼" },
  { key: "reference", label: "Referência Pessoal", emoji: "👤" },
];

const PRIORITY_FACTORS = [
  { key: "has_clean_credit", label: "Nome limpo", emoji: "✅", points: 25 },
  { key: "has_down_payment", label: "Tem entrada", emoji: "💰", points: 20 },
] as const;

const priorityScore = (client: any): { score: number; label: string; color: string } => {
  let score = 0;
  if (client.has_clean_credit) score += 25;
  if (client.has_down_payment) score += 20;

  // Employment > 1 year
  const et = (client.employment_time || "").toLowerCase();
  if (et.includes("ano") || et.includes("year") || parseInt(et) >= 12) score += 20;

  // Payment type
  if (client.payment_type === "cash") score += 30;
  else if (client.payment_type === "financing") score += 5;

  // Docs complete
  const docs: FinancingDocs = client.financing_docs || { cnh: false, proof_of_residence: false, pay_stub: false, reference: false };
  const docsComplete = Object.values(docs).every(Boolean);
  if (docsComplete) score += 15;

  if (score >= 80) return { score, label: "⭐ Premium", color: "text-yellow-400" };
  if (score >= 50) return { score, label: "🔥 Alta Prioridade", color: "text-primary" };
  if (score >= 25) return { score, label: "📊 Médio", color: "text-muted-foreground" };
  return { score, label: "📋 Padrão", color: "text-muted-foreground" };
};

const FinancingSection = ({ client }: FinancingSectionProps) => {
  const updateClient = useUpdateClient();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [verifyStep, setVerifyStep] = useState<number>(-1); // -1 = idle, 0-3 = steps
  const [verification, setVerification] = useState<any>(null);
  const [extractedPayStub, setExtractedPayStub] = useState<any>(null);
  const [showVerification, setShowVerification] = useState(true);
  const [verificationHistory, setVerificationHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ key: string; url: string; label: string } | null>(null);
  const [bankProposalUrl, setBankProposalUrl] = useState<string | null>(null);
  const [uploadingBankProposal, setUploadingBankProposal] = useState(false);
  const [bankProposal, setBankProposal] = useState<{
    approved_amount?: number;
    installments?: Record<string, number>; // e.g. {"12": 850, "24": 500, ...}
    bank_name?: string;
    notes?: string;
  }>(() => {
    const fd = client.funnel_data as any;
    return fd?.bank_proposal || {};
  });
  const [editFields, setEditFields] = useState({
    phone: client.phone || "",
    employer: client.employer || "",
    employment_time: client.employment_time || "",
    position: client.position || "",
    salary: client.salary || "",
    birth_city: client.birth_city || "",
    reference_name: client.reference_name || "",
    reference_phone: client.reference_phone || "",
    down_payment_amount: client.down_payment_amount || "",
  });

  // Load uploaded document URLs (including bank proposal)
  useEffect(() => {
    const loadDocUrls = async () => {
      try {
        const { data: files } = await supabase.storage
          .from("financing-docs")
          .list(client.id, { sortBy: { column: "created_at", order: "desc" } });
        if (!files || files.length === 0) return;

        const urls: Record<string, string> = {};
        for (const docType of DOC_LABELS) {
          const docFile = files.find(f => f.name.startsWith(docType.key));
          if (docFile) {
            const { data } = await supabase.storage
              .from("financing-docs")
              .createSignedUrl(`${client.id}/${docFile.name}`, 3600);
            if (data?.signedUrl) urls[docType.key] = data.signedUrl;
          }
        }
        setDocUrls(urls);

        // Load bank proposal
        const bankFile = files.find(f => f.name.startsWith("bank_proposal_"));
        if (bankFile) {
          const { data } = await supabase.storage
            .from("financing-docs")
            .createSignedUrl(`${client.id}/${bankFile.name}`, 3600);
          if (data?.signedUrl) setBankProposalUrl(data.signedUrl);
        }
      } catch (err) {
        console.error("Error loading doc URLs:", err);
      }
    };
    loadDocUrls();
  }, [client.id, uploading, uploadingBankProposal]);

  // Load verification history
  useEffect(() => {
    const loadHistory = async () => {
      const { data } = await supabase
        .from("employer_verifications")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });
      if (data) {
        setVerificationHistory(data);
        // Show latest verification if exists and no current one
        if (data.length > 0 && !verification) {
          const latest = data[0];
          setVerification({
            company_name: latest.company_name,
            trading_name: latest.trading_name,
            sector: latest.sector,
            size: latest.size,
            status: latest.status,
            location: latest.location,
            address: latest.address,
            verified: latest.verified,
            cnpj_validated: latest.cnpj_validated,
            reliability_score: latest.reliability_score,
            source: latest.source,
            risk_flags: latest.risk_flags || [],
            positive_flags: latest.positive_flags || [],
            legal_nature: latest.legal_nature,
            share_capital: latest.share_capital,
          });
          if (latest.extracted_data && Object.keys(latest.extracted_data).length > 0) {
            setExtractedPayStub(latest.extracted_data);
          }
        }
      }
    };
    loadHistory();
  }, [client.id]);

  const docs: FinancingDocs = client.financing_docs || { cnh: false, proof_of_residence: false, pay_stub: false, reference: false };
  const docsCompleted = Object.values(docs).filter(Boolean).length;
  const docsTotal = DOC_LABELS.length;
  const allDocsComplete = docsCompleted === docsTotal;
  const pct = Math.round((docsCompleted / docsTotal) * 100);
  const priority = priorityScore(client);

  const toggleDoc = async (key: keyof FinancingDocs) => {
    const newDocs = { ...docs, [key]: !docs[key] };
    const allComplete = Object.values(newDocs).every(Boolean);

    updateClient.mutate({
      id: client.id,
      financing_docs: newDocs,
      financing_status: allComplete ? "ready" : "incomplete",
    } as any);

    if (allComplete && !allDocsComplete) {
      toast.success("🎉 Documentação completa! Ficha pronta para envio.");
    }
  };

  const verifying = verifyStep >= 0;

  const VERIFY_STEPS = [
    { label: "Enviando imagem", icon: Upload, emoji: "📤" },
    { label: "Extraindo dados do holerite", icon: Search, emoji: "🔍" },
    { label: "Verificando empresa na Receita Federal", icon: Shield, emoji: "🏛️" },
    { label: "Salvando resultados", icon: Save, emoji: "💾" },
  ];

  const verifyEmployer = async (file: File) => {
    setVerifyStep(0);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      setVerifyStep(1);

      const { data, error } = await supabase.functions.invoke("verify-employer", {
        body: { image_base64: base64, client_id: client.id },
      });

      if (error) throw error;

      setVerifyStep(2);

      if (data?.extracted) {
        setExtractedPayStub(data.extracted);
        const ext = data.extracted;
        const updates: any = { id: client.id };
        if (ext.employer_name && !client.employer) updates.employer = ext.employer_name;
        if (ext.position && !client.position) updates.position = ext.position;
        if (ext.salary_net && !client.salary) updates.salary = parseFloat(ext.salary_net);
        if (ext.employee_name && !client.name) updates.name = ext.employee_name;

        if (Object.keys(updates).length > 1) {
          updateClient.mutate(updates);
          setEditFields(prev => ({
            ...prev,
            employer: ext.employer_name || prev.employer,
            position: ext.position || prev.position,
            salary: ext.salary_net || prev.salary,
          }));
          toast.success("Dados do holerite preenchidos automaticamente!");
        }
      }

      setVerifyStep(3);

      if (data?.verification) {
        setVerification(data.verification);
        setShowVerification(true);
        toast.success("Empresa verificada com sucesso!");
        const { data: histData } = await supabase
          .from("employer_verifications")
          .select("*")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false });
        if (histData) setVerificationHistory(histData);
      }

      // Brief pause to show completed state
      await new Promise(r => setTimeout(r, 800));
    } catch (err: any) {
      console.error("Verify error:", err);
      toast.error("Erro ao verificar empresa: " + (err.message || "tente novamente"));
    } finally {
      setVerifyStep(-1);
    }
  };

  const handleDeleteDoc = async (docKey: string) => {
    setDeleting(docKey);
    try {
      // List files for this doc type
      const { data: files } = await supabase.storage
        .from("financing-docs")
        .list(client.id);
      const toDelete = (files || []).filter(f => f.name.startsWith(docKey));
      if (toDelete.length > 0) {
        await supabase.storage
          .from("financing-docs")
          .remove(toDelete.map(f => `${client.id}/${f.name}`));
      }
      // Unmark doc
      const newDocs = { ...docs, [docKey]: false };
      updateClient.mutate({
        id: client.id,
        financing_docs: newDocs,
        financing_status: "incomplete",
      } as any);
      setDocUrls(prev => {
        const next = { ...prev };
        delete next[docKey];
        return next;
      });
      toast.success("Documento removido!");
    } catch (err: any) {
      toast.error("Erro ao remover: " + (err.message || "tente novamente"));
    } finally {
      setDeleting(null);
    }
  };

  const handleUploadDoc = async (docKey: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie uma imagem");
      return;
    }
    setUploading(docKey);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${client.id}/${docKey}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("financing-docs").upload(path, file);
      if (error) throw error;

      // Mark doc as complete
      const newDocs = { ...docs, [docKey]: true };
      const allComplete = Object.values(newDocs).every(Boolean);
      updateClient.mutate({
        id: client.id,
        financing_docs: newDocs,
        financing_status: allComplete ? "ready" : "incomplete",
      } as any);

      toast.success("Documento enviado!");
      if (allComplete) toast.success("🎉 Documentação completa!");

      // If pay stub, trigger employer verification
      if (docKey === "pay_stub") {
        verifyEmployer(file);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar documento");
    } finally {
      setUploading(null);
    }
  };

  const saveFields = () => {
    const updates: any = { id: client.id };
    Object.entries(editFields).forEach(([k, v]) => {
      if (k === "salary" || k === "down_payment_amount") {
        updates[k] = v ? parseFloat(String(v)) : null;
      } else {
        updates[k] = v || null;
      }
    });

    // Check if reference is complete
    if (editFields.reference_name && editFields.reference_phone) {
      const newDocs = { ...docs, reference: true };
      updates.financing_docs = newDocs;
      if (Object.values(newDocs).every(Boolean)) updates.financing_status = "ready";
    }

    updateClient.mutate(updates);
    setEditing(false);
    toast.success("Dados atualizados!");
  };

  const togglePriority = (key: string, value: boolean) => {
    updateClient.mutate({ id: client.id, [key]: value } as any);
  };

  const togglePaymentType = (type: string) => {
    updateClient.mutate({ id: client.id, payment_type: type } as any);
  };

  const buildWhatsAppFicha = (): string => {
    const lines = [
      "📋 *FICHA DE FINANCIAMENTO*",
      "━━━━━━━━━━━━━━━━━━",
      "",
      `👤 *Nome:* ${client.name}`,
      `📞 *Telefone:* ${client.phone || "—"}`,
      `📧 *Email:* ${client.email || "—"}`,
      `📍 *Cidade:* ${client.city || "—"}`,
      `🏙️ *Cidade Natal:* ${client.birth_city || editFields.birth_city || "—"}`,
      "",
      "━━━ *TRABALHO* ━━━",
      `🏢 *Empresa:* ${client.employer || editFields.employer || "—"}`,
      `⏰ *Tempo:* ${client.employment_time || editFields.employment_time || "—"}`,
      `👔 *Cargo:* ${client.position || editFields.position || "—"}`,
      `💰 *Salário:* ${client.salary ? `R$ ${Number(client.salary).toLocaleString("pt-BR")}` : "—"}`,
      "",
      "━━━ *REFERÊNCIA* ━━━",
      `👤 *Nome:* ${client.reference_name || editFields.reference_name || "—"}`,
      `📞 *Telefone:* ${client.reference_phone || editFields.reference_phone || "—"}`,
      "",
      "━━━ *INTERESSE* ━━━",
      `🏍️ *Interesse:* ${client.interest || "—"}`,
      `💵 *Orçamento:* ${client.budget_range || "—"}`,
      `💳 *Tipo:* ${client.payment_type === "cash" ? "À vista" : "Financiamento"}`,
      client.has_down_payment ? `💰 *Entrada:* R$ ${client.down_payment_amount ? Number(client.down_payment_amount).toLocaleString("pt-BR") : "Sim"}` : "",
      client.has_clean_credit ? "✅ *Nome limpo*" : "",
      "",
      "━━━ *DOCUMENTOS* ━━━",
      ...DOC_LABELS.map(d => `${docs[d.key] ? "✅" : "❌"} ${d.label}`),
      "",
      `📊 *Prioridade:* ${priority.label} (${priority.score}pts)`,
      "",
      client.notes ? `📝 *Obs:* ${client.notes}` : "",
    ].filter(Boolean);

    // Add document links if available
    const docLinks = Object.entries(docUrls);
    if (docLinks.length > 0) {
      lines.push("", "━━━ *ANEXOS (DOCS)* ━━━");
      for (const [key, url] of docLinks) {
        const label = DOC_LABELS.find(d => d.key === key);
        if (label) lines.push(`📎 ${label.emoji} ${label.label}: ${url}`);
      }
    }

    return lines.join("\n");
  };

  const sendFichaWhatsApp = async () => {
    const FINANCEIRA_NUMBER = "5500000000000"; // placeholder
    const msg = buildWhatsAppFicha();
    window.open(`https://wa.me/${FINANCEIRA_NUMBER}?text=${encodeURIComponent(msg)}`);
    toast.success("Ficha aberta no WhatsApp!");
  };

  const copyFicha = () => {
    navigator.clipboard.writeText(buildWhatsAppFicha());
    toast.success("Ficha copiada com links dos documentos!");
  };

  const openDocPreview = (key: string, url: string) => {
    const label = DOC_LABELS.find(d => d.key === key);
    setPreviewDoc({ key, url, label: label?.label || key });
  };

  return (
    <div className="space-y-4">
      {/* Priority Score Badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" /> Prioridade do Cliente
          </p>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold font-mono ${priority.color}`}>{priority.score}pts</span>
            <span className={`text-xs font-medium ${priority.color}`}>{priority.label}</span>
          </div>
        </div>

        {/* Priority factors */}
        <div className="space-y-2">
          {PRIORITY_FACTORS.map((f) => (
            <div key={f.key} className="flex items-center justify-between py-1">
              <span className="text-xs flex items-center gap-1.5">
                {f.emoji} {f.label} <span className="text-muted-foreground">(+{f.points}pts)</span>
              </span>
              <Switch
                checked={!!client[f.key]}
                onCheckedChange={(v) => togglePriority(f.key, v)}
              />
            </div>
          ))}

          <div className="flex items-center justify-between py-1">
            <span className="text-xs flex items-center gap-1.5">
              💳 Tipo de pagamento
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={client.payment_type === "cash" ? "default" : "outline"}
                className="rounded-full text-[10px] h-6 px-2"
                onClick={() => togglePaymentType("cash")}
              >
                À vista (+30)
              </Button>
              <Button
                size="sm"
                variant={client.payment_type === "financing" || !client.payment_type ? "default" : "outline"}
                className="rounded-full text-[10px] h-6 px-2"
                onClick={() => togglePaymentType("financing")}
              >
                Financiamento
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Document Checklist */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-primary" /> Documentos para Financiamento
          </p>
          <span className={`text-xs font-mono ${allDocsComplete ? "text-green-400" : "text-muted-foreground"}`}>
            {docsCompleted}/{docsTotal}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-secondary overflow-hidden mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8 }}
            className={`h-full rounded-full ${allDocsComplete ? "bg-green-500" : "bg-primary"}`}
          />
        </div>

        <div className="space-y-2">
          {DOC_LABELS.map((doc) => (
            <div key={doc.key} className="flex items-center gap-2 py-2 border-b border-border/30 last:border-0">
              <button onClick={() => toggleDoc(doc.key)} className="shrink-0">
                {docs[doc.key] ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              <span className="text-xs flex-1">
                {doc.emoji} {doc.label}
              </span>
              {docUrls[doc.key] && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-[10px] h-7 gap-1 text-primary"
                    onClick={() => openDocPreview(doc.key, docUrls[doc.key])}
                  >
                    <Eye className="w-3 h-3" /> Ver
                  </Button>
                  {confirmDelete === doc.key ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="rounded-full text-[10px] h-7 px-2"
                        disabled={deleting === doc.key}
                        onClick={() => { handleDeleteDoc(doc.key); setConfirmDelete(null); }}
                      >
                        {deleting === doc.key ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sim"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-[10px] h-7 px-2"
                        onClick={() => setConfirmDelete(null)}
                      >
                        Não
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-[10px] h-7 gap-1 text-destructive"
                      onClick={() => setConfirmDelete(doc.key)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-[10px] h-7 gap-1"
                disabled={uploading === doc.key}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleUploadDoc(doc.key, file);
                  };
                  input.click();
                }}
              >
                {uploading === doc.key ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3" />
                )}
                Foto
              </Button>
            </div>
          ))}
        </div>

        {allDocsComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center"
          >
            <p className="text-xs text-green-400 font-medium">
              ✅ Documentação completa — pronto para enviar ficha!
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* Employer Verification Result */}
      {(verifying || verification) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <button
            onClick={() => setShowVerification(!showVerification)}
            className="w-full flex items-center justify-between"
          >
            <p className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Verificação da Empresa
              {verifying && <Loader2 className="w-3 h-3 animate-spin" />}
            </p>
            <div className="flex items-center gap-2">
              {verification?.verified && (
                <ShieldCheck className="w-4 h-4 text-green-400" />
              )}
              {verification && !verification.verified && (
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              )}
              {showVerification ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
          </button>

          {showVerification && verifying && (
            <div className="mt-4 space-y-1">
              {VERIFY_STEPS.map((step, i) => {
                const isActive = verifyStep === i;
                const isDone = verifyStep > i;
                const isPending = verifyStep < i;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${
                      isActive ? "bg-primary/10 border border-primary/30" :
                      isDone ? "bg-secondary/30" : "opacity-40"
                    }`}
                  >
                    <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
                      {isDone ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        </motion.div>
                      ) : isActive ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground/50" />
                      )}
                    </div>
                    <span className={`text-xs font-medium transition-colors ${
                      isActive ? "text-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/50"
                    }`}>
                      {step.emoji} {step.label}
                    </span>
                    {isActive && (
                      <motion.div
                        className="ml-auto flex gap-0.5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        {[0, 1, 2].map(dot => (
                          <motion.div
                            key={dot}
                            className="w-1 h-1 rounded-full bg-primary"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.2 }}
                          />
                        ))}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}

              {/* Progress bar */}
              <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: `${Math.min(((verifyStep + 1) / VERIFY_STEPS.length) * 100, 100)}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {showVerification && !verifying && extractedPayStub && (
            <div className="mt-3 space-y-3">
              {/* Extracted Data */}
              <div className="bg-secondary/30 rounded-xl p-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  📋 Dados extraídos do holerite
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {extractedPayStub.employer_name && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">Empresa</p>
                      <p className="text-xs font-medium">{extractedPayStub.employer_name}</p>
                    </div>
                  )}
                  {extractedPayStub.employer_cnpj && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">CNPJ</p>
                      <p className="text-xs font-medium font-mono">{extractedPayStub.employer_cnpj}</p>
                    </div>
                  )}
                  {extractedPayStub.position && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">Cargo</p>
                      <p className="text-xs font-medium">{extractedPayStub.position}</p>
                    </div>
                  )}
                  {extractedPayStub.salary_net && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">Salário líquido</p>
                      <p className="text-xs font-medium text-green-400">
                        R$ {Number(extractedPayStub.salary_net).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  )}
                  {extractedPayStub.salary_gross && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">Salário bruto</p>
                      <p className="text-xs font-medium">
                        R$ {Number(extractedPayStub.salary_gross).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  )}
                  {extractedPayStub.admission_date && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">Admissão</p>
                      <p className="text-xs font-medium">{extractedPayStub.admission_date}</p>
                    </div>
                  )}
                  {extractedPayStub.reference_month && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">Mês referência</p>
                      <p className="text-xs font-medium">{extractedPayStub.reference_month}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Result */}
              {verification && (
                <div className={`rounded-xl p-3 border ${
                  verification.verified
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-amber-500/5 border-amber-500/20"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {verification.verified ? (
                      <ShieldCheck className="w-4 h-4 text-green-400" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                    )}
                    <p className="text-xs font-medium">
                      {verification.verified ? "Empresa verificada" : "Verificação inconclusiva"}
                    </p>
                    {verification.reliability_score && (
                      <span className={`text-[10px] font-bold font-mono ml-auto ${
                        verification.reliability_score >= 7 ? "text-green-400"
                        : verification.reliability_score >= 4 ? "text-amber-400"
                        : "text-red-400"
                      }`}>
                        {verification.reliability_score}/10
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {verification.company_name && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Nome: </span>
                        <span className="font-medium">{verification.company_name}</span>
                      </p>
                    )}
                    {verification.sector && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Setor: </span>{verification.sector}
                      </p>
                    )}
                    {verification.size && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Porte: </span>{verification.size}
                      </p>
                    )}
                    {verification.location && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Local: </span>{verification.location}
                      </p>
                    )}
                    {verification.description && (
                      <p className="text-[10px] text-muted-foreground mt-1">{verification.description}</p>
                    )}
                  </div>

                  {/* Flags */}
                  {verification.positive_flags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {verification.positive_flags.map((flag: string, i: number) => (
                        <span key={i} className="text-[9px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded-full">
                          ✅ {flag}
                        </span>
                      ))}
                    </div>
                  )}
                  {verification.risk_flags?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {verification.risk_flags.map((flag: string, i: number) => (
                        <span key={i} className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full">
                          ⚠️ {flag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Verification History */}
      {verificationHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between"
          >
            <p className="text-sm font-medium flex items-center gap-2">
              <History className="w-4 h-4 text-primary" /> Histórico de Verificações
              <span className="text-[10px] text-muted-foreground font-mono">({verificationHistory.length})</span>
            </p>
            {showHistory ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>

          {showHistory && (
            <div className="mt-3 space-y-2">
              {verificationHistory.map((v: any) => (
                <div
                  key={v.id}
                  className={`rounded-lg p-3 border cursor-pointer transition-colors hover:bg-secondary/50 ${
                    v.verified ? "border-green-500/20 bg-green-500/5" : "border-amber-500/20 bg-amber-500/5"
                  }`}
                  onClick={() => {
                    setVerification({
                      company_name: v.company_name,
                      trading_name: v.trading_name,
                      sector: v.sector,
                      size: v.size,
                      status: v.status,
                      location: v.location,
                      address: v.address,
                      verified: v.verified,
                      cnpj_validated: v.cnpj_validated,
                      reliability_score: v.reliability_score,
                      source: v.source,
                      risk_flags: v.risk_flags || [],
                      positive_flags: v.positive_flags || [],
                    });
                    if (v.extracted_data) setExtractedPayStub(v.extracted_data);
                    setShowVerification(true);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {v.verified ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span className="text-xs font-medium">{v.company_name || v.employer_name || "Empresa"}</span>
                      {v.cnpj && <span className="text-[9px] font-mono text-muted-foreground">{v.cnpj}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {v.reliability_score && (
                        <span className={`text-[10px] font-bold font-mono ${
                          v.reliability_score >= 7 ? "text-green-400" : v.reliability_score >= 4 ? "text-amber-400" : "text-red-400"
                        }`}>{v.reliability_score}/10</span>
                      )}
                      <div className="flex items-center gap-0.5 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span className="text-[9px]">
                          {new Date(v.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  </div>
                  {v.source && <p className="text-[9px] text-muted-foreground mt-1">{v.source}</p>}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" /> Dados de Trabalho e Referência
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full text-[10px] h-7 gap-1"
            onClick={() => editing ? saveFields() : setEditing(true)}
          >
            {editing ? <Save className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
            {editing ? "Salvar" : "Editar"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "phone", label: "📞 Telefone", span: 2 },
            { key: "employer", label: "🏢 Empresa" },
            { key: "employment_time", label: "⏰ Tempo de empresa" },
            { key: "position", label: "👔 Cargo" },
            { key: "salary", label: "💰 Salário", type: "number" },
            { key: "birth_city", label: "🏙️ Cidade natal" },
            { key: "down_payment_amount", label: "💵 Valor entrada", type: "number" },
            { key: "reference_name", label: "👤 Nome referência" },
            { key: "reference_phone", label: "📞 Tel. referência" },
          ].map((field) => (
            <div key={field.key} className={field.span === 2 ? "col-span-2" : ""}>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">{field.label}</label>
              {editing ? (
                <Input
                  type={field.type || "text"}
                  value={(editFields as any)[field.key] || ""}
                  onChange={(e) => setEditFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
                />
              ) : (
                <p className="text-xs font-medium">
                  {field.type === "number" && (client as any)[field.key]
                    ? `R$ ${Number((client as any)[field.key]).toLocaleString("pt-BR")}`
                    : (client as any)[field.key] || "—"}
                </p>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Bank Proposal Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4 space-y-4"
      >
        <p className="text-sm font-medium flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-primary" /> Proposta do Banco
        </p>

        {/* Status buttons */}
        <div className="flex gap-1.5">
          {[
            { value: "approved", label: "✅ Aprovado", color: "bg-green-500/15 text-green-400 border-green-500/30" },
            { value: "pre_approved", label: "🟡 Pré-Aprovado", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
            { value: "rejected", label: "❌ Recusado", color: "bg-destructive/15 text-destructive border-destructive/30" },
          ].map((s) => (
            <Button
              key={s.value}
              size="sm"
              variant="outline"
              className={cn(
                "rounded-full text-[10px] h-7 flex-1 border transition-all",
                client.financing_status === s.value
                  ? s.color + " font-bold ring-1 ring-offset-1 ring-offset-background"
                  : "border-border/50"
              )}
              onClick={() => {
                updateClient.mutate({ id: client.id, financing_status: s.value } as any);
                toast.success(`Status atualizado: ${s.label}`);
              }}
            >
              {s.label}
            </Button>
          ))}
        </div>

        {/* Bank details - show when approved or pre_approved */}
        {(client.financing_status === "approved" || client.financing_status === "pre_approved") && (
          <div className="space-y-3 bg-secondary/30 rounded-xl p-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              📋 Dados da resposta do banco
            </p>

            {/* Bank name */}
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">🏦 Banco / Financeira</label>
              <Input
                value={bankProposal.bank_name || ""}
                onChange={(e) => setBankProposal(prev => ({ ...prev, bank_name: e.target.value }))}
                placeholder="Ex: Itaú, Bradesco, BV..."
                className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
              />
            </div>

            {/* Approved amount */}
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">💰 Valor liberado</label>
              <Input
                type="number"
                value={bankProposal.approved_amount || ""}
                onChange={(e) => setBankProposal(prev => ({ ...prev, approved_amount: e.target.value ? parseFloat(e.target.value) : undefined }))}
                placeholder="Ex: 25000"
                className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
              />
            </div>

            {/* Installment options */}
            <div>
              <label className="text-[10px] text-muted-foreground mb-1.5 block">📊 Parcelas disponíveis (valor de cada)</label>
              <div className="grid grid-cols-5 gap-1.5">
                {["12", "24", "36", "48", "60"].map((months) => (
                  <div key={months} className="text-center">
                    <p className="text-[9px] font-bold text-primary mb-0.5">{months}x</p>
                    <Input
                      type="number"
                      value={bankProposal.installments?.[months] || ""}
                      onChange={(e) => {
                        const val = e.target.value ? parseFloat(e.target.value) : undefined;
                        setBankProposal(prev => ({
                          ...prev,
                          installments: { ...(prev.installments || {}), [months]: val },
                        }));
                      }}
                      placeholder="R$"
                      className="rounded-lg bg-secondary border-border/50 h-7 text-[10px] text-center px-1"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">📝 Observações da operadora</label>
              <Input
                value={bankProposal.notes || ""}
                onChange={(e) => setBankProposal(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Ex: Precisa de avalista, entrada mínima 30%..."
                className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
              />
            </div>

            {/* Save button */}
            <Button
              size="sm"
              className="w-full rounded-xl h-8 text-xs gap-1.5"
              onClick={() => {
                const currentFunnelData = (client.funnel_data as any) || {};
                updateClient.mutate({
                  id: client.id,
                  funnel_data: { ...currentFunnelData, bank_proposal: bankProposal },
                } as any);
                toast.success("Dados do banco salvos!");
              }}
            >
              <Save className="w-3 h-3" /> Salvar dados do banco
            </Button>

            {/* Summary of available installments */}
            {bankProposal.installments && Object.values(bankProposal.installments).some(v => v) && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-2">
                <p className="text-[10px] font-medium text-primary mb-1">📊 Resumo das parcelas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(bankProposal.installments)
                    .filter(([_, v]) => v)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([months, value]) => (
                      <span key={months} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {months}x R$ {Number(value).toLocaleString("pt-BR")}
                      </span>
                    ))}
                </div>
                {bankProposal.approved_amount && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Valor liberado: <span className="font-bold text-foreground">R$ {Number(bankProposal.approved_amount).toLocaleString("pt-BR")}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Rejected notes */}
        {client.financing_status === "rejected" && (
          <div className="space-y-2 bg-destructive/5 rounded-xl p-3 border border-destructive/20">
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">🏦 Banco que recusou</label>
              <Input
                value={bankProposal.bank_name || ""}
                onChange={(e) => setBankProposal(prev => ({ ...prev, bank_name: e.target.value }))}
                placeholder="Ex: Itaú, Bradesco..."
                className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-0.5 block">📝 Motivo / Observação</label>
              <Input
                value={bankProposal.notes || ""}
                onChange={(e) => setBankProposal(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Ex: Score baixo, restrição no CPF..."
                className="rounded-xl bg-secondary border-border/50 h-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-xl h-8 text-xs gap-1.5 border-destructive/30"
              onClick={() => {
                const currentFunnelData = (client.funnel_data as any) || {};
                updateClient.mutate({
                  id: client.id,
                  funnel_data: { ...currentFunnelData, bank_proposal: bankProposal },
                } as any);
                toast.success("Dados salvos!");
              }}
            >
              <Save className="w-3 h-3" /> Salvar
            </Button>
          </div>
        )}

        {/* Upload bank proposal */}
        <div className="flex items-center gap-2">
          {bankProposalUrl ? (
            <div className="flex-1 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-[10px] h-7 gap-1 text-primary"
                onClick={() => setPreviewDoc({ key: "bank_proposal", url: bankProposalUrl, label: "Proposta do Banco" })}
              >
                <Eye className="w-3 h-3" /> Ver proposta
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-[10px] h-7 gap-1 text-destructive"
                onClick={async () => {
                  try {
                    const { data: files } = await supabase.storage.from("financing-docs").list(client.id);
                    const toDelete = (files || []).filter(f => f.name.startsWith("bank_proposal_"));
                    if (toDelete.length > 0) {
                      await supabase.storage.from("financing-docs").remove(toDelete.map(f => `${client.id}/${f.name}`));
                    }
                    setBankProposalUrl(null);
                    toast.success("Proposta removida!");
                  } catch { toast.error("Erro ao remover"); }
                }}
              >
                <Trash2 className="w-3 h-3" /> Remover
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full text-[10px] h-7 gap-1 flex-1"
              disabled={uploadingBankProposal}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*,.pdf";
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  setUploadingBankProposal(true);
                  try {
                    const ext = file.name.split(".").pop() || "jpg";
                    const path = `${client.id}/bank_proposal_${Date.now()}.${ext}`;
                    const { error } = await supabase.storage.from("financing-docs").upload(path, file);
                    if (error) throw error;
                    toast.success("Proposta do banco anexada!");
                  } catch (err: any) {
                    toast.error(err.message || "Erro ao enviar");
                  } finally {
                    setUploadingBankProposal(false);
                  }
                };
                input.click();
              }}
            >
              {uploadingBankProposal ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              📎 Anexar print/foto da proposta
            </Button>
          )}
        </div>
      </motion.div>

      {/* Send to WhatsApp */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4"
      >
        <p className="text-sm font-medium mb-3 flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" /> Enviar Ficha para Financeira
        </p>

        {!allDocsComplete && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
            <p className="text-[10px] text-yellow-400">
              Documentação incompleta ({docsCompleted}/{docsTotal}). Você pode enviar mesmo assim.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            className="flex-1 rounded-xl gap-1.5 glow-red"
            onClick={sendFichaWhatsApp}
          >
            <MessageCircle className="w-4 h-4" /> Enviar via WhatsApp
          </Button>
          <Button
            variant="outline"
            className="rounded-xl gap-1.5"
            onClick={copyFicha}
          >
            📋 Copiar
          </Button>
        </div>
      </motion.div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative max-w-lg w-full max-h-[85vh] bg-card rounded-2xl overflow-hidden shadow-2xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border">
              <p className="text-sm font-medium">{previewDoc.label}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px] gap-1"
                  onClick={() => window.open(previewDoc.url, "_blank")}
                >
                  <ExternalLink className="w-3 h-3" /> Abrir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px]"
                  onClick={() => setPreviewDoc(null)}
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="overflow-auto max-h-[75vh] p-2 flex items-center justify-center">
              <img
                src={previewDoc.url}
                alt={previewDoc.label}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default FinancingSection;
