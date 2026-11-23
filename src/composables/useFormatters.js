export function hoyLocal() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatearFecha(fechaStr) {
  if (!fechaStr) return '-'
  const parts = fechaStr.split('-')
  if (parts.length !== 3) return fechaStr
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${parts[2]} ${meses[parseInt(parts[1], 10) - 1]} ${parts[0]}`
}

export function escaparCeldaCSV(valor) {
  if (valor === null || valor === undefined) return '""'
  let str = String(valor)
  // Neutraliza inyección de fórmulas en Excel / Google Sheets
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  return `"${str.replace(/"/g, '""')}"`
}