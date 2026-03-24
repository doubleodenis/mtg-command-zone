'use client'

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import type { RatingHistoryEntry } from '@/types'

type RatingHistoryChartProps = {
  data: RatingHistoryEntry[]
  height?: number
  showCard?: boolean
  className?: string
}

/**
 * Displays rating history as a line chart with gradient fill.
 * Shows rating progression over time with wins/losses indicated.
 */
export function RatingHistoryChart({
  data,
  height = 200,
  showCard = true,
  className,
}: RatingHistoryChartProps) {
  // Transform data for chart
  const chartData = data.map((entry, index) => {
    const date = new Date(entry.matchDate)
    return {
      index,
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      rating: entry.ratingAfter,
      delta: entry.delta,
      isWin: entry.isWin,
    }
  })

  // Calculate min/max for Y axis with padding
  const ratings = chartData.map(d => d.rating)
  const minRating = Math.min(...ratings)
  const maxRating = Math.max(...ratings)
  const padding = Math.max(20, (maxRating - minRating) * 0.1)
  const yMin = Math.floor((minRating - padding) / 10) * 10
  const yMax = Math.ceil((maxRating + padding) / 10) * 10

  // Show labels every ~7 data points to avoid clutter
  const labelInterval = Math.max(1, Math.floor(chartData.length / 4))

  const content = (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#aa28d8" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#aa28d8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          axisLine={{ stroke: '#222228' }}
          tickLine={{ stroke: '#222228' }}
          tick={{ fill: '#5a6270', fontSize: 11 }}
          interval={labelInterval - 1}
          tickMargin={8}
        />
        <YAxis
          domain={[yMin, yMax]}
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#5a6270', fontSize: 11 }}
          width={40}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const data = payload[0].payload
            return (
              <div className="bg-card border border-card-border rounded-lg p-2 shadow-lg">
                <p className="text-sm text-text-1 font-display font-bold">
                  {data.rating}
                </p>
                <p className="text-xs text-text-2">{data.date}</p>
                <p
                  className={`text-xs font-bold ${
                    data.isWin ? 'text-win' : 'text-loss'
                  }`}
                >
                  {data.delta >= 0 ? '+' : ''}
                  {data.delta}
                </p>
              </div>
            )
          }}
        />
        <Area
          type="monotone"
          dataKey="rating"
          stroke="#aa28d8"
          strokeWidth={2}
          fill="url(#ratingGradient)"
          dot={false}
          activeDot={{
            r: 4,
            fill: '#aa28d8',
            stroke: '#0f0f12',
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )

  if (!showCard) {
    return <div className={className}>{content}</div>
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">{content}</CardContent>
    </Card>
  )
}
