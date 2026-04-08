# Feature Landscape

**Domain:** Aplicação web de controle financeiro pessoal com arquitetura flat-file (JSON + GitHub Actions)
**Researched:** 2026-04-08
**Confidence:** HIGH (baseado no codebase existente de ~2100 linhas + análise do ecossistema)

## Table Stakes

Features que o usuário espera. Se faltar, o app se torna inutilizável.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **CRUD de transações** (criar, listar, editar, excluir) | Funcionalidade fundamental de qualquer app financeiro. Sem isso não existe app. | Média | Escrita via GitHub Actions (Issue → Action → commit JSON). Leitura via fetch direto nos JSONs do repo. Latência de escrita de segundos a minutos é aceitável para uso pessoal. |
| **Categorias e subcategorias** com cores | Usuários precisam organizar gastos. Apps como YNAB, Actual Budget, Monarch Money todos oferecem hierarquia de categorias. Cores ajudam na visualização rápida. | Baixa | JSON simples. App atual já tem. Preservar hierarquia 2 níveis (categoria → subcategoria). |
| **Dashboard com resumo mensal** | Visão rápida do estado financeiro é o que o usuário vê toda vez que abre o app. Renda, despesas, saldo, nº transações. | Média | Chart.js para gráficos. Cards de resumo. Cálculos feitos no client-side a partir dos JSONs. |
| **Gráficos interativos** (gastos por categoria, orçado vs realizado) | Visualização é table stakes desde 2023. Firefly III, Actual Budget, Quicken Simplifi todos têm dashboards visuais. Sem gráficos, parece uma planilha. | Média | Chart.js (já usado no app atual). Pie chart de categorias + bar chart orçado vs realizado são os dois essenciais. |
| **Orçamento por categoria** com comparativo realizado vs planejado | Envelope budgeting é o padrão. YNAB popularizou. Actual Budget é built em torno disso. Usuário quer saber "gastei X de Y permitido". | Média | Armazenado em config JSON. Cálculo client-side comparando budget vs soma de transações filtradas por categoria/mês. Per-person budgets já existem no app atual. |
| **Filtros e busca** no extrato (por tipo, pessoa, categoria, período) | Com o acúmulo de transações, sem filtros o extrato vira ilegível. Todo app financeiro tem. | Baixa | Client-side filtering após carregar JSON. Sem necessidade de backend search. Volume de dados pessoal (centenas/mês) é processável no browser. |
| **Métodos de pagamento** configuráveis | Usuário precisa distinguir entre cartão de crédito, débito, Pix, dinheiro. Essencial para reconciliação e para a lógica de ciclo de fatura. | Baixa | Lista simples em config JSON. CRUD inline na tela de configurações. |
| **Configurações de perfil** (nome, salário, metas) | Personalização mínima. Sem nome/salário, o dashboard não consegue calcular saldo real. Metas motivam o usuário. | Baixa | JSON de config. Um objeto por pessoa com nome, cor, salário, metas. |
| **Formato brasileiro** (R$, DD/MM/YYYY, timezone SP) | App é para uso pessoal no Brasil. Formato errado causa confusão e erros de entrada. | Baixa | Formatação via `Intl.NumberFormat('pt-BR')` e `toLocaleDateString`. Já implementado no app atual. |
| **Responsividade mobile** | Maioria dos acessos vem do celular. App que não funciona no mobile será abandonado. Todo app financeiro moderno é mobile-first. | Média | CSS responsivo com media queries. Tab navigation já adaptada no app atual. Max-width 860px com padding. |
| **Suporte a múltiplas pessoas** (1 ou mais, configurável) | Casais/famílias compartilham finanças. O app atual suporta 2 pessoas com tabs de toggle. Actual Budget e Monarch Money têm shared access como selling point. | Média | Modelo flexível: N pessoas em config JSON, filtro por pessoa em transações. v1 pode manter modelo simples (1-2 pessoas) com extensibilidade. |

## Differentiators

