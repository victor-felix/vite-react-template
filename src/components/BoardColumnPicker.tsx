import type { GitlabBoardList } from '../types/gitlab'

// Lista de checkboxes com as colunas reais do quadro selecionado, para o
// usuário escolher direto quais representam cada fase do processo (em vez de
// digitar o nome da label de memória).
export function BoardColumnPicker({
  idPrefix,
  lists,
  selected,
  onToggle,
}: {
  idPrefix: string
  lists: GitlabBoardList[]
  selected: string[]
  onToggle: (name: string) => void
}) {
  const columns = lists.filter((l) => l.label)
  if (columns.length === 0) return null

  return (
    <div className="column-picker">
      {columns.map((list) => {
        const name = list.label!.name
        const checked = selected.includes(name)
        return (
          <label
            key={list.id}
            className={`column-option${checked ? ' column-option--selected' : ''}`}
            htmlFor={`${idPrefix}-${list.id}`}
          >
            <input
              id={`${idPrefix}-${list.id}`}
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(name)}
            />
            {name}
          </label>
        )
      })}
    </div>
  )
}
