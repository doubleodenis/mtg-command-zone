'use client'

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

type ColorStats = {
  W: number
  U: number
  B: number
  R: number
  G: number
}

type ColorRadarChartProps = {
  colorStats: ColorStats
  height?: number
  className?: string
}

// Color names for display
const COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
}

// MTG mana colors for the chart
const MANA_COLORS: Record<string, string> = {
  W: '#F9FAF4', // White
  U: '#0E68AB', // Blue
  B: '#150B00', // Black
  R: '#D3202A', // Red
  G: '#00733E', // Green
}

/**
 * Radar chart showing player's color identity distribution
 * based on all commanders they've played.
 */
export function ColorRadarChart({
  colorStats,
  height = 250,
  className,
}: ColorRadarChartProps) {
  // Calculate total for percentages
  const total = Object.values(colorStats).reduce((a, b) => a + b, 0)

  // Transform data for the radar chart - order in WUBRG sequence
  const chartData = ['W', 'U', 'B', 'R', 'G'].map((color) => ({
    color,
    name: COLOR_NAMES[color],
    value: colorStats[color as keyof ColorStats],
    percentage: total > 0 ? Math.round((colorStats[color as keyof ColorStats] / total) * 100) : 0,
    fill: MANA_COLORS[color],
  }))

  // Find the max value for the domain
  const maxValue = Math.max(...Object.values(colorStats), 1)

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="#222228" />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: '#8a929f', fontSize: 12 }}
            tickLine={{ stroke: '#222228' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, maxValue]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Games"
            dataKey="value"
            stroke="#aa28d8"
            fill="#aa28d8"
            fillOpacity={0.4}
            strokeWidth={2}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <div className="bg-surface border border-card-border rounded-lg px-3 py-2 shadow-lg">
                    <p className="text-sm font-medium text-text-1">{data.name}</p>
                    <p className="text-xs text-text-2">
                      {data.value} games ({data.percentage}%)
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
