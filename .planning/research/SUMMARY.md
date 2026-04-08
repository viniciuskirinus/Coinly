# Project Research Summary

**Project:** FinanceiroVK — Flat-File Edition
**Domain:** Personal Finance Web App (flat-file, serverless, GitHub-native)
**Researched:** 2026-04-08
**Confidence:** HIGH

## Executive Summary

FinanceiroVK é uma aplicação de controle financeiro pessoal para 1-2 pessoas, construída inteiramente sobre infraestrutura gratuita do GitHub: Pages para hosting estático, Actions como backend serverless, e arquivos JSON no repositório como banco de dados flat-file. A pesquisa confirma que essa arquitetura é viável e bem suportada para uso pessoal de baixo volume, com um stack 100% vanilla (HTML/CSS/JS sem bundler, sem framework) que elimina toda complexidade de build e dependências. O diferencial matador do app é o OCR de comprovantes e faturas via Gemini 2.0 Flash (free tier), algo que apps financeiros open-source raramente oferecem.

A abordagem recomendada é: frontend estático com ES Modules nativos, escrita de dados via `repository_dispatch` (não Issues — mais limpo e sem poluição do repo), leitura via `fetch()` direto nos JSONs servidos pelo Pages, e integração com Gemini API via REST puro. O JSON de transações deve ser particionado mensalmente desde o início para evitar problemas de performance e bloat no Git. O padrão de Optimistic UI é obrigatório — a latência do ciclo de escrita (10s–2min) é inaceitável sem feedback instantâneo ao usuário.

Os riscos principais são: (1) race conditions em escritas concorrentes, mitigadas com `concurrency` group no workflow; (2) tokens de autenticação expostos no frontend client-side, mitigados com Fine-Grained PAT de escopo mínimo e repo privado; (3) dados stale por cache do GitHub Pages, resolvidos com Optimistic UI + localStorage como source of truth temporária. Nenhum desses riscos é bloqueador — são inerentes à arquitetura e têm mitigações bem documentadas.

## Key Findings

### Recommended Stack

Stack 100% zero-build, zero-dependency (exceto Chart.js via CDN). Todas as tecnologias são nativas do browser ou gratuitas do ecossistema GitHub/Google.

**Core technologies:**
- **Vanilla JS (ES2022+ com ES Modules):** Lógica da aplicação — app de ~5k linhas não justifica framework, import/export nativos cobrem organização de código
- **Chart.js 4.5.1 (CDN jsDelivr):** Gráficos de dashboard — lib mais popular para JS vanilla, API simples, ~60KB gzip, já usado no app atual
- **Arquivos JSON em `/data/`:** Banco de dados flat-file — zero custo, versionado no Git, legível, portável, servido automaticamente pelo GitHub Pages
- **GitHub Actions (`repository_dispatch`):** Backend serverless de escrita — evento custom sem artefatos residuais, payload JSON estruturado nativo
- **Gemini 2.0 Flash (REST direto, sem SDK):** OCR de comprovantes/faturas — free tier generoso (15 RPM, 1M tokens/dia), chamada `fetch()` pura
- **GitHub Pages:** Hosting gratuito com HTTPS automático, deploy via push
- **Fine-Grained PAT:** Autenticação client-side para GitHub API — escopo mínimo (Contents + Actions write), repo-specific

**Decisão crítica confirmada:** Usar `repository_dispatch` ao invés de Issues como trigger de escrita. A pesquisa de ARCHITECTURE.md mostrou vantagens claras: payload JSON nativo (sem parsear markdown), sem poluição de Issues, sem necessidade de cleanup, mesma latência.

### Expected Features

**Must have (table stakes para v1):**
- CRUD de transações (criar, listar, editar, excluir)
- Categorias e subcategorias com cores e ícones
- Dashboard com resumo mensal (cards + gráficos)
- Gráficos interativos (gastos por categoria, orçado vs realizado)
- Orçamento por categoria com comparativo
- Filtros e busca no extrato
- Métodos de pagamento configuráveis
- Configurações de perfil (pessoa, salário, metas, ciclo fatura)
- Formato brasileiro (R$, DD/MM/YYYY)
- Responsividade mobile
- Suporte a múltiplas pessoas

