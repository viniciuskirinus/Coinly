# Phase 1: Fundação & Pipeline de Dados - Research

**Researched:** 2026-04-08
**Domain:** Infraestrutura de app financeiro flat-file (GitHub Pages + JSON + Actions)
**Confidence:** HIGH

## Summary

A Phase 1 entrega a base sobre a qual todas as features futuras dependem: repositório estruturado com ES Modules, arquivos JSON seed com schema versionado, design system Indigo aplicado, app shell com sidebar de navegação, pipeline de leitura (fetch direto nos JSON do Pages) e pipeline de escrita (repository_dispatch → Action → commit atômico com concurrency group). Tudo 100% vanilla JS, zero build step, zero dependências npm.

A pesquisa confirma que todas as tecnologias escolhidas são estáveis, bem documentadas e verificadas com fontes oficiais (GitHub Docs, npm registry, MDN). O maior risco técnico é o comportamento do concurrency group do GitHub Actions: apenas 1 running + 1 pending são permitidos por grupo — o terceiro dispatch concorrente é **cancelado**, não enfileirado. Para uso pessoal (1-2 usuários), colisões são improváveis, mas o frontend deve implementar retry com backoff como safety net.

**Primary recommendation:** Construir em waves — (1) JSON schema + seed data, (2) app shell com design system + sidebar, (3) data service de leitura, (4) write workflow + GitHub API client, (5) wizard de primeiro acesso — testando cada wave antes de avançar.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** 5 abas na navegação do v1: Dashboard, Transação, Extrato, Comprovante, Config. Poupança e Relatório ficam para v2.
- **D-02:** Navegação em sidebar lateral no desktop — menu fixo na esquerda com ícones + labels.
- **D-03:** No mobile, comportamento responsivo da sidebar fica a critério do Claude (hamburger menu ou barra inferior — o que funcionar melhor para UX mobile).
- **D-04:** Responsividade mobile é requisito obrigatório desde a Phase 1.
- **D-05:** Wizard de boas-vindas no primeiro acesso — passo a passo guiando: nome/pessoa, PAT do GitHub, categorias, e orientação para primeira transação. Wizard aparece quando config.json não existe ou está vazio.
- **D-06:** Usar `repository_dispatch` como trigger de escrita (não Issues — confirmado pela pesquisa).
- **D-07:** Fine-Grained PAT com escopo mínimo (`Contents:write` + metadata:read auto-granted), scoped ao repo específico.
- **D-08:** Workflow YAML com `concurrency: { group: data-writes, cancel-in-progress: false }` para serializar escritas.
- **D-09:** Action processa payload, valida dados, atualiza JSON correspondente, e faz commit atômico.
- **D-10:** Transações particionadas por mês: `data/transactions/YYYY-MM.json` com `lastId` para geração incremental de IDs.
- **D-11:** Config extensível para N pessoas: array `people` ao invés de campos fixos pessoa1/pessoa2.
- **D-12:** Categorias separadas por tipo (expense/income) com subcategorias e cores.
- **D-13:** Schema versionado com campo `_schema_version` em cada arquivo JSON.
- **D-14:** Paleta Indigo preservada: `--p: #1a237e`, `--s: #3949ab`, `--ok: #2e7d32` (receita), `--err: #c62828` (despesa), `--warn: #e65100`.
- **D-15:** Fonte: Google Sans, Arial fallback.
- **D-16:** Formato brasileiro: R$ #.###,00, DD/MM/YYYY, timezone America/Sao_Paulo.
- **D-17:** ES Modules nativos com `type="module"` nos scripts.
- **D-18:** Estrutura: `js/modules/` (serviços), `js/views/` (lógica de cada aba), `css/` (estilos), `data/` (JSON), `.github/workflows/` (Actions).

