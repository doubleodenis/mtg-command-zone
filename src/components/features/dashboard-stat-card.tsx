"use client";

import { Card, CardContent } from '@/components/ui/card'
import { AnimatedNumber } from '@/components/ui/animated-number'

type DashboardStatCardProps = {
  label: string
  sublabel?: string
  /** If provided, animates the number from 0 to this value */
  animatedValue?: number
  /** Decimals for animated value (default: 0) */
  decimals?: number
  /** Static text before the animated number */
  prefix?: string
  /** Static text after the animated number */
  suffix?: string
}

/**
 * Simple stat card for dashboard grids.
 * Displays a label, animated value with optional prefix/suffix, and optional sublabel.
 * 
 * @example
 * ```tsx
 * <DashboardStatCard label="Win Rate" animatedValue={50} suffix="%" />
 * <DashboardStatCard label="Best Streak" animatedValue={3} suffix=" wins" />
 * <DashboardStatCard label="Rating" animatedValue={1847} />
 * ```
 */
export function DashboardStatCard({ 
  label, 
  sublabel, 
  animatedValue = 0,
  decimals = 0,
  prefix = "",
  suffix = "",
}: DashboardStatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sublabel text-sm text-text-2 mb-1">{label}</p>
        <AnimatedNumber 
          value={animatedValue} 
          decimals={decimals}
          prefix={prefix}
          suffix={suffix}
          className="text-stat text-text-1"
        />
        {sublabel && (
          <p className="text-mono-sm text-text-2 mt-1">{sublabel}</p>
        )}
      </CardContent>
    </Card>
  )
}
