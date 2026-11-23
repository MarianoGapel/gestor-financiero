<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFinanceStore } from '@/stores/useFinanceStore'
import { hoyLocal, formatearFecha, escaparCeldaCSV } from '@/composables/useFormatters'
import { sugerirClasificacion } from '@/composables/useSmartCategorizer'

const route = useRoute()
const router = useRouter()
const financeStore = useFinanceStore()

const editandoId = ref(null)
const editandoTieneActivo = ref(false)
const txOriginalEditando = ref(null)
const cuentaSeleccionadaManualmente = ref(false)
const formularioTocado = ref(false)
const seleccionadosIds = ref([])
const seleccionManual = ref(false)
const guardando = ref(false)
const exitoMsg = ref(false)
const busqueda = ref('')
const filtroTipo = ref('ALL')
const filtroCuenta = ref(typeof route.query.cuenta === 'string' ? route.query.cuenta : '')
const sugerenciaAplicada = ref('')
const sugerenciaPendiente = ref(null)

const form = ref({
  cuenta_id: '',
  categoria_id: '',
  tipo: 'inversion',
  monto: '',
  descripcion: '',
  fecha: hoyLocal(),
  activo_simbolo: 'BTC',
  activo_cantidad: ''
})

const monedaActiva = computed(() => financeStore.monedaSeleccionada || 'USD')
const simbolo = computed(() => financeStore.simboloMoneda(monedaActiva.value))

const cuentaFiltradaObj = computed(() =>
  financeStore.cuentas.find((c) => c.id === filtroCuenta.value) || null
)

watch(
  () => route.query.cuenta,
  (nuevaCuenta) => {
    const idCuenta = typeof nuevaCuenta === 'string' ? nuevaCuenta : ''
    filtroCuenta.value = idCuenta
    if (
      idCuenta &&
      !editandoId.value &&
      !formularioTocado.value &&
      !cuentaSeleccionadaManualmente.value
    ) {
      form.value.cuenta_id = idCuenta
    }
  },
  { immediate: true }
)

function onCambiarFiltroCuenta() {
  const nuevaQuery = { ...route.query }
  if (filtroCuenta.value) {
    nuevaQuery.cuenta = filtroCuenta.value
  } else {
    delete nuevaQuery.cuenta
  }
  router.replace({ query: nuevaQuery })
}

function limpiarFiltroCuenta() {
  filtroCuenta.value = ''
  onCambiarFiltroCuenta()
}

watch(
  () => financeStore.monedaSeleccionada,
  (nuevaMoneda) => {
    seleccionadosIds.value = []
    if (!filtroCuenta.value) return
    const cta = financeStore.cuentas.find((c) => c.id === filtroCuenta.value)
    if (cta && (cta.moneda || 'USD').toUpperCase() !== nuevaMoneda) {
      limpiarFiltroCuenta()
    }
  }
)

const cuentaSeleccionadaObj = computed(() =>
  financeStore.cuentas.find((c) => c.id === form.value.cuenta_id) || null
)

const monedaCuentaFormulario = computed(() =>
  (cuentaSeleccionadaObj.value?.moneda || monedaActiva.value).toUpperCase()
)

// Efectivo líquido disponible en la cuenta (descuenta gastos e inversiones)
const efectivoDisponibleSeleccionado = computed(() => {
  if (!cuentaSeleccionadaObj.value) return 0
  return financeStore.efectivoDisponibleCuenta(cuentaSeleccionadaObj.value)
})

// Saldo disponible proyectado considerando el reemplazo del asiento cuando se edita
const efectivoBaseParaOperacion = computed(() => {
  if (!cuentaSeleccionadaObj.value) return 0
  let base = efectivoDisponibleSeleccionado.value

  if (
    editandoId.value &&
    txOriginalEditando.value &&
    txOriginalEditando.value.cuenta_id === form.value.cuenta_id
  ) {
    const orig = txOriginalEditando.value
    if (orig.tipo === 'gasto' || orig.tipo === 'inversion') {
      base += Number(orig.monto || 0)
    } else if (orig.tipo === 'ingreso') {
      base -= Number(orig.monto || 0)
    }
  }
  return base
})

const excesoSobreDisponible = computed(() => {
  if (form.value.tipo === 'ingreso') return 0
  const monto = Number(form.value.monto || 0)
  return monto > efectivoBaseParaOperacion.value ? monto - efectivoBaseParaOperacion.value : 0
})

const categoriasPorTipo = computed(() => {
  return financeStore.categorias.filter(
    (cat) => (cat.tipo || '').toLowerCase() === form.value.tipo
  )
})

const categoriaSeleccionadaObj = computed(() =>
  financeStore.categorias.find((c) => c.id === form.value.categoria_id)
)

// Reconoce categorías con activo por flag estable o por datos históricos existentes
const esCompraActivoCripto = computed(() => {
  if (form.value.tipo !== 'inversion') return false
  if (editandoTieneActivo.value) return true
  if (categoriaSeleccionadaObj.value?.requiere_activo) return true
  const nombre = (categoriaSeleccionadaObj.value?.nombre || '').toLowerCase()
  return nombre.includes('cripto') || nombre.includes('activo')
})

const precioUnitarioCompra = computed(() => {
  const monto = Number(form.value.monto)
  const cant = Number(form.value.activo_cantidad)
  if (monto > 0 && cant > 0) return monto / cant
  return 0
})

function marcarSeleccionManual() {
  seleccionManual.value = true
  formularioTocado.value = true
  sugerenciaAplicada.value = ''
}

function aplicarSugerenciaPendiente() {
  if (!sugerenciaPendiente.value) return
  form.value.tipo = sugerenciaPendiente.value.tipo
  form.value.categoria_id = sugerenciaPendiente.value.categoriaId
  sugerenciaAplicada.value = `${sugerenciaPendiente.value.tipo.toUpperCase()} → ${sugerenciaPendiente.value.categoriaNombre}`
  sugerenciaPendiente.value = null
  seleccionManual.value = false
}