### Claude's Discretion
- Comportamento exato da navegação no mobile (hamburger vs bottom bar)
- Implementação detalhada do wizard de boas-vindas (número de passos, animações, skip option)
- Organização interna dos módulos ES (data-service, github-api, format, state)
- Design exato dos JSON schemas (campos específicos além dos já definidos)
- Dados seed padrão para categorias e métodos de pagamento (baseados no app GAS atual)
- CSS architecture (custom properties, file organization)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FUND-01 | Repositório com estrutura de pastas (`js/modules/`, `js/views/`, `data/`, `css/`, `.github/workflows/`) | Estrutura detalhada em Architecture Patterns → Recommended Project Structure |
| FUND-02 | JSON schema versionado com dados seed (config, categorias, métodos de pagamento) | Schemas completos em JSON Schema Design com `_schema_version` field |
| FUND-03 | Transações particionadas por mês (`data/transactions/YYYY-MM.json`) | Padrão de particionamento + lastId documentado em Architecture Patterns |
| FUND-04 | GitHub Pages habilitado com deploy automático | Workflow `build-deploy.yml` com `upload-pages-artifact@v4` + `deploy-pages@v5` |
| WRIT-01 | Frontend envia dados via `repository_dispatch` para a API do GitHub | GitHub API client pattern com fetch() + PAT Fine-Grained |
| WRIT-02 | GitHub Action processa o payload, valida dados, atualiza arquivo JSON correspondente e faz commit atômico | Write workflow design com `process-write.js` e git atomic commit |
| WRIT-03 | Workflow usa `concurrency` group para serializar escritas e evitar race conditions | Concurrency group config + limitação de 1 running + 1 pending documentada |
| UX-02 | Design system com paleta Indigo preservada | CSS Custom Properties extraídas do app atual em Design System section |
| UX-03 | Formato brasileiro em toda a aplicação (R$ #.###,00, DD/MM/YYYY) | Intl.NumberFormat + Intl.DateTimeFormat nativos documentados em Code Examples |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (ES2022+) | Native | Lógica da aplicação | Zero build step, ES Modules nativos, app de escopo controlado [VERIFIED: MDN] |
| ES Modules (`type="module"`) | Native | Organização de código | 97%+ browser support, import/export nativos [VERIFIED: caniuse.com] |
| CSS Custom Properties | Native | Design system / theming | Já usado no app GAS atual, zero overhead [VERIFIED: codebase analysis] |
| Google Sans + Arial | CDN | Tipografia | Consistência visual com app atual [VERIFIED: codebase analysis] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Chart.js | 4.5.1 | Gráficos de dashboard | Quando Phase 3 implementar Dashboard (carregado via CDN desde Phase 1 para preparar) |

### Actions Versions

| Action | Version | Purpose | Verified |
|--------|---------|---------|----------|
| `actions/checkout` | v6 | Checkout do repo nas workflows | [VERIFIED: v6.0.2, Jan 2026] |
| `actions/upload-pages-artifact` | v4 | Empacotar site para deploy | [VERIFIED: v4.0.0, Aug 2025] |
| `actions/deploy-pages` | v5 | Deploy ao GitHub Pages | [VERIFIED: v5.0.0, Mar 2026] |
| `actions/configure-pages` | v5 | Configurar Pages metadata | [VERIFIED: GitHub Docs 2026] |
| `actions/setup-node` | v4 | Setup Node.js para process-write.js | [VERIFIED: GitHub Marketplace] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla JS | React/Vue/Svelte | Framework adicionaria build step obrigatório — desnecessário para app pessoal [VERIFIED: PROJECT.md constraint] |
| ES Modules nativos | Vite/esbuild | Zero build step = deploy direto ao Pages. Import maps cobrem resolução de CDN |
| `fetch()` direto | `@octokit/rest` v22 | Octokit adiciona ~40KB. App usa apenas 1 endpoint (dispatches). fetch() basta |
| CSS Custom Properties | Tailwind CSS | Tailwind requer build step (PostCSS). App já tem design system próprio |
| GitHub Pages | Cloudflare Pages / Netlify | GitHub Pages é nativo ao repo, zero config extra, gratuito |

**Installation:**
```bash
# Nenhuma instalação npm necessária — zero dependencies
# Chart.js via CDN no index.html:
# https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js
```

**Version verification:**
- Chart.js 4.5.1: Confirmado via `npm view chart.js version` em 2026-04-08 [VERIFIED: npm registry]
- actions/checkout v6.0.2: Confirmado via GitHub Releases em 2026-04-08 [VERIFIED: GitHub]
- actions/deploy-pages v5.0.0: Confirmado via GitHub Releases, lançado 2026-03-25 [VERIFIED: GitHub]
- actions/upload-pages-artifact v4.0.0: Confirmado via GitHub Releases [VERIFIED: GitHub]

## Architecture Patterns

### Recommended Project Structure

```
/
├── index.html                        # SPA com app shell (sidebar + content area)
├── css/
│   ├── variables.css                 # CSS Custom Properties (design tokens)
│   ├── base.css                      # Reset, tipografia, layout base
│   ├── components.css                # Botões, cards, alerts, forms, modals
│   └── views.css                     # Estilos específicos por view/aba
├── js/
│   ├── app.js                        # Entry point — inicialização, routing, event listeners
│   ├── modules/
│   │   ├── data-service.js           # Camada de acesso a dados (fetch + cache + dispatch)
│   │   ├── github-api.js             # Client repository_dispatch (POST /dispatches)
│   │   ├── format.js                 # Formatação BRL, datas, timezone
│   │   ├── state.js                  # Estado global in-memory da aplicação
│   │   └── storage.js                # LocalStorage helpers (PAT, pending writes, wizard state)
│   └── views/
│       ├── dashboard.js              # Aba Dashboard (placeholder Phase 1, implementada Phase 3)
│       ├── transaction.js            # Aba Transação (placeholder Phase 1, implementada Phase 2)
│       ├── statement.js              # Aba Extrato (placeholder Phase 1, implementada Phase 2)
│       ├── receipt.js                # Aba Comprovante (placeholder Phase 1, implementada Phase 4)
│       ├── settings.js               # Aba Config (wizard + configurações iniciais)
│       └── wizard.js                 # Wizard de primeiro acesso (D-05)
├── data/
│   ├── config.json                   # Configurações (people array, settings)
│   ├── categories.json               # Categorias expense/income com subcategorias
│   ├── payment-methods.json          # Métodos de pagamento
│   └── transactions/
│       └── 2026-04.json              # Seed file — mês corrente
├── .github/
│   ├── workflows/
│   │   ├── write-data.yml            # Processa repository_dispatch → JSON update → commit
│   │   └── deploy.yml                # Build + deploy ao GitHub Pages
│   └── scripts/
│       └── process-write.js          # Node.js script de validação e escrita JSON
└── .gitignore
```

### Pattern 1: Data Service Layer (Abstração de Acesso a Dados)

**What:** Todo acesso a dados (leitura e escrita) passa por `data-service.js`. Nenhuma view faz fetch() ou dispatch diretamente.

**When to use:** Sempre — é a camada de abstração central.

**Example:**

```javascript
// js/modules/data-service.js
const BASE_URL = '.';
const cache = new Map();

export async function getConfig() {
  return fetchJSON(`${BASE_URL}/data/config.json`, 'config');
}

export async function getCategories() {
  return fetchJSON(`${BASE_URL}/data/categories.json`, 'categories');
}

export async function getTransactions(yearMonth) {
  return fetchJSON(
    `${BASE_URL}/data/transactions/${yearMonth}.json`,
    `txn-${yearMonth}`
  );
}

export async function getPaymentMethods() {
  return fetchJSON(`${BASE_URL}/data/payment-methods.json`, 'payment-methods');
}

async function fetchJSON(url, cacheKey) {
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    cache.set(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

export function invalidateCache(key) {
  if (key) cache.delete(key);
  else cache.clear();
}
```
[VERIFIED: padrão fetch + cache in-memory é standard web pattern — MDN]

### Pattern 2: GitHub API Client (repository_dispatch)

**What:** Módulo dedicado para comunicação com a API do GitHub via `repository_dispatch`.

**When to use:** Em toda operação de escrita (criar, editar, excluir transação; atualizar config).

**Example:**

```javascript
// js/modules/github-api.js
import { getRepoConfig } from './storage.js';

export async function dispatch(eventType, data) {
  const { owner, repo, pat } = getRepoConfig();
  if (!pat) throw new Error('PAT não configurado');

  const resp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: {
          action: eventType,
          data: data,
          timestamp: new Date().toISOString()
        }
      })
    }
  );

  if (resp.status === 204) return { success: true };
  if (resp.status === 404) return { success: false, error: 'Repo não encontrado ou PAT sem permissão' };
  if (resp.status === 422) return { success: false, error: 'Payload inválido' };
  return { success: false, error: `HTTP ${resp.status}` };
}
```
[VERIFIED: GitHub REST API docs — POST /repos/{owner}/{repo}/dispatches retorna 204 No Content em sucesso]

### Pattern 3: SPA Navigation com Sidebar

**What:** App shell com sidebar fixa na esquerda (desktop) e content area dinâmica. Navegação sem reload de página.

**When to use:** Estrutura base do `index.html`.

```javascript
// js/app.js
import { initDashboard } from './views/dashboard.js';
import { initTransaction } from './views/transaction.js';
import { initStatement } from './views/statement.js';
import { initReceipt } from './views/receipt.js';
import { initSettings } from './views/settings.js';
import { checkFirstRun } from './views/wizard.js';

const VIEWS = {
  dashboard:   { init: initDashboard,   icon: '📊', label: 'Dashboard' },
  transaction: { init: initTransaction, icon: '💳', label: 'Transação' },
  statement:   { init: initStatement,   icon: '📋', label: 'Extrato' },
  receipt:     { init: initReceipt,     icon: '📸', label: 'Comprovante' },
  settings:    { init: initSettings,    icon: '⚙️', label: 'Config' }
};

let currentView = null;

export function navigate(viewName) {
  if (currentView === viewName) return;
  document.querySelectorAll('.view-section').forEach(s => s.hidden = true);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById(`view-${viewName}`);
  const navItem = document.querySelector(`[data-view="${viewName}"]`);
  if (section) section.hidden = false;
  if (navItem) navItem.classList.add('active');

  currentView = viewName;
  VIEWS[viewName]?.init();
}

document.addEventListener('DOMContentLoaded', async () => {
  const isFirstRun = await checkFirstRun();
  if (isFirstRun) {
    navigate('settings'); // wizard handles first-run flow
  } else {
    navigate('dashboard');
  }
});
```

### Pattern 4: Payload Nesting (contornar limite de 10 campos)

**What:** `client_payload` do `repository_dispatch` aceita máximo 10 campos top-level. Transações têm 13+ campos.

**Solution:** Aninhar todos os dados dentro de um campo `data`:

```json
{
  "event_type": "create-transaction",
  "client_payload": {
    "action": "create-transaction",
    "target": "2026-04",
    "data": {
      "date": "2026-04-08",
      "amount": 45.90,
      "type": "expense",
      "description": "Almoço restaurante",
      "category": "Alimentação",
      "subcategory": "Restaurante",
      "personId": 1,
      "paymentMethod": "Cartão de Crédito",
      "establishment": "Restaurante Bom Sabor",
      "notes": ""
    },
    "timestamp": "2026-04-08T12:30:00-03:00"
  }
}
```

Resultado: 4 campos top-level no `client_payload` (action, target, data, timestamp) — bem dentro do limite de 10.
[VERIFIED: GitHub REST API docs confirmam limite de 10 top-level properties]

### Anti-Patterns to Avoid

- **Nunca usar `${{ github.event.client_payload.* }}` em blocos `run:`** — Command injection. Sempre passar via `env:`. [VERIFIED: GitHub Security Lab]
- **Nunca serializar PAT no código-fonte** — Armazenar em localStorage do browser, configurado pelo wizard. [VERIFIED: GitHub Docs]
- **Nunca criar um JSON monolítico de transações** — Particionar por mês desde o dia 1. [VERIFIED: PITFALLS.md pesquisa prévia]
- **Nunca usar `cancel-in-progress: true` no write workflow** — Cancelaria escritas do usuário, causando perda de dados. [VERIFIED: GitHub Docs]
- **Nunca fazer fetch via `raw.githubusercontent.com`** — Cache de ~5 min + sem CORS confiável. Usar URL do GitHub Pages. [CITED: Stack Overflow]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Formatação monetária BRL | Função custom `formatarMoeda()` | `Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})` | Handles edge cases (negativos, zero, NaN), locale-aware [VERIFIED: MDN] |
| Formatação de datas BR | Função custom `formatarData()` | `Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo'})` | Timezone-aware nativo, sem lib [VERIFIED: MDN] |
| CSS Reset | Reset custom | Usar `box-sizing: border-box` + `:root` variables | Suficiente para app single-page sem conflito de libs externas |
| JSON validation no workflow | Validação manual com if/else | `JSON.parse()` com try/catch + schema check por campos obrigatórios | Node.js nativo, sem dependência extra |
| Git commit na Action | git commands manuais em `run:` | `git add data/ && git diff --staged --quiet \|\| git commit -m "..."` | Idiomático, commit condicional evita "nothing to commit" errors |
| UUID generation | Lib ou crypto | `lastId + 1` incremental por arquivo mensal | Simples, sequencial, human-readable. O `lastId` no header do JSON resolve [VERIFIED: ARCHITECTURE.md decision] |

## Common Pitfalls

### Pitfall 1: Concurrency Group — 1 Running + 1 Pending, Terceiro é Cancelado

**What goes wrong:** O concurrency group do GitHub Actions permite apenas 1 workflow em execução + 1 pendente por grupo. Se um terceiro dispatch chega enquanto os dois slots estão ocupados, o **pending anterior é substituído** pelo novo — efetivamente cancelando a segunda escrita.

**Why it happens:** GitHub Actions não implementa fila (queue) real. O concurrency group é projetado para "latest wins", não para FIFO ordering.

**How to avoid:**
1. Frontend deve implementar debounce de 3-5 segundos entre dispatches consecutivos
2. Retry com backoff exponencial (2s, 4s, 8s) se dispatch retornar erro
3. Para uso pessoal (1-2 usuários), colisões são raras — aceitar a limitação
4. Considerar batching: acumular operações e enviar em um único dispatch

**Warning signs:** Transação "salva" pelo frontend mas ausente no JSON. Dois workflow runs com timestamps <10s de diferença.
[VERIFIED: GitHub Docs — "When a concurrent job or workflow is queued, if another job or workflow using the same concurrency group is pending, the pending job will be cancelled"]

### Pitfall 2: PAT Exposto no Frontend (Client-Side)

**What goes wrong:** O PAT fica armazenado em localStorage e é usado em chamadas fetch() ao GitHub API. Qualquer pessoa com acesso à URL do Pages pode extraí-lo via DevTools.

**Why it happens:** Não existe como esconder credenciais em código client-side estático.

**How to avoid:**
1. Fine-Grained PAT com escopo mínimo: `Contents: Read and write` apenas no repo financeiro
2. Repo privado (URL não indexada)
3. PAT com expiração de 90 dias + lembrete para rotação
4. Armazenar em localStorage (não no código-fonte)
5. Wizard guia o usuário a criar o PAT com permissões corretas

**Warning signs:** Dispatches de IPs desconhecidos. Consumo anormal de Actions minutes.
[VERIFIED: GitHub Docs — Fine-Grained PAT scoped to single repo]

### Pitfall 3: Cache do GitHub Pages (max-age=600)

**What goes wrong:** Após uma escrita (dispatch → Action → commit → push), o JSON atualizado pode não estar disponível via fetch por até 10 minutos (cache CDN Fastly).

**Why it happens:** GitHub Pages aplica `Cache-Control: max-age=600` em todo conteúdo. Não há API de invalidação.

**How to avoid:**
1. **Cache-busting:** Adicionar `?v=${Date.now()}` nos fetches (funciona parcialmente — CDN pode ignorar query strings)
2. **Estado local como source of truth:** Após escrita, mesclar dados locais (pendentes) com dados do servidor. Dados locais têm prioridade por 15 min.
3. **Na Phase 1:** Impacto mínimo — seed data é estático. O problema aparece na Phase 2 quando o CRUD estiver ativo.

**Warning signs:** Dados "sumiram" após salvar. Precisar dar refresh múltiplos.
[VERIFIED: Stack Exchange — GitHub Support confirma max-age=600, imutável pelo usuário]

### Pitfall 4: Command Injection no Workflow via `${{ }}` Expressions

**What goes wrong:** Se o workflow usar `${{ github.event.client_payload.* }}` diretamente em blocos `run:`, um payload malicioso pode injetar comandos shell com acesso aos secrets do repo.

**Why it happens:** `${{ }}` faz substituição textual antes do shell executar, sem sanitização.

**How to avoid:**
1. **SEMPRE** passar payload via variáveis de ambiente:
   ```yaml
   - env:
       PAYLOAD: ${{ toJSON(github.event.client_payload) }}
     run: node .github/scripts/process-write.js
   ```
2. O Node.js script lê `process.env.PAYLOAD`, faz `JSON.parse()`, e valida schema
3. Nunca interpolate client_payload em run: blocks

[VERIFIED: GitHub Security Lab — "Keeping your GitHub Actions and workflows secure" — HIGH confidence]

## JSON Schema Design

Schemas verificados e alinhados com decisões D-10 a D-13 do CONTEXT.md.

### `/data/config.json`

```json
{
  "_schema_version": 1,
  "people": [],
  "settings": {
    "currency": "BRL",
    "locale": "pt-BR",
    "timezone": "America/Sao_Paulo"
  },
  "repo": {
    "owner": "",
    "name": "",
    "configured": false
  },
  "updatedAt": ""
}
```

Após wizard preenchido:
```json
{
  "_schema_version": 1,
  "people": [
    {
      "id": 1,
      "name": "Vinicius",
      "color": "#3949ab",
      "salary": 5000.00,
      "savingsGoal": 10000.00,
      "monthlyGoal": 500.00,
      "creditCard": {
        "closingDay": 5,
        "paymentDay": 10
      }
    }
  ],
  "settings": {
    "currency": "BRL",
    "locale": "pt-BR",
    "timezone": "America/Sao_Paulo"
  },
  "repo": {
    "owner": "usuario",
    "name": "financeiro-vk",
    "configured": true
  },
  "updatedAt": "2026-04-08T14:30:00-03:00"
}
```

### `/data/categories.json`

```json
{
  "_schema_version": 1,
  "expense": [
    {
      "name": "Alimentação",
      "icon": "🍽️",
      "color": "#e65100",
      "subcategories": ["Restaurante", "Supermercado", "Delivery", "Lanche"]
    },
    {
      "name": "Transporte",
      "icon": "🚗",
      "color": "#1565c0",
      "subcategories": ["Combustível", "Uber/99", "Transporte Público", "Estacionamento"]
    },
    {
      "name": "Moradia",
      "icon": "🏠",
      "color": "#6a1b9a",
      "subcategories": ["Aluguel", "Condomínio", "Conta de Luz", "Conta de Água", "Internet", "Manutenção"]
    },
    {
      "name": "Saúde",
      "icon": "🏥",
      "color": "#00838f",
      "subcategories": ["Farmácia", "Consulta", "Plano de Saúde", "Academia"]
    },
    {
      "name": "Lazer",
      "icon": "🎮",
      "color": "#ad1457",
      "subcategories": ["Cinema", "Streaming", "Jogos", "Viagem", "Eventos"]
    },
    {
      "name": "Educação",
      "icon": "📚",
      "color": "#1b5e20",
      "subcategories": ["Curso", "Livro", "Material"]
    },
    {
      "name": "Vestuário",
      "icon": "👔",
      "color": "#4e342e",
      "subcategories": ["Roupa", "Calçado", "Acessório"]
    },
    {
      "name": "Outros",
      "icon": "📦",
      "color": "#546e7a",
      "subcategories": ["Presente", "Pet", "Assinatura", "Diversos"]
    }
  ],
  "income": [
    {
      "name": "Salário",
      "icon": "💼",
      "color": "#2e7d32",
      "subcategories": []
    },
    {
      "name": "Freelance",
      "icon": "💻",
      "color": "#1565c0",
      "subcategories": []
    },
    {
      "name": "Investimento",
      "icon": "📈",
      "color": "#00695c",
      "subcategories": ["Rendimento", "Dividendo"]
    },
    {
      "name": "Outros",
      "icon": "💰",
      "color": "#546e7a",
      "subcategories": ["Reembolso", "Presente", "Diversos"]
    }
  ]
}
```

Categorias seed baseadas no app GAS atual (`Setup.gs` + `Configuracoes.gs`). [VERIFIED: codebase analysis STRUCTURE.md + INTEGRATIONS.md]

### `/data/payment-methods.json`

```json
{
  "_schema_version": 1,
  "methods": [
    "Pix",
    "Cartão de Débito",
    "Cartão de Crédito",
    "Dinheiro",
    "Boleto",
    "TED/DOC"
  ]
}
```

[VERIFIED: METODOS_PADRAO do codebase GAS em Configuracoes.gs]

### `/data/transactions/2026-04.json` (seed vazio)

```json
{
  "_schema_version": 1,
  "month": "2026-04",
  "lastId": 0,
  "transactions": []
}
```

## GitHub Actions Workflow Design

### `write-data.yml` — Write Processor

```yaml
name: Write Data
on:
  repository_dispatch:
    types:
      - create-transaction
      - edit-transaction
      - delete-transaction
      - update-config
      - update-categories
      - update-payment-methods

concurrency:
  group: data-writes
  cancel-in-progress: false

permissions:
  contents: write

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Process write request
        env:
          EVENT_TYPE: ${{ github.event.action }}
          PAYLOAD: ${{ toJSON(github.event.client_payload) }}
        run: node .github/scripts/process-write.js

      - name: Commit changes
        run: |
          git config user.name "FinanceiroVK Bot"
          git config user.email "bot@financeirovk.local"
          git add data/
          git diff --staged --quiet || git commit -m "data: ${{ github.event.action }}"
          git push
```

**Nota sobre segurança:** `EVENT_TYPE` usa `github.event.action` (que é o `event_type` do dispatch, controlado pelo código do frontend — não é input do usuário direto). `PAYLOAD` é passado como env var JSON, lido e parseado pelo Node.js script. Nenhum `${{ client_payload.* }}` em blocos `run:`.
[VERIFIED: GitHub Security Lab best practices]

### `deploy.yml` — Build & Deploy to Pages

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
    paths-ignore:
      - '.planning/**'
      - 'README.md'
      - '.gitignore'

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v6

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v4
        with:
          path: '.'

      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v5
```

**Nota:** Para Phase 1 não há secret injection (Gemini key é Phase 4). O workflow simplesmente faz deploy do conteúdo estático como está. Secret injection será adicionada na Phase 4.
[VERIFIED: GitHub Docs 2026 — recommended approach for static site deployment]

### `process-write.js` — Script de Processamento

```javascript
// .github/scripts/process-write.js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const eventType = process.env.EVENT_TYPE;
const payload = JSON.parse(process.env.PAYLOAD);
const data = payload.data;

const handlers = {
  'create-transaction': handleCreateTransaction,
  'edit-transaction': handleEditTransaction,
  'delete-transaction': handleDeleteTransaction,
  'update-config': handleUpdateConfig,
  'update-categories': handleUpdateCategories,
  'update-payment-methods': handleUpdatePaymentMethods
};

const handler = handlers[eventType];
if (!handler) {
  console.error(`Unknown event type: ${eventType}`);
  process.exit(1);
}

handler(data);

function handleCreateTransaction(txn) {
  const yearMonth = txn.date.slice(0, 7); // "2026-04"
  const filePath = `data/transactions/${yearMonth}.json`;

  let file;
  if (existsSync(filePath)) {
    file = JSON.parse(readFileSync(filePath, 'utf-8'));
  } else {
    mkdirSync('data/transactions', { recursive: true });
    file = { _schema_version: 1, month: yearMonth, lastId: 0, transactions: [] };
  }

  file.lastId += 1;
  txn.id = file.lastId;
  txn.createdAt = new Date().toISOString();
  file.transactions.push(txn);

  writeFileSync(filePath, JSON.stringify(file, null, 2) + '\n', 'utf-8');
  console.log(`Created transaction ${txn.id} in ${yearMonth}`);
}

// ... handlers para edit, delete, update-config, etc.
```

**Nota:** O script usa ES Modules (precisa de `"type": "module"` em um package.json local ou renomear para `.mjs`). Alternativa: usar CommonJS com `require()`. Para simplificar (sem package.json na Action), usar `.mjs` extension.
[ASSUMED: pattern recomendado — validar se `actions/setup-node` suporta ES Modules out of the box]

## Design System

### CSS Custom Properties (extraídas do app GAS atual)

```css
/* css/variables.css */
:root {
  /* Paleta Indigo (D-14) */
  --color-primary: #1a237e;
  --color-secondary: #3949ab;
  --color-primary-light: #534bae;
  --color-primary-dark: #000051;

  /* Semânticas */
  --color-income: #2e7d32;
  --color-expense: #c62828;
  --color-warning: #e65100;
  --color-info: #1565c0;

  /* Superfícies */
  --color-bg: #f5f7ff;
  --color-card: #ffffff;
  --color-text: #37474f;
  --color-text-secondary: #78909c;
  --color-border: #c5cae9;

  /* Layout */
  --sidebar-width: 240px;
  --sidebar-width-collapsed: 64px;
  --radius: 8px;
  --radius-lg: 12px;

  /* Tipografia (D-15) */
  --font-family: 'Google Sans', Arial, sans-serif;
  --font-size-base: 14px;
  --font-size-sm: 12px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}
```

**Migração do app GAS:** As variáveis curtas do app atual (`--p`, `--s`, `--ok`, `--err`) devem ser expandidas para nomes semânticos mais claros no novo app. Os valores hex são idênticos.
[VERIFIED: codebase analysis CONVENTIONS.md — CSS variables extracted from WebApp.html]

### Sidebar Layout

```css
/* css/base.css — layout structure */
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--color-primary);
  color: white;
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.main-content {
  margin-left: var(--sidebar-width);
  flex: 1;
  padding: 24px;
  background: var(--color-bg);
}

