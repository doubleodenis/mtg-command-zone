import { 
  Skeleton, 
  SkeletonStatCard, 
  SkeletonMatchCard, 
  SkeletonProfileHeader 
} from "@/components/ui/skeleton";

export default function PlayerProfileLoading() {
  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="flex items-start justify-between">
        <SkeletonProfileHeader />
        <Skeleton variant="rectangular" width={100} height={36} className="rounded-md" />
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Rating Chart Placeholder */}
      <div className="rounded-lg bg-card border border-card-border p-4 space-y-4">
        <Skeleton variant="text" width={120} height={16} />
        <Skeleton variant="rectangular" className="w-full h-48" />
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Format Stats */}
          <div className="rounded-lg bg-card border border-card-border p-4 space-y-4">
            <Skeleton variant="text" width={120} height={16} />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Skeleton variant="rectangular" width={50} height={20} className="rounded-sm" />
                    <Skeleton variant="text" width={60} height={14} />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton variant="text" width={40} height={14} />
                    <Skeleton variant="text" width={50} height={14} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Matches */}
          <div className="space-y-3">
            <Skeleton variant="text" width={140} height={16} />
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonMatchCard key={i} />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Top Commanders */}
          <div className="rounded-lg bg-card border border-card-border p-4 space-y-4">
            <Skeleton variant="text" width={120} height={16} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton variant="rectangular" width={32} height={32} className="rounded-md" />
                <div className="flex-1 space-y-1">
                  <Skeleton variant="text" width={100} height={14} />
                  <Skeleton variant="text" width={60} height={12} />
                </div>
              </div>
            ))}
          </div>

          {/* Color Chart */}
          <div className="rounded-lg bg-card border border-card-border p-4 space-y-4">
            <Skeleton variant="text" width={100} height={16} />
            <Skeleton variant="circular" width={160} height={160} className="mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
