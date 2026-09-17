# Revisão automática de merge requests com Claude Code

Pipeline do GitLab CI que roda o Claude Code sobre cada merge request e publica
a revisão como comentário no MR. Feito para ser usado no **projeto GitLab**
que você configurou na tela de Configurações do relatório de burndown (não
neste repositório, que fica no GitHub).

## O que tem aqui

```
gitlab-ci/
├── .gitlab-ci.yml           # job de CI, disparado em pipelines de merge request
└── scripts/
    └── claude-mr-review.sh  # busca o diff, roda o Claude e publica/atualiza o comentário
```

## Como instalar no seu projeto GitLab

1. Copie `.gitlab-ci.yml` para a raiz do repositório (ou mescle o job
   `claude_mr_review` com o `.gitlab-ci.yml` que já existir lá).
2. Copie a pasta `scripts/` (com `claude-mr-review.sh`) para a raiz do mesmo
   repositório, mantendo o caminho `scripts/claude-mr-review.sh`.
3. Em **Settings → CI/CD → Variables**, crie duas variáveis:

   | Variável | Valor | Masked | Protected |
   |---|---|---|---|
   | `ANTHROPIC_API_KEY` | chave gerada em [console.anthropic.com](https://console.anthropic.com) | ✅ | ❌ |
   | `GITLAB_REVIEW_TOKEN` | Project Access Token (Settings → Access Tokens), papel **Developer**, escopo **api** | ✅ | ❌ |

   > **Por que não marcar "Protected"?** Variáveis protegidas só ficam
   > disponíveis em pipelines de branches/tags protegidas. Merge requests
   > normalmente partem de branches de feature (não protegidas) — se marcar
   > como Protected, o job falha por falta das variáveis.

4. Faça commit dessas mudanças. A partir do próximo merge request aberto ou
   atualizado, o job `claude_mr_review` roda automaticamente.

## Como funciona

1. O `.gitlab-ci.yml` de exemplo usa `rules: $CI_PIPELINE_SOURCE == "merge_request_event"`
   (pipelines nativas de merge request). Se o seu projeto usa pipelines
   clássicas de branch (`only:`/`except:`, sem `rules:`), rode o job assim
   mesmo — o script detecta que `$CI_MERGE_REQUEST_IID` não existe e resolve
   o MR aberto para a branch atual via API (`GET /merge_requests?source_branch=...`).
   Se não houver MR aberto para a branch, o job só encerra sem fazer nada.
2. `claude-mr-review.sh`:
   - consulta a API do GitLab para saber se o MR está em rascunho — se sim,
     encerra sem fazer nada;
   - busca o diff via `GET /merge_requests/:iid/changes` (evita depender de
     `git diff` local e de clones profundos);
   - trunca o diff em 200 KB para não estourar o contexto do modelo;
   - monta um prompt pedindo revisão focada em bugs, segurança, código morto/duplicado
     e testes ausentes, e roda `claude -p` restrito às ferramentas de leitura
     (`Read`, `Grep`, `Glob` — sem `Bash`, para não permitir execução arbitrária
     no pipeline);
   - publica o resultado como comentário no MR. Em pushes seguintes ao mesmo
     MR, **atualiza o mesmo comentário** (usa um marcador HTML oculto para
     encontrá-lo) em vez de duplicar.
3. `allow_failure: true` — a revisão é consultiva e não bloqueia o merge.
   Mude para `false` no `.gitlab-ci.yml` se quiser que vire um gate
   obrigatório.

## Ajustes comuns

- **Trocar o modelo**: exporte `CLAUDE_REVIEW_MODEL` como variável de CI/CD;
  ajuste `claude-mr-review.sh` para passar `--model "$CLAUDE_REVIEW_MODEL"`
  quando a variável estiver definida.
- **Revisar só certos caminhos**: filtre `CHANGES_JSON` por `old_path`/`new_path`
  com `jq` antes de montar o diff.
- **Diffs muito grandes**: a API `changes` pode retornar `overflow: true`
  quando o MR excede o limite de diff do GitLab; nesse caso considere paginar
  com `GET /merge_requests/:iid/diffs` em vez de `/changes`.

## Segurança

Como as variáveis não podem ser "Protected" (precisam rodar em branches de
feature), qualquer pessoa com permissão de abrir MR no projeto consegue
disparar esse job — em um projeto privado com colaboradores de confiança é o
mesmo nível de risco de qualquer outro segredo de CI. Se o projeto aceitar
merge requests de forks externos, não habilite pipelines de MR de forks para
este job.
