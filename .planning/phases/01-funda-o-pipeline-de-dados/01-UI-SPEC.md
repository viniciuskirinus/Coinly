---
phase: 1
slug: funda-o-pipeline-de-dados
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-08
---

# Phase 1 — UI Design Contract

> Contrato visual e de interação para a Phase 1: Fundação & Pipeline de Dados. Gerado por gsd-ui-researcher, verificado por gsd-ui-checker.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (Vanilla JS + CSS Custom Properties) |
| Preset | not applicable |
| Component library | none — componentes HTML/CSS manuais |
| Icon library | Emoji nativo (📊 💳 📋 📸 ⚙️ para nav; emoji de categoria definidos em `categories.json`) |
| Font | Google Sans, Arial, sans-serif (via Google Fonts CDN) |

**Fonte:** D-14, D-15 (CONTEXT.md) + Standard Stack (RESEARCH.md)

---

## Spacing Scale

Escala 8-point — todos os valores são múltiplos de 4:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gaps entre ícone e texto inline, padding mínimo |
| sm | 8px | Espaçamento entre elementos compactos, padding de pills/badges |
| md | 16px | Espaçamento padrão entre elementos, padding mobile do main-content |
| lg | 24px | Padding de seções, padding desktop do main-content, gap entre cards |
| xl | 32px | Gap entre seções principais do wizard |
| 2xl | 48px | Padding vertical de seções hero (wizard boas-vindas) |
| 3xl | 64px | Altura da bottom bar mobile, sidebar collapsed width |

Exceções:
- **Sidebar desktop:** 240px largura (`--sidebar-width`) — valor fixo de layout, não da escala de spacing
- **Touch targets mobile:** mínimo 44px para áreas tocáveis (nav items da bottom bar)

**Fonte:** RESEARCH.md (CSS Custom Properties section)

---

## Typography

| Role | Size | Weight | Line Height | Uso |
|------|------|--------|-------------|-----|
| Body | 14px | 400 (Regular) | 1.5 | Texto corrido, descrições, conteúdo de cards |
| Label | 12px | 700 (Bold) | 1.4 | Labels de form (uppercase), texto auxiliar, timestamps |
| Heading | 20px | 700 (Bold) | 1.2 | Títulos de seção, heading de views, título do wizard step |
| Display | 24px | 700 (Bold) | 1.2 | Título principal do app na sidebar, heading de boas-vindas do wizard |

Pesos declarados: **Regular (400)** + **Bold (700)** — consistente com o app GAS atual.

**Fonte:** D-15 (CONTEXT.md) + RESEARCH.md (CSS Custom Properties `--font-size-*`)

---

## Color

### Distribuição 60/30/10

| Role | Value | Uso |
|------|-------|-----|
| Dominante (60%) | `#f5f7ff` | Background geral do app (`--color-bg`), superfícies principais |
| Secundário (30%) | `#ffffff` cards + `#1a237e` sidebar | Cards de conteúdo (`--color-card`), sidebar de navegação (`--color-primary`) |
| Accent (10%) | `#3949ab` | Elementos interativos primários — lista restrita abaixo |

### Accent reservado para (lista exaustiva):
1. Background do nav item ativo na sidebar
2. Botões primários ("Próximo", "Concluir Configuração", "Testar Conexão")
3. Focus ring de inputs de formulário (`border-color` no `:focus`)
4. Indicador de progresso do wizard (step ativo)
5. Links em texto corrido
6. Tab ativa (se usada dentro de views)

### Cores Semânticas

| Role | Value | Uso restrito |
|------|-------|--------------|
| Income (receita) | `#2e7d32` | Valores monetários positivos, badges de receita, ícones de sucesso |
| Expense (despesa) / Destructive | `#c62828` | Valores monetários negativos, alertas de erro, ações destrutivas |
| Warning | `#e65100` | Alertas de atenção, PAT prestes a expirar, indicadores de pendência |
| Info | `#1565c0` | Alertas informativos, tooltips, dicas do wizard |

### Superfícies auxiliares