watch(
  () => form.value.descripcion,
  (nuevaDesc) => {
    if (editandoId.value) return
    const sug = sugerirClasificacion(nuevaDesc, financeStore.categorias)
    if (sug && sug.categoriaId) {
      if (seleccionManual.value) {
        sugerenciaPendiente.value = sug
      } else {
        form.value.tipo = sug.tipo
        form.value.categoria_id = sug.categoriaId
        sugerenciaAplicada.value = `${sug.tipo.toUpperCase()} → ${sug.categoriaNombre}`
        sugerenciaPendiente.value = null
      }
    } else {
      sugerenciaAplicada.value = ''
      sugerenciaPendiente.value = null
    }
  }
)

watch(
  categoriasPorTipo,
  (lista) => {
    if (!lista.length) {
      form.value.categoria_id = ''
      return
    }
    const sigueValida = lista.some((c) => c.id === form.value.categoria_id)
    if (!sigueValida) {
      form.value.categoria_id = lista[0].id
    }
  },
  { immediate: true }
)

watch(
  [() => financeStore.monedaSeleccionada, () => financeStore.cuentasMonedaActiva],
  ([_nuevaMoneda, listaCuentas]) => {
    if (editandoId.value || formularioTocado.value || cuentaSeleccionadaManualmente.value) return
    if (filtroCuenta.value) {
      form.value.cuenta_id = filtroCuenta.value
      return
    }
    const cuentaActual = financeStore.cuentas.find((c) => c.id === form.value.cuenta_id)
    const coincideDivisa =
      cuentaActual &&
      (cuentaActual.moneda || 'USD').toUpperCase() === financeStore.monedaSeleccionada

    if (!coincideDivisa) {
      form.value.cuenta_id = listaCuentas[0]?.id || ''
    }
  },
  { immediate: true }
)

const transaccionesFiltradas = computed(() => {
  return financeStore.transaccionesMonedaActiva.filter((tx) => {
    const coincideCuenta = !filtroCuenta.value || tx.cuenta_id === filtroCuenta.value
    const coincideTipo = filtroTipo.value === 'ALL' || tx.tipo === filtroTipo.value
    const q = busqueda.value.toLowerCase().trim()
    const coincideTexto =
      !q ||
      (tx.descripcion && tx.descripcion.toLowerCase().includes(q)) ||
      (tx.activo_simbolo && tx.activo_simbolo.toLowerCase().includes(q)) ||
      (tx.cuentas?.nombre && tx.cuentas.nombre.toLowerCase().includes(q)) ||
      (tx.categorias?.nombre && tx.categorias.nombre.toLowerCase().includes(q))
    return coincideCuenta && coincideTipo && coincideTexto
  })
})

const transaccionesSeleccionadas = computed(() =>
  transaccionesFiltradas.value.filter((tx) => seleccionadosIds.value.includes(tx.id))
)

const todasVisiblesSeleccionadas = computed(
  () =>
    transaccionesFiltradas.value.length > 0 &&
    transaccionesFiltradas.value.every((tx) => seleccionadosIds.value.includes(tx.id))
)

function toggleSeleccionTodas() {
  if (todasVisiblesSeleccionadas.value) {
    const idsVisibles = new Set(transaccionesFiltradas.value.map((t) => t.id))
    seleccionadosIds.value = seleccionadosIds.value.filter((id) => !idsVisibles.has(id))
  } else {
    const combinados = new Set([
      ...seleccionadosIds.value,
      ...transaccionesFiltradas.value.map((t) => t.id)
    ])
    seleccionadosIds.value = [...combinados]
  }
}

const porcentajeInvertido = computed(() => {
  if (financeStore.patrimonioTotal <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((financeStore.totalInvertido / financeStore.patrimonioTotal) * 100)))
})

const liquidezDisponible = computed(() => {
  return financeStore.patrimonioTotal - financeStore.totalInvertido
})

function resetForm() {
  editandoId.value = null
  editandoTieneActivo.value = false
  txOriginalEditando.value = null
  cuentaSeleccionadaManualmente.value = false
  formularioTocado.value = false
  seleccionManual.value = false
  sugerenciaAplicada.value = ''
  sugerenciaPendiente.value = null
  const cuentaPorDefecto =
    filtroCuenta.value || financeStore.cuentasMonedaActiva[0]?.id || financeStore.cuentas[0]?.id || ''
  const primeraCat = categoriasPorTipo.value[0]?.id || ''
  form.value = {
    cuenta_id: cuentaPorDefecto,
    categoria_id: primeraCat,
    tipo: form.value.tipo,
    monto: '',
    descripcion: '',
    fecha: hoyLocal(),
    activo_simbolo: 'BTC',
    activo_cantidad: ''
  }
}

