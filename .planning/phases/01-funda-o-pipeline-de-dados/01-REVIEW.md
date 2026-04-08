---
phase: 01
status: issues_found
findings: 9
severity_high: 2
severity_medium: 4
severity_low: 3
---

# Fase 01 — Relatório de code review

**Escopo:** arquivos criados/alterados conforme `01-01` a `01-04-SUMMARY.md` (dados seed, CSS, `index.html`, módulos JS, views, GitHub Actions, `process-write.mjs`).  
**Foco:** bugs, segurança (PAT / GitHub API / Actions), qualidade e tratamento de erros.

## Arquivos revisados (lista)

- `.gitignore`
- `data/config.json`, `data/categories.json`, `data/payment-methods.json`, `data/transactions/2026-04.json`
- `css/variables.css`, `css/base.css`, `css/components.css`, `css/views.css`
- `index.html`
- `js/app.js`, `js/modules/format.js`, `js/modules/storage.js`, `js/modules/state.js`, `js/modules/data-service.js`, `js/modules/github-api.js`
- `js/views/dashboard.js`, `transaction.js`, `statement.js`, `receipt.js`, `settings.js`, `wizard.js`
- `.github/workflows/write-data.yml`, `.github/workflows/deploy.yml`
- `.github/scripts/process-write.mjs`

## Resumo

O pipeline `repository_dispatch` evita interpolação do payload no shell (bom). O cliente `github-api.js` usa cabeçalhos adequados para a API REST. Há, porém, **risco alto** de **path traversal** no script server-side se `client_payload.target` (mês) não for validado, e **XSS armazenado/refletido** em `settings.js` ao inserir dados de `config.json` e `localStorage` em `innerHTML` sem escape. Pontos médios incluem robustez do `process-write.mjs` (JSON inválido / estrutura inesperada), injeção via estilos nas categorias do wizard, e descompasso UX quando o `dispatch` falha mas o wizard já é marcado como concluído.

---

## Alta severidade

### H-01 — Path traversal em `target` (mês) no `process-write.mjs`

**Arquivo:** `.github/scripts/process-write.mjs` (ex.: linhas 54–56, 83, 110)

**Problema:** `yearMonth` vem de `payload.target` (ou da transação). Valores como `../config` ou `2026-04/../../data/config` geram caminhos como `data/transactions/<valor>.json` e podem escrever **fora** de `data/transactions/`, corrompendo arquivos do repositório.

**Correção:** Validar com regex estrita e rejeitar qualquer outro valor:

```javascript
function assertYearMonth(ym, label) {
  if (typeof ym !== 'string' || !/^\d{4}-\d{2}$/.test(ym)) {
    console.error(`Validation failed: invalid ${label} (expected YYYY-MM)`);
    process.exit(1);
  }
  return ym;
}
// Em cada handler que usa target, ex.: const month = assertYearMonth(yearMonth || txn.date.slice(0, 7), 'target');
```

---

### H-02 — XSS em `settings.js` via `innerHTML` com dados dinâmicos

**Arquivo:** `js/views/settings.js` (linhas 29–42)

**Problema:** `person?.name`, `repoConfig.owner` e `repoConfig.repo` são concatenados em template strings atribuídas a `section.innerHTML`. Conteúdo malicioso em `data/config.json` (repo comprometido ou PR malicioso) ou valores alterados no `localStorage` podem executar HTML/JS no contexto da aplicação.

**Correção:** Reutilizar o padrão `esc()` do wizard ou criar `js/modules/dom.js` com `esc()` compartilhado; aplicar a todos os campos vindos de JSON/storage, ou montar o DOM com `textContent`/`createElement`.

```javascript
// Exemplo: importar esc de um módulo utilitário
<p><strong>Nome:</strong> ${esc(person?.name || 'Não configurado')}</p>
<p><strong>Repo:</strong> ${esc(repoConfig.owner || '-')}/${esc(repoConfig.repo || '-')}</p>
```

---

## Média severidade

### M-01 — `process-write.mjs`: falhas sem tratamento e estrutura assumida

**Arquivo:** `.github/scripts/process-write.mjs` (linhas 27–29, 62–70, 90–94)

