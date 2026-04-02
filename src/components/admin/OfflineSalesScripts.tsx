import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, ChevronDown, ChevronUp, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface OfflineSalesScriptsProps {
  clientName: string;
  clientPhone?: string;
  clientInterest?: string;
  clientBudget?: string;
}

const SCRIPT_CATEGORIES = [
  { key: "spin", label: "🎯 SPIN Selling", color: "bg-blue-400/15 text-blue-400" },
  { key: "objection", label: "⚡ Quebrar Objeções", color: "bg-amber-400/15 text-amber-400" },
  { key: "followup", label: "📅 Follow-up", color: "bg-emerald-400/15 text-emerald-400" },
  { key: "closing", label: "🏆 Fechamento", color: "bg-pink-400/15 text-pink-400" },
  { key: "reactivation", label: "🔄 Reativação", color: "bg-purple-400/15 text-purple-400" },
];

interface Script {
  id: string;
  category: string;
  title: string;
  context: string;
  steps: string[];
  whatsappMessage: string;
}

const OFFLINE_SCRIPTS: Script[] = [
  // SPIN
  {
    id: "spin-situacao",
    category: "spin",
    title: "Perguntas de Situação",
    context: "Use no primeiro contato para entender o cenário do cliente",
    steps: [
      "Qual moto você usa hoje? Há quanto tempo?",
      "Pra que você mais usa? Trabalho, lazer, dia a dia?",
      "Já teve alguma moto antes? Qual?",
      "Tá pensando em trocar ou é a primeira?",
      "Quanto mais ou menos você quer investir?",
    ],
    whatsappMessage: "Fala {nome}! 👋 Beleza? Vi que você tem interesse em motos. Me conta, você já tem uma hoje ou seria sua primeira? Pergunto pra te indicar a melhor opção pro seu perfil! 🏍️",
  },
  {
    id: "spin-problema",
    category: "spin",
    title: "Perguntas de Problema",
    context: "Identifique dores e insatisfações para criar urgência",
    steps: [
      "O que mais te incomoda na sua moto atual?",
      "Já teve problema mecânico recente?",
      "Tá gastando muito com manutenção?",
      "Sente que ela já não atende mais suas necessidades?",
      "Já deixou de fazer algo por causa da moto atual?",
    ],
    whatsappMessage: "E aí {nome}, me conta uma coisa... sua moto atual tá te dando alguma dor de cabeça? 🤔 Tipo manutenção cara, consumo alto... Pergunto porque tenho umas opções que podem resolver isso de vez! 💪",
  },
  {
    id: "spin-implicacao",
    category: "spin",
    title: "Perguntas de Implicação",
    context: "Mostre as consequências de não agir agora",
    steps: [
      "Se continuar com essa moto, quanto vai gastar de manutenção nos próximos 6 meses?",
      "E se ela quebrar no meio do caminho pro trabalho?",
      "Quanto de desvalorização ela perde por mês?",
      "Já pensou que cada mês que passa, sua moto vale menos na troca?",
      "Se as parcelas de uma nova cabem no que você gasta de manutenção, faz sentido trocar, né?",
    ],
    whatsappMessage: "{nome}, pensa comigo: se sua moto desvaloriza R$200/mês e você gasta R$300 de manutenção... em 6 meses são R$3.000 jogados fora 😬 Com esse valor você já dá entrada numa nova! Quer ver as opções?",
  },
  {
    id: "spin-necessidade",
    category: "spin",
    title: "Perguntas de Necessidade",
    context: "Faça o cliente verbalizar que precisa da solução",
    steps: [
      "Se eu te mostrasse uma moto que resolve tudo isso, com parcela que cabe no bolso, você teria interesse?",
      "O que seria a moto ideal pra você?",
      "Se eu conseguir uma condição especial essa semana, fecha?",
      "Imagina sair daqui hoje pilotando sua moto nova... como seria?",
      "Se a parcela ficar em X, fecha negócio?",
    ],
    whatsappMessage: "{nome}, e se eu te disser que tenho uma moto que resolve tudo isso, com parcela a partir de R$XXX? 🔥 Sem dor de cabeça, garantia, revisão em dia... Posso te mostrar? Tenho uma condição especial só até sexta! ⏰",
  },

  // OBJEÇÕES
  {
    id: "obj-preco",
    category: "objection",
    title: "\"Tá caro / Não tenho dinheiro\"",
    context: "A objeção mais comum. Nunca discuta o preço, reframe o valor.",
    steps: [
      "Entendo! Mas me diz: caro comparado a quê?",
      "Divida o valor por 30 dias... fica menos que um café por dia",
      "Compare: quanto você gasta de Uber/ônibus por mês?",
      "Mostre a economia: combustível, tempo, praticidade",
      "Ofereça: 'E se eu conseguir uma condição especial?'",
      "Ancoragem: mostre primeiro a opção mais cara, depois a ideal",
    ],
    whatsappMessage: "{nome}, entendo que o valor parece alto olhando assim 😊 Mas pensa comigo: a parcela de R$XXX por dia fica menos de R$XX... Menos que um almoço! E você economiza tempo, combustível e tem liberdade total. Quer que eu veja uma condição especial pra você? 💰",
  },
  {
    id: "obj-pensar",
    category: "objection",
    title: "\"Vou pensar / Preciso consultar\"",
    context: "O cliente tem dúvida, não objeção real. Descubra o verdadeiro motivo.",
    steps: [
      "Perfeito! O que exatamente você quer pensar? (descubra a objeção real)",
      "'Pensar sobre o preço, a moto ou o momento?'",
      "Se for cônjuge: 'Quer que eu prepare um resumo pra você mostrar?'",
      "Crie urgência: 'Entendo! Só que essa condição vale até sexta...'",
      "Opção: 'Posso reservar pra você por 24h sem compromisso'",
      "Nunca pressione, mas mantenha o follow-up agendado",
    ],
    whatsappMessage: "{nome}, tranquilo! 👍 Pensar é importante. Só quero te ajudar: o que ficou em dúvida? O valor, a moto ou o momento? Pergunto porque posso preparar algo que facilite sua decisão. E se quiser, reservo ela pra você até amanhã sem compromisso! 😊",
  },
  {
    id: "obj-concorrencia",
    category: "objection",
    title: "\"Vi mais barato em outro lugar\"",
    context: "Nunca fale mal do concorrente. Destaque diferenciais e segurança.",
    steps: [
      "'Legal! Onde você viu? Posso te ajudar a comparar'",
      "Pergunte: procedência, garantia, revisão, documentação",
      "Destaque: 'Aqui você tem garantia, procedência verificada, FIPE'",
      "Compare custo total: preço + documentação + revisão + segurança",
      "Mostre avaliações e cases de clientes satisfeitos",
      "'O barato sai caro quando você não tem garantia'",
    ],
    whatsappMessage: "{nome}, que bom que está pesquisando! 👏 Mas me fala: esse outro lugar oferece garantia? Procedência verificada? Documentação ok? Aqui na Arsenal cada moto passa por 47 pontos de inspeção. O preço pode parecer menor lá, mas o custo total (documentação + revisão + risco) geralmente é maior. Quer que eu compare os dois pra você? 📊",
  },
  {
    id: "obj-entrada",
    category: "objection",
    title: "\"Não tenho entrada\"",
    context: "Trabalhe alternativas: troca, consórcio, condição especial.",
    steps: [
      "'Tem alguma moto ou veículo pra dar na troca?'",
      "'E se a gente parcelasse a entrada?'",
      "Mostre opção sem entrada (parcela maior, mas viável)",
      "Simule: 'Com sua moto na troca, a entrada fica coberta'",
      "Consórcio contemplado como alternativa",
      "'Posso ver uma condição especial sem entrada pra você'",
    ],
    whatsappMessage: "{nome}, sobre a entrada: você tem algum veículo pra dar na troca? 🔄 Muitos clientes nossos entram sem tirar nada do bolso! A moto atual já serve como entrada. E se não tiver, tenho opções sem entrada com parcela acessível. Quer que eu simule? 📱",
  },
  {
    id: "obj-nome-sujo",
    category: "objection",
    title: "\"Meu nome tá sujo\"",
    context: "Nunca julgue. Mostre alternativas com empatia.",
    steps: [
      "'Entendo, isso acontece com muita gente. Vamos ver as opções'",
      "Verifique: Score, valor da dívida, tempo de negativação",
      "Opções: entrada maior, fiador, consórcio",
      "Algumas financeiras aceitam score baixo com entrada de 40-50%",
      "'Já tive clientes na mesma situação que saíram pilotando'",
      "Se possível: 'Limpa o nome primeiro, eu reservo a moto'",
    ],
    whatsappMessage: "{nome}, relaxa! Isso é mais comum do que você imagina 😊 Tenho opções que funcionam mesmo assim. Algumas financeiras trabalham com score diferente. Me fala: você conseguiria uma entrada um pouco maior? Com 40-50% de entrada, as chances são bem altas! Vamos ver juntos? 💪",
  },

  // FOLLOW-UP
  {
    id: "fu-24h",
    category: "followup",
    title: "Follow-up 24 horas (Lembrete)",
    context: "Primeiro contato após proposta. Tom leve, sem pressão.",
    steps: [
      "Agradeça o interesse",
      "Recapitule brevemente a proposta",
      "Pergunte se ficou alguma dúvida",
      "Reforce um benefício-chave",
      "Deixe a porta aberta",
    ],
    whatsappMessage: "E aí {nome}! 👋 Tudo bem? Passei pra saber se deu pra pensar naquela proposta que te mandei ontem. A [MODELO] de R$XXX com parcela de R$XXX ficou boa pra você? Se tiver qualquer dúvida, tô aqui! 😊",
  },
  {
    id: "fu-48h",
    category: "followup",
    title: "Follow-up 48 horas (Escassez)",
    context: "Criar senso de urgência sutil, mostrar demanda.",
    steps: [
      "Mencione que houve interesse de outros clientes",
      "Reforce a condição especial com prazo",
      "Mostre que o preço pode mudar",
      "Ofereça algo extra: revisão grátis, acessório",
      "Pergunte se quer reservar",
    ],
    whatsappMessage: "{nome}, passei pra te avisar: tivemos mais 2 pessoas interessadas na [MODELO] que te mostrei 👀 Como te ofereci primeiro, quero saber se quer que eu reserve pra você. A condição especial que te passei vale até amanhã! Me avisa? 🏍️",
  },
  {
    id: "fu-72h",
    category: "followup",
    title: "Follow-up 72 horas (Última chance)",
    context: "Deadline real. Escassez máxima mas sem ser agressivo.",
    steps: [
      "Comunique que a condição vai expirar",
      "Mostre o que o cliente perde se não agir",
      "Ofereça facilidade adicional",
      "Dê uma alternativa (outra moto, condição)",
      "Encerre com pergunta direta",
    ],
    whatsappMessage: "{nome}, última mensagem sobre isso, prometo! 😅 Aquela condição especial da [MODELO] vence hoje. Depois disso o preço volta ao normal (R$XXX a mais). Se quiser, consigo segurar até às 18h. O que me diz? Sim ou não, sem pressão! 🤝",
  },
  {
    id: "fu-7d",
    category: "followup",
    title: "Follow-up 7 dias (Reengajamento)",
    context: "Abordagem completamente diferente. Gere curiosidade.",
    steps: [
      "Não mencione a proposta anterior",
      "Traga novidade: novo modelo, promoção, condição",
      "Use gatilho de novidade ou prova social",
      "Tom casual e amigável",
      "Convide para visitar sem compromisso",
    ],
    whatsappMessage: "{nome}! Tudo bem? 😊 Chegou uma novidade aqui que lembrei de você na hora: [NOVIDADE]. Achei sua cara! Sem compromisso nenhum, mas se quiser dar uma olhada, tô aqui até as 18h. Um café te espera! ☕🏍️",
  },

  // FECHAMENTO
  {
    id: "close-alternativa",
    category: "closing",
    title: "Fechamento por Alternativa",
    context: "Ofereça duas opções — ambas levam ao fechamento.",
    steps: [
      "Nunca pergunte 'vai querer?'",
      "Ofereça: 'Você prefere a preta ou a vermelha?'",
      "'Quer dar entrada de X ou Y?'",
      "'Prefere começar a pagar em maio ou junho?'",
      "Qualquer resposta = venda encaminhada",
    ],
    whatsappMessage: "{nome}, já separei as duas melhores opções pra você! 🔥 A [MODELO A] preta com parcela de R$XXX ou a [MODELO B] vermelha com parcela de R$XXX. Qual combina mais com você? Reservo agora e fazemos a papelada amanhã! 📝",
  },
  {
    id: "close-resumo",
    category: "closing",
    title: "Fechamento por Resumo",
    context: "Recapitule todos os pontos positivos e peça o fechamento.",
    steps: [
      "Liste tudo que o cliente gostou durante a conversa",
      "'Então vamos recapitular: você gostou do modelo, a parcela cabe...'",
      "'A moto resolve seu problema de X, tem garantia de Y...'",
      "'Falta alguma coisa pra fecharmos?'",
      "Se sim: resolva. Se não: 'Então vamos fazer sua ficha!'",
    ],
    whatsappMessage: "{nome}, deixa eu recapitular: ✅ Modelo que você curtiu, ✅ Parcela de R$XXX que cabe no bolso, ✅ Sua moto atual como entrada, ✅ Garantia de 6 meses, ✅ Documentação inclusa. Falta alguma coisa pra fecharmos? Se tiver tudo certo, preparo sua ficha agora! 🏆",
  },
  {
    id: "close-urgencia",
    category: "closing",
    title: "Fechamento por Urgência Real",
    context: "Use escassez verdadeira, nunca invente.",
    steps: [
      "Última unidade, fim de promoção, condição especial",
      "'Essa é a última com esse preço'",
      "'A taxa do banco muda na segunda'",
      "'Tenho 3 pessoas olhando essa mesma moto'",
      "Ofereça reserva: 'Posso segurar por X horas'",
    ],
    whatsappMessage: "{nome}, vou ser sincero: essa [MODELO] é a última com esse preço. Já tive 3 consultas hoje sobre ela 😬 Se quiser, consigo segurar até amanhã de manhã. Depois não garanto. Me avisa? 🏍️🔥",
  },

  // REATIVAÇÃO
  {
    id: "react-novidade",
    category: "reactivation",
    title: "Reativação com Novidade",
    context: "Para leads inativos há 15-30 dias. Traga algo novo.",
    steps: [
      "Não cobre, não pergunte 'ainda quer?'",
      "Traga novidade genuína: chegada, promoção, feira",
      "Tom casual como se lembrasse do cliente",
      "Convide para algo sem compromisso",
      "Foto do veículo novo gera mais clique",
    ],
    whatsappMessage: "Eiii {nome}! 😄 Lembrei de você agora: chegou uma [MODELO] aqui que é exatamente o que você tava procurando! [DETALHE]. Passou por aqui? Tô com ela separada, se quiser dar uma olhada! Sem compromisso 😊",
  },
  {
    id: "react-prova-social",
    category: "reactivation",
    title: "Reativação com Prova Social",
    context: "Mostre que outros compraram. Efeito manada.",
    steps: [
      "Conte história de outro cliente parecido",
      "'Um cliente com perfil parecido com o seu acabou de fechar'",
      "Mostre depoimento ou foto de entrega",
      "Gere FOMO: 'Ele também tava em dúvida'",
      "Convide para conversar",
    ],
    whatsappMessage: "{nome}! Sabia que o João, que tava na mesma dúvida que você, fechou semana passada? Saiu pilotando a [MODELO] e já me mandou mensagem dizendo que foi a melhor decisão! 🏍️ Guardei uma condição parecida pra você. Bora conversar? 💪",
  },
  {
    id: "react-condicao",
    category: "reactivation",
    title: "Reativação com Condição Especial",
    context: "Para leads frios. Ofereça algo que não ofereceu antes.",
    steps: [
      "Crie uma condição exclusiva e temporária",
      "Justifique: fim de mês, meta, aniversário da loja",
      "Coloque deadline: 'Só até sexta'",
      "Facilite: sem entrada, taxa menor, brinde",
      "Peça resposta direta",
    ],
    whatsappMessage: "{nome}, tô com uma condição que nunca fiz antes e lembrei de você 🤫 Estamos batendo meta esse mês e meu gerente liberou [CONDIÇÃO ESPECIAL]. Mas é só até sexta! Achei justo te avisar primeiro. Tem interesse? 🔥",
  },
];