function seleccionarEditar(tx) {
  const activoDetectado = financeStore.extraerActivoDeTx(tx)

  editandoId.value = tx.id
  txOriginalEditando.value = { ...tx }
  editandoTieneActivo.value = Boolean(activoDetectado)
  cuentaSeleccionadaManualmente.value = true
  formularioTocado.value = true
  seleccionManual.value = true
  sugerenciaAplicada.value = ''
  sugerenciaPendiente.value = null
  form.value = {
    cuenta_id: tx.cuenta_id,
    categoria_id: tx.categoria_id || '',
    tipo: tx.tipo,
    monto: tx.monto,
    descripcion: tx.descripcion || '',
    fecha: tx.fecha,
    activo_simbolo: activoDetectado?.simbolo || 'BTC',
    activo_cantidad: activoDetectado?.cantidad || ''
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function duplicarParaHoy(tx) {
  const activoDetectado = financeStore.extraerActivoDeTx(tx)

  editandoId.value = null
  txOriginalEditando.value = null
  editandoTieneActivo.value = Boolean(activoDetectado)
  cuentaSeleccionadaManualmente.value = true
  formularioTocado.value = true
  seleccionManual.value = true
  sugerenciaAplicada.value = 'Movimiento duplicado con fecha de hoy'
  sugerenciaPendiente.value = null
  form.value = {
    cuenta_id: tx.cuenta_id,
    categoria_id: tx.categoria_id || '',
    tipo: tx.tipo,
    monto: tx.monto,
    descripcion: tx.descripcion || '',
    fecha: hoyLocal(),
    activo_simbolo: activoDetectado?.simbolo || 'BTC',
    activo_cantidad: activoDetectado?.cantidad || ''
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function guardarMovimiento() {
  if (!form.value.cuenta_id) {
    alert('Primero debés seleccionar o crear una Cuenta en la pestaña Cuentas.')
    return
  }
  if (esCompraActivoCripto.value && (!form.value.activo_cantidad || Number(form.value.activo_cantidad) <= 0)) {
    alert('Ingresá la cantidad del activo/cripto adquirido (ej: 0.5).')
    return
  }

  guardando.value = true
  try {
    const cuentaElegida = financeStore.cuentas.find((c) => c.id === form.value.cuenta_id)
    const simboloActivo = esCompraActivoCripto.value
      ? (form.value.activo_simbolo || 'BTC').toUpperCase().trim()
      : null
    const cantidadActivo = esCompraActivoCripto.value
      ? Number(form.value.activo_cantidad)
      : null

    const descripcionFinal =
      form.value.descripcion.trim() ||
      (esCompraActivoCripto.value ? `Compra ${cantidadActivo} ${simboloActivo}` : '')

    const payload = {
      cuenta_id: form.value.cuenta_id,
      categoria_id: form.value.categoria_id || null,
      tipo: form.value.tipo,
      monto: Number(form.value.monto),
      descripcion: descripcionFinal,
      fecha: form.value.fecha,
      activo_simbolo: simboloActivo,
      activo_cantidad: cantidadActivo
    }

    if (editandoId.value) {
      await financeStore.editarTransaccion(editandoId.value, payload)
    } else {
      await financeStore.agregarTransaccion(payload)
    }

    if (cuentaElegida?.moneda) {
      financeStore.monedaSeleccionada = cuentaElegida.moneda.toUpperCase()
    }
    resetForm()
    exitoMsg.value = true
    setTimeout(() => (exitoMsg.value = false), 2000)
  } catch (err) {
    alert('Error al registrar movimiento: ' + err.message)
  } finally {
    guardando.value = false
  }
}

function generarCSV(lista, nombreArchivo, formatoExcelEs = false) {
  const sep = formatoExcelEs ? ';' : ','
  const encabezados = ['Fecha', 'Moneda', 'Cuenta', 'Categoria', 'Activo', 'Cantidad', 'Descripcion', 'Tipo', 'Monto']
  const filas = lista.map((tx) => {
    const montoFormateado = formatoExcelEs
      ? Number(tx.monto || 0).toFixed(2).replace('.', ',')
      : tx.monto
    const cantFormateada =
      formatoExcelEs && tx.activo_cantidad != null
        ? String(tx.activo_cantidad).replace('.', ',')
        : tx.activo_cantidad || ''

    return [
      escaparCeldaCSV(tx.fecha),
      escaparCeldaCSV(monedaActiva.value),
      escaparCeldaCSV(tx.cuentas?.nombre || ''),
      escaparCeldaCSV(tx.categorias?.nombre || ''),
      escaparCeldaCSV(tx.activo_simbolo || ''),
      cantFormateada,
      escaparCeldaCSV(tx.descripcion || ''),
      escaparCeldaCSV(tx.tipo.toUpperCase()),
      montoFormateado
    ]
  })
  const csv = [encabezados.join(sep), ...filas.map((f) => f.join(sep))].join('\n')
  const prefijo = formatoExcelEs ? '\uFEFF' : ''
  const blob = new Blob([prefijo + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', nombreArchivo)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function exportarCSV() {
  generarCSV(
    transaccionesFiltradas.value,
    `libro_mayor_${monedaActiva.value}_${hoyLocal()}.csv`,
    false
  )
}

function exportarSeleccionCSV() {
  if (!transaccionesSeleccionadas.value.length) return
  generarCSV(
    transaccionesSeleccionadas.value,
    `seleccion_${monedaActiva.value}_${hoyLocal()}.csv`,
    true
  )
}

function imprimirLibro() {
  window.print()
}
</script>

<template>
  <div class="flex flex-col w-full">
    <div class="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-8 lg:py-12 overflow-hidden">
      <div class="absolute -top-24 right-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div class="absolute top-1/2 -left-20 w-80 h-80 bg-tertiary-container/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

      <!-- Header -->
      <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div class="flex flex-col max-w-2xl">
          <div class="flex items-center gap-2 mb-3">
            <span class="inline-block w-2 h-2 rounded-full bg-primary"></span>
            <span class="text-[11px] font-label font-bold tracking-[0.22em] uppercase text-primary">
              Contabilidad • Gestión de Flujos
            </span>
            <span class="text-outline-variant text-xs mx-1">/</span>
            <span class="text-[11px] font-label tracking-widest uppercase text-on-surface-variant/70">
              Cartera {{ monedaActiva }}
            </span>
          </div>
          <h1 class="font-headline text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-on-surface leading-[1.15]">
            Libro Mayor — <span class="italic font-light text-primary">Gastos e Inversiones</span>
          </h1>
          <p class="mt-3 text-sm lg:text-base text-on-surface-variant font-light leading-relaxed">
            Registro centralizado de aportes, egresos patrimoniales y rendimiento de cartera filtrado por divisa activa.
          </p>
        </div>
      </div>

      <!-- Summary Metrics Bar -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <div class="relative overflow-hidden rounded-xl bg-surface-container-lowest p-6 shadow-[0_2px_16px_rgba(58,48,42,0.04)] flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-label font-bold tracking-[0.18em] uppercase text-on-surface-variant">
              Entradas Totales ({{ monedaActiva }})
            </span>
            <div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
              <span class="material-symbols-outlined text-lg">arrow_downward_alt</span>
            </div>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="font-headline text-3xl font-normal text-on-surface tracking-tight">
              +{{ simbolo }}{{ financeStore.totalIngresos.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
            </span>
          </div>
          <div class="mt-3 flex items-center justify-between text-[11px] text-on-surface-variant/70">
            <span>Aportes netos y rendimientos</span>
            <span class="font-mono">
              {{ financeStore.transaccionesMonedaActiva.filter((t) => t.tipo === 'ingreso').length }} ops
            </span>
          </div>
          <div class="absolute bottom-0 left-0 w-full h-[2px] bg-primary/25"></div>
        </div>

        <div class="relative overflow-hidden rounded-xl bg-surface-container-lowest p-6 shadow-[0_2px_16px_rgba(58,48,42,0.04)] flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-label font-bold tracking-[0.18em] uppercase text-on-surface-variant">
              Gastos Acumulados ({{ monedaActiva }})
            </span>
            <div class="w-8 h-8 rounded-lg bg-error-container/60 flex items-center justify-center text-tertiary">
              <span class="material-symbols-outlined text-lg">arrow_upward_alt</span>
            </div>
          </div>
          <div class="mt-4 flex items-baseline gap-2">
            <span class="font-headline text-3xl font-normal text-tertiary tracking-tight">
              -{{ simbolo }}{{ financeStore.totalGastos.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
            </span>
          </div>
          <div class="mt-3 flex items-center justify-between text-[11px] text-on-surface-variant/70">
            <span>Egresos operativos registrados</span>
            <span class="font-mono text-tertiary">
              {{ financeStore.transaccionesMonedaActiva.filter((t) => t.tipo === 'gasto').length }} ops
            </span>
          </div>
          <div class="absolute bottom-0 left-0 w-full h-[2px] bg-tertiary/30"></div>
        </div>

        <div class="relative overflow-hidden rounded-xl bg-primary text-on-primary p-6 shadow-[0_4px_24px_rgba(194,101,42,0.22)] flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-label font-bold tracking-[0.18em] uppercase text-primary-fixed">
              Inversión Activa ({{ monedaActiva }})
            </span>
            <div class="w-8 h-8 rounded-lg bg-surface-container-lowest/15 backdrop-blur-sm flex items-center justify-center text-on-primary">
              <span class="material-symbols-outlined text-lg">token</span>
            </div>
          </div>
          <div class="mt-4 flex items-baseline gap-2 flex-wrap">
            <span class="font-headline text-3xl font-normal text-on-primary tracking-tight">
              {{ simbolo }}{{ financeStore.totalInvertido.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
            </span>
            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-surface-container-lowest/20 text-on-primary tracking-wide">
              {{ porcentajeInvertido }}% asignado
            </span>
          </div>
          <div class="mt-3 flex items-center justify-between text-[11px] text-primary-fixed/85">
            <span>Criptoactivos, Renta Fija y Cartera</span>
            <span>{{ financeStore.transaccionesMonedaActiva.filter((t) => t.tipo === 'inversion').length }} ops</span>
          </div>
        </div>
      </div>

      <!-- Workspace Asimétrico -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <!-- Columna Izquierda: Formulario (4 Cols) -->
        <div class="lg:col-span-4 rounded-2xl bg-surface-container-lowest p-6 sm:p-7 shadow-[0_2px_20px_rgba(58,48,42,0.05)] relative">
          <div class="flex items-center justify-between mb-6 pb-3 border-b border-outline-variant/30">
            <div class="flex flex-col">
              <span class="text-[10px] font-label font-bold tracking-[0.2em] uppercase text-primary">
                {{ editandoId ? 'Edición' : 'Asiento Nuevo' }}
              </span>
              <h2 class="font-headline text-2xl font-normal text-on-surface">
                {{ editandoId ? 'Modificar Movimiento' : 'Registrar Movimiento' }}
              </h2>
            </div>
            <span class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
              <span class="material-symbols-outlined text-base">receipt_long</span>
            </span>
          </div>

          <form class="flex flex-col gap-4 text-xs" @submit.prevent="guardarMovimiento">
            <!-- Cuenta -->
            <div class="flex flex-col gap-1.5">
              <label class="font-semibold uppercase tracking-wider text-[10px] text-on-surface-variant" for="cuentaInput">
                Cuenta
              </label>
              <div class="relative">
                <select
                  id="cuentaInput"
                  v-model="form.cuenta_id"
                  @change="cuentaSeleccionadaManualmente = true; formularioTocado = true"
                  required
                  class="w-full h-11 px-3.5 pr-9 bg-surface-container-low rounded-lg text-on-surface text-xs font-medium focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all appearance-none cursor-pointer"
                >
                  <option disabled value="">Seleccionar cuenta...</option>
                  <option v-for="c in financeStore.cuentas" :key="c.id" :value="c.id">
                    {{ c.nombre }} ({{ c.moneda || 'USD' }})
                  </option>
                </select>
                <span class="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-on-surface-variant text-base">
                  expand_more
                </span>
              </div>

              <!-- Efectivo disponible real de la cuenta seleccionada -->
              <div
                v-if="cuentaSeleccionadaObj"
                class="px-3 py-2 rounded-lg bg-surface-container-low/80 border border-outline-variant/25 flex flex-col gap-1 text-[11px]"
              >
                <div class="flex items-center justify-between">
                  <span class="text-on-surface-variant flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[15px] text-primary">account_balance_wallet</span>
                    <span>Efectivo disponible:</span>
                  </span>
                  <span
                    class="font-mono font-bold"
                    :class="efectivoDisponibleSeleccionado < 0 ? 'text-tertiary' : 'text-primary'"
                  >
                    {{ financeStore.simboloMoneda(cuentaSeleccionadaObj.moneda) }}{{
                      efectivoDisponibleSeleccionado.toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })
                    }}
                    <span class="text-[10px] font-normal text-on-surface-variant">
                      {{ monedaCuentaFormulario }}
                    </span>
                  </span>
                </div>

                <span
                  v-if="excesoSobreDisponible > 0"
                  class="text-[10px] text-tertiary font-medium flex items-center gap-1"
                >
                  <span class="material-symbols-outlined text-[13px]">warning</span>
                  <span>
                    Supera el efectivo disponible por {{ financeStore.simboloMoneda(cuentaSeleccionadaObj.moneda) }}{{
                      excesoSobreDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2 })
                    }}.
                  </span>
                </span>
              </div>
            </div>

            <!-- Tipo de Operación -->
            <div class="flex flex-col gap-1.5">
              <label class="font-semibold uppercase tracking-wider text-[10px] text-on-surface-variant">
                Tipo de Operación
              </label>
              <div class="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-surface-container-low">
                <label class="cursor-pointer">
                  <input v-model="form.tipo" @change="marcarSeleccionManual" class="peer sr-only" name="tipoOp" type="radio" value="inversion" />
                  <div class="py-2 text-center rounded-md font-medium text-[11px] text-on-surface-variant peer-checked:bg-surface-container-lowest peer-checked:text-primary peer-checked:shadow-sm transition-all">
                    Inversión
                  </div>
                </label>
                <label class="cursor-pointer">
                  <input v-model="form.tipo" @change="marcarSeleccionManual" class="peer sr-only" name="tipoOp" type="radio" value="ingreso" />
                  <div class="py-2 text-center rounded-md font-medium text-[11px] text-on-surface-variant peer-checked:bg-surface-container-lowest peer-checked:text-on-surface peer-checked:shadow-sm transition-all">
                    Ingreso
                  </div>
                </label>
                <label class="cursor-pointer">
                  <input v-model="form.tipo" @change="marcarSeleccionManual" class="peer sr-only" name="tipoOp" type="radio" value="gasto" />
                  <div class="py-2 text-center rounded-md font-medium text-[11px] text-on-surface-variant peer-checked:bg-surface-container-lowest peer-checked:text-tertiary peer-checked:shadow-sm transition-all">
                    Gasto
                  </div>
                </label>
              </div>
            </div>

            <!-- Categoría Independiente según Tipo -->
            <div class="flex flex-col gap-1.5">
              <label class="font-semibold uppercase tracking-wider text-[10px] text-on-surface-variant" for="catInput">
                Categoría ({{ form.tipo === 'inversion' ? 'Inversiones' : form.tipo === 'ingreso' ? 'Ingresos' : 'Gastos' }})
              </label>
              <div class="relative">
                <select
                  id="catInput"
                  v-model="form.categoria_id"
                  @change="marcarSeleccionManual"
                  class="w-full h-11 px-3.5 pr-9 bg-surface-container-low rounded-lg text-on-surface text-xs font-medium focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all appearance-none cursor-pointer"
                >
                  <option v-for="cat in categoriasPorTipo" :key="cat.id" :value="cat.id">
                    {{ cat.nombre }}
                  </option>
                </select>
                <span class="material-symbols-outlined absolute right-3 top-3 pointer-events-none text-on-surface-variant text-base">
                  expand_more
                </span>
              </div>
            </div>

            <!-- Monto & Fecha -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <label class="font-semibold uppercase tracking-wider text-[10px] text-on-surface-variant" for="montoInput">
                  Monto ({{ monedaCuentaFormulario }})
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-3 font-semibold text-primary">$</span>
                  <input
                    id="montoInput"
                    v-model.number="form.monto"
                    @input="formularioTocado = true"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="70000.00"
                    class="w-full h-11 pl-7 pr-3 bg-surface-container-low rounded-lg text-on-surface text-xs font-semibold focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="font-semibold uppercase tracking-wider text-[10px] text-on-surface-variant" for="fechaInput">
                  Fecha
                </label>
                <input
                  id="fechaInput"
                  v-model="form.fecha"
                  @change="formularioTocado = true"
                  type="date"
                  required
                  class="w-full h-11 px-3 bg-surface-container-low rounded-lg text-on-surface text-xs font-medium focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>
            </div>

            <!-- Cuadro Especial: Compra de Activo / Cripto -->
            <div
              v-if="esCompraActivoCripto"
              class="p-4 rounded-xl bg-primary-fixed/45 border border-primary/20 space-y-3"
            >
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px]">currency_bitcoin</span>
                  Detalle de Compra Cripto / Activo
                </span>
              </div>

              <div class="grid grid-cols-2 gap-2.5">
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    Activo / Moneda
                  </label>
                  <div class="relative">
                    <select
                      v-model="form.activo_simbolo"
                      @change="formularioTocado = true"
                      class="w-full h-10 px-3 pr-7 bg-surface-container-lowest rounded-lg text-on-surface text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer"
                    >
                      <option value="BTC">Bitcoin (BTC)</option>
                      <option value="ETH">Ethereum (ETH)</option>
                      <option value="SOL">Solana (SOL)</option>
                      <option value="BNB">BNB (BNB)</option>
                      <option value="ADA">Cardano (ADA)</option>
                      <option value="XRP">XRP (XRP)</option>
                    </select>
                    <span class="material-symbols-outlined absolute right-2 top-2.5 pointer-events-none text-on-surface-variant text-sm">
                      expand_more
                    </span>
                  </div>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
                    Cantidad Comprada
                  </label>
                  <input
                    v-model.number="form.activo_cantidad"
                    @input="formularioTocado = true"
                    type="number"
                    step="any"
                    min="0.00000001"
                    required
                    placeholder="Ej: 0.5"
                    class="w-full h-10 px-3 bg-surface-container-lowest rounded-lg text-on-surface text-xs font-semibold font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div
                v-if="precioUnitarioCompra > 0"
                class="flex items-center justify-between text-[11px] pt-1 border-t border-primary/15 text-on-surface-variant"
              >
                <span>Precio unitario de compra:</span>
                <strong class="font-mono text-primary">
                  ${{ precioUnitarioCompra.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} / {{ form.activo_simbolo }}
                </strong>
              </div>
            </div>

            <!-- Descripción -->
            <div class="flex flex-col gap-1.5">
              <label class="font-semibold uppercase tracking-wider text-[10px] text-on-surface-variant" for="descInput">
                Descripción Breve
              </label>
              <input
                id="descInput"
                v-model="form.descripcion"
                @input="formularioTocado = true"
                type="text"
                :placeholder="esCompraActivoCripto ? 'Ej: Compra Bitcoin spot (opcional)' : 'Ej: Pago servicios, Alquiler, Sueldo...'"
                class="w-full h-11 px-3.5 bg-surface-container-low rounded-lg text-on-surface text-xs focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-outline"
              />
              <span v-if="sugerenciaAplicada" class="text-[11px] text-primary font-medium flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">auto_awesome</span>
                <span>Clasificación sugerida: {{ sugerenciaAplicada }}</span>
              </span>
              <button
                v-else-if="sugerenciaPendiente"
                type="button"
                @click="aplicarSugerenciaPendiente"
                class="text-left text-[11px] text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[14px]">auto_awesome</span>
                <span>
                  Aplicar sugerencia: {{ sugerenciaPendiente.tipo.toUpperCase() }} → {{ sugerenciaPendiente.categoriaNombre }}
                </span>
              </button>
            </div>

            <!-- Submit Buttons -->
            <div class="flex gap-2 mt-2">
              <button
                v-if="editandoId"
                type="button"
                @click="resetForm"
                class="h-12 px-4 bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-semibold uppercase text-xs rounded-lg transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="guardando"
                :class="[
                  'flex-1 h-12 text-on-primary font-semibold tracking-wide uppercase text-xs rounded-lg shadow-[0_4px_16px_rgba(194,101,42,0.25)] flex items-center justify-center gap-2 transition-all cursor-pointer',
                  exitoMsg ? 'bg-on-surface' : 'bg-primary hover:bg-on-primary-fixed-variant'
                ]"
              >
                <span class="material-symbols-outlined text-lg">
                  {{ exitoMsg ? 'check_circle' : editandoId ? 'save' : 'add_circle' }}
                </span>
                <span>
                  {{ exitoMsg ? 'Guardado con éxito' : editandoId ? 'Actualizar Asiento' : 'Registrar Movimiento' }}
                </span>
              </button>
            </div>
          </form>
        </div>

        <!-- Columna Derecha: Historial de Asientos (8 Cols) -->
        <div class="lg:col-span-8 flex flex-col gap-6">
          <div class="rounded-2xl bg-surface-container-lowest p-5 sm:p-6 shadow-[0_2px_20px_rgba(58,48,42,0.05)]">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5">
              <div>
                <div class="flex items-center gap-2.5 flex-wrap">
                  <h3 class="font-headline text-2xl font-normal text-on-surface">
                    Historial de Asientos ({{ monedaActiva }})
                  </h3>
                  <span class="px-2.5 py-0.5 rounded-full bg-surface-container font-mono text-[11px] font-semibold text-primary">
                    {{ transaccionesFiltradas.length }}
                    {{ transaccionesFiltradas.length === 1 ? 'registro' : 'registros' }}
                  </span>
                </div>
                <p class="text-xs text-on-surface-variant mt-0.5">
                  Auditoría cronológica de flujos contables en {{ monedaActiva }}.
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-if="transaccionesSeleccionadas.length > 0"
                  type="button"
                  @click="exportarSeleccionCSV"
                  class="px-3 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span class="material-symbols-outlined text-sm">checklist</span>
                  <span>Exportar selección ({{ transaccionesSeleccionadas.length }})</span>
                </button>
                <button
                  type="button"
                  @click="exportarCSV"
                  class="px-3 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-medium text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span class="material-symbols-outlined text-sm text-primary">file_download</span>
                  <span>Exportar CSV</span>
                </button>
                <button
                  type="button"
                  @click="imprimirLibro"
                  class="px-3 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-medium text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span class="material-symbols-outlined text-sm text-on-surface-variant">print</span>
                  <span>Imprimir</span>
                </button>
              </div>
            </div>

            <!-- Filtro activo por cuenta -->
            <div
              v-if="cuentaFiltradaObj"
              class="mb-4 px-3.5 py-2 rounded-xl bg-primary-fixed/60 border border-primary/25 flex items-center justify-between text-xs"
            >
              <span class="text-on-surface font-medium flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px] text-primary">filter_alt</span>
                <span>Filtrando por cuenta: <strong>{{ cuentaFiltradaObj.nombre }}</strong></span>
              </span>
              <button
                type="button"
                @click="limpiarFiltroCuenta"
                class="px-2.5 py-1 rounded-md bg-surface-container-lowest hover:bg-surface text-[11px] font-semibold text-primary cursor-pointer"
              >
                Quitar filtro ✕
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              <div class="sm:col-span-5 relative">
                <span class="material-symbols-outlined absolute left-3.5 top-2.5 text-on-surface-variant text-base">
                  search
                </span>
                <input
                  v-model="busqueda"
                  type="text"
                  placeholder="Filtrar por descripción, activo o categoría..."
                  class="w-full h-10 pl-10 pr-4 bg-surface-container-low rounded-lg text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>
              <div class="sm:col-span-4">
                <select
                  v-model="filtroCuenta"
                  @change="onCambiarFiltroCuenta"
                  aria-label="Filtrar por cuenta"
                  class="w-full h-10 px-3 bg-surface-container-low rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="">Todas las cuentas ({{ monedaActiva }})</option>
                  <option v-for="c in financeStore.cuentasMonedaActiva" :key="c.id" :value="c.id">
                    {{ c.nombre }}
                  </option>
                </select>
              </div>
              <div class="sm:col-span-3">
                <select
                  v-model="filtroTipo"
                  aria-label="Filtrar por tipo de movimiento"
                  class="w-full h-10 px-3 bg-surface-container-low rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="ALL">Todos los tipos</option>
                  <option value="inversion">Solo Inversiones</option>
                  <option value="gasto">Solo Gastos</option>
                  <option value="ingreso">Solo Ingresos</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Libro Mayor -->
          <div class="rounded-2xl bg-surface-container-lowest shadow-[0_2px_20px_rgba(58,48,42,0.05)] overflow-hidden">
            <!-- Vista Móvil -->
            <div class="md:hidden divide-y divide-outline-variant/25">
              <div
                v-for="tx in transaccionesFiltradas"
                :key="'mob-' + tx.id"
                class="p-4 flex flex-col gap-3 hover:bg-surface-container-low/50 transition-colors"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-2.5 min-w-0">
                    <input
                      v-model="seleccionadosIds"
                      :value="tx.id"
                      type="checkbox"
                      aria-label="Seleccionar movimiento"
                      class="mt-1 accent-primary w-4 h-4 cursor-pointer"
                    />
                    <div class="flex flex-col min-w-0">
                      <span class="font-semibold text-sm text-on-surface truncate">
                        {{ tx.descripcion || 'Asiento sin descripción' }}
                      </span>
                      <span class="text-xs text-on-surface-variant mt-0.5">
                        {{ tx.categorias?.nombre || 'Sin categoría' }}
                        <span
                          v-if="tx.activo_simbolo && tx.activo_cantidad"
                          class="ml-1.5 px-1.5 py-0.5 rounded bg-primary-fixed text-primary font-mono text-[10px] font-bold"
                        >
                          {{ Number(tx.activo_cantidad) }} {{ tx.activo_simbolo }}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div class="flex flex-col items-end flex-shrink-0">
                    <span
                      class="font-headline text-lg font-semibold tracking-tight font-mono leading-none"
                      :class="{
                        'text-primary': tx.tipo === 'inversion',
                        'text-tertiary': tx.tipo === 'gasto',
                        'text-on-surface': tx.tipo === 'ingreso'
                      }"
                    >
                      {{ tx.tipo === 'ingreso' ? '+' : tx.tipo === 'gasto' ? '-' : '' }}{{ simbolo }}{{
                        Number(tx.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })
                      }}
                    </span>
                  </div>
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-outline-variant/15 text-xs text-on-surface-variant">
                  <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-on-surface font-medium text-[11px]">
                      {{ tx.cuentas?.nombre || '-' }}
                    </span>
                    <span class="text-[11px]">{{ formatearFecha(tx.fecha) }}</span>
                  </div>

                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      @click="duplicarParaHoy(tx)"
                      title="Repetir movimiento hoy"
                      class="p-1.5 rounded-md bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                    >
                      <span class="material-symbols-outlined text-[16px]">content_copy</span>
                    </button>
                    <button
                      type="button"
                      @click="seleccionarEditar(tx)"
                      title="Editar Asiento"
                      class="p-1.5 rounded-md bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                    >
                      <span class="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button
                      type="button"
                      @click="financeStore.eliminarTransaccion(tx.id)"
                      title="Borrar Asiento"
                      class="p-1.5 rounded-md bg-surface-container-low hover:bg-error-container text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                    >
                      <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="transaccionesFiltradas.length === 0" class="py-10 px-5 text-center text-xs text-on-surface-variant">
                No hay asientos contables registrados en {{ monedaActiva }} para el filtro seleccionado.
              </div>
            </div>

            <!-- Vista Tablet y Escritorio -->
            <div class="hidden md:block overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-surface-container-low text-[10px] font-label font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                    <th class="py-4 pl-5 pr-2 w-9">
                      <input
                        type="checkbox"
                        :checked="todasVisiblesSeleccionadas"
                        @change="toggleSeleccionTodas"
                        aria-label="Seleccionar todos los movimientos visibles"
                        class="accent-primary w-3.5 h-3.5 cursor-pointer align-middle"
                      />
                    </th>
                    <th class="py-4 px-3">Fecha</th>
                    <th class="py-3.5 px-4">
                      <div class="relative inline-flex items-center">
                        <select
                          v-model="filtroCuenta"
                          @change="onCambiarFiltroCuenta"
                          aria-label="Filtrar columna por cuenta"
                          class="appearance-none bg-transparent hover:bg-surface-container px-2 py-1 pr-6 rounded-md text-[10px] font-label font-bold uppercase tracking-[0.14em] focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer transition-colors"
                          :class="filtroCuenta ? 'text-primary bg-primary-fixed/50' : 'text-on-surface-variant'"
                        >
                          <option value="">CUENTA (TODAS)</option>
                          <option v-for="c in financeStore.cuentasMonedaActiva" :key="c.id" :value="c.id">
                            {{ c.nombre }}
                          </option>
                        </select>
                        <span
                          class="material-symbols-outlined text-[14px] pointer-events-none absolute right-1"
                          :class="filtroCuenta ? 'text-primary' : 'text-on-surface-variant'"
                        >
                          expand_more
                        </span>
                      </div>
                    </th>
                    <th class="py-4 px-4">Categoría &amp; Detalle</th>
                    <th class="py-4 px-3 text-center">Tipo</th>
                    <th class="py-4 px-5 text-right">Monto ({{ monedaActiva }})</th>
                    <th class="py-4 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody class="font-body text-on-surface divide-y divide-outline-variant/20">
                  <tr
                    v-for="tx in transaccionesFiltradas"
                    :key="tx.id"
                    class="hover:bg-surface-container-low/60 transition-colors group"
                    :class="seleccionadosIds.includes(tx.id) ? 'bg-primary-fixed/25' : ''"
                  >
                    <td class="py-4 pl-5 pr-2 whitespace-nowrap">
                      <input
                        v-model="seleccionadosIds"
                        :value="tx.id"
                        type="checkbox"
                        aria-label="Seleccionar movimiento"
                        class="accent-primary w-3.5 h-3.5 cursor-pointer align-middle"
                      />
                    </td>

                    <td class="py-4 px-3 whitespace-nowrap">
                      <span class="font-medium text-on-surface">{{ formatearFecha(tx.fecha) }}</span>
                    </td>

                    <td class="py-4 px-4 whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <span class="w-6 h-6 rounded-md bg-surface-container flex items-center justify-center text-primary">
                          <span class="material-symbols-outlined text-[15px]">account_balance_wallet</span>
                        </span>
                        <span class="font-medium text-on-surface">{{ tx.cuentas?.nombre || '-' }}</span>
                      </div>
                    </td>

                    <td class="py-4 px-4">
                      <div class="flex flex-col max-w-xs">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="font-medium text-on-surface truncate">
                            {{ tx.descripcion || 'Asiento sin descripción' }}
                          </span>
                          <span
                            v-if="tx.activo_simbolo && tx.activo_cantidad"
                            class="px-1.5 py-0.5 rounded bg-primary-fixed text-primary font-mono text-[10px] font-bold"
                          >
                            {{ Number(tx.activo_cantidad) }} {{ tx.activo_simbolo }}
                          </span>
                        </div>
                        <span class="text-[11px] text-on-surface-variant tracking-tight">
                          {{ tx.categorias?.nombre || 'Sin categoría' }}
                        </span>
                      </div>
                    </td>

                    <td class="py-4 px-3 text-center whitespace-nowrap">
                      <span
                        v-if="tx.tipo === 'inversion'"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-primary-fixed text-on-primary-fixed-variant"
                      >
                        <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                        Inversión
                      </span>
                      <span
                        v-else-if="tx.tipo === 'gasto'"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-error-container text-on-error-container"
                      >
                        <span class="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                        Gasto
                      </span>
                      <span
                        v-else
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-secondary-container text-on-secondary-container"
                      >
                        <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                        Ingreso
                      </span>
                    </td>

                    <td class="py-4 px-5 text-right whitespace-nowrap">
                      <span
                        class="font-headline text-base font-semibold tracking-tight font-mono"
                        :class="{
                          'text-primary': tx.tipo === 'inversion',
                          'text-tertiary': tx.tipo === 'gasto',
                          'text-on-surface': tx.tipo === 'ingreso'
                        }"
                      >
                        {{ tx.tipo === 'ingreso' ? '+' : tx.tipo === 'gasto' ? '-' : '' }}{{ simbolo }}{{
                          Number(tx.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })
                        }}
                      </span>
                    </td>

                    <td class="py-4 px-4 text-center whitespace-nowrap">
                      <div class="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          @click="duplicarParaHoy(tx)"
                          title="Repetir movimiento hoy"
                          class="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors bg-transparent cursor-pointer"
                        >
                          <span class="material-symbols-outlined text-base">content_copy</span>
                        </button>
                        <button
                          type="button"
                          @click="seleccionarEditar(tx)"
                          title="Editar Asiento"
                          class="p-1.5 rounded-md hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors bg-transparent cursor-pointer"
                        >
                          <span class="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          type="button"
                          @click="financeStore.eliminarTransaccion(tx.id)"
                          title="Borrar Asiento"
                          class="p-1.5 rounded-md hover:bg-error-container text-on-surface-variant hover:text-error transition-colors bg-transparent cursor-pointer"
                        >
                          <span class="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>

                  <tr v-if="transaccionesFiltradas.length === 0">
                    <td colspan="7" class="py-10 px-5 text-center text-on-surface-variant">
                      No hay asientos contables registrados en {{ monedaActiva }} para el filtro seleccionado.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="p-4 sm:px-6 bg-surface-container-low flex items-center justify-between text-xs text-on-surface-variant">
              <span class="text-[11px]">
                Mostrando {{ transaccionesFiltradas.length }} de {{ financeStore.transaccionesMonedaActiva.length }} transacciones en {{ monedaActiva }}
              </span>
            </div>
          </div>

          <!-- Composición de Cartera -->
          <div class="rounded-2xl bg-surface-container-lowest p-6 shadow-[0_2px_20px_rgba(58,48,42,0.05)] flex flex-col md:flex-row items-center justify-between gap-6">
            <div class="flex items-center gap-4">
              <div class="relative w-16 h-16 flex-shrink-0">
                <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" fill="none" r="14" stroke="#eae2da" stroke-width="3.5"></circle>
                  <circle
                    cx="18"
                    cy="18"
                    fill="none"
                    r="14"
                    stroke="#c2652a"
                    :stroke-dasharray="`${porcentajeInvertido * 0.88} 100`"
                    stroke-linecap="round"
                    stroke-width="3.5"
                  ></circle>
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="font-headline text-[11px] font-bold text-on-surface">{{ porcentajeInvertido }}%</span>
                </div>
              </div>
              <div class="flex flex-col">
                <span class="text-[10px] font-label font-bold tracking-widest uppercase text-primary">
                  Estado de Cartera ({{ monedaActiva }})
                </span>
                <h4 class="font-headline text-base text-on-surface font-medium">
                  Equilibrio • Renta y Acumulación
                </h4>
                <p class="text-xs text-on-surface-variant font-light mt-0.5">
                  Asignación actual sobre patrimonio consolidado en {{ monedaActiva }}.
                </p>
              </div>
            </div>

            <div class="flex items-center gap-4 w-full md:w-auto justify-end text-xs">
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-primary"></span>
                <span class="text-on-surface-variant">
                  Inversión ({{ simbolo }}{{ financeStore.totalInvertido.toLocaleString('es-AR') }})
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                <span class="text-on-surface-variant">
                  Liquidez ({{ liquidezDisponible < 0 ? '-' : '' }}{{ simbolo }}{{ Math.abs(liquidezDisponible).toLocaleString('es-AR') }})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>