## Context

O app é um SPA React 19 + Vite que fala direto com a API REST do GitLab pelo navegador (`src/lib/gitlabApi.ts`, token em `sessionStorage`). Toda a lógica de cálculo fica em `src/lib/*` (funções puras ou async sem React), e os componentes só buscam e renderizam — padrão seguido por `bugStatus.ts` + `BugStatusSummary.tsx`. Não há framework de testes no repositório; a verificação é `npm run build`, `npm run lint` e checagem manual.

Como os dados do projeto de referência (`inova-af/fp`, GitLab 18.2.1 CE) estão organizados, verificado pela API:

- **Histórias**: 14 issues com a label `História` (3 abertas, 11 fechadas). Título começa pelo código: `US007 - …`, `US004B - …`, `HU01 - …`, `[E-002] - …`. Há códigos repetidos (`US007` em #124, fechada, e #545, aberta).
- **Subtasks**: 291 issues com a label `Task`, quase todas com título `[USxxx] - …` ou `[USxxx] 6.2 - …`. O GitLab não tem vínculo estrutural entre elas e a história: o widget de hierarquia dos work items vem vazio, e os links de issue apontam só para os roteiros de QA. Parte das descrições traz `Issue-mãe: #545 (US007)`, mas não todas (as da US011 apontam para um épico).
- **Wiki de validação**: a pasta `Documentação-Negocial/Portal-e-Gestor-Farmacia-Popular/História-de-Usuário/Validação` tem 19 páginas de US (US010 a US029) que ainda não viraram issues `História`. Algumas já têm subtasks `[US011]`, `[US012]`, `[US013]` no GitLab; as demais não têm nenhuma. Há códigos repetidos dentro da pasta (duas US014, duas US018). As páginas não têm checklist de tarefas.

## Goals / Non-Goals

**Goals:**
- Uma página que liste todas as US (GitLab e wiki de validação) como acordeons com porcentagem de desenvolvimento e subtasks marcadas como concluídas ou pendentes.
- Funcionar com as convenções reais do projeto sem exigir mudança no GitLab, mantendo labels e pasta configuráveis.
- Reaproveitar as regras que o app já tem: colunas de concluído (`doneLabels`) e labels de exclusão (`excludeLabels`).

**Non-Goals:**
- Porcentagem ponderada por story points (o pedido é por subtask; `points.ts` pode ser usado depois).
- Mostrar a coluna do board em que cada subtask pendente está.
- Ler o conteúdo das páginas da wiki (decisões em aberto, critérios de aceite).
- Filtros, busca ou ordenação configurável na lista.
- Criar ou editar issues/páginas no GitLab.

## Decisions

### 1. Vínculo história ↔ subtask pelo código no título
A subtask pertence à história cujo código está entre colchetes no início do título. Código da história: regex no início do título, aceitando o código com ou sem colchetes (`/^\[?([A-Za-z]{1,4}-?\d+[A-Za-z]?)\]?/`). Código da subtask: conteúdo do primeiro par de colchetes (`/^\[([^\]]+)\]/`). Ambos normalizados com `trim().toUpperCase()` e comparados por igualdade, o que separa `US007` de `US007B` e ignora `[Epic]`/`[Gestão]`.

*Alternativas descartadas:* hierarquia de work items (vazia no projeto real); links entre issues (só ligam aos roteiros de QA); `Issue-mãe: #iid` na descrição como regra principal (ausente em parte das subtasks); a busca `search=` da API (é textual, `US007` também retorna `US007B`, e exigiria uma chamada por história).

### 2. Desempate quando o código se repete
Se mais de uma história do GitLab tem o mesmo código, procura-se na descrição da subtask um `#<iid>` (regex `/#(\d+)\b/g`) que seja de uma dessas histórias. Se houver, ela ganha; se não, vai para a de maior iid (a mais recente, que na prática é a reaberta/atual). Isso usa a convenção `Issue-mãe` quando ela existe sem depender dela.

### 3. Duas seções em vez de mesclar wiki e GitLab
As histórias do GitLab e as páginas da wiki aparecem em seções separadas, e uma página da wiki recebe as subtasks do seu código independentemente de existir uma issue `História` com o mesmo código. Mesclar por código esconderia dados: a US010 tem página em validação e uma issue `História` antiga fechada (#127), e a pasta tem duas US014 diferentes. O custo é que a mesma subtask pode aparecer nas duas seções; isso é aceitável e coerente (as duas visões leem o mesmo trabalho).

### 4. "Concluída" = fechada ou em coluna de concluído
Mesma semântica do burndown, para que os números batam entre as telas. Times que movem o card para uma coluna final antes de fechar a issue já têm essa coluna em `doneLabels`.

### 5. Buscar todas as subtasks de uma vez, com paginação
Novo `gitlabFetchAll<T>()` em `gitlabApi.ts` que segue o cabeçalho `x-next-page` com `per_page=100` até ele vir vazio, com limite de segurança de 50 páginas. A página faz, em paralelo: histórias (`labels=<storyLabel>`), subtasks (`labels=<taskLabel>`), lista da wiki (`GET /projects/:id/wikis`, que devolve todas as páginas sem conteúdo e sem paginação) e o projeto (para `web_url`, usado nos links da wiki). No projeto real são ~6 requisições. `gitlabFetch` passa a expor os headers para o helper; as funções existentes não mudam de comportamento.

### 6. Lógica pura em `src/lib/userStories.ts`
Funções sem React: `parseStoryCode`, `parseTaskCode`, `isTaskDone`, `buildGitlabStories`, `buildWikiStories`, `normalizeWikiPath`, `storyProgress`. O componente só chama `loadUserStories(config)` e renderiza. Mantém o padrão de `bugStatus.ts` e deixa o cálculo verificável isoladamente.

### 7. Acordeon com `<details>/<summary>` nativo
Acessível por teclado e leitor de tela sem estado React nem ARIA manual; o marcador padrão é escondido e substituído por um chevron em CSS que gira com `[open]`. Cada `<details>` é independente (vários podem ficar abertos). *Alternativa:* botão com `aria-expanded` e estado próprio — mais código para o mesmo resultado.

### 8. Página própria em `/historias`
O dashboard já tem MRs, bugs, burndown, Gantt e velocidade; 30+ acordeons ali o deixariam longo e lento para abrir. Uma rota separada carrega só quando acessada.

### 9. Pasta da wiki aceita URL
`normalizeWikiPath` pega o trecho depois de `/-/wikis/` quando o valor é uma URL, aplica `decodeURIComponent` e remove barras nas pontas. Páginas entram na seção quando `slug.startsWith(pasta + '/')`. O título exibido vem do `title` da listagem, em que o GitLab troca hífens por espaços (`US010   Migração de Acesso…`): sequências de 3+ espaços (o " - " original) viram ` – ` e as de 2 viram um espaço.

## Risks / Trade-offs

- [Subtasks fora da convenção de título não são contadas; hoje 49 issues `Task` não têm prefixo `[USxxx]`] → o acordeon de uma história sem subtasks diz qual prefixo é esperado; a convenção fica documentada na dica da tela de Configurações.
- [Códigos repetidos na pasta de validação (duas US014) mostram as mesmas subtasks nas duas páginas] → aceito; é o reflexo fiel de um código ambíguo, e hoje nenhuma das duas tem subtasks.
- [Projetos com milhares de issues `Task` geram muitas páginas de requisição] → limite de 50 páginas (5.000 issues) e carga só ao abrir a rota.
- [A listagem da wiki (`GET /wikis`) devolve a wiki inteira] → sem `with_content`, a resposta tem só slug/título/formato; no projeto real são ~200 entradas.
- [Token sem acesso à wiki ou wiki desabilitada (404)] → erro mostrado só na seção da wiki, sem derrubar a do GitLab.
- [`description` nula em issues sem descrição] → tratada como string vazia no desempate.

## Migration Plan

`loadConfig` passa a preencher `storyLabel: 'História'`, `taskLabel: 'Task'` e `validationWikiPath: ''` quando ausentes, então configurações salvas continuam válidas. Não há dados persistidos fora do `sessionStorage` e nada muda no GitLab; reverter é remover a rota e os campos.

## Open Questions

- Histórias fechadas ficam no fim da lista e fechadas no acordeon. Se a lista ficar longa demais na prática, um filtro "ocultar fechadas" pode entrar numa próxima mudança.
