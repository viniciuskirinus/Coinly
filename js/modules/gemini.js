const GEMINI_KEY = 'financeirovk_gemini_key';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export function getGeminiKey() {
  return localStorage.getItem(GEMINI_KEY) || '';
}

export function saveGeminiKey(key) {
  if (key) localStorage.setItem(GEMINI_KEY, key.trim());
  else localStorage.removeItem(GEMINI_KEY);
}

export function isGeminiConfigured() {
  return !!getGeminiKey();
}

async function callGemini(parts) {
  const key = getGeminiKey();
  if (!key) throw new Error('Chave da API Gemini não configurada.');

  const resp = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] })
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => null);
    const msg = body?.error?.message || `HTTP ${resp.status}`;
    if (resp.status === 400) throw new Error(`Requisição inválida: ${msg}`);
    if (resp.status === 403) throw new Error('Chave da API sem permissão. Verifique nas configurações.');
    if (resp.status === 429) throw new Error('Limite de requisições atingido. Aguarde um momento.');
    throw new Error(`Erro da API Gemini: ${msg}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Resposta vazia da API Gemini.');
  return text;
}

function extractJSON(text) {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

function buildCategoryList(categories) {
  const lines = [];
  if (categories?.expense?.length) {
    lines.push('CATEGORIAS DE DESPESA:');
    categories.expense.forEach(c => {
      const subs = c.subcategories?.length ? ` (subcategorias: ${c.subcategories.join(', ')})` : '';
      lines.push(`- ${c.name}${subs}`);
    });
  }
  if (categories?.income?.length) {
    lines.push('CATEGORIAS DE RECEITA:');
    categories.income.forEach(c => {
      const subs = c.subcategories?.length ? ` (subcategorias: ${c.subcategories.join(', ')})` : '';
      lines.push(`- ${c.name}${subs}`);
    });
  }
  return lines.join('\n');
}

export async function analyzeReceipt(imageBase64, mimeType, categories) {
  const catList = buildCategoryList(categories);

  const prompt = `Analise este comprovante/recibo e extraia as informações da transação financeira.

${catList}

Retorne APENAS um JSON válido (sem markdown, sem explicações) com esta estrutura:
{
  "date": "YYYY-MM-DD",
  "description": "descrição curta do que foi comprado/pago",
  "amount": 0.00,
  "type": "expense" ou "income",
  "category": "nome exato de uma das categorias acima",
  "subcategory": "subcategoria se aplicável, ou vazio",
  "confidence": 0.0 a 1.0
}

Regras:
- O campo "category" DEVE ser exatamente um dos nomes listados acima
- O campo "type" deve ser "expense" para pagamentos/compras e "income" para recebimentos
- O valor "amount" deve ser numérico sem símbolo de moeda
- Se não conseguir extrair algo, use string vazia ou 0
- A data deve estar no formato YYYY-MM-DD`;

  const parts = [
    { inlineData: { mimeType, data: imageBase64 } },
    { text: prompt }
  ];

  const text = await callGemini(parts);
  return extractJSON(text);
}

export async function analyzeStatement(imageBase64, mimeType, categories) {
  const catList = buildCategoryList(categories);

  const prompt = `Analise esta imagem de fatura de cartão de crédito e extraia TODAS as transações visíveis.

${catList}

Retorne APENAS um JSON válido (sem markdown, sem explicações) com esta estrutura:
{
  "items": [
    {
      "date": "YYYY-MM-DD",
      "description": "descrição da transação",
      "amount": 0.00,
      "category": "nome exato de uma das categorias de despesa acima",
      "subcategory": "subcategoria se aplicável, ou vazio"
    }
  ]
}

Regras:
- Extraia TODAS as linhas de transação visíveis na fatura
- O campo "category" DEVE ser exatamente um dos nomes de despesa listados acima
- O valor "amount" deve ser numérico positivo sem símbolo de moeda
- Se a data não tiver ano, use o ano atual (${new Date().getFullYear()})
- Use formato YYYY-MM-DD para datas
- Descrição deve ser limpa e legível`;

  const parts = [
    { inlineData: { mimeType, data: imageBase64 } },
    { text: prompt }
  ];

  const text = await callGemini(parts);
  const result = extractJSON(text);
  return result.items || result;
}

export async function suggestCategory(description, categories) {
  const catList = buildCategoryList(categories);

  const prompt = `Dada a descrição de uma transação financeira, sugira a melhor categoria.

Descrição: "${description}"

${catList}

Retorne APENAS um JSON válido (sem markdown, sem explicações):
{
  "category": "nome exato de uma das categorias acima",
  "subcategory": "subcategoria se aplicável, ou vazio",
  "type": "expense" ou "income",
  "confidence": 0.0 a 1.0
}

Regras:
- O campo "category" DEVE ser exatamente um dos nomes listados acima
- Escolha a categoria mais provável para essa descrição
- confidence indica o quão confiante você está na sugestão`;

  const text = await callGemini([{ text: prompt }]);
  return extractJSON(text);
}

export async function testApiKey(key) {
  const resp = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Responda apenas: OK' }] }]
    })
  });

  if (resp.ok) return { success: true };
  if (resp.status === 400) return { success: false, error: 'Chave inválida ou modelo não disponível.' };
  if (resp.status === 403) return { success: false, error: 'Chave sem permissão para este modelo.' };
  const body = await resp.json().catch(() => null);
  return { success: false, error: body?.error?.message || `Erro HTTP ${resp.status}` };
}

export async function compressImage(file, maxSizeKB = 1024) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        const MAX_DIM = 2048;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        while (dataUrl.length * 0.75 > maxSizeKB * 1024 && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
