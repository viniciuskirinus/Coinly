# Technology Stack

**Project:** FinanceiroVK — Flat-File Edition
**Researched:** 2026-04-08
**Overall Confidence:** HIGH

## Recommended Stack

### Frontend — Static HTML/CSS/JS

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vanilla JS (ES2022+) | Native | Application logic | Sem framework = zero build step, deploy direto no GitHub Pages. App de escopo controlado (~5k linhas) não justifica React/Vue. ES modules nativos cobrem organização de código. | HIGH |
| ES Modules (`<script type="module">`) | Native | Organização de código | Suportado em 97%+ dos browsers. Permite split do código em arquivos sem bundler. `import`/`export` nativos eliminam necessidade de Webpack/Vite. | HIGH |
| Import Maps (`<script type="importmap">`) | Native | Resolução de imports de CDN | Baseline desde março 2023. Suporte em Chrome 89+, Firefox 108+, Safari 16.4+. Permite mapear nomes curtos para CDN URLs sem bundler. | HIGH |
| CSS Custom Properties | Native | Design system / theming | Já usado no app atual (variáveis `--p`, `--s`, etc.). Zero overhead, browser-native. | HIGH |
| Google Sans + Arial | — | Tipografia | Manter consistência visual com o app atual. Google Sans via Google Fonts CDN. | HIGH |

### Gráficos & Visualização

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Chart.js | 4.5.1 | Dashboard de gráficos | Lib mais popular para gráficos em JS vanilla. API simples, boa documentação, lightweight (~60KB gzip). Já usado no app atual. | HIGH |

**CDN:**
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js"></script>
```

### Dados — Flat-File JSON

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Arquivos `.json` em `/data` | — | Banco de dados flat-file | Zero custo, versionado no Git, legível, portável. Frontend lê via `fetch()` direto do GitHub Pages. | HIGH |
| GitHub Pages serving | — | CDN dos JSONs | Arquivos na pasta `/data` são servidos automaticamente em `https://<user>.github.io/<repo>/data/<file>.json`. Cache automático. | HIGH |

**Estrutura de dados recomendada:**
```
/data
  transactions.json      # Array de transações (documento principal)
  categories.json        # Categorias e subcategorias
  budget.json            # Orçamento por categoria/mês
  settings.json          # Configurações do app (pessoas, métodos de pagamento, metas)
```

**Formato de leitura:**
```javascript
const res = await fetch('./data/transactions.json');
const transactions = await res.json();
```

### Backend de Escrita — GitHub Actions

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| GitHub Actions | v2 (latest) | Processar escrita de dados | Backend serverless gratuito. Workflow acionado por Issue → lê payload → atualiza JSON → commit. Sem servidor para manter. | HIGH |
| `actions/checkout` | v6 | Checkout do repo na Action | v6 (jan 2026) melhorou segurança de credenciais. Necessário para ler/escrever arquivos JSON. | HIGH |
| `stefanzweifel/git-auto-commit-action` | v7 | Auto-commit dos JSONs | v7 (out 2025) roda em Node 24. Simplifica o git add/commit/push dentro da Action. Requer `contents: write` permission. | HIGH |
| `actions/github-script` | v7 | Ler/fechar Issues via API | Permite usar Octokit dentro da Action para ler o body do Issue e fechar após processar. | MEDIUM |

**Trigger da Action:**
```yaml
on:
  issues:
    types: [opened]
```

**Fluxo:**
1. Frontend cria Issue via API do GitHub (com payload JSON no body)
2. Action é acionada pelo evento `issues: opened`
3. Action faz checkout, lê o body do Issue, parseia o JSON
4. Action atualiza o arquivo `.json` correspondente
5. Action faz commit+push via `git-auto-commit-action`
6. Action fecha o Issue com comentário de confirmação
7. GitHub Pages rebuilda automaticamente com os novos dados

