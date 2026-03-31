import { Card, CardContent } from '@/components/ui/card'

type DashboardStatCardProps = {
  label: string
  value: string
  sublabel?: string
}

/**
 * Simple stat card for dashboard grids.
 * Displays a label, value, and optional sublabel.
 */
export function DashboardStatCard({ label, value, sublabel }: DashboardStatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sublabel text-sm text-text-2 mb-1">{label}</p>
        <p className="text-stat text-text-1">{value}</p>
        {sublabel && (
          <p className="text-mono-sm text-text-2 mt-1">{sublabel}</p>
        )}
      </CardContent>
    </Card>
  )
}