Features que diferenciam o app. Não esperadas, mas valorizadas. Foco no que se encaixa naturalmente na arquitetura flat-file + GitHub Actions.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **OCR de comprovantes com Gemini AI** | Elimina digitação manual. Usuário tira foto do comprovante/fatura e a IA extrai dados. Pouquíssimos apps open-source/self-hosted têm isso. Competidores como Navan cobram caro. | Alta | Gemini API (free tier). Suporte a imagem (JPG/PNG/WEBP) + PDF. Extração de comprovante simples (1 transação) e fatura completa (múltiplos itens). Chave API via GitHub Secrets. **Diferencial matador do FinanceiroVK.** |
| **AI sugestão de categoria** | Ao digitar descrição, IA sugere categoria automaticamente. Reduz atrito na entrada de dados. Apps premium (Quicken Simplifi, Copilot Money) têm isso via regras/ML. | Média | Gemini API com prompt contextual. Envia descrição + lista de categorias do usuário. Resposta rápida, custo zero no free tier. |
| **Dados versionados no Git** (auditoria natural) | Cada alteração vira um commit. Histórico completo, rollback grátis, diff visual. Nenhum app financeiro tradicional oferece isso. É a vantagem inerente da arquitetura flat-file no Git. | Zero (inerente) | Não precisa construir nada. É consequência da arquitetura. Destacar como feature na UX ("seus dados têm histórico completo no Git"). |
| **Ciclo de fatura de cartão de crédito** por pessoa | Compras após o fechamento migram para competência do mês seguinte. Fundamental para quem usa cartão de crédito pesado. Apps simples ignoram isso. O app atual já tem. | Média | Config: dia_fechamento + dia_pagamento por pessoa. Lógica no frontend: se data transação > dia fechamento E método = Cartão de Crédito → competência = mês+1. |
| **Zero custo** (GitHub Pages + Actions + Gemini free tier) | Não paga nada. Nenhum servidor. Nenhuma assinatura. YNAB custa $14.99/mês. Monarch Money $14.99/mês. Copilot Money $11.99/mês. | Zero (inerente) | GitHub Pages grátis, Actions grátis (2000 min/mês), Gemini API grátis (15 RPM). Custo zero é diferencial competitivo real vs apps pagos. |
| **Portabilidade total dos dados** | Dados são seus, em JSON legível, no seu repositório. Migração para outro sistema = ler JSON. Nenhum vendor lock-in. | Zero (inerente) | Contraste com apps que prendem dados (YNAB requer export manual, Mint foi descontinuado e dados foram perdidos). |
| **Operações em lote** (seleção múltipla + exclusão em massa) | Acelera limpeza e organização. App atual já tem checkbox + "Excluir Selecionados" no extrato. Apps simples só permitem um de cada vez. | Baixa | Client-side: checkboxes + envio de array de IDs para Action deletar. |
| **Fatura completa com múltiplos itens** | Upload de fatura de cartão → IA extrai N transações de uma vez → revisar e salvar em lote. Diferencial forte. Apps de receipt scanning normalmente lidam com 1 recibo = 1 transação. | Alta | Gemini analisa imagem/PDF, retorna array de items. UI com tabela de review (checkbox, categoria editável). Já existe no app atual. |
| **Offline reading** | Frontend estático carrega dados via fetch. Com cache/service worker, leitura funciona offline. Escrita requer internet (GitHub API), mas consulta não. | Baixa | Service worker cacheia JSONs. Não é prioridade v1, mas a arquitetura suporta naturalmente. |

## Anti-Features

Features para deliberadamente NÃO construir. Ruins para flat-file ou fora do escopo.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Sincronização bancária automática** (Plaid, Open Finance) | Requer servidor persistente, OAuth flows, keys sensíveis, compliance bancário. Incompatível com arquitetura estática. Complexidade desproporcional para uso pessoal. | Entrada manual + OCR de comprovantes. O OCR com IA compensa 80% do esforço de digitação. |
| **Autenticação/login** | Uso pessoal, 1-2 pessoas. Adicionar auth requer backend, sessões, tokens. URL obscura + repo privado é suficiente para o threat model. | Repo privado + GitHub Pages habilitado. URL não é indexável. Se precisar mais, GitHub Pages pode exigir autenticação via GitHub (repo privado). |
| **Real-time sync multi-dispositivo** | Flat-file no Git não suporta escrita concorrente segura. Dois dispositivos escrevendo ao mesmo tempo podem causar conflito. | Leitura é instant (fetch JSON). Escrita é serializada via GitHub Actions (fila de Issues). Conflitos são improváveis com uso pessoal de 1-2 pessoas. |
| **Investimentos e portfolio** | Requer cotações em tempo real, cálculo de rentabilidade, múltiplas classes de ativos. Complexidade de domínio enorme. Apps como Personal Capital/Empower são dedicados a isso. | Fora do escopo. Se necessário, track como transação manual de rendimento. |
| **Pagamento automatizado de contas** | Requer integração bancária, autorização de pagamento, compliance PCI. Impossível sem backend financeiro. | Track manual. Transação de "Conta X paga" após o pagamento. |
| **Transações recorrentes automáticas** | Cron do GitHub Actions poderia criar transações, mas: (1) Actions pode atrasar até 15min, (2) manutenção de regras de recorrência é complexa, (3) Actions programadas podem falhar silenciosamente. | **v1:** Manual. **Futuro:** Possível com cron Action que lê regras de recorrência do JSON e cria transações. Mas não é prioridade — frequência mensal significa 5-10 transações recorrentes no máximo. |
| **Notificações push** | Requer service worker + push server + subscription management. Overengineering para app pessoal. | Sem notificações. Usuário abre o app quando quer. Dashboard mostra alertas de orçamento estourado. |
| **App mobile nativo** | Dobra a complexidade. Manutenção de 2 codebases. PWA/responsivo atende 95% do uso. | Web-first responsivo. Pode adicionar PWA manifest para "instalar" no celular como ícone na home screen. |
| **Importação de extrato bancário** (OFX/QIF) | Parsing de formatos bancários brasileiros é frágil (cada banco tem formato diferente). Manutenção alta. | OCR de comprovante/fatura é mais universal. Funciona com qualquer banco/cartão. |
| **Relatórios fiscais/IRPF** | Legislação muda, complexidade tributária brasileira é alta, risco de informação errada. | Fora de escopo. Dados exportáveis em JSON podem alimentar ferramentas especializadas. |