const OfflineSalesScripts = ({ clientName, clientPhone, clientInterest, clientBudget }: OfflineSalesScriptsProps) => {
  const [activeCategory, setActiveCategory] = useState("spin");
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const firstName = clientName?.split(" ")[0] || "Cliente";

  const personalizeMsg = (msg: string) =>
    msg
      .replace(/\{nome\}/gi, firstName)
      .replace(/\{interesse\}/gi, clientInterest || "motos")
      .replace(/\{orcamento\}/gi, clientBudget || "a combinar");

  const copyMsg = (msg: string) => {
    navigator.clipboard.writeText(personalizeMsg(msg));
    toast.success("Mensagem copiada!");
  };

  const sendWhatsApp = (msg: string) => {
    if (!clientPhone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    const phone = clientPhone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(personalizeMsg(msg))}`);
  };

  const filtered = OFFLINE_SCRIPTS.filter(
    (s) =>
      s.category === activeCategory &&
      (!search ||
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.whatsappMessage.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">📚 Scripts Offline</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">Sem custo de IA</span>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {SCRIPT_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => { setActiveCategory(cat.key); setExpandedScript(null); }}
            className={`text-[10px] px-2.5 py-1.5 rounded-full shrink-0 transition-colors font-medium ${
              activeCategory === cat.key ? cat.color : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar script..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs rounded-xl bg-secondary border-border/50"
        />
      </div>

      {/* Scripts list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {filtered.map((script) => {
          const isOpen = expandedScript === script.id;
          return (
            <div key={script.id} className="bg-secondary/40 rounded-xl border border-border/30 overflow-hidden">
              <button
                onClick={() => setExpandedScript(isOpen ? null : script.id)}
                className="w-full text-left p-3 flex items-center gap-2 hover:bg-accent/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{script.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{script.context}</p>
                </div>
                {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-3">
                      {/* Steps */}
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Roteiro</p>
                        <ol className="space-y-1">
                          {script.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2 text-[11px]">
                              <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span className="text-foreground/80">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* WhatsApp message */}
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">💬 Mensagem WhatsApp</p>
                        <div className="bg-card rounded-xl p-2.5 border border-border/30">
                          <p className="text-[11px] text-foreground/80 whitespace-pre-wrap leading-relaxed">
                            {personalizeMsg(script.whatsappMessage)}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full text-[10px] gap-1 h-7 flex-1"
                          onClick={() => copyMsg(script.whatsappMessage)}
                        >
                          <Copy className="w-3 h-3" /> Copiar
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-full text-[10px] gap-1 h-7 flex-1"
                          disabled={!clientPhone}
                          onClick={() => sendWhatsApp(script.whatsappMessage)}
                        >
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-[11px] text-muted-foreground py-4">Nenhum script encontrado</p>
        )}
      </div>
    </div>
  );
};

export default OfflineSalesScripts;