### API do GitHub — Client-Side

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@octokit/rest` | 22.0.1 | Criar Issues via API do GitHub | SDK oficial, funciona no browser via ESM. Tipado, bem mantido. Alternativa: `fetch()` direto na REST API v3. | HIGH |

**Uso via CDN (sem build step):**
```html
<script type="module">
  import { Octokit } from "https://esm.sh/@octokit/rest@22.0.1";

  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  await octokit.rest.issues.create({
    owner: "user",
    repo: "repo",
    title: "[TX] Nova transação",
    body: JSON.stringify(transactionData)
  });
</script>
```

**Alternativa mais leve (fetch direto):**
```javascript
await fetch('https://api.github.com/repos/OWNER/REPO/issues', {
  method: 'POST',
  headers: {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: '[TX] Nova transação',
    body: JSON.stringify(transactionData)
  })
});
```

**Recomendação:** Usar `fetch()` direto para manter o app sem dependências externas pesadas. Octokit adiciona ~40KB e o app só precisa de 2-3 endpoints (create issue, get issue). Reserve Octokit se a complexidade de API crescer.

### Autenticação GitHub

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Fine-Grained Personal Access Token | — | Autenticar chamadas à API do GitHub | Permissões granulares por repo. Precisa apenas de `Issues: write`. Mais seguro que classic tokens. | HIGH |

**Permissões necessárias no token:**
- `Issues: Read and write` — para criar e ler Issues
- Scope: apenas o repositório do app

**ALERTA DE SEGURANÇA:** O token ficará exposto no JavaScript client-side. Mitigações:
1. Repo **privado** (URL obscura + token com escopo mínimo)
2. Token com permissão **apenas** de Issues (sem acesso a código/settings)
3. Para uso pessoal (1-2 pessoas), risco aceitável

### IA — Google Gemini

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Gemini API (REST) | v1beta | OCR de comprovantes/faturas | Chamada REST direta via `fetch()`. Sem SDK pesado. Gemini 2.0 Flash oferece excelente OCR com custo zero no free tier. | HIGH |
| Gemini 2.0 Flash | `gemini-2.0-flash` | Modelo para OCR | Melhor custo-benefício: rápido, gratuito no free tier (15 RPM, 1M tokens/dia). OCR nativo via multimodal input. | HIGH |

**Abordagem recomendada — REST direto (sem SDK):**
```javascript
async function analyzeReceipt(imageBase64) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Extraia as transações deste comprovante..." },
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
          ]
        }]
      })
    }
  );
  return await response.json();
}
```

**Por que REST direto ao invés do SDK `@google/genai`:**
- O SDK (`@google/genai` v1.48.0) requer Node.js 20+ e bundler para browser
- REST direto = zero dependências, funciona com `fetch()` nativo
- App usa apenas 1 endpoint (generateContent), não justifica SDK inteiro
- Mantém o princípio de zero build step

**Gestão da API Key:**
- **Opção A (recomendada para v1):** Key embutida no JS client-side. Risco aceitável: free tier tem rate limit natural, repo privado, uso pessoal.
- **Opção B (mais segura, v2):** Key como GitHub Secret → Action injeta no HTML durante build.

### Infraestrutura — Hosting & Deploy

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| GitHub Pages | — | Hosting do frontend | Gratuito, HTTPS automático, deploy via push. Suporte a custom domain. | HIGH |
| GitHub Actions (deploy) | — | CI/CD automático | Push no branch → GitHub Pages rebuilda. Zero config para sites estáticos. | HIGH |

**Configuração de Pages:**
- Source: branch `main`, pasta `/` (root) ou `/docs`
- Build: nenhum (arquivos estáticos puros)

## Stack Completo — Diagrama

```
┌─────────────────────────────────────────────────────┐
│                    BROWSER                           │
│                                                      │
│  HTML/CSS/JS (vanilla, ES modules, sem bundler)      │
│  ├── fetch('./data/*.json')     → LEITURA            │
│  ├── fetch(GitHub API /issues)  → ESCRITA            │
│  ├── fetch(Gemini REST API)     → IA/OCR             │
│  └── Chart.js 4.5.1 (CDN)      → GRÁFICOS           │
└──────────────┬──────────────────┬────────────────────┘
               │                  │
               ▼                  ▼
