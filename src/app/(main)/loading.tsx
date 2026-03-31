import { Skeleton, SkeletonStatCard, SkeletonMatchCard } from "@/components/ui/skeleton";

export default function MainLoading() {
  return (
    <div className="space-y-8">
      {/* Page Header Skeleton */}
      <div className="space-y-2">
        <Skeleton variant="text" width={240} height={28} />
        <Skeleton variant="text" width={360} height={16} />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <Skeleton variant="text" width={120} height={14} />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonMatchCard key={i} />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-lg bg-card border border-card-border p-4 space-y-4">
            <Skeleton variant="text" width={100} height={14} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton variant="circular" width={24} height={24} />
                <Skeleton variant="text" className="flex-1" height={14} />
                <Skeleton variant="text" width={40} height={14} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
