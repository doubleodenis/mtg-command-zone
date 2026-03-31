import { Skeleton } from "@/components/ui/skeleton";

function SkeletonNotificationRow() {
  return (
    <div className="flex items-start gap-4 px-4 py-4">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-full max-w-md" height={16} />
        <Skeleton variant="text" width={200} height={14} />
        <Skeleton variant="text" width={80} height={12} />
      </div>
      <Skeleton variant="rectangular" width={24} height={24} className="rounded-md" />
    </div>
  );
}

export default function NotificationsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton variant="text" width={140} height={28} />
        <Skeleton variant="text" width={300} height={16} />
      </div>

      {/* Tab filters */}
      <div className="flex items-center gap-2">
        <Skeleton variant="rectangular" width={60} height={32} className="rounded-md" />
        <Skeleton variant="rectangular" width={80} height={32} className="rounded-md" />
        <div className="flex-1" />
        <Skeleton variant="rectangular" width={100} height={32} className="rounded-md" />
      </div>

      {/* Notification List */}
      <div className="rounded-lg bg-card border border-card-border overflow-hidden">
        <div className="divide-y divide-card-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonNotificationRow key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
