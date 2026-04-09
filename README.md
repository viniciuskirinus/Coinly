# Coinly

Sistema completo de controle financeiro pessoal. Interface moderna, responsiva e instalável como aplicativo (PWA). Dados armazenados em nuvem via Supabase PostgreSQL.

**[Acessar o Coinly](https://viniciuskirinus.github.io/Coinly/)**

---

## Funcionalidades

### Dashboard
- Visão geral do mês: salário, disponível, receitas, despesas
- Gráfico de rosca com distribuição de gastos por categoria
- Gráfico de barras comparativo receita × despesa
- Progresso do orçamento por categoria com alertas visuais
- Navegação entre meses com setas
- Filtro por pessoa ou "Todos" (agrega dados de múltiplos usuários)

### Transações
- Registro manual com tipo (despesa/receita), data, valor, categoria, subcategoria, pessoa e método de pagamento
- Sugestão automática de categoria via Gemini AI ao digitar a descrição
- Detecção de duplicatas antes de salvar
- Ajuste automático de mês para compras no cartão de crédito (baseado no dia de fechamento)
- Detecção de salário: ao registrar uma receita com palavras-chave como "salário" ou "holerite", oferece registrar no histórico de salários

### Extrato
- Lista completa de transações do mês com filtros por pessoa, tipo e categoria
- Visualização em tabela (desktop) ou cards (mobile)
- Seleção múltipla para exclusão em lote
- Edição inline de transações existentes
- Navegação entre meses

### Scanner IA (Gemini)
- **Comprovante**: upload de foto/PDF de um comprovante, a IA preenche automaticamente data, valor, descrição e categoria
- **Extrato/Fatura**: upload de extrato bancário ou fatura de cartão, a IA identifica múltiplas transações com tipo (receita/despesa), permitindo edição e salvamento em lote
- Suporte a JPG, PNG, WebP, HEIC e PDF
- Detecção automática de receitas (incluindo salários) em extratos

### Poupança
- Criação de metas de poupança com nome, valor alvo, prazo e cor
- Depósitos e retiradas com registro de data e observação
- Barra de progresso visual por meta
- Visualização de lançamentos dentro de cada meta

### Histórico de Salários
- Registro mensal de salários por pessoa
- Gráfico de progressão salarial ao longo do tempo
- Cálculo de variação percentual entre meses
- Salário do mês é usado no dashboard; se não houver registro no mês, usa o valor padrão da configuração

### Configurações
- **Tema**: alternância entre modo claro e escuro
- **Segurança**: definição de PIN para proteger o acesso (SHA-256 + AES-GCM)
- **Pessoas**: cadastro de múltiplos usuários com salário, meta mensal, dia de fechamento/pagamento do cartão e cor
- **Categorias**: categorias de despesa e receita com ícone, cor e subcategorias personalizáveis
- **Orçamento**: definição de limite por categoria por pessoa
- **Métodos de pagamento**: cadastro livre (Pix, Cartão de Crédito, Dinheiro, etc.)
- **Gemini AI**: configuração da chave de API, seleção de modelo e teste de conexão
- **Banco de dados**: status e teste de conexão com Supabase

---

## Arquitetura

```
Frontend (GitHub Pages)   →   Supabase PostgreSQL (nuvem)
      HTML/CSS/JS                 REST API
         ↓                           ↓
   Service Worker (PWA)        Dados persistentes
```

### Frontend
- HTML5 + CSS3 + JavaScript ES Modules (vanilla, sem frameworks)
- Hospedado no GitHub Pages com deploy automático via GitHub Actions
- PWA instalável com `manifest.json` e `service-worker.js`
- UI responsiva: sidebar no desktop, barra inferior no mobile

### Backend
- Supabase PostgreSQL como banco de dados principal
- Comunicação via REST API (PostgREST) usando `@supabase/supabase-js`
- Row Level Security (RLS) habilitado com policies permissivas (uso pessoal)

### Segurança
- PIN de acesso com hash SHA-256
- Chave Gemini criptografada com AES-256-GCM (PBKDF2 com 100k iterações, derivada do PIN)
- Sessão via `sessionStorage` (expira ao fechar o navegador)
- Chave anon do Supabase é pública por design (publishable key)

---

## Estrutura de Arquivos

```
├── index.html                 # Página principal (SPA)
├── manifest.json              # Configuração PWA
├── service-worker.js          # Cache e offline
├── css/
│   ├── variables.css          # Design tokens (cores, espaçamento, tipografia)
│   ├── base.css               # Layout, sidebar, login, mobile
│   ├── components.css         # Cards, botões, formulários, modais, tabelas
│   └── views.css              # Estilos específicos das views
├── js/
│   ├── app.js                 # Bootstrap, navegação, tema, autenticação, alertas
│   ├── modules/
│   │   ├── supabase.js        # Inicialização do client Supabase
│   │   ├── data-service.js    # Leitura de dados (cache + Supabase)
│   │   ├── github-api.js      # Escrita de dados (dispatch → Supabase)
│   │   ├── auth.js            # Hash, criptografia, sessão
│   │   ├── gemini.js          # Integração com Google Gemini AI
│   │   ├── format.js          # Formatação de moeda e datas
│   │   ├── state.js           # Estado global e pending syncs
│   │   ├── storage.js         # localStorage helpers
│   │   └── budget-helpers.js  # Cálculos de orçamento
│   └── views/
│       ├── dashboard.js       # Dashboard com gráficos
│       ├── transaction.js     # Formulário de nova transação
│       ├── statement.js       # Extrato de transações
│       ├── receipt.js         # Scanner IA (comprovante e fatura)
│       ├── savings.js         # Metas de poupança
│       ├── salary-history.js  # Histórico de salários
│       ├── settings.js        # Configurações
│       ├── wizard.js          # Assistente de primeiro acesso
│       └── login.js           # Tela de login (PIN)
├── icons/
│   ├── icon-192.png           # Ícone PWA 192x192
│   ├── icon-512.png           # Ícone PWA 512x512
│   └── icon.svg               # Ícone SVG fonte
├── .github/workflows/
│   └── deploy.yml             # Deploy automático para GitHub Pages
├── setup-database.js          # Script de criação do schema no Supabase
└── seed-database.js           # Script de migração de dados JSON → Supabase
```

---

## Banco de Dados

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `people` | Pessoas cadastradas (nome, salário, metas, cartão de crédito) |
| `categories` | Categorias de despesa/receita com subcategorias |
| `payment_methods` | Métodos de pagamento (Pix, Cartão, etc.) |
| `transactions` | Todas as transações financeiras |
| `savings_goals` | Metas de poupança |
| `savings_deposits` | Depósitos/retiradas das metas |
| `salary_history` | Registro mensal de salários por pessoa |
| `budgets` | Limite de orçamento por categoria por pessoa |
| `app_config` | Configurações gerais (chave-valor) |

### Diagrama de Relacionamentos

```
people ──────── transactions (person)
                salary_history (person)
                budgets (person)
                savings_goals (person)

categories ──── transactions (category)
                budgets (category)

savings_goals ── savings_deposits (goal_id FK)
```

---

## Instalação e Configuração

### Pré-requisitos
- Conta no [Supabase](https://supabase.com) (plano gratuito é suficiente)
- Repositório no GitHub com Pages habilitado

### 1. Clonar o repositório

```bash
git clone https://github.com/viniciuskirinus/Coinly.git
cd Coinly
```

### 2. Criar o banco de dados

No Supabase, crie um novo projeto e obtenha:
- **URL do projeto** (ex: `https://xxxxx.supabase.co`)
- **Chave anon** (publishable key)
- **String de conexão PostgreSQL**

Atualize `js/modules/supabase.js` com sua URL e chave anon:

```javascript
const SUPABASE_URL = 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = 'sua_chave_anon';
```

### 3. Criar as tabelas

```bash
npm install pg
node setup-database.js
```

Ou execute o SQL do `setup-database.js` diretamente no SQL Editor do Supabase.

### 4. Deploy

O deploy é automático via GitHub Actions. A cada push na branch `main`, o site é publicado no GitHub Pages.

Para desenvolvimento local, basta abrir `index.html` com um servidor local:

```bash
npx serve .
```

### 5. Primeiro acesso

Ao acessar pela primeira vez, o assistente (wizard) guiará pela configuração inicial:
1. Nome e dados pessoais
2. Teste de conexão com o banco
3. Visualização das categorias padrão
4. Conclusão e acesso ao dashboard

---

## PWA (Progressive Web App)

O Coinly pode ser instalado como aplicativo no celular ou desktop:

1. Acesse o site no navegador
2. No Android: toque nos três pontos → "Instalar aplicativo"
3. No iOS: toque no ícone de compartilhar → "Adicionar à Tela de Início"
4. No Desktop (Chrome/Edge): clique no ícone de instalação na barra de endereço

### Comportamento offline
- A interface carrega normalmente via cache do Service Worker
- Operações de leitura/escrita exibem alerta quando não há conexão
- Ao voltar online, tudo funciona normalmente

### Estratégias de cache
- **Cache First**: arquivos estáticos (CSS, JS, fontes, CDNs)
- **Network First**: dados do Supabase (sempre busca dados frescos)

---

## Tecnologias

| Tecnologia | Uso |
|------------|-----|
| HTML5 / CSS3 / ES Modules | Frontend (sem frameworks) |
| [Supabase](https://supabase.com) | Banco de dados PostgreSQL + REST API |
| [Chart.js](https://www.chartjs.org/) | Gráficos do dashboard |
| [Google Gemini AI](https://ai.google.dev/) | OCR de comprovantes, sugestão de categorias |
| [GitHub Pages](https://pages.github.com/) | Hospedagem do frontend |
| [GitHub Actions](https://github.com/features/actions) | Deploy automático |
| Web Crypto API | SHA-256, AES-GCM, PBKDF2 |
| Service Worker | PWA, cache offline |
| [Inter](https://fonts.google.com/specimen/Inter) | Tipografia |

---

## Licença

Este projeto é de uso pessoal. Sinta-se livre para fazer fork e adaptar às suas necessidades.