**Should have (diferenciadores):**
- OCR de comprovantes com Gemini AI (diferencial matador)
- OCR de fatura completa com múltiplos itens
- AI sugestão de categoria automática
- Ciclo de fatura de cartão de crédito por pessoa
- Operações em lote (seleção múltipla + exclusão em massa)
- Dados versionados no Git (auditoria natural — inerente)
- Zero custo total (inerente da arquitetura)

**Defer (v2+):**
- Poupança (depósito/retirada/saldo/meta)
- Insights mensais com IA (requer volume de dados)
- Relatório mensal detalhado
- Offline reading (service worker)
- PWA manifest

**Nunca construir:**
- Sincronização bancária automática
- Autenticação/login complexa
- App mobile nativo
- Investimentos/portfolio
- Relatórios fiscais
- Transações recorrentes automáticas
- Notificações push

### Architecture Approach

Arquitetura SPA-like com separação clara entre read path (rápido, fetch direto nos JSONs do Pages) e write path (assíncrono, `repository_dispatch` → Action → commit). O frontend é organizado em módulos ES: `modules/` para serviços (data, GitHub API, Gemini, formatação, estado) e `views/` para lógica de cada aba. Todo acesso a dados é abstraído atrás de um `DataService` que encapsula leitura (fetch + cache) e escrita (dispatch + optimistic update).

**Major components:**
1. **SPA Frontend** (`/js/`, `/css/`, `index.html`) — UI, interação, charts, validação, estado local
2. **Data Store** (`/data/*.json`) — JSON flat-files particionados por mês (transações) ou por domínio (config, categorias, budget, payment-methods)
3. **Write Workflow** (`.github/workflows/write-data.yml`) — Processa `repository_dispatch`, valida payload, atualiza JSON, commit atômico
4. **Build Workflow** (`.github/workflows/build-deploy.yml`) — Injeta secrets (Gemini key, PAT) no build, deploy ao Pages
5. **Gemini AI** (REST client-side) — OCR de comprovantes, sugestão de categoria

**JSON Schema definido:**
- `config.json` — Array de `people` (extensível a N pessoas) com salário, metas, ciclo fatura
- `categories.json` — Separado por `expense`/`income`, com subcategorias e cores
- `transactions/YYYY-MM.json` — Um arquivo por mês com `lastId` para geração incremental
- `budget.json` — Mapa por `personId` → categoria → limite mensal
- `payment-methods.json` — Lista simples de métodos

### Critical Pitfalls

Top 5 decisões que previnem 80% dos problemas:

1. **Race conditions em escritas concorrentes** — Usar `concurrency: { group: data-writes, cancel-in-progress: false }` no workflow YAML para serializar execuções. Sem isso, escritas simultâneas causam perda de dados silenciosa.
2. **Dados stale + latência de escrita** — Implementar Optimistic UI obrigatório: atualizar estado local (localStorage) imediatamente, mostrar como "salvo", fazer polling para confirmação. Nunca bloquear UI esperando o ciclo completo de 10s–2min.
3. **Token exposto no frontend** — Fine-Grained PAT com permissão apenas `Contents:write` + `Actions:write`, scoped ao repo específico, expiração 90 dias. Repo privado minimiza superfície.
4. **Command injection via payload** — NUNCA usar `${{ github.event.client_payload.* }}` em blocos `run:`. Sempre passar via variáveis de ambiente (`env:`).
5. **JSON monolítico cresce sem limite** — Particionar transações por mês (`/data/transactions/2026-04.json`) desde o dia 1. Arquivo de sumário opcional para dashboard sem carregar todas as transações.

## Implications for Roadmap

### Phase 1: Fundação — Repo, Estrutura e JSON Schema
**Rationale:** Tudo depende do schema de dados e da estrutura do repositório. Erros aqui propagam para todas as fases. Particionamento mensal e schema versionado devem ser definidos antes de qualquer código.
**Delivers:** Repositório configurado, arquivos JSON seed com schema, GitHub Pages habilitado, estrutura de pastas (`js/modules/`, `js/views/`, `data/`, `.github/workflows/`), CSS base extraído do app atual.
**Addresses:** Fundação para todas as features. Prevenção de pitfalls #5 (bloat) e #9 (JSON monolítico).
**Avoids:** Pitfall #5 (repo bloat) e #9 (performance) com particionamento mensal desde o início.