| Token | Value | Uso |
|-------|-------|-----|
| `--color-text` | `#37474f` | Cor de texto principal |
| `--color-text-secondary` | `#78909c` | Texto secundário, placeholders, timestamps |
| `--color-border` | `#c5cae9` | Bordas de cards, inputs, divisores |
| Alert success bg | `#e8f5e9` | Background de alerta de sucesso |
| Alert error bg | `#ffebee` | Background de alerta de erro |
| Drag hover | `#e8eaf6` | Background de drop zone no estado hover |

**Fonte:** D-14 (CONTEXT.md) + UX-02 (REQUIREMENTS.md) + RESEARCH.md (CSS Custom Properties) + Codebase GAS (WebApp.html `:root` block)

---

## Copywriting Contract

### CTAs do Wizard (D-05)

| Step | Heading | CTA primário | CTA secundário |
|------|---------|-------------|----------------|
| 1. Boas-vindas | "Bem-vindo ao FinanceiroVK" | "Começar" | — |
| 2. Pessoa | "Quem é você?" | "Próximo" | "Voltar" |
| 3. GitHub PAT | "Conectar ao GitHub" | "Testar Conexão" | "Voltar" |
| 4. Categorias | "Categorias padrão" | "Próximo" | "Voltar" |
| 5. Pronto | "Tudo pronto!" | "Ir para o Dashboard" | — |

### Estados Vazios

| View | Heading | Body |
|------|---------|------|
| Dashboard (placeholder) | "Seu painel financeiro" | "Os resumos e gráficos aparecerão aqui quando você registrar suas primeiras transações." |
| Transação (placeholder) | "Nova transação" | "O formulário de registro de transações será habilitado na próxima fase." |
| Extrato (placeholder) | "Extrato mensal" | "A lista de transações com filtros será habilitada na próxima fase." |
| Comprovante (placeholder) | "Leitura de comprovantes" | "O scanner de comprovantes e faturas com IA será habilitado em uma fase futura." |
| Config (sem dados) | "Configurações" | "Configure suas preferências usando o assistente de boas-vindas." |

### Estados de Erro

| Contexto | Copy |
|----------|------|
| PAT inválido / sem permissão | "Token inválido ou sem permissão. Verifique se o PAT tem escopo 'Contents: Write' para este repositório." |
| Conexão com GitHub falhou | "Não foi possível conectar ao GitHub. Verifique sua conexão com a internet e tente novamente." |
| Falha ao carregar dados (fetch) | "Não foi possível carregar os dados. Tente recarregar a página." |
| Dispatch falhou (repo não encontrado) | "Repositório não encontrado. Verifique o nome do repositório e as permissões do token." |
| Payload inválido (422) | "Erro ao processar os dados. Tente novamente ou entre em contato com o suporte." |

### Ações Destrutivas

Nenhuma ação destrutiva na Phase 1. Operações de delete (transações, categorias) serão implementadas nas Phases 2+.

**Fonte:** D-05 (CONTEXT.md — wizard), RESEARCH.md (Pattern 2: GitHub API Client — error codes), RESEARCH.md (Pitfalls 2-3)

---

## Component Inventory (Phase 1)

Componentes HTML/CSS necessários nesta fase:

| Componente | Variantes | Onde é usado |
|------------|-----------|--------------|
| **App Shell** | desktop (sidebar + content), mobile (content + bottom bar) | Layout raiz |
| **Sidebar** | expanded (desktop 240px), bottom bar (mobile 64px) | Navegação principal |
| **Nav Item** | default, active, hover | Sidebar / bottom bar |
| **Wizard** | step container, progress bar, step content | Primeiro acesso (D-05) |
| **Card** | default (white bg, border, shadow-sm) | Container de conteúdo em todas as views |
| **Button** | primary (`--color-secondary` bg), ghost (transparent), disabled | CTAs do wizard, testar conexão |
| **Input** | text, select, password (para PAT) | Formulários do wizard |
| **Alert** | success (green), error (red), info (blue), warning (orange) | Feedback de operações |
| **Placeholder View** | centered, com ícone + heading + body | Views não implementadas nesta fase |
| **Spinner** | inline (16px), block (32px) | Indicador de carregamento durante fetch/dispatch |

