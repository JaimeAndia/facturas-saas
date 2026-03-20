export default function RecurrentesLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-44 rounded-lg bg-gray-200 dark:bg-gray-700" />

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-gray-100 px-5 py-4 last:border-0">
            <div className="space-y-1.5">
              <div className="h-3.5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-700/50" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
              <div className="h-8 w-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
