export default function FacturasLoading() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-9 w-36 rounded-lg bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* Buscador + filtro */}
        <div className="flex gap-3 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="h-10 w-64 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-10 w-32 rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-gray-100 px-5 py-4 last:border-0">
            <div className="space-y-1.5">
              <div className="h-3.5 w-24 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-40 rounded bg-gray-100 dark:bg-gray-700/50" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
