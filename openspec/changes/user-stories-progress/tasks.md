## 1. Tipos e configuração

- [x] 1.1 Em `src/types/gitlab.ts`, adicionar `storyLabel`, `taskLabel` e `validationWikiPath` em `GitlabConfig`, `description: string | null` em `GitlabIssue` e a interface `GitlabWikiPage` (`slug`, `title`, `format`)
- [x] 1.2 Em `src/lib/config.ts`, preencher os defaults `'História'`, `'Task'` e `''` em `loadConfig` quando os campos não existirem na configuração salva

## 2. Camada de API

- [x] 2.1 Refatorar `gitlabFetch` em `src/lib/gitlabApi.ts` para que um helper interno devolva corpo e headers, sem mudar a assinatura nem o comportamento das funções existentes
- [x] 2.2 Implementar `gitlabFetchAll<T>()` seguindo `x-next-page` com `per_page=100` e limite de 50 páginas
- [x] 2.3 Adicionar `getAllIssuesByLabel(config, label)` (qualquer estado, todas as páginas) e `getWikiPages(config)` (`GET /projects/:id/wikis`)

## 3. Lógica das histórias (`src/lib/userStories.ts`)

- [x] 3.1 Implementar `parseStoryCode` e `parseTaskCode` com normalização para maiúsculas, garantindo que `US007` e `US007B` não se confundam e que `[Epic]` não vire código de história
- [x] 3.2 Implementar `isTaskDone(issue, doneLabels)` (fechada ou com label de coluna de concluído) e `storyProgress(tasks)` (`done`, `total`, `percent` arredondado; `percent: null` sem subtasks)
- [x] 3.3 Implementar `buildGitlabStories(stories, tasks, config)`: filtra `excludeLabels`, agrupa subtasks por código, desempata códigos repetidos por `#iid` na descrição e depois pelo maior iid, ordena subtasks por iid e histórias por aberta/fechada, código e iid
- [x] 3.4 Implementar `normalizeWikiPath` (aceita caminho ou URL com `/-/wikis/`, decodifica, remove barras nas pontas) e `buildWikiStories(pages, tasks, folder, projectWebUrl, config)`, com título exibido sem os espaços múltiplos da listagem
- [x] 3.5 Implementar `loadUserStories(config)` que busca histórias, subtasks, wiki e projeto em paralelo e devolve resultado/erro separados para as seções GitLab e wiki

## 4. Interface

- [x] 4.1 Criar `src/components/UserStoryAccordion.tsx` com `<details>/<summary>`: cabeçalho com código, título, selo de estado ("Aberta", "Fechada" ou "Em validação"), `done/total`, porcentagem ou "Sem subtasks" e barra de progresso; corpo com link para a história e lista de subtasks (ícone + texto "Concluída"/"Pendente", `#iid`, título com link) ou a mensagem com o prefixo esperado
- [x] 4.2 Criar `src/pages/UserStoriesPage.tsx` com estado vazio sem configuração, carregamento, e as seções "Histórias no GitLab" e "Em validação (wiki)" com erro e dica independentes
- [x] 4.3 Registrar a rota `/historias` em `src/App.tsx` e o link "Histórias" em `src/components/Layout.tsx`
- [x] 4.4 Adicionar em `src/App.css` os estilos do acordeon (chevron que gira com `[open]`, cabeçalho em linha que quebra em telas estreitas, lista de subtasks, marcadores de concluída/pendente com ícone), reaproveitando `.card`, `.progress-track` e `.progress-fill`

## 5. Configurações

- [x] 5.1 Em `src/pages/SettingsPage.tsx`, adicionar os campos "Label das histórias", "Label das subtasks" e "Pasta da wiki com histórias em validação", com dicas explicando a convenção `[CÓDIGO]` no título e que a pasta aceita a URL copiada do navegador
- [x] 5.2 Incluir os três campos no objeto salvo por `setConfig`

## 6. Verificação

- [x] 6.1 Rodar `npm run build` e `npm run lint` sem erros
- [x] 6.2 Conferir no navegador contra `inova-af/fp` com a pasta `Validação` configurada: US007 (#545) mostra as subtasks `[US007]` e não as `[US007B]`; US004B mostra porcentagem coerente com as issues fechadas; US020 aparece em "Em validação" com "Sem subtasks"; US013 aparece em "Em validação" com suas subtasks; acordeons abrem e fecham por clique e por teclado
- [x] 6.3 Conferir que uma configuração salva antes da mudança carrega sem erro e que o dashboard continua igual
