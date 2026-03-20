export default function ClientesLoading() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-24 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-9 w-36 rounded-lg bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* Buscador */}
        <div className="border-b border-gray-200 p-4">
          <div className="h-10 w-72 rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-gray-100 px-5 py-4 last:border-0">
            <div className="space-y-1.5">
              <div className="h-3.5 w-36 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-28 rounded bg-gray-100 dark:bg-gray-700/50" />
            </div>
            <div className="h-8 w-16 rounded-lg bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    </div>
  )
}