**Problema:** `readJSONFile` chama `JSON.parse` sem `try/catch` — arquivo corrompido derruba o job. Handlers assumem `file.transactions` como array; se estiver ausente ou não for array, `.push` / `.findIndex` / `.filter` quebram.

**Correção:** Envolver parse em try/catch com `process.exit(1)` e mensagem clara; após ler o arquivo, validar `Array.isArray(file.transactions)` ou inicializar `file.transactions = []` com log de aviso conforme política do projeto.

---

### M-02 — Estilos inline com `c.color` sem validação (wizard)

**Arquivo:** `js/views/wizard.js` (linhas 289–298)

**Problema:** `color` vem de `data/categories.json`. Valores não hex (ou strings com `;`, `url()`, etc.) permitem **CSS injection** no atributo `style`, com impacto de UI e possível exfiltração em cenários combinados com outros bugs.

**Correção:** Validar com `/^#[0-9A-Fa-f]{6}$/` (ou lista permitida) antes de interpolar; caso inválido, usar cor fallback do design system.

---

### M-03 — `github-api.js`: `owner`/`repo` na URL sem normalização

**Arquivo:** `js/modules/github-api.js` (linhas 17–18, 45–46)

**Problema:** Caracteres especiais, barras ou espaços em `owner`/`repo` produzem URL inválida ou comportamento inesperado; `owner`/`repo` vazios ainda disparam requisições (erro pouco claro).

**Correção:** Validar formato (ex.: regex alfanumérico + hífen conforme regras do GitHub) antes do `fetch`; opcionalmente usar `encodeURIComponent` por segmento de path da API (onde aplicável à API de repositórios).

---

### M-04 — Wizard concluído mesmo com `dispatch` falhando

**Arquivo:** `js/views/wizard.js` (linhas 354–360)

**Problema:** `markWizardDone()` e fechamento do overlay ocorrem mesmo quando `dispatch('update-config', …)` falha (catch vazio). O utilizador fica com wizard “feito” mas `config.json` no remoto pode não refletir as pessoas/config — estado inconsistente com a mensagem “Tudo pronto”.

**Correção:** Se `dispatch` retornar erro ou lançar, mostrar alerta, manter overlay ou step de retry, e **não** chamar `markWizardDone()` até sucesso confirmado (ou fila `pending writes` documentada).

---

## Baixa severidade

### L-01 — `catch` vazio / silencioso

**Arquivos:** `js/views/wizard.js` (linhas 30, 355–356)

**Problema:** Falhas de rede ou parse são engolidas; dificulta diagnóstico e pode mascarar regressões.

**Correção:** Logar em consola em desenvolvimento ou acumular telemetria mínima; no mínimo comentário + `console.warn` condicionado a flag de debug.

---

### L-02 — `paymentDay: closingDay + 5` pode exceder 31

**Arquivo:** `js/views/wizard.js` (linhas 337–340)

**Problema:** Valores de fechamento altos geram dia de pagamento inválido no domínio do negócio.

**Correção:** Normalizar com `((closingDay + 5 - 1) % 31) + 1` ou regra explícita documentada (ex.: cap em 31 / próximo dia útil).

---

### L-03 — PAT apenas em `localStorage`

**Arquivo:** `js/modules/storage.js` + fluxo do wizard

**Problema:** É trade-off esperado para SPA estática, mas qualquer XSS na origem expõe o token; extensões do browser com acesso à página também.

**Correção:** Documentar risco para o utilizador; considerar futuro armazenamento mais restrito ou fluxo OAuth de app (fora do escopo imediato).

---

## Pontos positivos

- Payload do workflow passado por `env: PAYLOAD` (`toJSON(client_payload)`), reduzindo risco de injeção de comando no shell.
- `concurrency` com `cancel-in-progress: false` serializa escritas sem descartar jobs.
- `testConnection` e `dispatch` tratam códigos HTTP comuns; PAT com `type="password"` no wizard.
- `showAlert` em `app.js` usa `textContent`, adequado contra XSS nesse caminho.
- `esc()` no wizard protege vários campos de texto; falta alinhar `settings.js` ao mesmo padrão.

---

_Revisão: 2026-04-08 · Profundidade: standard (leitura contextual dos fontes da fase 01) · Revisor: Claude (gsd-code-reviewer)_
