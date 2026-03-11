export default function InformesLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Cabecera + selector de período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-7 w-32 rounded-lg bg-gray-200" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-10 rounded-lg bg-gray-200" />
          ))}
          <div className="h-9 w-24 rounded-lg bg-gray-200" />
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="h-3 w-24 rounded bg-gray-200" />
            <div className="mt-3 h-7 w-20 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="h-4 w-40 rounded bg-gray-200" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between border-b border-gray-100 px-5 py-3.5 last:border-0">
            <div className="h-3.5 w-20 rounded bg-gray-200" />
            <div className="h-3.5 w-32 rounded bg-gray-200" />
            <div className="h-3.5 w-16 rounded bg-gray-200" />
            <div className="h-3.5 w-16 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  )
}