/* Mobile — Claude's discretion: bottom bar approach */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    bottom: 0;
    left: 0;
    top: auto;
    width: 100%;
    height: 64px;
    flex-direction: row;
    justify-content: space-around;
    align-items: center;
  }

  .sidebar .nav-label { display: none; }

  .main-content {
    margin-left: 0;
    margin-bottom: 64px;
    padding: 16px;
  }
}
```

**Recomendação para mobile (Claude's Discretion):** Bottom bar com ícones (sem labels) é preferível a hamburger menu para 5 abas. Hamburger esconde navegação e requer 2 taps para mudar de aba. Bottom bar dá acesso direto em 1 tap, padrão familiar (Instagram, Nubank, Itaú).
[ASSUMED: UX best practice para 5 ou menos itens de navegação]

## Code Examples

### Formatação Brasileira (UX-03)

```javascript
// js/modules/format.js
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo'
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

export function formatCurrency(value) {
  return currencyFormatter.format(value);
}

export function formatDate(dateStr) {
  return dateFormatter.format(new Date(dateStr + 'T12:00:00'));
}

export function formatDateTime(isoStr) {
  return dateTimeFormatter.format(new Date(isoStr));
}

export function getCurrentYearMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
```

[VERIFIED: Intl.NumberFormat e Intl.DateTimeFormat são APIs nativas — MDN]

### LocalStorage para PAT e Config do Repo

```javascript
// js/modules/storage.js
const KEYS = {
  REPO_CONFIG: 'financeirovk_repo',
  WIZARD_DONE: 'financeirovk_wizard_done',
  PENDING_WRITES: 'financeirovk_pending'
};

