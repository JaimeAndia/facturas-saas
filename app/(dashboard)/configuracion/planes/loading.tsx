export default function PlanesLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-7 w-36 rounded-lg bg-gray-200 dark:bg-gray-700" />

      {/* Toggle mensual/anual */}
      <div className="flex justify-center gap-3">
        <div className="h-5 w-14 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-6 w-11 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="h-5 w-10 rounded bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Tarjetas de planes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <div className="h-5 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-3 h-9 w-24 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-4 space-y-2.5">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-3 w-full rounded bg-gray-100 dark:bg-gray-700/50" />
              ))}
            </div>
            <div className="mt-5 h-10 w-full rounded-lg bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    </div>
  )
}
