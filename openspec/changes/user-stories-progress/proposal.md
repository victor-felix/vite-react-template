## Why

Hoje o app mostra burndown, Gantt e velocidade por milestone, mas não responde à pergunta mais comum do time: "quanto de cada história de usuário (US) já foi desenvolvido e o que falta?". No projeto real (`inova-af/fp`) as US vivem como issues com a label `História`, as subtasks como issues com a label `Task` e prefixo `[USxxx]` no título, e as US ainda em validação com o negócio vivem só na wiki (pasta `História-de-Usuário/Validação`), algumas já com subtasks criadas no GitLab (ex.: US011, US012, US013). Não existe hoje nenhuma visão que junte essas três fontes.

## What Changes

- Nova página **Histórias** (rota `/historias`, link na navegação) que lista todas as US do projeto, abertas e fechadas.
- Cada US é um **acordeon**: o cabeçalho mostra código, título, estado e a **porcentagem de desenvolvimento** (subtasks concluídas ÷ total de subtasks) com barra de progresso; ao abrir, lista as subtasks marcando cada uma como **concluída** ou **pendente**, com link para a issue.
- Uma segunda seção lista as **US em validação** lidas da pasta configurada da wiki, no mesmo formato de acordeon, com link para a página da wiki e as subtasks do GitLab que já existirem para aquele código.
- Vínculo US ↔ subtask pelo código no título (`[US007] - ...` → US007). Quando mais de uma US no GitLab tem o mesmo código, a referência explícita à issue-mãe na descrição da subtask (`#545`) decide.
- Subtask "concluída" = issue fechada **ou** em uma das colunas de concluído já configuradas (`doneLabels`). Labels de exclusão (`excludeLabels`) continuam valendo.
- Três novos campos em **Configurações**: label das histórias (padrão `História`), label das subtasks (padrão `Task`) e pasta da wiki com as US em validação (aceita o caminho ou a URL da wiki; vazio desliga a seção).
- Novo helper de paginação na camada de API: o projeto tem ~290 issues `Task`, acima do limite de 100 por página que as chamadas atuais usam.

## Capabilities

### New Capabilities
- `user-story-progress`: listagem das US (GitLab + pasta de validação da wiki) em acordeons com porcentagem de desenvolvimento e subtasks marcadas como concluídas ou pendentes, incluindo as configurações que definem de onde vêm US e subtasks.

### Modified Capabilities
<!-- Nenhuma: openspec/specs/ ainda não tem specs publicadas. -->

## Impact

- `src/types/gitlab.ts`: novos campos em `GitlabConfig` (`storyLabel`, `taskLabel`, `validationWikiPath`), `description` em `GitlabIssue` e tipo `GitlabWikiPage`.
- `src/lib/config.ts`: defaults dos novos campos ao carregar configs antigas do `sessionStorage`.
- `src/lib/gitlabApi.ts`: `gitlabFetchAll` (paginação por `x-next-page`), `getAllIssuesByLabel`, `getWikiPages`, `getProject` reutilizado para montar URLs da wiki.
- Novo `src/lib/userStories.ts` (montagem e cálculo, sem React) e novos componentes `UserStoriesPage` / `UserStoryAccordion`.
- `src/App.tsx`, `src/components/Layout.tsx`, `src/pages/SettingsPage.tsx`, `src/App.css`.
- Sem novas dependências. Chamadas extras à API: ~3 páginas de issues `Task`, 1 de histórias, 1 da lista da wiki, 1 do projeto.
