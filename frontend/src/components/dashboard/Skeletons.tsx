/**
 * Skeletons différenciés par rôle pour le Dashboard.
 */

export function MemberSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-6 w-48 bg-ink-100 rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-ink-100 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 bg-ink-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-ink-100 rounded-lg animate-pulse" />
      </div>
    </div>
  )
}

export function ChefSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-6 w-48 bg-ink-100 rounded animate-pulse" />
      <div className="h-12 bg-ink-100 rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-ink-100 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 h-64 bg-ink-100 rounded-lg animate-pulse" />
        <div className="lg:col-span-2 h-64 bg-ink-100 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 bg-ink-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-ink-100 rounded-lg animate-pulse" />
      </div>
      <div className="h-48 bg-ink-100 rounded-lg animate-pulse" />
    </div>
  )
}

export function DirectorSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-6 w-48 bg-ink-100 rounded animate-pulse" />
      <div className="h-12 bg-ink-100 rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-ink-100 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 h-64 bg-ink-100 rounded-lg animate-pulse" />
        <div className="lg:col-span-2 h-64 bg-ink-100 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-64 bg-ink-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-ink-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-ink-100 rounded-lg animate-pulse" />
      </div>
      <div className="h-48 bg-ink-100 rounded-lg animate-pulse" />
    </div>
  )
}
