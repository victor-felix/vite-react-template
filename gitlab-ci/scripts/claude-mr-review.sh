#!/usr/bin/env bash
set -euo pipefail

MARKER="<!-- claude-code-review -->"
MAX_DIFF_BYTES=200000

if [ -z "${ANTHROPIC_API_KEY:-}" ] || [ -z "${GITLAB_REVIEW_TOKEN:-}" ]; then
  echo "ANTHROPIC_API_KEY ou GITLAB_REVIEW_TOKEN não configurados nas variáveis de CI/CD do projeto." >&2
  exit 1
fi

PROJECT_API="$CI_API_V4_URL/projects/$CI_PROJECT_ID"

# Funciona tanto em pipelines de merge request nativas (onde CI_MERGE_REQUEST_IID
# já vem definido) quanto em pipelines clássicas de branch (only/except): nesse
# segundo caso, resolve o MR aberto para a branch atual via API.
MERGE_REQUEST_IID="${CI_MERGE_REQUEST_IID:-}"
if [ -z "$MERGE_REQUEST_IID" ]; then
  BRANCH_ENCODED=$(printf '%s' "$CI_COMMIT_BRANCH" | jq -sRr @uri)
  MERGE_REQUEST_IID=$(curl -sf --header "PRIVATE-TOKEN: $GITLAB_REVIEW_TOKEN" \
    "$PROJECT_API/merge_requests?source_branch=${BRANCH_ENCODED}&state=opened&order_by=updated_at&per_page=1" \
    | jq -r '.[0].iid // empty')
fi

if [ -z "$MERGE_REQUEST_IID" ]; then
  echo "Nenhum merge request aberto para a branch '${CI_COMMIT_BRANCH:-desconhecida}' — nada para revisar."
  exit 0
fi

API="$PROJECT_API/merge_requests/$MERGE_REQUEST_IID"

MR_JSON=$(curl -sf --header "PRIVATE-TOKEN: $GITLAB_REVIEW_TOKEN" "$API")
IS_DRAFT=$(echo "$MR_JSON" | jq -r '.draft // .work_in_progress')
if [ "$IS_DRAFT" = "true" ]; then
  echo "MR !$MERGE_REQUEST_IID em rascunho, pulando revisão automática."
  exit 0
fi

MR_TITLE=$(echo "$MR_JSON" | jq -r '.title')
MR_SOURCE_BRANCH=$(echo "$MR_JSON" | jq -r '.source_branch')
MR_TARGET_BRANCH=$(echo "$MR_JSON" | jq -r '.target_branch')

# Usa a API de diffs do próprio GitLab em vez de "git diff" local: evita
# problemas de clone raso e funciona igual em qualquer pipeline de MR.
CHANGES_JSON=$(curl -sf --header "PRIVATE-TOKEN: $GITLAB_REVIEW_TOKEN" "$API/changes")
echo "$CHANGES_JSON" | jq -r '.changes[] | "diff --git a/\(.old_path) b/\(.new_path)\n\(.diff)"' > /tmp/mr.diff

if [ ! -s /tmp/mr.diff ]; then
  echo "Diff vazio, nada para revisar."
  exit 0
fi

DIFF_SIZE=$(wc -c < /tmp/mr.diff)
if [ "$DIFF_SIZE" -gt "$MAX_DIFF_BYTES" ]; then
  head -c "$MAX_DIFF_BYTES" /tmp/mr.diff > /tmp/mr.diff.tmp
  mv /tmp/mr.diff.tmp /tmp/mr.diff
  printf '\n[diff truncado - excedeu %s bytes]\n' "$MAX_DIFF_BYTES" >> /tmp/mr.diff
fi

PROMPT_FILE=/tmp/prompt.txt
cat > "$PROMPT_FILE" <<PROMPT
Você é um revisor de código sênior. Revise o diff abaixo do merge request
!$MERGE_REQUEST_IID ("$MR_TITLE"), de
$MR_SOURCE_BRANCH para $MR_TARGET_BRANCH.

Aponte apenas problemas reais e de alta confiança:
- bugs e condições de erro (entradas/estados que quebram o código)
- vulnerabilidades de segurança (injeção, XSS, segredos expostos, etc.)
- código morto, duplicado ou complexidade desnecessária introduzida por este diff
- testes ausentes para comportamento novo ou alterado

Não elogie nem repita o que já está bom. Se não houver problemas, diga isso em
uma frase.

Formate a saída em Markdown: uma lista com arquivo e linha (quando aplicável),
agrupada por severidade (Crítico / Importante / Sugestão). Sem preâmbulo.

Você pode usar as ferramentas Read, Grep e Glob para consultar o repositório e
entender o contexto além do diff, se necessário.

Diff:
\`\`\`diff
$(cat /tmp/mr.diff)
\`\`\`
PROMPT

claude -p --output-format text --allowedTools "Read Grep Glob" \
  < "$PROMPT_FILE" > /tmp/review.md

BODY_FILE=/tmp/review_body.md
{
  echo "$MARKER"
  echo ""
  echo "### 🤖 Revisão automática do Claude"
  echo ""
  cat /tmp/review.md
} > "$BODY_FILE"

# Idempotente: atualiza o comentário anterior do bot em vez de duplicar a
# cada novo push no MR.
EXISTING_NOTE_ID=$(curl -sf --header "PRIVATE-TOKEN: $GITLAB_REVIEW_TOKEN" "$API/notes?per_page=100" \
  | jq -r --arg marker "$MARKER" '[.[] | select(.body | startswith($marker))] | sort_by(.id) | last | .id // empty')

if [ -n "$EXISTING_NOTE_ID" ]; then
  curl -sf --request PUT --header "PRIVATE-TOKEN: $GITLAB_REVIEW_TOKEN" \
    --data-urlencode "body@${BODY_FILE}" \
    "$API/notes/$EXISTING_NOTE_ID" > /dev/null
  echo "Comentário de revisão atualizado (note $EXISTING_NOTE_ID)."
else
  curl -sf --request POST --header "PRIVATE-TOKEN: $GITLAB_REVIEW_TOKEN" \
    --data-urlencode "body@${BODY_FILE}" \
    "$API/notes" > /dev/null
  echo "Comentário de revisão publicado."
fi
