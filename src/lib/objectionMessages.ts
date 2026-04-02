// Mensagens inteligentes cruzando pipeline_stage + objection_type

interface SmartMessage {
  label: string;
  msg: string;
}

const objectionMsgMap: Record<string, Record<string, (name: string) => SmartMessage[]>> = {
  // PREÇO
  price: {
    interested: (n) => [
      { label: "💰 Ancoragem de valor", msg: `${n}, entendo que o preço é um ponto importante! Mas olha: essa moto tem [diferencial]. Comparando com outras do mercado, a condição tá muito boa. Posso te mostrar o comparativo?` },
      { label: "💰 Flexibilidade", msg: `${n}, sobre o valor, consigo ver uma condição especial se fecharmos essa semana. Quer que eu refaça a proposta com uma condição diferenciada?` },
    ],
    negotiating: (n) => [
      { label: "💰 Última oferta", msg: `${n}, fiz o máximo que podia no preço. Essa é realmente a melhor condição que consigo. Se fechar hoje, ainda incluo [benefício extra]. O que acha?` },
      { label: "💰 Valor percebido", msg: `${n}, pensando no custo-benefício: essa moto na concorrência sai por [valor maior]. Aqui você leva com [garantia/revisão/brinde]. Vale a pena!` },
    ],
    thinking: (n) => [
      { label: "💰 Tempo limitado", msg: `${n}, a condição que te passei é válida até [data]. Depois disso, o preço volta ao normal. Quer garantir essa oportunidade?` },
    ],
    _default: (n) => [
      { label: "💰 Negociação", msg: `${n}, sobre o preço: posso tentar melhorar a condição. Me conta qual valor seria ideal pra você que vou ver o que consigo! 💪` },
    ],
  },

  // ENTRADA
  down_payment: {
    interested: (n) => [
      { label: "💵 Sem entrada", msg: `${n}, sobre a entrada: consigo opções com entrada reduzida ou até sem entrada dependendo do perfil de crédito. Quer que eu simule pra você?` },
      { label: "💵 Parcelamento", msg: `${n}, posso parcelar a entrada em até 3x no cartão! Isso facilita muito. Quer ver como fica?` },
    ],
    negotiating: (n) => [
      { label: "💵 Facilitação", msg: `${n}, entendo que a entrada pesa. Olha: posso aceitar sua moto como parte da entrada. Com isso, o valor que sai do seu bolso fica bem menor. Posso avaliar sua moto?` },
    ],
    _default: (n) => [
      { label: "💵 Entrada flexível", msg: `${n}, temos condições de entrada flexíveis! Posso montar uma proposta que caiba no seu bolso. Me fala quanto você consegue dar de entrada que eu vejo as opções.` },
    ],
  },

  // PARCELA ALTA
  installment: {
    interested: (n) => [
      { label: "📊 Mais parcelas", msg: `${n}, se a parcela tá pesando, posso estender o prazo pra deixar mais leve. Em 48x fica bem mais acessível. Quer que eu simule?` },
    ],
    negotiating: (n) => [
      { label: "📊 Ajuste parcela", msg: `${n}, consegui renegociar! Dá pra baixar a parcela se aumentarmos um pouco a entrada ou o prazo. Qual caminho você prefere?` },
    ],
    _default: (n) => [
      { label: "📊 Simulação", msg: `${n}, posso fazer uma simulação com parcelas menores! Me fala o valor ideal de parcela que você consegue pagar por mês.` },
    ],
  },

  // CRÉDITO
  credit: {
    financing_analysis: (n) => [
      { label: "🏦 Outros bancos", msg: `${n}, não se preocupe! Trabalho com vários bancos parceiros. Se um não aprovar, a gente tenta outro. Já estou enviando pra análise. 💪` },
    ],
    _default: (n) => [
      { label: "🏦 Alternativas", msg: `${n}, sobre o crédito: tenho parceiros que aprovam perfis variados. Além disso, temos opção de consórcio contemplado. Posso te explicar?` },
      { label: "🏦 Fiador", msg: `${n}, outra alternativa: com um fiador ou uma entrada maior, a aprovação fica mais fácil. Tem alguém que poderia te ajudar nesse sentido?` },
    ],
  },

  // CONFIANÇA
  trust: {
    _default: (n) => [
      { label: "🤝 Prova social", msg: `${n}, entendo sua preocupação! Estamos no mercado há [X anos] com mais de [X] motos vendidas. Posso te mandar depoimentos de clientes nossos? ⭐` },
      { label: "🤝 Garantia", msg: `${n}, todas as nossas motos passam por inspeção mecânica completa e têm garantia. Você pode trazer seu mecânico pra avaliar também! 🔍` },
    ],
  },

  // COMPARAÇÃO
  comparison: {
    interested: (n) => [
      { label: "⚖️ Diferencial", msg: `${n}, tá comparando com outra loja? Me fala a proposta deles que eu cubro e ainda adiciono [benefício extra]. Ninguém vai cuidar melhor de você! 😊` },
    ],
    negotiating: (n) => [
      { label: "⚖️ Cobrir oferta", msg: `${n}, me manda a proposta que recebeu que eu analiso. Se for justa, cubro e ainda ofereço vantagens exclusivas que só a Arsenal tem!` },
    ],
    _default: (n) => [
      { label: "⚖️ Comparativo", msg: `${n}, posso te mandar um comparativo completo mostrando nosso diferencial! Preço, garantia, condições de pagamento, pós-venda... Quer ver?` },
    ],
  },

  // TROCA DESVALORIZADA
  trade_undervalued: {
    _default: (n) => [
      { label: "🔄 Reavaliação", msg: `${n}, posso reavaliar sua moto pessoalmente. Às vezes com fotos não dá pra ver todos os pontos positivos. Que tal trazer aqui pra gente olhar juntos?` },
      { label: "🔄 Valor justo", msg: `${n}, o valor que passei é baseado na FIPE e condição do veículo. Mas posso compensar na negociação do preço da moto nova. Bora encontrar um meio-termo?` },
    ],
  },

  // INDECISÃO
  indecision: {
    thinking: (n) => [
      { label: "🤔 Segurança", msg: `${n}, é normal ter dúvida! O que te ajudaria a decidir? Posso te dar mais informações, fazer test-ride, ou apresentar mais opções. Me diz! 😊` },
      { label: "🤔 Urgência leve", msg: `${n}, essa moto tem bastante procura e não sei até quando consigo segurar essa condição. Se decidir, me avisa rápido que garanto pra você! ⚡` },
    ],
    _default: (n) => [
      { label: "🤔 Dúvidas", msg: `${n}, sem pressão! Me conta: qual é a sua maior dúvida agora? Preço, modelo, condição? Quero te ajudar a tomar a melhor decisão! 💪` },
    ],
  },

  // TIMING
  timing: {
    _default: (n) => [
      { label: "⏰ Reserva", msg: `${n}, entendo que agora não é o melhor momento. Posso reservar essa condição pra quando você estiver pronto? Me avisa quando podemos retomar!` },
      { label: "⏰ Planejamento", msg: `${n}, sem problemas! E se a gente já deixar tudo encaminhado pra quando chegar o momento? Assim você já sai na frente! 🏍️` },
    ],
  },
};

export function getObjectionMessages(
  firstName: string,
  pipelineStage: string,
  objectionType?: string
): SmartMessage[] {
  if (!objectionType || objectionType === "none") {
    // Generic messages for the stage
    return [];
  }

  const objectionGroup = objectionMsgMap[objectionType];
  if (!objectionGroup) return [];

  // Try stage-specific, then fallback to _default
  const generator = objectionGroup[pipelineStage] || objectionGroup._default;
  if (!generator) return [];

  return generator(firstName);
}