┌──────────────────────┐  ┌───────────────────────┐
│   GITHUB PAGES       │  │   GITHUB API          │
│   (hosting estático) │  │   (REST v3)           │
│   /data/*.json       │  │   POST /issues        │
│   /index.html        │  │   Fine-Grained PAT    │
│   /js/*.js           │  └───────────┬───────────┘
│   /css/*.css         │              │
└──────────────────────┘              ▼
                           ┌───────────────────────┐
                           │   GITHUB ACTIONS      │
                           │   on: issues: opened  │
                           │   1. Lê Issue body    │
                           │   2. Atualiza JSON    │
                           │   3. git commit/push  │
                           │   4. Fecha Issue      │
                           └───────────────────────┘
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Frontend framework | Vanilla JS | React / Vue / Svelte | App de escopo pequeno, sem necessidade de virtual DOM ou state management complexo. Framework adicionaria build step obrigatório. |
| Bundler | Nenhum (ES modules nativos) | Vite / esbuild | Zero build step = deploy direto. Import maps cobrem a resolução de módulos CDN. Simplicidade > otimização para app pessoal. |
| Gráficos | Chart.js 4.5 | D3.js / ApexCharts / ECharts | Chart.js é o mais simples para gráficos comuns (bar, pie, line). D3 é overkill. Já usado no app atual. |
| Backend | GitHub Actions (Issues) | Cloudflare Workers / Supabase / Firebase | Zero custo, sem conta adicional, dados no Git. Actions é "serverless" nativo do GitHub. |
| Backend trigger | Issues API | `repository_dispatch` | Issues são visíveis na UI (debugging fácil), têm body grande (65K chars), e a Action pode fechar com feedback. `repository_dispatch` requer token com mais permissões. |
| Banco de dados | JSON flat-file | SQLite (via sql.js) / IndexedDB / LocalStorage | JSON no Git = versionado, portável, legível. IndexedDB não persiste entre devices. SQLite via WASM é complexo demais. |
| IA/OCR | Gemini REST API | Tesseract.js / OpenAI Vision / Claude Vision | Gemini free tier é generoso (15 RPM). Tesseract.js é OCR puro (sem compreensão). OpenAI/Claude custam dinheiro. |
| SDK Gemini | `fetch()` direto | `@google/genai` v1.48 | SDK requer Node.js 20 + bundler. `fetch()` funciona nativamente, app usa 1 endpoint só. |
| SDK GitHub | `fetch()` direto | `@octokit/rest` v22 | Manter zero-dependency para 2-3 endpoints. Octokit disponível como upgrade se complexidade crescer. |
| CSS framework | CSS vanilla + Custom Properties | Tailwind / Bootstrap | App já tem design system próprio com variáveis CSS. Framework adicionaria peso desnecessário e build step (Tailwind). |
| Charts CDN | jsDelivr | unpkg / cdnjs | jsDelivr é o CDN oficial recomendado pela documentação do Chart.js. Boa performance e confiabilidade. |

## Supporting Libraries (Opcionais)

| Library | Version | CDN | Purpose | When to Use |
|---------|---------|-----|---------|-------------|
| Chart.js `chartjs-plugin-datalabels` | 2.2.0 | jsDelivr | Labels dentro dos gráficos | Se precisar de valores nos segmentos do pie/bar chart |
| `date-fns` | 4.1.0 | esm.sh | Formatação de datas | Se a formatação manual de datas ficar complexa. Alternativa: `Intl.DateTimeFormat` nativo. |
| `currency.js` | 2.0.4 | esm.sh | Formatação monetária | Se cálculos com float gerarem problemas. Alternativa: `Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})` nativo. |

**Recomendação:** Começar com APIs nativas do browser (`Intl.DateTimeFormat`, `Intl.NumberFormat`). Adicionar libs apenas se limitações surgirem.

## Versões Verificadas

| Package | Versão | Verificado em | Fonte |
|---------|--------|---------------|-------|
| Chart.js | 4.5.1 | 2026-04-08 | npm registry, jsDelivr |
| `@octokit/rest` | 22.0.1 | 2026-04-08 | npm registry, GitHub |
| `@google/genai` | 1.48.0 | 2026-04-08 | npm registry (SDK não recomendado para este caso) |
| `actions/checkout` | v6 | 2026-04-08 | GitHub Actions Marketplace |
| `stefanzweifel/git-auto-commit-action` | v7 | 2026-04-08 | GitHub Releases |
| `actions/github-script` | v7 | 2026-04-08 | GitHub Actions Marketplace |
| Gemini model | `gemini-2.0-flash` | 2026-04-08 | Google AI docs |

## Não Usar

| Technology | Reason |
|------------|--------|
| `@google/generative-ai` (antigo SDK) | **DEPRECIADO** — EOL em novembro 2025. Substituído por `@google/genai`. |
| webpack / parcel | Overkill para app estático sem framework. Adiciona complexidade de build desnecessária. |
| Tailwind CSS | Requer build step (PostCSS). App já tem design system funcional com CSS custom properties. |
| Firebase / Supabase | Adiciona dependência externa e custo potencial. GitHub Actions + JSON no repo = zero custo. |
| LocalStorage / IndexedDB como DB principal | Dados não sincronizam entre devices. JSON no Git é a source of truth. (OK como cache local.) |
| jQuery | Desnecessário em 2026. APIs nativas (`fetch`, `querySelector`, `classList`) cobrem tudo. |
| TypeScript | Requer build step (transpilação). Para app vanilla pessoal, JSDoc types são suficientes. |

## Configuração Inicial

```bash
# Estrutura do repositório (sem npm init, sem package.json necessário)
/
├── index.html              # App principal (SPA-like com tabs)
├── css/
│   └── styles.css          # Design system
├── js/
│   ├── app.js              # Entry point (type="module")
│   ├── api.js              # GitHub API + Gemini API calls
│   ├── data.js             # Leitura/cache dos JSONs
│   ├── transactions.js     # CRUD de transações
│   ├── dashboard.js        # Gráficos Chart.js
│   ├── budget.js           # Orçamento
│   ├── settings.js         # Configurações
│   └── ai.js               # Integração Gemini OCR
├── data/
│   ├── transactions.json   # []
│   ├── categories.json     # {}
│   ├── budget.json         # {}
│   └── settings.json       # {}
├── .github/
│   └── workflows/
│       └── write-data.yml  # Action: Issue → JSON update
└── README.md
```

```html
<!-- index.html — carregamento -->
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FinanceiroVK</title>
  <link rel="stylesheet" href="./css/styles.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js"></script>
</head>
<body>
  <!-- App HTML -->
  <script type="module" src="./js/app.js"></script>
</body>
</html>
```

## Sources

- Chart.js: npm registry (v4.5.1, Oct 2025) — https://www.npmjs.com/package/chart.js
- Chart.js CDN: jsDelivr — https://www.jsdelivr.com/package/npm/chart.js
- Octokit REST: GitHub (v22.0.1, Oct 2025) — https://github.com/octokit/rest.js/
- Google Gemini API: Official docs — https://ai.google.dev/gemini-api/docs
- `@google/genai`: npm registry (v1.48.0, deprecated antigo) — https://www.npmjs.com/package/@google/genai
- `@google/generative-ai` DEPRECIADO: https://github.com/google-gemini/deprecated-generative-ai-js
- GitHub Actions events: https://docs.github.com/actions/using-workflows/events-that-trigger-workflows
- `actions/checkout` v6: https://github.com/actions/checkout
- `git-auto-commit-action` v7: https://github.com/stefanzweifel/git-auto-commit-action
- Import Maps (Can I Use): https://caniuse.com/import-maps
- ES Modules (MDN): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
- GitHub Fine-Grained PATs: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
