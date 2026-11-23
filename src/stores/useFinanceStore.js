import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase'

const MONEDAS_SOPORTADAS = ['USD', 'USDT', 'ARS', 'EUR']

const SIMBOLOS_MONEDA = {
  USD: 'US$',
  USDT: 'USDT ',
  ARS: '$',
  EUR: '€'
}

const NOMBRES_ACTIVOS = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  BNB: 'BNB',
  ADA: 'Cardano',
  XRP: 'XRP'
}

export const useFinanceStore = defineStore('finance', () => {
  const cuentas = ref([])
  const categorias = ref([])
  const transacciones = ref([])
  const monedaSeleccionada = ref(localStorage.getItem('moneda_activa') || 'USD')
  const loading = ref(false)
  const error = ref(null)
  let consultaId = 0

  const preciosCripto = ref({
    BTC: { USD: 0, USDT: 0, ARS: 0, EUR: 0 },
    ETH: { USD: 0, USDT: 0, ARS: 0, EUR: 0 },
    SOL: { USD: 0, USDT: 0, ARS: 0, EUR: 0 },
    BNB: { USD: 0, USDT: 0, ARS: 0, EUR: 0 },
    ADA: { USD: 0, USDT: 0, ARS: 0, EUR: 0 },
    XRP: { USD: 0, USDT: 0, ARS: 0, EUR: 0 }
  })
  const cargandoPrecios = ref(false)
  const errorPrecios = ref(false)
  const cotizacionEstimada = ref(false)
  const ultimaActualizacionPrecios = ref(null)

  const estadisticasSistema = ref({
    totalUsuarios: 0,
    totalCuentasSistema: 0,
    totalTransaccionesSistema: 0,
    topCategorias: [],
    porMoneda: [],
    errorAdminStats: false
  })

  watch(monedaSeleccionada, (nueva) => {
    localStorage.setItem('moneda_activa', nueva)
  })

  function simboloMoneda(moneda = monedaSeleccionada.value) {
    const code = (moneda || 'USD').toUpperCase()
    return SIMBOLOS_MONEDA[code] || `${code} `
  }

  const cuentasMonedaActiva = computed(() =>
    cuentas.value.filter(
      (c) => (c.moneda || 'USD').toUpperCase() === monedaSeleccionada.value
    )
  )

  const transaccionesMonedaActiva = computed(() => {
    const idsCuentasActivas = new Set(cuentasMonedaActiva.value.map((c) => c.id))
    return transacciones.value.filter((t) => idsCuentasActivas.has(t.cuenta_id))
  })

  // Saldo contable de la cuenta (saldo inicial + ingresos - gastos)
  function saldoActualCuenta(cuenta) {
    if (!cuenta) return 0
    const movs = transacciones.value.filter((t) => t.cuenta_id === cuenta.id)
    const ingresos = movs
      .filter((t) => t.tipo === 'ingreso')
      .reduce((acc, t) => acc + Number(t.monto || 0), 0)
    const gastos = movs
      .filter((t) => t.tipo === 'gasto')
      .reduce((acc, t) => acc + Number(t.monto || 0), 0)
    return Number(cuenta.saldo_inicial || 0) + ingresos - gastos
  }

  // Capital asignado a inversiones en una cuenta específica
  function invertidoCuenta(cuentaId) {
    return transacciones.value
      .filter((t) => t.cuenta_id === cuentaId && t.tipo === 'inversion')
      .reduce((acc, t) => acc + Number(t.monto || 0), 0)
  }

  // Efectivo líquido disponible en la cuenta (descuenta gastos e inversiones)
  function efectivoDisponibleCuenta(cuenta) {
    if (!cuenta) return 0
    return saldoActualCuenta(cuenta) - invertidoCuenta(cuenta.id)
  }

  // Patrimonio al costo en la moneda activa
  const patrimonioTotal = computed(() =>
    cuentasMonedaActiva.value.reduce((acc, c) => acc + saldoActualCuenta(c), 0)
  )

  const totalIngresos = computed(() =>
    transaccionesMonedaActiva.value
      .filter((t) => t.tipo === 'ingreso')
      .reduce((acc, t) => acc + Number(t.monto || 0), 0)
  )

  const totalGastos = computed(() =>
    transaccionesMonedaActiva.value
      .filter((t) => t.tipo === 'gasto')
      .reduce((acc, t) => acc + Number(t.monto || 0), 0)
  )

  const totalInvertido = computed(() =>
    transaccionesMonedaActiva.value
      .filter((t) => t.tipo === 'inversion')
      .reduce((acc, t) => acc + Number(t.monto || 0), 0)
  )
function extraerActivoDeTx(tx) {
    if (!tx || tx.tipo !== 'inversion') return null

    if (tx.activo_simbolo && Number(tx.activo_cantidad) > 0) {
      return {
        simbolo: tx.activo_simbolo.toUpperCase().trim(),
        cantidad: Number(tx.activo_cantidad)
      }
    }

    const desc = (tx.descripcion || '').trim()
    const matchCantidadAntes = desc.match(
      /(?:^|\b)compra\s+(\d+(?:[.,]\d+)?)\s*(BTC|ETH|SOL|BNB|ADA|XRP)\b/i
    )
    if (matchCantidadAntes) {
      const cantidad = Number(matchCantidadAntes[1].replace(',', '.'))
      if (cantidad > 0) {
        return {
          simbolo: matchCantidadAntes[2].toUpperCase(),
          cantidad
        }
      }
    }

    return null
  }

  const carteraActivos = computed(() => {
    const moneda = monedaSeleccionada.value
    const mapa = {}

for (const tx of transaccionesMonedaActiva.value) {
      const activo = extraerActivoDeTx(tx)
      if (!activo) continue
      const sym = activo.simbolo
      if (!mapa[sym]) {
        mapa[sym] = {
          simbolo: sym,
          nombre: NOMBRES_ACTIVOS[sym] || sym,
          cantidadTotal: 0,
          totalInvertido: 0,
          operaciones: 0
        }
      }
      mapa[sym].cantidadTotal += activo.cantidad
      mapa[sym].totalInvertido += Number(tx.monto || 0)
      mapa[sym].operaciones += 1
    }

    return Object.values(mapa)
      .filter((item) => item.cantidadTotal > 0)
      .map((item) => {
        const precioPromedio = item.totalInvertido / item.cantidadTotal
        const precioActual = Number(preciosCripto.value[item.simbolo]?.[moneda] || 0)
        const valorActual = precioActual > 0 ? item.cantidadTotal * precioActual : item.totalInvertido
        const gananciaPerdida = precioActual > 0 ? valorActual - item.totalInvertido : 0
        const rendimientoPorcentaje =
          precioActual > 0 && item.totalInvertido > 0
            ? (gananciaPerdida / item.totalInvertido) * 100
            : 0

        return {
          ...item,
          precioPromedio,
          precioActual,
          valorActual,
          gananciaPerdida,
          rendimientoPorcentaje
        }
      })
      .sort((a, b) => b.valorActual - a.valorActual)
  })

  // Patrimonio valuado a mercado (patrimonio al costo + ganancia/pérdida no realizada de activos)
  const patrimonioMercado = computed(() => {
    const deltaNoRealizado = carteraActivos.value.reduce(
      (acc, a) => acc + (a.precioActual > 0 ? a.gananciaPerdida : 0),
      0
    )
    return patrimonioTotal.value + deltaNoRealizado
  })

  const posicionesSinCotizacion = computed(() =>
    carteraActivos.value.filter((a) => !a.precioActual || a.precioActual <= 0).length
  )

  
  const resumenPorMoneda = computed(() => {
    return MONEDAS_SOPORTADAS.map((moneda) => {
      const ctas = cuentas.value.filter(
        (c) => (c.moneda || 'USD').toUpperCase() === moneda
      )
      const ids = new Set(ctas.map((c) => c.id))
      const movs = transacciones.value.filter((t) => ids.has(t.cuenta_id))

      const patrimonio = ctas.reduce((acc, c) => acc + saldoActualCuenta(c), 0)
      const ingresos = movs
        .filter((t) => t.tipo === 'ingreso')
        .reduce((acc, t) => acc + Number(t.monto || 0), 0)
      const gastos = movs
        .filter((t) => t.tipo === 'gasto')
        .reduce((acc, t) => acc + Number(t.monto || 0), 0)
      const invertido = movs
        .filter((t) => t.tipo === 'inversion')
        .reduce((acc, t) => acc + Number(t.monto || 0), 0)

      const porcentajeInvertido =
        patrimonio > 0
          ? Math.min(100, Math.max(0, Math.round((invertido / patrimonio) * 100)))
          : 0

      return {
        moneda,
        simbolo: simboloMoneda(moneda),
        cuentasCount: ctas.length,
        movimientosCount: movs.length,
        patrimonio,
        ingresos,
        gastos,
        invertido,
        porcentajeInvertido
      }
    }).filter((item) => item.cuentasCount > 0 || item.movimientosCount > 0)
  })

  function limpiarDatos() {
    consultaId += 1
    cuentas.value = []
    categorias.value = []
    transacciones.value = []
    estadisticasSistema.value = {
      totalUsuarios: 0,
      totalCuentasSistema: 0,
      totalTransaccionesSistema: 0,
      topCategorias: [],
      porMoneda: [],
      errorAdminStats: false
    }
    error.value = null
    loading.value = false
  }

  async function cargarTransaccionesPaginadas(userId, idActual) {
    const TAMANO_PAGINA = 1000
    let desde = 0
    const acumuladas = []

    while (true) {
      const { data, error: txError } = await supabase
        .from('transacciones')
        .select('*, cuentas(nombre, moneda), categorias(nombre, tipo)')
        .eq('user_id', userId)
        .order('fecha', { ascending: false })
        .order('id', { ascending: true })
        .range(desde, desde + TAMANO_PAGINA - 1)

      if (idActual !== consultaId) return null
      if (txError) throw txError

      const lote = data || []
      acumuladas.push(...lote)
      if (lote.length < TAMANO_PAGINA) break
      desde += TAMANO_PAGINA
    }

    return acumuladas
  }

  async function cargarTodo() {
    const idActual = ++consultaId
    loading.value = true
    error.value = null
    try {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData?.user?.id
      if (!userId || idActual !== consultaId) return

      const [resCuentas, resCategorias, todasTransacciones] = await Promise.all([
        supabase
          .from('cuentas')
          .select('*')
          .eq('user_id', userId)
          .order('nombre', { ascending: true }),
        supabase.from('categorias').select('*').order('nombre', { ascending: true }),
        cargarTransaccionesPaginadas(userId, idActual)
      ])

      if (idActual !== consultaId) return

      if (resCuentas.error) throw resCuentas.error
      if (resCategorias.error) throw resCategorias.error

      cuentas.value = resCuentas.data || []
      categorias.value = resCategorias.data || []
      transacciones.value = todasTransacciones || []

      if (
        cuentas.value.length > 0 &&
        !cuentas.value.some((c) => (c.moneda || 'USD').toUpperCase() === monedaSeleccionada.value)
      ) {
        monedaSeleccionada.value = (cuentas.value[0].moneda || 'USD').toUpperCase()
      }
    } catch (err) {
      if (idActual === consultaId) {
        error.value = err.message
        console.error('Error al cargar datos financieros:', err)
      }
    } finally {
      if (idActual === consultaId) {
        loading.value = false
      }
    }
  }

  async function cargarPreciosCripto() {
    cargandoPrecios.value = true
    errorPrecios.value = false

    // 1. Cotización USD -> ARS y EUR desde DolarApi (aislada)
    let tasaArs = 1150
    let tasaEur = 0.92
    cotizacionEstimada.value = true
    try {
      const resCambio = await fetch('https://dolarapi.com/v1/cotizaciones')
      if (resCambio.ok) {
        const cotiz = await resCambio.json()
        const usdObj =
          cotiz.find((c) => c.moneda === 'USD' && c.casa === 'oficial') ||
          cotiz.find((c) => c.moneda === 'USD')
        const eurObj = cotiz.find((c) => c.moneda === 'EUR')
        if (usdObj?.venta) {
          tasaArs = Number(usdObj.venta)
          cotizacionEstimada.value = false
          if (eurObj?.venta) {
            tasaEur = Number(usdObj.venta) / Number(eurObj.venta)
          }
        }
      }
    } catch {
      cotizacionEstimada.value = true
    }

    const simbolos = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'XRP']
    const preciosUsd = {}

    // 2. Proveedor primario: Binance API (aislado para que un fallo no aborte CryptoCompare)
    try {
      const pares = JSON.stringify(simbolos.map((s) => `${s}USDT`))
      const resBinance = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(pares)}`
      )
      if (resBinance.ok) {
        const lista = await resBinance.json()
        for (const item of lista) {
          const sym = item.symbol.replace('USDT', '')
          preciosUsd[sym] = Number(item.price)
        }
      }
    } catch {
      // Continúa al proveedor secundario
    }

    // 3. Proveedor secundario: CryptoCompare (si falta algún símbolo o falló Binance)
    if (simbolos.some((s) => !preciosUsd[s])) {
      try {
        const resCC = await fetch(
          `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${simbolos.join(',')}&tsyms=USD`
        )
        if (resCC.ok) {
          const dataCC = await resCC.json()
          for (const sym of simbolos) {
            if (!preciosUsd[sym] && dataCC[sym]?.USD) {
              preciosUsd[sym] = Number(dataCC[sym].USD)
            }
          }
        }
      } catch {
        // Sin conexión a proveedores cripto
      }
    }

    let alMenosUno = false
    for (const sym of simbolos) {
      const usd = preciosUsd[sym] || 0
      if (usd > 0) {
        alMenosUno = true
        preciosCripto.value[sym] = {
          USD: usd,
          USDT: usd,
          ARS: usd * tasaArs,
          EUR: usd * tasaEur
        }
      }
    }

    if (alMenosUno) {
      ultimaActualizacionPrecios.value = new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    } else {
      errorPrecios.value = true
    }

    cargandoPrecios.value = false
  }

  async function cargarEstadisticasAdmin() {
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_stats')
      if (rpcError || !data) {
        estadisticasSistema.value = {
          totalUsuarios: 0,
          totalCuentasSistema: 0,
          totalTransaccionesSistema: 0,
          topCategorias: [],
          porMoneda: [],
          errorAdminStats: true
        }
        return
      }

      estadisticasSistema.value = {
        totalUsuarios: data.total_usuarios || 0,
        totalCuentasSistema: data.total_cuentas || 0,
        totalTransaccionesSistema: data.total_transacciones || 0,
        topCategorias: data.top_categorias || [],
        porMoneda: data.por_moneda || [],
        errorAdminStats: false
      }
    } catch {
      estadisticasSistema.value = {
        totalUsuarios: 0,
        totalCuentasSistema: 0,
        totalTransaccionesSistema: 0,
        topCategorias: [],
        porMoneda: [],
        errorAdminStats: true
      }
    }
  }

  async function agregarCuenta(cuenta) {
    const { data: authData } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('cuentas').insert([
      {
        ...cuenta,
        moneda: (cuenta.moneda || 'USD').toUpperCase(),
        user_id: authData.user.id
      }
    ])
    if (err) throw err
    await cargarTodo()
  }

  async function editarCuenta(id, cuenta) {
    const { error: err } = await supabase
      .from('cuentas')
      .update({
        ...cuenta,
        moneda: (cuenta.moneda || 'USD').toUpperCase()
      })
      .eq('id', id)
    if (err) throw err
    await cargarTodo()
  }

  async function eliminarCuenta(id) {
    const { error: err } = await supabase.from('cuentas').delete().eq('id', id)
    if (err) throw err
    await cargarTodo()
  }

  async function agregarTransaccion(tx) {
    const { data: authData } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('transacciones').insert([
      {
        ...tx,
        user_id: authData.user.id
      }
    ])
    if (err) throw err
    await cargarTodo()
  }

  async function editarTransaccion(id, tx) {
    const { error: err } = await supabase
      .from('transacciones')
      .update(tx)
      .eq('id', id)
    if (err) throw err
    await cargarTodo()
  }

  async function eliminarTransaccion(id) {
    const { error: err } = await supabase.from('transacciones').delete().eq('id', id)
    if (err) throw err
    await cargarTodo()
  }

  async function agregarCategoria(cat) {
    const { error: err } = await supabase.from('categorias').insert([cat])
    if (err) throw err
    await cargarTodo()
  }

  async function editarCategoria(id, cat) {
    const { error: err } = await supabase
      .from('categorias')
      .update(cat)
      .eq('id', id)
    if (err) throw err
    await cargarTodo()
  }

  async function eliminarCategoria(id) {
    const { error: err } = await supabase.from('categorias').delete().eq('id', id)
    if (err) throw err
    await cargarTodo()
  }

  return {
    cuentas,
    categorias,
    transacciones,
    monedaSeleccionada,
    MONEDAS_SOPORTADAS,
    loading,
    error,
    preciosCripto,
    cargandoPrecios,
    errorPrecios,
    cotizacionEstimada,
    ultimaActualizacionPrecios,
    estadisticasSistema,
    simboloMoneda,
    cuentasMonedaActiva,
    transaccionesMonedaActiva,
    saldoActualCuenta,
    invertidoCuenta,
    efectivoDisponibleCuenta,
    patrimonioTotal,
    patrimonioMercado,
    posicionesSinCotizacion,
    extraerActivoDeTx,
    totalIngresos,
    totalGastos,
    totalInvertido,
    carteraActivos,
    resumenPorMoneda,
    cargarTodo,
    limpiarDatos,
    cargarPreciosCripto,
    cargarEstadisticasAdmin,
    agregarCuenta,
    editarCuenta,
    eliminarCuenta,
    agregarTransaccion,
    editarTransaccion,
    eliminarTransaccion,
    agregarCategoria,
    editarCategoria,
    eliminarCategoria
  }
})