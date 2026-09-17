import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { BurndownPoint } from '../lib/burndown'

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
}

interface TooltipPayloadItem {
  dataKey: string
  value: number | null
  color: string
}

function BurndownTooltip({
  active,
  payload,
  label,
  idealKey,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
  idealKey: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.5rem 0.7rem',
        fontSize: '0.8rem',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{formatDateLabel(label ?? '')}</div>
      {payload.map((item) =>
        item.value === null || item.value === undefined ? null : (
          <div key={item.dataKey} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: item.color,
                display: 'inline-block',
              }}
            />
            <span>{item.dataKey === idealKey ? 'Ideal' : 'Real'}:</span>
            <strong>{item.value}</strong>
          </div>
        ),
      )}
    </div>
  )
}

export function BurndownChart({
  points,
  hasDueDate,
  mode = 'issues',
}: {
  points: BurndownPoint[]
  hasDueDate: boolean
  mode?: 'points' | 'issues'
}) {
  const actualKey = mode === 'points' ? 'actualPoints' : 'actualIssues'
  const idealKey = mode === 'points' ? 'idealPoints' : 'idealIssues'
  const unitLabel = mode === 'points' ? 'pontos restantes' : 'tarefas restantes'

  return (
    <div>
      <div className="chart-legend">
        <span>
          <span className="swatch" style={{ background: 'var(--series-actual)' }} />
          Real ({unitLabel})
        </span>
        {hasDueDate && (
          <span>
            <span
              className="swatch"
              style={{
                background:
                  'repeating-linear-gradient(90deg, var(--series-ideal) 0 4px, transparent 4px 8px)',
              }}
            />
            Ideal
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            stroke="var(--baseline)"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            stroke="var(--baseline)"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            width={36}
          />
          <Tooltip content={<BurndownTooltip idealKey={idealKey} />} />
          {hasDueDate && (
            <Line
              type="monotone"
              dataKey={idealKey}
              stroke="var(--series-ideal)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
          <Line
            type="monotone"
            dataKey={actualKey}
            stroke="var(--series-actual)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
