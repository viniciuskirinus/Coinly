# Roadmap: FinanceiroVK — Flat-File Edition

## Overview

De um repositório vazio a um app financeiro completo com IA. A jornada começa pela infraestrutura (repo, JSON schema, pipeline de leitura/escrita via GitHub Actions), avança para o core funcional (configurações + CRUD de transações com Optimistic UI), depois visualização (dashboard com Chart.js + orçamento comparativo), e finaliza com o diferencial matador: OCR de comprovantes e faturas via Gemini AI.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Fundação & Pipeline de Dados** - Repo estruturado, JSON schema, GitHub Pages, read/write path via Actions
- [ ] **Phase 2: Configurações & Transações** - CRUD completo de config e transações com Optimistic UI e responsividade
- [ ] **Phase 3: Dashboard & Orçamento** - Gráficos interativos, resumo mensal, orçamento realizado vs planejado
- [ ] **Phase 4: Gemini AI** - OCR de comprovantes/faturas, sugestão automática de categoria

## Phase Details

### Phase 1: Fundação & Pipeline de Dados
**Goal**: A infraestrutura base está funcional — repo estruturado, dados JSON com schema, design system aplicado, e pipeline de leitura/escrita operacional via GitHub Actions
**Depends on**: Nothing (first phase)
**Requirements**: FUND-01, FUND-02, FUND-03, FUND-04, WRIT-01, WRIT-02, WRIT-03, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. Repositório existe com estrutura de pastas (`js/modules/`, `js/views/`, `data/`, `css/`, `.github/workflows/`) e GitHub Pages serve o index.html com design system Indigo aplicado
  2. Arquivos JSON seed existem com schema versionado — config de pessoas, categorias com cores/ícones, métodos de pagamento, e transações particionadas por mês (`data/transactions/YYYY-MM.json`)
  3. Frontend lê dados JSON via fetch() nos arquivos servidos pelo Pages com formatação brasileira (R$, DD/MM/YYYY)
  4. Frontend envia dados via `repository_dispatch` e a Action processa, valida, atualiza o JSON correspondente e faz commit atômico
  5. Workflow usa `concurrency` group para serializar escritas e evitar race conditions
**Plans:** 4 plans

Plans:
- [ ] 01-01-PLAN.md — Foundation: estrutura do repo, seed data JSON e design system CSS
- [ ] 01-02-PLAN.md — App Shell: HTML, navegação SPA, módulos core JS e views placeholder
- [ ] 01-03-PLAN.md — Write Path: GitHub API client, workflows de escrita e deploy
- [ ] 01-04-PLAN.md — Wizard: primeiro acesso com config de pessoa, PAT e categorias
**UI hint**: yes

### Phase 2: Configurações & Transações
**Goal**: Usuário consegue configurar o app (pessoas, categorias, métodos) e gerenciar transações financeiras com CRUD completo, feedback instantâneo e interface responsiva
**Depends on**: Phase 1
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, TRAN-01, TRAN-02, TRAN-03, TRAN-04, TRAN-05, TRAN-06, WRIT-04, UX-01
**Success Criteria** (what must be TRUE):
  1. Usuário pode configurar pessoas (nome, salário, meta, dia fatura), categorias/subcategorias com ícones e cores, e métodos de pagamento — mudanças persistem via write path
  2. Usuário pode criar transação com data, descrição, valor, tipo, categoria, pessoa e método de pagamento — e vê-la na lista imediatamente (Optimistic UI com indicador de sincronização)
  3. Usuário pode listar transações com filtros por mês, pessoa, tipo e categoria, editar e excluir transações individuais
  4. Usuário pode selecionar e excluir múltiplas transações de uma vez (bulk delete)
  5. Ciclo de fatura de cartão ajusta automaticamente a competência para o mês seguinte, e a interface funciona em desktop e mobile
**Plans**: TBD
**UI hint**: yes

### Phase 3: Dashboard & Orçamento
**Goal**: Usuário visualiza sua situação financeira em gráficos interativos e acompanha orçamento por categoria com comparativo realizado vs planejado
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, ORCA-01, ORCA-02
**Success Criteria** (what must be TRUE):
  1. Dashboard exibe cards de resumo mensal (receita total, despesa total, saldo) que atualizam ao trocar filtro de mês ou pessoa
  2. Gráfico doughnut de gastos por categoria reflete dados reais das transações do mês/pessoa selecionados
  3. Usuário pode definir limite de orçamento mensal por categoria e por pessoa, e vê barras de progresso com comparativo realizado vs planejado e alerta visual de estouro
  4. Gráfico de barras orçado vs realizado por categoria atualiza dinamicamente com os filtros
**Plans**: TBD
**UI hint**: yes

### Phase 4: Gemini AI
**Goal**: IA analisa comprovantes e faturas via OCR e sugere categorias, acelerando a entrada de dados e reduzindo erros manuais
**Depends on**: Phase 2
**Requirements**: GEMI-01, GEMI-02, GEMI-03, GEMI-04
**Success Criteria** (what must be TRUE):
  1. Usuário envia foto de comprovante (Pix, boleto, recibo) e recebe transação pré-preenchida automaticamente via Gemini Vision
  2. Usuário envia foto de fatura completa de cartão e recebe tabela editável com múltiplos itens extraídos para revisão antes de salvar
  3. Ao digitar descrição de uma transação, IA sugere categoria automaticamente com base no texto
  4. API key do Gemini é injetada no build via GitHub Secrets e nunca aparece no código-fonte
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundação & Pipeline de Dados | 0/4 | Planning complete | - |
| 2. Configurações & Transações | 0/TBD | Not started | - |
| 3. Dashboard & Orçamento | 0/TBD | Not started | - |
| 4. Gemini AI | 0/TBD | Not started | - |
