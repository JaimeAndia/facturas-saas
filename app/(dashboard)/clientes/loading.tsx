export default function ClientesLoading() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-24 rounded-lg bg-gray-200" />
        <div className="h-9 w-36 rounded-lg bg-gray-200" />
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {/* Buscador */}
        <div className="border-b border-gray-200 p-4">
          <div className="h-10 w-72 rounded-lg bg-gray-200" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-gray-100 px-5 py-4 last:border-0">
            <div className="space-y-1.5">
              <div className="h-3.5 w-36 rounded bg-gray-200" />
              <div className="h-3 w-28 rounded bg-gray-100" />
            </div>
            <div className="h-8 w-16 rounded-lg bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  )
}
