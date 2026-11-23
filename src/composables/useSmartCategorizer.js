const REGLAS_CLASIFICACION = [
  { keywords: ['btc', 'bitcoin', 'eth', 'ethereum', 'sol', 'solana', 'bnb', 'ada', 'xrp', 'cripto'], tipo: 'inversion', categoria: 'Compra Activo / Cripto' },
  { keywords: ['plazo fijo', 'fci', 'fondo comun', 'fondo común'], tipo: 'inversion', categoria: 'Plazo Fijo / FCI' },
  { keywords: ['bono', 'al30', 'gd30', 'letra', 'renta fija', 'cedear'], tipo: 'inversion', categoria: 'Renta Fija / Bonos' },
  { keywords: ['sueldo', 'salario', 'honorario', 'honorarios', 'consultoria', 'consultoría', 'cobro'], tipo: 'ingreso', categoria: 'Sueldo / Honorarios' },
  { keywords: ['inmueble', 'bienes raices', 'bienes raíces', 'propiedad', 'renta'], tipo: 'ingreso', categoria: 'Bienes Raíces' },
  { keywords: ['coto', 'carrefour', 'super', 'supermercado', 'dia', 'disco', 'jumbo', 'verduleria', 'verdulería', 'carniceria', 'carnicería'], tipo: 'gasto', categoria: 'Supermercado' },
  { keywords: ['uber', 'cabify', 'taxi', 'subte', 'colectivo', 'nafta', 'gasolina', 'ypf', 'shell', 'peaje', 'transporte'], tipo: 'gasto', categoria: 'Transporte' },
  { keywords: ['alquiler', 'expensas', 'departamento'], tipo: 'gasto', categoria: 'Alquiler' },
  { keywords: ['luz', 'agua', 'gas', 'internet', 'fibertel', 'personal', 'movistar', 'claro', 'edenor', 'edesur', 'servicios', 'netflix', 'spotify', 'youtube', 'disney', 'prime', 'icloud', 'chatgpt', 'suscripcion', 'suscripción', 'gym', 'gimnasio'], tipo: 'gasto', categoria: 'Servicios' },
  { keywords: ['impuesto', 'impuestos', 'afip', 'arba', 'api', 'monotributo', 'patente', 'tgi'], tipo: 'gasto', categoria: 'Impuestos' },
  { keywords: ['tarjeta', 'visa', 'mastercard', 'amex', 'resumen'], tipo: 'gasto', categoria: 'Tarjeta de Crédito' },
  { keywords: ['ropa', 'zapatillas', 'indumentaria', 'remera', 'pantalon', 'pantalón', 'campera'], tipo: 'gasto', categoria: 'Indumentaria' },
  { keywords: ['notebook', 'celular', 'iphone', 'monitor', 'teclado', 'tecnologia', 'tecnología'], tipo: 'gasto', categoria: 'Tecnología' },
  { keywords: ['pedidosya', 'rappi', 'delivery', 'mcdonalds', 'cafe', 'café', 'restaurante', 'helado'], tipo: 'gasto', categoria: 'Compras' }
]

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function coincidePalabraCompleta(texto, keyword) {
  const kw = escaparRegex(keyword.toLowerCase().trim())
  const regex = new RegExp(`(?:^|[^a-z0-9áéíóúüñ])${kw}(?:$|[^a-z0-9áéíóúüñ])`, 'i')
  return regex.test(texto)
}

export function sugerirClasificacion(descripcion, categorias = []) {
  const texto = (descripcion || '').toLowerCase().trim()
  if (texto.length < 3) return null

  const regla = REGLAS_CLASIFICACION.find((r) =>
    r.keywords.some((kw) => coincidePalabraCompleta(texto, kw))
  )
  if (!regla) return null

  const catEncontrada = categorias.find(
    (c) =>
      (c.tipo || '').toLowerCase() === regla.tipo &&
      (c.nombre || '').toLowerCase() === regla.categoria.toLowerCase()
  )

  return {
    tipo: regla.tipo,
    categoriaNombre: regla.categoria,
    categoriaId: catEncontrada?.id || null
  }
}