### Phase 2: Data Service + Read Path
**Rationale:** O read path é independente do write path e pode ser testado com dados seed. Construir a camada de acesso a dados primeiro permite que todas as views subsequentes dependam de uma API interna consistente.
**Delivers:** `data-service.js` com fetch + cache in-memory, `format.js` (BRL, datas), `state.js` (estado global).
**Addresses:** Feature: formato brasileiro, base para filtros e busca.
**Avoids:** Pitfall #4 (stale data) — cache layer preparada para merge com dados locais.

### Phase 3: Dashboard + Extrato (read-only)
**Rationale:** Valor visual imediato — o usuário vê dados e gráficos sem precisar do write path ainda. Motivação para continuar o desenvolvimento.
**Delivers:** Dashboard com cards de resumo + Chart.js (pie + bar), Extrato com listagem e filtros client-side. Ambos read-only consumindo data service.
**Addresses:** Table stakes: dashboard, gráficos interativos, filtros e busca, responsividade mobile.

### Phase 4: Write Path — GitHub API + Actions Workflow
**Rationale:** O pipeline de escrita é o componente mais complexo e arriscado da arquitetura. Deve ser construído e testado antes de qualquer formulário de entrada.
**Delivers:** `github-api.js` (repository_dispatch client), `write-data.yml` (workflow com concurrency), `process-write.js` (Node script de validação + escrita JSON), `build-deploy.yml` (secret injection).
**Addresses:** Infraestrutura para todo CRUD de escrita.
**Avoids:** Pitfalls #1 (race condition), #3 (injection), #7 (Actions minutes), #13 (failures silenciosos).

### Phase 5: Configurações — CRUD de Pessoas, Categorias, Métodos, Orçamento
**Rationale:** Todas as features do app dependem de config (pessoas, categorias, métodos de pagamento). Precisa existir antes do formulário de transação.
**Delivers:** Tela de configurações completa: CRUD de pessoas (nome, cor, salário, meta, ciclo fatura), categorias com subcategorias e cores, métodos de pagamento, orçamentos por pessoa/categoria.
**Addresses:** Table stakes: categorias, métodos de pagamento, config de perfil, suporte multi-pessoa.

### Phase 6: CRUD de Transações — Criar, Editar, Excluir
**Rationale:** Core do app. Depende de write path (Phase 4) e config (Phase 5). Inclui Optimistic UI como requisito obrigatório.
**Delivers:** Formulário de nova transação, modal de edição, exclusão single + bulk, optimistic updates com sync feedback ("salvando" → "sincronizado").
**Addresses:** Table stakes: CRUD de transações, operações em lote. Differentiator: ciclo de fatura de cartão.
**Avoids:** Pitfall #6 (latência sem feedback) — Optimistic UI obrigatório.

### Phase 7: Orçamento Comparativo
**Rationale:** Depende de transações e config de orçamento existentes. Cálculo client-side de realizado vs planejado.
**Delivers:** Tela de orçamento com barras de progresso por categoria/pessoa, alerta de estouro.
**Addresses:** Table stakes: orçamento por categoria com comparativo.

### Phase 8: Integração Gemini — OCR de Comprovantes e Faturas
**Rationale:** Diferencial matador do app, mas depende de todo o CRUD estar funcional. Complexidade alta (upload de imagem, chamada Gemini, parsing de resposta, UI de review).
**Delivers:** Upload de comprovante → Gemini analisa → formulário preenchido. Upload de fatura → extração de N itens → tabela de review editável → salvar em lote. Sugestão de categoria automática.
**Addresses:** Differentiators: OCR comprovante, fatura completa, AI sugestão de categoria.
**Avoids:** Pitfall #11 (Gemini key) — build-time injection, nunca no source code.

### Phase 9: Polish — UX, Mobile, Error Handling
**Rationale:** Última fase para refinar a experiência completa. Loading states, tratamento de erros, responsividade mobile fino, animações.
**Delivers:** App polido e pronto para uso diário.

### Phase Ordering Rationale