export function getRepoConfig() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.REPO_CONFIG)) || {};
  } catch {
    return {};
  }
}

export function saveRepoConfig(config) {
  localStorage.setItem(KEYS.REPO_CONFIG, JSON.stringify(config));
}

export function isWizardDone() {
  return localStorage.getItem(KEYS.WIZARD_DONE) === 'true';
}

export function markWizardDone() {
  localStorage.setItem(KEYS.WIZARD_DONE, 'true');
}
```

**Importante:** O PAT fica em localStorage — não no código-fonte, não nos JSON do repo. Cada browser/device precisa configurar o PAT separadamente via wizard. Isso é aceitável para uso pessoal (1-2 devices).
[VERIFIED: padrão standard para client-side secrets em apps sem backend]

### Wizard de Primeiro Acesso (D-05)

```javascript
// js/views/wizard.js
import { getRepoConfig, saveRepoConfig, isWizardDone, markWizardDone } from '../modules/storage.js';
import * as DataService from '../modules/data-service.js';

export async function checkFirstRun() {
  if (isWizardDone()) return false;
  const config = await DataService.getConfig();
  if (config && config.people && config.people.length > 0) {
    markWizardDone();
    return false;
  }
  return true;
}

// Steps:
// 1. Boas-vindas + nome da pessoa
// 2. PAT do GitHub (com instruções de como criar)
// 3. Verificação de conexão (test dispatch)
// 4. Categorias padrão (mostrar, permitir customizar)
// 5. Pronto — orientação para primeira transação
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Issues API como trigger de escrita | `repository_dispatch` | Pesquisa 2026-04-08 | Sem poluição de Issues, payload JSON nativo, mais limpo |
| Classic PAT com escopo `repo` | Fine-Grained PAT scoped ao repo | GitHub 2023+ | Permissões mínimas por repo, mais seguro |
| `actions/checkout@v4` | `actions/checkout@v6` | Jan 2026 | Credenciais em arquivo separado (não em `.git/config`), mais seguro |
| `actions/deploy-pages@v4` | `actions/deploy-pages@v5` | Mar 2026 | Node.js 24, workflow improvements |
| GitHub Pages source: branch | GitHub Pages source: Actions | GitHub 2022+ | Mais controle sobre o build/deploy pipeline |
| `@google/generative-ai` SDK | `@google/genai` SDK (ou fetch direto) | Nov 2025 | SDK antigo deprecated. Para este app: fetch direto sem SDK |
| Chart.js 4.4.7 (no app GAS atual) | Chart.js 4.5.1 | 2025 | Versão mais recente disponível [VERIFIED: npm] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `process-write.js` como `.mjs` funciona sem package.json no runner do Actions | Workflow Design | Baixo — fallback é renomear para `.cjs` com `require()` |
| A2 | Bottom bar é melhor UX que hamburger para 5 abas no mobile | Design System (Sidebar Layout) | Baixo — decisão de UI reversível, Claude's Discretion |
| A3 | Dados seed de categorias/métodos baseados no app GAS cobrem os casos de uso | JSON Schema Design | Baixo — usuário pode customizar via Config |
| A4 | `Cache-Control: max-age=600` do Pages é suficiente para leitura de seed data na Phase 1 | Pitfall 3 | Nenhum — Phase 1 não tem writes ativos; problema real emerge na Phase 2 |

