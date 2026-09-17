export default function LandingFeatures() {
  const features = [
    {
      title: "Inventario",
      description: "Mantén un control preciso de existencias y productos en todo momento.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    },
    {
      title: "Compras y proveedores",
      description: "Gestiona órdenes de compra, proveedores y la recepción de mercadería sin complicaciones.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      title: "Punto de venta",
      description: "Agiliza la operación diaria de ventas desde MARJYM con un sistema rápido e intuitivo.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      title: "Trazabilidad completa",
      description: "Supervisa tus productos mediante lotes, fechas de vencimiento y números de serie.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    {
      title: "Múltiples sucursales",
      description: "Gestiona múltiples sucursales desde una sola cuenta centralizada.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      title: "Seguridad y separación de información",
      description: "Los datos de cada negocio operan en espacios separados y seguros, garantizando tu privacidad.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    }
  ];

  return (
    <section id="funcionalidades" className="py-16 md:py-24 bg-[var(--color-surface)] border-y border-[var(--color-border)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-title)] mb-4">
            Todo lo que necesitas para operar
          </h2>
          <p className="text-lg text-[var(--color-title)]/70">
            Una plataforma robusta que se adapta a las necesidades de tu comercio, brindándote herramientas profesionales de gestión y control.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div key={idx} className="bg-[var(--color-app-background)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-[var(--color-title)] mb-3">
                {feature.title}
              </h3>
              <p className="text-[var(--color-title)]/70 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-20 pt-10 border-t border-[var(--color-border)] text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-title)]/50 mb-6">
            Diseñado para múltiples rubros
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-base font-medium text-[var(--color-title)]/80">
            <span className="px-4 py-2 rounded-full bg-[var(--color-app-background)] border border-[var(--color-border)]">Ferreterías</span>
            <span className="px-4 py-2 rounded-full bg-[var(--color-app-background)] border border-[var(--color-border)]">Farmacias</span>
            <span className="px-4 py-2 rounded-full bg-[var(--color-app-background)] border border-[var(--color-border)]">Tiendas</span>
            <span className="px-4 py-2 rounded-full bg-[var(--color-app-background)] border border-[var(--color-border)]">Abarroterías</span>
            <span className="px-4 py-2 rounded-full bg-[var(--color-app-background)] border border-[var(--color-border)]">Negocios de servicios</span>
          </div>
        </div>
      </div>
    </section>
  );
}