- **Fundação antes de tudo:** Schema de dados e particionamento mensal são irreversíveis — erro aqui custa reescrita completa (Pitfall #5, #9)
- **Read antes de Write:** Dashboard funcional com dados seed dá feedback visual rápido e permite testar a camada de dados sem complexidade do pipeline de escrita
- **Write path isolado:** O pipeline `repository_dispatch` → Action → commit é o componente mais arriscado. Testá-lo independentemente antes de conectar ao frontend reduz debugging
- **Config antes de Transações:** Transações referenciam pessoas, categorias e métodos — essas entidades precisam existir primeiro
- **OCR no final:** Depende de CRUD completo, é o componente mais complexo, e tem valor incremental (app funciona 100% sem IA)

### Research Flags

Fases que provavelmente precisam de pesquisa mais profunda durante planning:
- **Phase 4 (Write Path):** Pipeline `repository_dispatch` → Action → commit precisa de testes de concurrency e validação de payload. Documentação oficial cobre, mas edge cases de retry e error handling precisam ser validados.
- **Phase 8 (Gemini OCR):** Prompt engineering para extração de comprovantes/faturas brasileiros. Parsing da resposta do Gemini. Handling de imagens de baixa qualidade.

Fases com padrões bem estabelecidos (pular research-phase):
- **Phase 1 (Fundação):** Estrutura de repo estático + JSON — padrão trivial
- **Phase 2 (Data Service):** Fetch + cache in-memory — padrão web básico
- **Phase 3 (Dashboard):** Chart.js + client-side aggregation — bem documentado
- **Phase 5 (Configurações):** CRUD de config em JSON — straightforward
- **Phase 7 (Orçamento):** Cálculo client-side — aritmética simples

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Todas as tecnologias verificadas com fontes oficiais (npm registry, GitHub docs, Google AI docs). Versões confirmadas em 2026-04-08. |
| Features | HIGH | Baseado no codebase existente (~2100 linhas) + análise de competidores (YNAB, Actual Budget, Monarch Money, Firefly III). |
| Architecture | HIGH | `repository_dispatch` documentado oficialmente. JSON schema validado contra requirements. Concurrency control confirmado. |
| Pitfalls | HIGH | Top 5 pitfalls todos referenciados com documentação oficial do GitHub ou GitHub Security Lab. |

**Overall confidence:** HIGH

### Gaps to Address

- **Gemini OCR accuracy para comprovantes brasileiros:** Não testado empiricamente. O free tier é generoso, mas a qualidade de extração de comprovantes específicos (Pix, faturas de cartão) precisa ser validada com amostras reais durante a Phase 8.
- **GitHub Pages com repo privado:** GitHub Pages de repo privado requer GitHub Pro ou Team. Se o plano é free tier, o site será público (URL obscura). Validar se isso é aceitável para o threat model do usuário.
- **`repository_dispatch` client_payload limit:** A documentação menciona máximo de 10 campos no `client_payload`. Para transações com muitos campos, pode precisar serializar como string JSON dentro de um campo. Validar durante Phase 4.
- **Latência real do write path:** A estimativa de 10s–2min é baseada em relatos. A latência real depende do momento (queue de Actions) e deve ser medida em produção.

## Sources

### Primary (HIGH confidence)
- GitHub Actions Events (repository_dispatch): https://docs.github.com/actions/using-workflows/events-that-trigger-workflows
- GitHub Actions Concurrency: https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs
- GitHub Actions Security (untrusted input): https://securitylab.github.com/resources/github-actions-untrusted-input/
- GitHub Fine-Grained PATs: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- Google Gemini API: https://ai.google.dev/gemini-api/docs
- Chart.js 4.5.1: https://www.npmjs.com/package/chart.js
- ES Modules (MDN): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
- Import Maps (Can I Use): https://caniuse.com/import-maps

### Secondary (MEDIUM confidence)
- GitHub Pages Cache Behavior: Stack Overflow discussions
- Optimistic UI Patterns: simonhearne.com, Medium
- raw.githubusercontent.com Cache: Stack Overflow
- Package Managers Using Git as Database: nesbitt.io (real-world collapses of Cargo/Homebrew/CocoaPods)

### Tertiary (LOW confidence)
- Gemini OCR accuracy for Brazilian receipts: Not empirically tested, extrapolated from general Gemini 2.0 Flash capabilities

---
*Research completed: 2026-04-08*
*Ready for roadmap: yes*
