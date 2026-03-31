import { Skeleton } from "@/components/ui/skeleton";

export default function MatchDetailLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar placeholder - will be replaced by real navbar from layout */}
      <div className="h-14 border-b border-card-border bg-card" />
      
      {/* Header */}
      <div className="border-b border-card-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton variant="text" width={160} height={28} />
              <Skeleton variant="text" width={200} height={14} />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton variant="rectangular" width={80} height={28} className="rounded-md" />
              <Skeleton variant="rectangular" width={60} height={20} className="rounded-full" />
              <Skeleton variant="rectangular" width={70} height={20} className="rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Match Preview Card Skeleton */}
        <div className="rounded-lg bg-card border border-card-border p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Skeleton variant="rectangular" width={60} height={24} className="rounded-sm" />
              <Skeleton variant="rectangular" width={50} height={24} className="rounded-full" />
            </div>
            <Skeleton variant="rectangular" width={100} height={20} className="rounded-full" />
          </div>

          {/* Participants */}
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-surface">
                <Skeleton variant="text" width={24} height={20} />
                <Skeleton variant="circular" width={36} height={36} />
                <div className="flex-1 space-y-1">
                  <Skeleton variant="text" width={120} height={16} />
                  <Skeleton variant="text" width={80} height={12} />
                </div>
                <div className="text-right space-y-1">
                  <Skeleton variant="text" width={50} height={16} />
                  <Skeleton variant="text" width={30} height={12} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Participant Details */}
        <div className="rounded-lg bg-card border border-card-border p-6">
          <Skeleton variant="text" width={140} height={20} className="mb-4" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg bg-surface space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton variant="circular" width={40} height={40} />
                  <div className="space-y-1">
                    <Skeleton variant="text" width={100} height={16} />
                    <Skeleton variant="text" width={70} height={12} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton variant="rectangular" width={32} height={32} className="rounded-sm" />
                  <div className="space-y-1">
                    <Skeleton variant="text" width={120} height={14} />
                    <Skeleton variant="text" width={80} height={12} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