---

## Layout Contract

### Desktop (>768px)

```
┌──────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────────────────────────────┐ │
│ │ SIDEBAR  │ │         MAIN CONTENT             │ │
│ │  240px   │ │         padding: 24px             │ │
│ │  fixed   │ │                                   │ │
│ │          │ │   ┌─────────────────────────────┐ │ │
│ │  📊 Dash │ │   │         CARD                │ │ │
│ │  💳 Tran │ │   │    padding: 16-24px         │ │ │
│ │  📋 Extr │ │   │    radius: 8px              │ │ │
│ │  📸 Comp │ │   │    shadow-sm                │ │ │
│ │  ⚙️ Conf │ │   └─────────────────────────────┘ │ │
│ │          │ │                                   │ │
│ └──────────┘ └──────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

- Sidebar: `position: fixed`, `background: var(--color-primary)`, `color: white`
- Main content: `margin-left: 240px`, `background: var(--color-bg)`

### Mobile (≤768px)

```
┌────────────────────┐
│                    │
│   MAIN CONTENT     │
│   padding: 16px    │
│                    │
│   ┌──────────────┐ │
│   │    CARD      │ │
│   └──────────────┘ │
│                    │
│   margin-bottom:   │
│   64px             │
├────────────────────┤
│ 📊  💳  📋  📸  ⚙️ │  ← bottom bar 64px, fixed bottom
└────────────────────┘
```

- Bottom bar: `position: fixed`, `bottom: 0`, `height: 64px`, ícones apenas (sem labels)
- Nav items: mínimo 44px touch target
- Decisão de Claude's Discretion: bottom bar > hamburger (5 itens, acesso direto em 1 tap)

**Fonte:** D-02, D-03, D-04 (CONTEXT.md) + RESEARCH.md (Sidebar Layout + mobile recommendation)

---

## Shadows & Elevation

| Token | Value | Uso |
|-------|-------|-----|
| `--shadow-sm` | `0 1px 3px rgba(0, 0, 0, 0.08)` | Cards em repouso |
| `--shadow-md` | `0 4px 12px rgba(0, 0, 0, 0.1)` | Cards hover, dropdowns |
| `--shadow-lg` | `0 8px 24px rgba(0, 0, 0, 0.12)` | Modais, wizard overlay |

**Fonte:** RESEARCH.md (CSS Custom Properties)

---

## Transitions

| Token | Value | Uso |
|-------|-------|-----|
| `--transition-fast` | `150ms ease` | Hover states, focus rings |
| `--transition-normal` | `250ms ease` | View transitions, sidebar collapse, wizard step |

**Fonte:** RESEARCH.md (CSS Custom Properties)

---

## Borders & Radius

| Token | Value | Uso |
|-------|-------|-----|
| `--radius` | `8px` | Cards, inputs, buttons, alerts |
| `--radius-lg` | `12px` | Wizard container, modal |

**Fonte:** RESEARCH.md (CSS Custom Properties) + Codebase GAS (`--rad: 8px`)

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| N/A | N/A | Projeto Vanilla JS — sem shadcn, sem registries |

Nenhum registry de terceiros utilizado. Todos os componentes são HTML/CSS manuais.

---

## Pre-Population Summary

| Source | Decisions Used | Details |
|--------|---------------|---------|
| CONTEXT.md | 18 (D-01 a D-18) | Navegação, wizard, write path, JSON schema, design system, estrutura |
| RESEARCH.md | 12 | CSS tokens completos, layout patterns, mobile recommendation, JSON schemas, code examples |
| REQUIREMENTS.md | 9 (FUND-01→04, WRIT-01→03, UX-02, UX-03) | Requisitos da Phase 1 |
| Codebase GAS (WebApp.html) | 3 | Confirmação de CSS variables, font weights, component patterns |
| User input | 0 | Nenhuma pergunta necessária — upstream 100% coberto |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