## Feature Dependencies

```
Configurações (pessoas, categorias, métodos) → Tudo (todas as features dependem de config existente)
    ├── Transação CRUD → Extrato (listagem/filtro/edição)
    │                  → Dashboard (resumo do mês)
    │                  → Orçamento (comparativo realizado vs planejado)
    │
    ├── Categorias/Subcategorias → Orçamento por categoria
    │                            → Gráfico de gastos por categoria
    │                            → AI sugestão de categoria
    │
    ├── Métodos de pagamento → Ciclo de fatura cartão de crédito
    │
    ├── Gemini API config → OCR de comprovante
    │                     → OCR de fatura (múltiplos itens)
    │                     → AI sugestão de categoria
    │
    └── Pessoas configuradas → Filtro por pessoa no dashboard
                             → Orçamento per-person
                             → Ciclo de fatura per-person
```

**Cadeia crítica para v1:**
1. Config (pessoas + categorias + métodos) — fundação
2. Transação CRUD — funcionalidade core
3. Dashboard — visualização imediata do valor
4. Orçamento — controle de gastos
5. Receipt OCR — diferencial de entrada de dados

## MVP Recommendation

### Priorizar (v1):

1. **Configurações completas** — fundação para tudo. Pessoas, categorias com subcategorias e cores, métodos de pagamento, salários, metas, ciclo de fatura.
2. **CRUD de transações** — core do app. Criar (com pessoa/tipo/categoria/subcategoria/método/estabelecimento), listar com filtros, editar via modal, excluir (single + bulk).
3. **Dashboard mensal** — valor imediato. Cards de resumo (renda/despesas/saldo/total), gráficos (categoria pie, orçado vs realizado, por pessoa), últimas transações, meta de economia.
4. **Orçamento por categoria** — controle de gastos. Budget mensal per-person por categoria, barra de progresso visual, alerta de estouro.
5. **OCR de comprovante com Gemini** — diferencial matador. Upload de imagem/PDF, extração automática de dados, review antes de salvar. Suporte a comprovante simples (1 item) e fatura completa (N itens).

### Diferir (v2+):

- **Poupança** (depósito/retirada/saldo/meta): Funcionalidade autônoma, não bloqueia o fluxo core. Complexidade média.
- **Insights mensais com IA**: Depende de volume de dados. Melhor após meses de uso quando há dados suficientes para análise significativa.
- **Relatório mensal detalhado**: Dashboard cobre 80% da necessidade. Relatório é nice-to-have.
- **Offline reading** (service worker): Otimização. Não é blocker para v1.
- **PWA manifest**: Quick win mas não essencial.

### Nunca construir:

- Sincronização bancária automática
- Autenticação/login complexa
- App mobile nativo
- Investimentos/portfolio
- Relatórios fiscais

## Complexity Budget (v1)

| Feature | Estimativa | Justificativa |
|---------|-----------|--------------|
| Config (schema JSON + UI + Action) | Média | Fundação: modelo de dados, CRUD de categorias/métodos, validação |
| Transação CRUD (UI + Action + JSON) | Alta | Maior volume de código. Form complexo, filtros, modal de edição, bulk ops |
| Dashboard (cálculos + Chart.js) | Média | Client-side aggregation. 4 charts + cards. Dependência: transações existentes |
| Orçamento (config + comparativo) | Baixa-Média | UI simples (tabela com barras). Cálculo = filtro por categoria + soma |
| Receipt OCR (upload + Gemini + review) | Alta | Integração com API externa, parsing de resposta IA, UI de review com tabela editável |

**Total v1:** ~5 features core, complexidade geral ALTA (pela integração Gemini + arquitetura GitHub Actions).

## Sources

- Análise do codebase existente (WebApp.html, ~2100 linhas, Google Apps Script)
- PROJECT.md — requisitos e constraints do projeto
- Quicken Simplifi, YNAB, Monarch Money, Actual Budget — feature comparison (WebSearch 2026)
- Firefly III — self-hosted open-source reference (Reddit r/selfhosted 2025)
- GitHub personal finance tracker projects (static site examples)
- Gemini AI OCR capabilities (Google developers blog 2025-2026)
- GitHub Actions scheduling/cron documentation
- Flat file database limitations (Estuary, Vantazo, Clustox)