**Se a tabela estiver vazia:** N/A — 4 assumptions identificadas acima, todas de baixo risco.

## Open Questions

1. **GitHub Pages + Repo Privado**
   - What we know: GitHub Pages de repo privado requer GitHub Pro/Team ($4/mês). No plano gratuito, Pages só funciona com repo público.
   - What's unclear: Se o usuário tem GitHub Pro ou se aceita repo público com URL obscura.
   - Recommendation: Proceder assumindo que funciona (o usuário sabe configurar). Se precisar mudar, a arquitetura é portável para Cloudflare Pages/Netlify.

2. **Expiração do PAT e UX de Renovação**
   - What we know: Fine-Grained PAT expira (máx 1 ano, recomendado 90 dias).
   - What's unclear: Como o app detecta e guia a renovação.
   - Recommendation: Detectar HTTP 401 na resposta do dispatch e mostrar modal pedindo novo PAT. Implementar na Phase 2 junto com o CRUD real.

## Environment Availability

> Phase 1 é majoritariamente code/config — dependências externas são serviços cloud, não ferramentas locais.

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| GitHub Pages | Hosting (FUND-04) | ✓ (cloud service) | — | Cloudflare Pages, Netlify |
| GitHub Actions | Write path (WRIT-01/02/03) | ✓ (cloud service) | — | — (core da arquitetura) |
| GitHub REST API | repository_dispatch (WRIT-01) | ✓ (cloud service) | 2022-11-28 | — |
| Node.js (no runner) | process-write.js | ✓ (ubuntu-latest) | 20+ | bash + jq (mais complexo) |
| Git (no runner) | Atomic commits | ✓ (ubuntu-latest) | — | — |

