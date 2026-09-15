#!/usr/bin/env bash
set -euo pipefail

MARKER="<!-- claude-code-review -->"
MAX_DIFF_BYTES=200000

if [ -z "${ANTHROPIC_API_KEY:-}" ] || [ -z "${GITLAB_REVIEW_TOKEN:-}" ]; then
  echo "ANTHROPIC_API_KEY ou GITLAB_REVIEW_TOKEN não configurados nas variáveis de CI/CD do projeto." >&2
  exit 1
fi

API="$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$CI_MERGE_REQUEST_IID"

MR_JSON=$(curl -sf --header "PRIVATE-TOKEN: $GITLAB_REVIEW_TOKEN" "$API")
IS_DRAFT=$(echo "$MR_JSON" | jq -r '.draft // .work_in_progress')
if [ "$IS_DRAFT" = "true" ]; then
  echo "MR em rascunho, pulando revisão automática."
  exit 0
fi

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
!$CI_MERGE_REQUEST_IID ("$CI_MERGE_REQUEST_TITLE"), de
$CI_MERGE_REQUEST_SOURCE_BRANCH_NAME para $CI_MERGE_REQUEST_TARGET_BRANCH_NAME.

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
