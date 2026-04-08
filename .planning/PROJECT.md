# FinanceiroVK — Flat-File Edition

## What This Is

Aplicação web de controle financeiro pessoal com arquitetura flat-file. Frontend estático (HTML/JS) hospedado no GitHub Pages, dados armazenados em arquivos JSON no repositório, e escrita de dados via GitHub Actions disparadas por Issues criadas pelo frontend via API do GitHub. Integração com Gemini AI para OCR de comprovantes.

## Core Value

O usuário consegue registrar e visualizar suas transações financeiras de forma rápida e confiável, com dados versionados e sob seu controle total no GitHub.

## Requirements

### Validated

(None yet — fresh start, no data migration)

### Active

- [ ] CRUD de transações financeiras (criar, listar, filtrar, editar, excluir)
- [ ] Dashboard com gráficos interativos (Chart.js) — resumo por categoria, receita vs despesa
- [ ] Orçamento por categoria com comparativo realizado vs planejado
- [ ] Análise de comprovantes/faturas com Gemini AI (OCR de imagem → extração de transações)
- [ ] Configurações (categorias, subcategorias, métodos de pagamento, metas, dados pessoais)
- [ ] Suporte flexível a múltiplas pessoas (1 ou mais, configurável)
- [ ] Frontend estático servido via GitHub Pages
- [ ] Dados persistidos em arquivos JSON na pasta `/data` do repositório
- [ ] Escrita de dados via GitHub Actions (frontend cria Issue via API → Action processa e faz commit no JSON)
- [ ] Chave da API Gemini injetada no build via variável de ambiente do GitHub Action

### Out of Scope

- Poupança (CRUD de movimentações) — v2
- Insights mensais com Gemini AI — v2
- Relatório mensal detalhado — v2
- Autenticação/login — uso pessoal, URL obscura suficiente
- Migração de dados do Google Sheets — começo zerado
- App mobile nativo — web-first
- Sidebars do Google Sheets — arquitetura antiga sendo aposentada
- Backend com servidor persistente — arquitetura é serverless via Actions

## Context

**Origem:** Reestruturação do FinanceiroVK existente, atualmente rodando como Google Apps Script com Google Sheets como banco de dados. O app atual tem ~4.500 linhas de código, suporte a 2 pessoas, integração com Gemini AI, dashboard com Chart.js, e CRUD completo de transações/poupança/orçamento.

**Motivação:** Eliminar a dependência do ecossistema Google Apps Script. Ganhar controle total sobre os dados (versionados no Git), simplificar o deploy (GitHub Pages é gratuito e automático), e manter a portabilidade.

**Arquitetura alvo:**
- **Frontend:** HTML/CSS/JS estáticos no GitHub Pages (vanilla, sem framework)
- **Dados:** Arquivos `.json` na pasta `/data` do repo (flat-file database)
- **Escrita:** GitHub Actions como "backend" — frontend cria Issue via GitHub API → Action lê o Issue, atualiza os JSONs, faz commit
- **Leitura:** Frontend faz `fetch()` direto nos arquivos JSON raw do repo (via GitHub Pages ou raw.githubusercontent)
- **IA:** Gemini API chamada no build (Action) com key em env var, ou chamada client-side com key embutida no build

**Design system atual (a ser preservado):**
- Paleta: Indigo (#1a237e primary, #3949ab secondary), Green (#2e7d32 receita), Red (#c62828 despesa)
- Fonte: Google Sans, Arial
- Chart.js para gráficos
- Formato brasileiro: R$ #.###,00, DD/MM/YYYY, timezone America/Sao_Paulo

**Referência do codebase atual:** `.planning/codebase/` contém análise completa da arquitetura GAS.

## Constraints

- **Hosting:** GitHub Pages (site estático, sem server-side rendering)
- **Dados:** Flat-file JSON no repo (sem banco de dados externo)
- **Escrita:** Via GitHub Actions apenas (sem endpoint HTTP próprio)
- **Custo:** Zero — todos os serviços usados são gratuitos (GitHub Pages, Actions, API Gemini free tier)
- **Latência de escrita:** Salvamentos não são instantâneos — dependem do ciclo Issue → Action → commit (segundos a minutos)
- **Segurança:** Sem autenticação; repo pode ser privado com GitHub Pages habilitado
- **IA:** Gemini API com key gerenciada via GitHub Secrets, injetada no build

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Flat-file JSON ao invés de banco externo | Zero custo, dados versionados no Git, simplicidade máxima | — Pending |
| GitHub Actions como backend de escrita | Sem servidor para manter, integração nativa com repo | — Pending |
| Issue Forms como trigger de escrita | API do GitHub acessível do frontend, Action pode ler payload do Issue | — Pending |
| Vanilla JS sem framework | App pequeno, manter simplicidade, sem build step complexo | — Pending |
| Gemini key via env var no build | Evita expor key no frontend, Action injeta no HTML gerado | — Pending |
| Começo zerado sem migrar dados | Simplifica v1, dados antigos ficam no Google Sheets como backup | — Pending |
| Suporte flexível a N pessoas | Evolução do modelo fixo de 2 pessoas do app atual | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-08 after initialization*