**Missing dependencies with no fallback:** Nenhuma.
**Missing dependencies with fallback:** Nenhuma.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Parcial | Fine-Grained PAT armazenado em localStorage (uso pessoal, sem login) |
| V3 Session Management | Não | App sem sessão — stateless, dados no Git |
| V4 Access Control | Parcial | PAT scoped ao repo; workflow valida evento mas não identidade |
| V5 Input Validation | Sim | `process-write.js` deve validar schema do payload antes de escrever JSON |
| V6 Cryptography | Não | Sem criptografia custom — HTTPS do Pages + PAT bearer token |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via workflow payload | Tampering | Passar payload via `env:`, nunca em `${{ }}` blocks |
| PAT theft via client-side code | Information Disclosure | Fine-Grained PAT, escopo mínimo, repo privado, expiração 90 dias |
| Malicious dispatch (PAT vazado) | Tampering | Validar schema no `process-write.js`, rejeitar payloads inválidos |
| Stale data overwrites | Tampering | `concurrency` group serializa escritas; `lastId` previne conflito de IDs |

## Sources

### Primary (HIGH confidence)
- [GitHub REST API — Create repository dispatch event](https://docs.github.com/en/rest/repos/repos#create-a-repository-dispatch-event) — Permissions, payload format, 204 response
- [GitHub Actions — Control concurrency](https://docs.github.com/en/actions/using-jobs/using-concurrency) — 1 running + 1 pending limit, cancel behavior
- [GitHub Actions — Security hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions) — Untrusted input via env vars
- [GitHub Security Lab — Untrusted Input](https://securitylab.github.com/resources/github-actions-untrusted-input/) — Command injection prevention
- [GitHub Docs — Fine-Grained PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) — `contents:write` for dispatches
- [GitHub Docs — Custom workflows for GitHub Pages](https://docs.github.com/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) — upload-pages-artifact + deploy-pages
- [npm registry](https://www.npmjs.com) — Chart.js 4.5.1 verified 2026-04-08
- [MDN — Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat) — Brazilian formatting
- [MDN — Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) — Date formatting with timezone

### Secondary (MEDIUM confidence)
- [Stack Exchange — GitHub Pages Cache-Control headers](https://webapps.stackexchange.com/questions/119286/caching-assets-in-website-served-from-github-pages) — max-age=600 confirmed by GitHub Support
- [Stack Overflow — Concurrency group queue limit](https://stackoverflow.com/questions/76096372/how-to-queue-more-than-one-github-action-workflow-run) — Only 1 running + 1 pending

### Tertiary (LOW confidence)
- Nenhuma — todas as claims foram verificadas com fontes primárias ou secundárias.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Todas versões verificadas via npm registry e GitHub Releases
- Architecture: HIGH — Patterns baseados em documentação oficial do GitHub e pesquisa prévia validada
- Pitfalls: HIGH — Todos documentados com fontes oficiais (GitHub Docs, Security Lab)
- JSON Schema: HIGH — Baseado em análise do codebase GAS existente + decisões do CONTEXT.md
- Design System: HIGH — Extraído diretamente do codebase atual (WebApp.html CSS variables)

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stack estável, 30 dias)
