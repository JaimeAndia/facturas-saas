export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-9 w-32 rounded-lg bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Barra de progreso */}
      <div className="h-16 rounded-xl bg-gray-100 dark:bg-gray-700/50" />

      {/* Tarjetas de stat */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-3 h-8 w-24 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-2 h-3 w-32 rounded bg-gray-100 dark:bg-gray-700/50" />
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="mb-4 h-4 w-52 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-48 rounded-lg bg-gray-100 dark:bg-gray-700/50" />
      </div>

      {/* Últimas facturas */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 last:border-0">
            <div className="space-y-1.5">
              <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-36 rounded bg-gray-100 dark:bg-gray-700/50" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-14 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
