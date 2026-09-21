import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { GanttBar } from '../lib/gantt'

const MIN_VISIBLE_DURATION_MS = 1000 * 60 * 60 * 12

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

function shortenTitle(title: string): string {
  return title.length > 28 ? `${title.slice(0, 27)}…` : title
}

interface Row {
  id: number
  title: string
  fullTitle: string
  webUrl: string
  offset: number
  duration: number
  fill: string
  opacity: number
  start: Date
  end: Date
  hasConfirmedStart: boolean
  isOpenEnded: boolean
  statusLabel: string
}

function GanttTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.5rem 0.7rem',
        fontSize: '0.8rem',
        color: 'var(--text-primary)',
        maxWidth: 260,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{row.fullTitle}</div>
      <div>{row.statusLabel}</div>
      <div style={{ color: 'var(--text-muted)' }}>
        {formatDate(row.start)} → {row.isOpenEnded ? 'sem previsão' : formatDate(row.end)}
      </div>
      {!row.hasConfirmedStart && (
        <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
          Início estimado (a tarefa não passou por uma coluna "em andamento" rastreada)
        </div>
      )}
    </div>
  )
}

export function GanttChart({
  bars,
  rangeStart,
  rangeEnd,
}: {
  bars: GanttBar[]
  rangeStart: Date
  rangeEnd: Date
}) {
  const today = new Date()
  const totalSpan = Math.max(rangeEnd.getTime() - rangeStart.getTime(), 1)
  const todayOffset = today.getTime() - rangeStart.getTime()

  const rows: Row[] = bars.map((bar) => ({
    id: bar.issue.id,
    title: shortenTitle(bar.issue.title),
    fullTitle: bar.issue.title,
    webUrl: bar.issue.web_url,
    offset: bar.start.getTime() - rangeStart.getTime(),
    duration: Math.max(bar.end.getTime() - bar.start.getTime(), MIN_VISIBLE_DURATION_MS),
    fill: bar.isDone ? 'var(--status-good)' : bar.isOverdue ? 'var(--status-critical)' : 'var(--series-actual)',
    opacity: bar.hasConfirmedStart ? 1 : 0.5,
    start: bar.start,
    end: bar.end,
    hasConfirmedStart: bar.hasConfirmedStart,
    isOpenEnded: bar.isOpenEnded,
    statusLabel: bar.isDone ? 'Finalizada' : bar.isOverdue ? 'Atrasada' : 'Em andamento',
  }))

  const height = Math.max(140, rows.length * 34 + 50)

  return (
    <div>
      <div className="chart-legend">
        <span>
          <span className="swatch" style={{ background: 'var(--series-actual)' }} />
          Em andamento
        </span>
        <span>
          <span className="swatch" style={{ background: 'var(--status-good)' }} />
          Finalizada
        </span>
        <span>
          <span className="swatch" style={{ background: 'var(--status-critical)' }} />
          Atrasada
        </span>
        <span>
          <span className="swatch" style={{ background: 'var(--series-actual)', opacity: 0.5 }} />
          Início estimado
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 20, right: 16, bottom: 0, left: 8 }} barCategoryGap={8}>
          <CartesianGrid stroke="var(--gridline)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, totalSpan]}
            tickFormatter={(value: number) => formatDate(new Date(rangeStart.getTime() + value))}
            stroke="var(--baseline)"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="title"
            width={150}
            stroke="var(--baseline)"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          />
          <Tooltip content={<GanttTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
          {todayOffset >= 0 && todayOffset <= totalSpan && (
            <ReferenceLine
              x={todayOffset}
              stroke="var(--text-muted)"
              strokeDasharray="3 3"
              label={{ value: 'Hoje', position: 'top', fill: 'var(--text-muted)', fontSize: 11 }}
            />
          )}
          <Bar dataKey="offset" stackId="gantt" fill="transparent" isAnimationActive={false} />
          <Bar
            dataKey="duration"
            stackId="gantt"
            radius={[4, 4, 4, 4]}
            isAnimationActive={false}
            style={{ cursor: 'pointer' }}
            onClick={(data: { payload?: Row }) => {
              const url = data?.payload?.webUrl
              if (url) window.open(url, '_blank', 'noreferrer')
            }}
          >
            {rows.map((row) => (
              <Cell key={row.id} fill={row.fill} opacity={row.opacity} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
