# Architecture Patterns

**Project:** FinanceiroVK — Flat-File Edition
**Domain:** Personal Finance Web App (flat-file, serverless, GitHub-native)
**Researched:** 2026-04-08

## Recommended Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────────┐│
│  │  /index.html  │  │  /data/*.json │  │ .github/workflows/*.yml   ││
│  │  /css/        │  │              │  │                            ││
│  │  /js/         │  │  config.json │  │  write-transaction.yml     ││
│  │  /assets/     │  │  txns/*.json │  │  build-deploy.yml          ││
│  │              │  │  budget.json │  │                            ││
│  └──────┬───────┘  └───────▲──────┘  └────────────▲───────────────┘│
│         │                  │                      │                 │
│         │ GitHub Pages     │ git commit+push      │ triggers        │
│         │ serves static    │ (by Action runner)   │                 │
└─────────┼──────────────────┼──────────────────────┼─────────────────┘
          │                  │                      │
          ▼                  │                      │
┌─────────────────┐          │           ┌──────────┴──────────┐
│   Browser/SPA   │──fetch───┘           │  GitHub Actions     │
│                 │                      │  (serverless runner) │
│  Vanilla JS     │──repository_dispatch─▶│                     │
│  Chart.js       │   (write requests)   │  1. parse payload   │
│  Gemini client  │                      │  2. read JSON       │
│                 │◀─────────────────────│  3. update JSON     │
│                 │   (Pages re-deploy)  │  4. commit + push   │
└─────────────────┘                      │  5. trigger Pages   │
                                         └─────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **SPA Frontend** (`/index.html`, `/js/`, `/css/`) | UI rendering, user interactions, chart visualization, form validation, local state management | GitHub REST API (write), GitHub Pages raw files (read), Gemini API (AI) |
| **Data Store** (`/data/*.json`) | Persistent storage of all financial data | Read by Frontend (fetch), Written by Actions (git commit) |
| **Write Workflow** (`.github/workflows/write-data.yml`) | Process write requests, validate payloads, update JSON files, commit changes | Triggered by Frontend (repository_dispatch), Reads/Writes `/data/` |
| **Build Workflow** (`.github/workflows/build-deploy.yml`) | Inject Gemini API key, generate final HTML, deploy to GitHub Pages | Triggered by push to main, Reads secrets, Writes to gh-pages branch |
| **Gemini AI** (Google API, client-side) | OCR of receipts, category suggestion, monthly insights | Called by Frontend JS with key injected at build time |

---

## Data Flow

### Read Path (Fast — milliseconds)

```
Browser ──fetch()──▶ GitHub Pages (CDN)
                     serves /data/transactions-2026-04.json
                     ◀── JSON response (cached by browser + CDN)
```

O frontend faz `fetch()` direto nos arquivos JSON servidos pelo GitHub Pages. Os arquivos são servidos com cache headers padrão do GitHub Pages (~10 min). Para dados mais frescos, o frontend pode usar `?t=timestamp` como cache-buster ou fazer fetch via `raw.githubusercontent.com` (sem cache CDN, mas com cache de ~5 min).

**Confidence:** HIGH — padrão bem estabelecido.

### Write Path (Slow — 10s a 2min)

```
1. Browser ──POST──▶ GitHub REST API
   │                 POST /repos/{owner}/{repo}/dispatches
   │                 Authorization: token {PAT}
   │                 Body: { event_type: "write-transaction", client_payload: {...} }
   │
2. GitHub ──trigger──▶ Actions Runner
   │                   on: repository_dispatch
   │                     types: [write-transaction, delete-transaction, update-config, ...]
   │
3. Runner executa workflow:
   │  a) checkout repo (main branch)
   │  b) ler /data/transactions-YYYY-MM.json existente
   │  c) parse payload do evento (github.event.client_payload)
   │  d) validar dados (tipo, categoria, valor > 0, etc.)
   │  e) gerar ID incremental (ler último ID do JSON, incrementar)
   │  f) inserir/atualizar/deletar no array JSON
   │  g) salvar JSON formatado (pretty-print para diff legível)
   │  h) git add + commit + push
   │
4. Push dispara rebuild do GitHub Pages
   │
5. ~30s depois, dados atualizados disponíveis via fetch
```

**Por que `repository_dispatch` ao invés de Issues:**

| Critério | Issues API | repository_dispatch |
|----------|-----------|-------------------|
| Latência | Issue precisa ser criado, depois Action processa | Direto — evento dispara workflow imediatamente |
| Payload | Precisa parsear body do Issue (markdown) | JSON estruturado nativo em `client_payload` (max 10 campos) |
| Lixo | Cria Issues reais no repo (poluição) | Nenhum artefato residual |
| Cleanup | Precisa fechar/deletar Issues após processar | Sem cleanup |
| Rate limit | 5000 req/h (REST API) | 5000 req/h (REST API) |
| Complexidade | Maior (criar Issue → trigger → parsear → fechar) | Menor (um POST → trigger → processar) |

**Recomendação:** Usar `repository_dispatch` ao invés do padrão Issue → Action. É mais limpo, mais rápido, e o payload já vem estruturado. O padrão Issue funciona mas é over-engineered para este caso de uso.

**Confidence:** HIGH — documentação oficial do GitHub confirma.

### Write Path — Concurrency Control

```yaml
# Em write-data.yml
concurrency:
  group: data-writes
  cancel-in-progress: false   # NUNCA cancelar — dados do usuário seriam perdidos
```

**Limitação crítica:** GitHub Actions mantém no máximo 1 pending + 1 running por concurrency group. Se 3+ writes chegarem simultaneamente, o terceiro é **descartado** (cancelado). Mitigações:

1. **Frontend queue local:** Acumular writes e enviar em batch (ex: a cada 5s ou no debounce)
2. **Retry com backoff:** Se dispatch falhar, re-tentar após 2s, 4s, 8s
3. **Optimistic UI:** Mostrar dado como "salvo" imediatamente no frontend, com badge "sincronizando"
4. **Aceitar a limitação:** Para uso pessoal (1-2 usuários), colisões são raras

**Confidence:** HIGH — documentação oficial confirma o limite de 2 slots por concurrency group.

---

## Recommended File Structure

```
/
├── index.html                    # SPA principal (single file ou modular)
├── css/
│   └── app.css                   # Estilos extraídos do HTML atual
├── js/
│   ├── app.js                    # Inicialização, routing, estado global
│   ├── modules/
│   │   ├── data-service.js       # Camada de acesso a dados (fetch + dispatch)
│   │   ├── github-api.js         # Client GitHub REST API (repository_dispatch)
│   │   ├── gemini-service.js     # Client Gemini API (OCR, sugestões)
│   │   ├── chart-manager.js      # Instância e update de Chart.js
│   │   ├── format.js             # Formatação BRL, datas, etc.
│   │   └── state.js              # Estado global da aplicação (in-memory)
│   └── views/
│       ├── dashboard.js          # Lógica da aba Dashboard
│       ├── transaction.js        # Lógica da aba Nova Transação
│       ├── statement.js          # Lógica da aba Extrato
│       ├── receipt.js            # Lógica da aba Comprovante
│       ├── report.js             # Lógica da aba Relatório
│       ├── budget.js             # Lógica da aba Orçamento
│       └── settings.js           # Lógica da aba Configurações
├── data/
│   ├── config.json               # Configurações (nomes, cores, metas, API flags)
│   ├── categories.json           # Categorias e subcategorias
│   ├── payment-methods.json      # Métodos de pagamento
│   ├── budget.json               # Orçamentos por pessoa por categoria
│   └── transactions/
│       ├── 2026-01.json          # Transações de Janeiro 2026
│       ├── 2026-02.json          # Transações de Fevereiro 2026
│       └── ...                   # Um arquivo por mês
├── .github/
│   └── workflows/
│       ├── write-data.yml        # Processa writes (repository_dispatch)
│       └── build-deploy.yml      # Build + deploy ao GitHub Pages
└── .gitignore
```

---

## JSON Schema Design

### `/data/config.json`

```json
{
  "version": 1,
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
  "gemini": {
    "enabled": true
  },
  "updatedAt": "2026-04-08T14:30:00-03:00"
}
```

**Decisão: Array de `people` ao invés de campos fixos `pessoa1`/`pessoa2`.** Suporta N pessoas sem mudar schema. O campo `id` é estável (nunca reutilizado).

### `/data/categories.json`

```json
{
  "version": 1,
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
    }
  ],
  "income": [
    {
      "name": "Salário",
      "icon": "💼",
      "color": "#2e7d32",
      "subcategories": []
    }
  ]
}
```

**Decisão: Separar `expense` e `income` no schema.** Elimina o campo `isReceita` booleano, tornando as queries mais naturais.

### `/data/transactions/2026-04.json`

```json
{
  "version": 1,
  "month": "2026-04",
  "lastId": 42,
  "transactions": [
    {
      "id": 42,
      "date": "2026-04-08",
      "amount": 45.90,
      "type": "expense",
      "description": "Almoço restaurante",
      "category": "Alimentação",
      "subcategory": "Restaurante",
      "personId": 1,
      "paymentMethod": "Cartão de Crédito",
      "establishment": "Restaurante Bom Sabor",
      "notes": "",
      "aiProcessed": false,
      "createdAt": "2026-04-08T12:30:00-03:00"
    }
  ]
}
```

**Decisões de schema:**
- **Um arquivo por mês** (`2026-04.json`) ao invés de um arquivo monolítico. Evita que o JSON cresça indefinidamente (problema real com flat-files). 12 arquivos/ano é manejável.
- **`lastId` no header** para geração incremental de IDs sem ler todos os registros.
- **`version` em todo JSON** para migração futura de schema.
- **`personId`** referencia `config.json` ao invés de armazenar nome (nome pode mudar).
- **Valores numéricos** (`amount: 45.90`) ao invés de strings. Parse no write workflow.
- **Datas ISO** (`2026-04-08`) para ordenação natural e parse universal.

### `/data/budget.json`

```json
{
  "version": 1,
  "budgets": {
    "1": {
      "Alimentação": 800,
      "Transporte": 400,
      "Lazer": 200
    },
    "2": {
      "Alimentação": 600,
      "Transporte": 300
    }
  }
}
```

**Decisão:** Chave por `personId` (string), valor é mapa categoria → limite mensal. Simples e suficiente.

### `/data/payment-methods.json`

```json
{
  "version": 1,
  "methods": ["Pix", "Cartão de Débito", "Cartão de Crédito", "Dinheiro", "Boleto", "TED/DOC"]
}
```

---

## Patterns to Follow

### Pattern 1: Data Service Layer

**What:** Abstrair todo acesso a dados atrás de um módulo `data-service.js` que encapsula tanto leitura (fetch) quanto escrita (repository_dispatch).

**When:** Sempre. Nenhuma view deve fazer fetch ou dispatch diretamente.

**Example:**

```javascript
// js/modules/data-service.js
const DataService = {
  _cache: {},

  async getTransactions(yearMonth) {
    const key = `txn-${yearMonth}`;
    if (this._cache[key]) return this._cache[key];
    const resp = await fetch(`./data/transactions/${yearMonth}.json`);
    if (!resp.ok) return { transactions: [] };
    const data = await resp.json();
    this._cache[key] = data;
    return data;
  },

  async writeTransaction(payload) {
    const resp = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_PAT}`,
          'Accept': 'application/vnd.github+json'
        },
        body: JSON.stringify({
          event_type: 'write-transaction',
          client_payload: payload
        })
      }
    );
    if (resp.status === 204) {
      this._invalidateCache(`txn-${payload.yearMonth}`);
      return { success: true };
    }
    return { success: false, error: resp.status };
  },

  _invalidateCache(key) {
    delete this._cache[key];
  }
};
```

### Pattern 2: Optimistic UI Updates

**What:** Atualizar o UI imediatamente após o usuário salvar, sem esperar o ciclo completo dispatch → action → commit → pages deploy.

**When:** Em toda operação de escrita. A latência do write path (10s-2min) é inaceitável para UX.

**Example:**

```javascript
async function saveTransaction(formData) {
  showSuccess('Transação salva!');
  addToLocalState(formData);
  renderDashboard();

  const result = await DataService.writeTransaction(formData);
  if (!result.success) {
    showError('Erro ao sincronizar. Tente novamente.');
    removeFromLocalState(formData);
    renderDashboard();
  } else {
    showBadge('Sincronizado ✓');
  }
}
```

### Pattern 3: Build-Time Secret Injection

**What:** O workflow de build lê `GEMINI_API_KEY` dos secrets do repo e injeta no HTML gerado antes de publicar no GitHub Pages.

**When:** No workflow `build-deploy.yml`, antes do deploy.

**Example workflow step:**

```yaml
- name: Inject Gemini API Key
  run: |
    sed -i "s|__GEMINI_API_KEY__|${{ secrets.GEMINI_API_KEY }}|g" index.html
```

**Atenção:** A key ficará visível no source code do site publicado. Qualquer pessoa com acesso à URL pode extraí-la. Para uso pessoal com repo privado + URL obscura, o risco é aceitável. Para produção pública, seria necessário um proxy.

### Pattern 4: Monthly File Partitioning

**What:** Dividir transações em um arquivo JSON por mês ao invés de um arquivo único.

**When:** Sempre para transações. Os outros JSONs (config, categorias, budget) são pequenos o suficiente para um arquivo cada.

**Why:** Um arquivo monolítico cresce ~1KB por transação. Após 2 anos com 50 txns/mês = 1200 txns = ~120KB. Particionado: cada mês tem ~5KB, e o frontend só carrega os meses necessários.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Issue como Trigger de Escrita

**What:** Criar um GitHub Issue para cada operação de escrita e processar na Action.

**Why bad:** Polui o repositório com centenas de Issues (1 por transação). Requer parsear markdown do body. Precisa fechar o Issue após processar. Latência adicional. O `repository_dispatch` resolve tudo isso de forma mais limpa.

**Instead:** Usar `repository_dispatch` com `client_payload` estruturado.

### Anti-Pattern 2: Arquivo JSON Monolítico para Transações

**What:** Guardar todas as transações de todos os meses em um único `transactions.json`.

**Why bad:** O arquivo cresce sem limite. Diffs no Git ficam enormes. O frontend precisa baixar tudo para ver um mês. Race conditions pioram com arquivo grande.

**Instead:** Um arquivo por mês (`/data/transactions/2026-04.json`).

### Anti-Pattern 3: Gemini API Key no Código Fonte do Repo

**What:** Commitar a API key diretamente no código fonte.

**Why bad:** Qualquer pessoa com acesso ao repo vê a key. Mesmo com repo privado, é má prática.

**Instead:** Usar GitHub Secrets + build-time injection. A key fica no HTML final (risco aceito para uso pessoal), mas nunca no source code versionado.

### Anti-Pattern 4: Frontend Faz Commit Diretamente via Contents API

**What:** Usar a GitHub Contents API (`PUT /repos/{owner}/{repo}/contents/{path}`) para o frontend escrever diretamente nos JSONs.

**Why bad:** Sem validação server-side. Race condition quando dois writes simultâneos (each precisa do SHA atual). Sem atomicidade — se precisa atualizar 2 arquivos, pode falhar no meio. Toda lógica de negócio no frontend.

**Instead:** `repository_dispatch` → Action com lógica de validação e commit atômico.

---

## GitHub Actions Workflow Design

### `write-data.yml` — Data Write Processor

```yaml
name: Write Data
on:
  repository_dispatch:
    types:
      - write-transaction
      - edit-transaction
      - delete-transaction
      - update-config
      - update-budget
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
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Process write request
        run: node .github/scripts/process-write.js
        env:
          EVENT_TYPE: ${{ github.event.action }}
          PAYLOAD: ${{ toJSON(github.event.client_payload) }}

      - name: Commit changes
        run: |
          git config user.name "FinanceiroVK Bot"
          git config user.email "bot@financeirovk.local"
          git add data/
          git diff --staged --quiet || git commit -m "data: ${{ github.event.action }} [${{ github.event.client_payload.description || 'update' }}]"
          git push
```

### `build-deploy.yml` — Build + Deploy to Pages

```yaml
name: Build & Deploy
on:
  push:
    branches: [main]
    paths-ignore:
      - '.planning/**'
      - 'README.md'

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
    steps:
      - uses: actions/checkout@v4

      - name: Inject secrets
        run: |
          sed -i "s|__GEMINI_API_KEY__|${{ secrets.GEMINI_API_KEY }}|g" index.html
          sed -i "s|__GITHUB_PAT__|${{ secrets.DATA_PAT }}|g" js/modules/github-api.js

      - name: Deploy to Pages
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - uses: actions/deploy-pages@v4
```

---

## Security Model

| Ativo | Risco | Mitigação |
|-------|-------|-----------|
| **GitHub PAT** (Fine-grained) | Exposto no JS publicado — permite dispatch para o repo | Escopo mínimo: `contents:write` + `actions:write` apenas no repo financeiro. Repo privado. Rotação periódica. |
| **Gemini API Key** | Exposta no HTML publicado — permite chamadas Gemini | Quota do free tier limita abuso. Repo privado + URL obscura. Google permite restringir por referrer. |
| **Dados financeiros** | No repo (mesmo privado, visível a collaborators) | Repo pessoal sem collaborators. GitHub criptografa at-rest. Dados versionados = auditoria natural. |
| **GitHub Pages URL** | Acessível publicamente se repo privado com Pages | GitHub Pages de repo privado requer autenticação (GitHub Pro/Enterprise). Alternativa: gerar URL difícil de adivinhar. |

**PAT Fine-Grained recomendado:**
- Resource owner: conta pessoal
- Repository access: Only select → repo financeiro
- Permissions: Contents (Read and Write), Actions (Write)
- Expiration: 90 dias (com lembrete para rotação)

---

## Build Order (Dependencies)

A ordem de construção reflete dependências reais entre componentes:

### Wave 1 — Foundation (sem dependências)

| # | O que | Entrega |
|---|-------|---------|
| 1 | **Estrutura de dados JSON** | Criar arquivos JSON seed em `/data/` com schema definido |
| 2 | **Scaffolding HTML/CSS** | Extrair HTML/CSS do monólito GAS, adaptar para estrutura modular |
| 3 | **Setup repositório** | `.github/workflows/` stubs, `.gitignore`, GitHub Pages habilitado |

### Wave 2 — Read Path (depende de Wave 1)

| # | O que | Entrega |
|---|-------|---------|
| 4 | **Data Service (leitura)** | `data-service.js` com fetch dos JSONs, cache in-memory |
| 5 | **Dashboard (read-only)** | Cards de resumo + Chart.js renderizando dados dos JSONs |
| 6 | **Extrato (read-only)** | Lista de transações com filtros, lendo do JSON |

### Wave 3 — Write Path (depende de Wave 1 + 2)

| # | O que | Entrega |
|---|-------|---------|
| 7 | **GitHub API client** | `github-api.js` com repository_dispatch |
| 8 | **Write workflow** | `write-data.yml` + `process-write.js` (criar/editar/deletar txns) |
| 9 | **Formulário de transação** | UI + optimistic update + dispatch |

### Wave 4 — Features (depende de Wave 2 + 3)

| # | O que | Entrega |
|---|-------|---------|
| 10 | **CRUD completo** | Edição e exclusão de transações (modal, bulk delete) |
| 11 | **Configurações** | Pessoas, categorias, métodos de pagamento, orçamentos |
| 12 | **Orçamento** | Comparativo orçado vs realizado |
| 13 | **Relatório** | Relatório por período com seleção de mês |

### Wave 5 — AI & Polish (depende de Wave 3 + 4)

| # | O que | Entrega |
|---|-------|---------|
| 14 | **Build pipeline** | `build-deploy.yml` com injeção de secrets |
| 15 | **Gemini OCR** | Upload de comprovante → análise → formulário preenchido |
| 16 | **Gemini Insights** | Sugestão de categoria + insights mensais |
| 17 | **Polish** | Loading states, error handling, mobile responsiveness |

### Dependency Graph

```
Wave 1: [JSON Schema] [HTML/CSS] [Repo Setup]
            │              │           │
            ▼              ▼           │
Wave 2: [Data Service] [Dashboard] [Extrato]
            │              │           │
            ▼              │           │
Wave 3: [GitHub API] [Write Workflow] [Form Transação]
            │              │           │
            ▼              ▼           ▼
Wave 4: [CRUD] [Configurações] [Orçamento] [Relatório]
            │       │              │           │
            ▼       ▼              ▼           ▼
Wave 5: [Build Pipeline] [Gemini OCR] [Insights] [Polish]
```

---

## Scalability Considerations

| Concern | 1 usuário | 2-5 usuários | 10+ usuários |
|---------|-----------|--------------|-------------|
| **Write latência** | Aceitável (10-30s) | Risco de queue (concurrency limit) | Inviável — precisa de backend real |
| **Tamanho JSON** | Trivial (~5KB/mês) | Trivial | Trivial |
| **GitHub API rate** | 5000 req/h sobra | 5000 req/h sobra | Pode ser limitante |
| **Custo** | Zero | Zero | Zero (Actions free tier = 2000min/mês) |
| **Conflitos de dados** | Impossível | Raro (concurrency group serializa) | Frequente — precisa de locking |

**Conclusão:** A arquitetura flat-file com GitHub Actions atende perfeitamente 1-2 usuários (uso pessoal). Para mais, precisaria de um backend real.

---

## Sources

- [GitHub Docs: Events that trigger workflows](https://docs.github.com/actions/using-workflows/events-that-trigger-workflows) — HIGH confidence
- [GitHub Docs: Control concurrency of workflows](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs) — HIGH confidence
- [GitHub Docs: GITHUB_TOKEN permissions](https://docs.github.com/actions/reference/authentication-in-a-workflow) — HIGH confidence
- [GitHub Docs: Fine-grained PAT permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) — HIGH confidence
- [Stack Overflow: workflow_dispatch vs repository_dispatch](https://stackoverflow.com/questions/68147899) — MEDIUM confidence
- [Stack Overflow: Avoiding concurrent commit conflicts in Actions](https://stackoverflow.com/questions/71341965) — MEDIUM confidence
- [GitHub Community: SPA routing on GitHub Pages](https://github.com/orgs/community/discussions/64096) — HIGH confidence
- [LinkedIn/HackerNews: Gemini API key exposure risks](https://thehackernews.com/2026/02/thousands-of-public-google-cloud-api.html) — HIGH confidence
- [GitHub Marketplace: Flat Data Action](https://github.com/marketplace/actions/flat-data) — MEDIUM confidence (padrão semelhante validado)
