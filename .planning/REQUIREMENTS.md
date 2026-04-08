# Requirements: FinanceiroVK — Flat-File Edition

**Defined:** 2026-04-08
**Core Value:** O usuário consegue registrar e visualizar suas transações financeiras de forma rápida e confiável, com dados versionados e sob seu controle total no GitHub.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Fundação

- [ ] **FUND-01**: Repositório com estrutura de pastas (`js/modules/`, `js/views/`, `data/`, `css/`, `.github/workflows/`)
- [ ] **FUND-02**: JSON schema versionado com dados seed (config, categorias, métodos de pagamento)
- [ ] **FUND-03**: Transações particionadas por mês (`data/transactions/YYYY-MM.json`)
- [ ] **FUND-04**: GitHub Pages habilitado com deploy automático

### Transações

- [ ] **TRAN-01**: Usuário pode criar uma transação com data, descrição, valor, tipo (receita/despesa), categoria, pessoa e método de pagamento
- [ ] **TRAN-02**: Usuário pode listar transações com filtros por mês, pessoa, tipo e categoria
- [ ] **TRAN-03**: Usuário pode editar uma transação existente
- [ ] **TRAN-04**: Usuário pode excluir uma transação
- [ ] **TRAN-05**: Usuário pode selecionar e excluir múltiplas transações de uma vez
- [ ] **TRAN-06**: Ciclo de fatura de cartão de crédito ajusta automaticamente a competência da transação para o mês seguinte

### Dashboard

- [ ] **DASH-01**: Usuário vê resumo mensal com cards de receita, despesa e saldo
- [ ] **DASH-02**: Gráfico de gastos por categoria (doughnut chart)
- [ ] **DASH-03**: Gráfico de orçamento vs realizado por categoria (bar chart)
- [ ] **DASH-04**: Dashboard atualiza ao mudar filtro de mês ou pessoa

### Orçamento

- [ ] **ORCA-01**: Usuário pode definir limite de orçamento mensal por categoria e por pessoa
- [ ] **ORCA-02**: Usuário vê comparativo realizado vs planejado com barras de progresso e alerta de estouro

### Configurações

- [ ] **CONF-01**: Usuário pode configurar pessoas (nome, salário referência, meta economia, dia fechamento fatura)
- [ ] **CONF-02**: Usuário pode gerenciar categorias e subcategorias com ícones e cores
- [ ] **CONF-03**: Usuário pode gerenciar lista de métodos de pagamento
- [ ] **CONF-04**: Configurações salvas em JSON e persistidas via write path do GitHub Actions

### Write Path

- [ ] **WRIT-01**: Frontend envia dados via `repository_dispatch` para a API do GitHub
- [ ] **WRIT-02**: GitHub Action processa o payload, valida dados, atualiza arquivo JSON correspondente e faz commit atômico
- [ ] **WRIT-03**: Workflow usa `concurrency` group para serializar escritas e evitar race conditions
- [ ] **WRIT-04**: Interface usa Optimistic UI — atualiza estado local instantaneamente e mostra indicador de sincronização

### Gemini AI

- [ ] **GEMI-01**: Usuário pode enviar imagem de comprovante e receber transação extraída automaticamente via Gemini Vision
- [ ] **GEMI-02**: Usuário pode enviar imagem de fatura completa e receber múltiplos itens em tabela editável para revisão
- [ ] **GEMI-03**: AI sugere categoria automaticamente ao preencher descrição de transação
- [ ] **GEMI-04**: API key do Gemini injetada no build via GitHub Secrets (nunca no código-fonte)

### UX

- [ ] **UX-01**: Interface responsiva para desktop e mobile
- [ ] **UX-02**: Design system com paleta Indigo (#1a237e) / Green (#2e7d32 receita) / Red (#c62828 despesa) preservada do app atual
- [ ] **UX-03**: Formato brasileiro em toda a aplicação (R$ #.###,00, DD/MM/YYYY, timezone America/Sao_Paulo)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Poupança

- **POUP-01**: Usuário pode registrar depósitos e retiradas da poupança por pessoa
- **POUP-02**: Usuário vê saldo atual e progresso em relação à meta de poupança

### IA Avançada

- **IA-01**: Usuário recebe insights mensais gerados por Gemini (análise de gastos, tendências, recomendações)

### Relatório

- **REL-01**: Relatório mensal detalhado com comparativos entre meses e pessoas

### Offline / PWA

- **PWA-01**: App funciona offline para leitura via Service Worker
- **PWA-02**: Manifest PWA para instalação como app

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Autenticação/login | Uso pessoal, URL obscura suficiente |
| Sincronização bancária automática | Complexidade extrema, APIs bancárias BR inexistentes para PF |
| App mobile nativo | Web responsivo é suficiente |
| Investimentos/portfolio | Fora do escopo de controle financeiro diário |
| Relatórios fiscais | Complexidade regulatória desnecessária |
| Notificações push | Sem backend persistente para enviar notificações |
| Migração de dados do Google Sheets | Começo zerado, dados antigos ficam como backup |
| Transações recorrentes automáticas | Complexidade de agendamento sem backend |
| Multi-moeda | Uso pessoal em BRL apenas |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FUND-01 | Phase 1 | Pending |
| FUND-02 | Phase 1 | Pending |
| FUND-03 | Phase 1 | Pending |
| FUND-04 | Phase 1 | Pending |
| WRIT-01 | Phase 1 | Pending |
| WRIT-02 | Phase 1 | Pending |
| WRIT-03 | Phase 1 | Pending |
| UX-02 | Phase 1 | Pending |
| UX-03 | Phase 1 | Pending |
| CONF-01 | Phase 2 | Pending |
| CONF-02 | Phase 2 | Pending |
| CONF-03 | Phase 2 | Pending |
| CONF-04 | Phase 2 | Pending |
| TRAN-01 | Phase 2 | Pending |
| TRAN-02 | Phase 2 | Pending |
| TRAN-03 | Phase 2 | Pending |
| TRAN-04 | Phase 2 | Pending |
| TRAN-05 | Phase 2 | Pending |
| TRAN-06 | Phase 2 | Pending |
| WRIT-04 | Phase 2 | Pending |
| UX-01 | Phase 2 | Pending |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 3 | Pending |
| ORCA-01 | Phase 3 | Pending |
| ORCA-02 | Phase 3 | Pending |
| GEMI-01 | Phase 4 | Pending |
| GEMI-02 | Phase 4 | Pending |
| GEMI-03 | Phase 4 | Pending |
| GEMI-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31 ✓
- Unmapped: 0

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-08 after roadmap creation*
