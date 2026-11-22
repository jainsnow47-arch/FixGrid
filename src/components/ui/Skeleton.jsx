export function Skeleton({ className = 'h-6 w-full' }) {
  return <div className={`animate-pulse rounded-md bg-[#245B45]/10 ${className}`} />;
}

export function TableSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-4 gap-4 items-center">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-full col-span-2" />
          <Skeleton className="h-5 w-20 justify-self-end" />
        </div>
      ))}
    </div>
  );
}
