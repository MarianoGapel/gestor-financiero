<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFinanceStore } from '@/stores/useFinanceStore'
import GastosMensualesChart from '@/components/GastosMensualesChart.vue'

const financeStore = useFinanceStore()
const periodo = ref('all')
const vistaAnalisis = ref('ambos') // 'ambos' | 'rubro' | 'mes'

onMounted(() => {
  financeStore.cargarPreciosCripto()
})

const monedaActiva = computed(() => financeStore.monedaSeleccionada || 'USD')
const simbolo = computed(() => financeStore.simboloMoneda(monedaActiva.value))

function parseFechaLocal(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const transaccionesMoneda = computed(() => {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  return financeStore.transaccionesMonedaActiva.filter((tx) => {
    if (periodo.value === 'all' || !tx.fecha) return true
    const fechaTx = parseFechaLocal(tx.fecha)

    if (periodo.value === '30d') {
      const diffDias = (hoy - fechaTx) / (1000 * 60 * 60 * 24)
      return diffDias >= 0 && diffDias <= 30
    }
    if (periodo.value === 'ytd') {
      return fechaTx.getFullYear() === hoy.getFullYear() && fechaTx <= hoy
    }
    return true
  })
})

const ingresosPeriodo = computed(() =>
  transaccionesMoneda.value
    .filter((t) => t.tipo === 'ingreso')
    .reduce((acc, t) => acc + Number(t.monto || 0), 0)
)

const gastosPeriodo = computed(() =>
  transaccionesMoneda.value
    .filter((t) => t.tipo === 'gasto')
    .reduce((acc, t) => acc + Number(t.monto || 0), 0)
)

const inversionPeriodo = computed(() =>
  transaccionesMoneda.value
    .filter((t) => t.tipo === 'inversion')
    .reduce((acc, t) => acc + Number(t.monto || 0), 0)
)

// El patrimonio al costo es el saldo acumulado actual
const patrimonioPeriodo = computed(() => financeStore.patrimonioTotal)

// Flujo neto del período seleccionado (Ingresos del período - Gastos del período)
const flujoNetoPeriodo = computed(() => ingresosPeriodo.value - gastosPeriodo.value)

// Conserva el signo negativo si los gastos superan el saldo (descubierto)
const liquidezPeriodo = computed(() =>
  patrimonioPeriodo.value - financeStore.totalInvertido
)

const tasaAsignacion = computed(() => {
  if (patrimonioPeriodo.value <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((financeStore.totalInvertido / patrimonioPeriodo.value) * 100)))
})

const porcentajeLiquidez = computed(() => {
  if (patrimonioPeriodo.value <= 0) return 0
  return Math.max(0, 100 - tasaAsignacion.value)
})

const arcoInversion = computed(() => (tasaAsignacion.value / 100) * 289)
const arcoLiquidez = computed(() => (porcentajeLiquidez.value / 100) * 289)
const dasharrayInversion = computed(() => `${arcoInversion.value} 289`)
const dasharrayLiquidez = computed(() => `${arcoLiquidez.value} 289`)

const movimientosDestacados = computed(() => {
  return [...transaccionesMoneda.value]
    .sort((a, b) => Number(b.monto) - Number(a.monto))
    .slice(0, 5)
})

// 1. Desglose de gastos por categoría
const desgloseGastosPorCategoria = computed(() => {
  const gastos = transaccionesMoneda.value.filter((t) => t.tipo === 'gasto')
  const total = gastos.reduce((acc, t) => acc + Number(t.monto || 0), 0)
  if (total <= 0) return []

  const mapa = {}
  for (const tx of gastos) {
    const nombre = tx.categorias?.nombre || 'Sin categoría'
    if (!mapa[nombre]) {
      mapa[nombre] = { nombre, total: 0, cantidad: 0 }
    }
    mapa[nombre].total += Number(tx.monto || 0)
    mapa[nombre].cantidad += 1
  }

  return Object.values(mapa)
    .map((item) => ({
      ...item,
      porcentaje: Math.round((item.total / total) * 100),
      anchoBarra: ((item.total / total) * 100).toFixed(1) + '%'
    }))
    .sort((a, b) => b.total - a.total)
})

// 2. Clasificación Gastos Fijos/Recurrentes vs. Gastos Variables
const estructuraGastos = computed(() => {
  const rubrosFijos = ['alquiler', 'servicios', 'impuestos', 'suscripciones', 'tarjeta de crédito']
  let fijos = 0
  let variables = 0

  for (const item of desgloseGastosPorCategoria.value) {
    if (rubrosFijos.includes(item.nombre.toLowerCase())) {
      fijos += item.total
    } else {
      variables += item.total
    }
  }

  const total = fijos + variables
  return {
    fijos,
    variables,
    porcentajeFijos: total > 0 ? Math.round((fijos / total) * 100) : 0,
    porcentajeVariables: total > 0 ? Math.round((variables / total) * 100) : 0
  }
})

// 3. Resumen Mensual comparativo sincronizado con el período activo
const resumenMensual = computed(() => {
  const mapa = {}
  const nombresMes = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

  for (const tx of transaccionesMoneda.value) {
    if (!tx.fecha || tx.fecha.length < 7) continue
    const clave = tx.fecha.slice(0, 7)
    if (!mapa[clave]) {
      const [anio, mes] = clave.split('-')
      mapa[clave] = {
        clave,
        etiqueta: `${nombresMes[parseInt(mes, 10) - 1]} ${anio}`,
        ingresos: 0,
        gastos: 0
      }
    }
    if (tx.tipo === 'ingreso') mapa[clave].ingresos += Number(tx.monto || 0)
    if (tx.tipo === 'gasto') mapa[clave].gastos += Number(tx.monto || 0)
  }

  const lista = Object.values(mapa)
    .sort((a, b) => a.clave.localeCompare(b.clave))
    .slice(-12)

  const maxMonto = Math.max(1, ...lista.flatMap((m) => [m.ingresos, m.gastos]))

  return lista.map((m) => ({
    ...m,
    balance: m.ingresos - m.gastos,
    anchoIngresos: Math.round((m.ingresos / maxMonto) * 100) + '%',
    anchoGastos: Math.round((m.gastos / maxMonto) * 100) + '%'
  }))
})

function anchoPorcentaje(valor) {
  return valor + '%'
}

function claseIconoTx(tipo) {
  if (tipo === 'inversion') return 'bg-primary-fixed text-primary'
  if (tipo === 'gasto') return 'bg-error-container text-tertiary'
  return 'bg-secondary-container text-on-secondary-container'
}

function claseMontoTx(tipo) {
  if (tipo === 'inversion') return 'text-primary'
  if (tipo === 'gasto') return 'text-tertiary'
  return 'text-on-surface'
}

function formatearFecha(fechaStr) {
  if (!fechaStr) return '-'
  const parts = fechaStr.split('-')
  if (parts.length !== 3) return fechaStr
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${parts[2]} ${meses[parseInt(parts[1], 10) - 1]} ${parts[0]}`
}

function imprimirReporte() {
  window.print()
}
</script>

<template>
  <div class="flex flex-col w-full">
    <!-- Header & Controles -->
    <section class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 pt-8 pb-6">
      <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div class="flex flex-col gap-2.5">
          <div class="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-secondary uppercase font-body">
            <span>Mi Cartera</span>
            <span class="text-outline">/</span>
            <span class="text-primary font-bold">Cartera en {{ monedaActiva }}</span>
          </div>
          <h1 class="font-headline text-3xl sm:text-5xl text-on-surface font-normal tracking-tight leading-none">
            Mi Cartera <span class="font-headline italic text-primary font-normal">— Rendimiento en {{ monedaActiva }}</span>
          </h1>
          <p class="font-body text-sm sm:text-base text-on-surface-variant max-w-2xl font-light">
            Indicadores personales calculados sobre tus cuentas, movimientos y valuación actualizada de criptoactivos.
          </p>
        </div>

        <!-- Selector de Período & Exportar -->
        <div class="flex flex-wrap items-center gap-3">
          <div class="inline-flex p-1 bg-surface-container-high rounded-xl text-xs font-medium text-on-surface-variant shadow-sm">
            <button
              type="button"
              @click="periodo = '30d'"
              :class="[
                'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                periodo === '30d' ? 'bg-surface text-primary font-semibold shadow-sm' : 'hover:text-on-surface'
              ]"
            >
              Últimos 30 días
            </button>
            <button
              type="button"
              @click="periodo = 'ytd'"
              :class="[
                'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                periodo === 'ytd' ? 'bg-surface text-primary font-semibold shadow-sm' : 'hover:text-on-surface'
              ]"
            >
              Año actual
            </button>
            <button
              type="button"
              @click="periodo = 'all'"
              :class="[
                'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                periodo === 'all' ? 'bg-surface text-primary font-semibold shadow-sm' : 'hover:text-on-surface'
              ]"
            >
              Histórico
            </button>
          </div>

          <button
            type="button"
            @click="imprimirReporte"
            class="inline-flex items-center gap-2 bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <span class="material-symbols-outlined text-[17px]">picture_as_pdf</span>
            <span>Exportar Reporte</span>
          </button>
        </div>
      </div>
    </section>

    <!-- 4 KPIs Principales -->
    <section class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 py-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div class="bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs font-medium text-on-surface-variant mb-2">
              <span class="tracking-wide uppercase text-[11px] font-semibold text-secondary">Patrimonio al Costo ({{ monedaActiva }})</span>
              <span class="material-symbols-outlined text-primary text-[20px]">account_balance_wallet</span>
            </div>
            <div class="font-headline text-3xl text-on-surface tracking-tight font-medium mt-1">
              {{ simbolo }}{{ patrimonioPeriodo.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
            </div>
            <div
              v-if="financeStore.carteraActivos?.length"
              class="text-xs font-mono font-semibold text-primary mt-1"
            >
              A mercado: {{ simbolo }}{{
                financeStore.patrimonioMercado.toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })
              }}
              <span v-if="financeStore.posicionesSinCotizacion > 0" class="block text-[10px] text-amber-700 font-normal mt-0.5">
                Valuación parcial ({{ financeStore.posicionesSinCotizacion }} sin cotiz., al costo)
              </span>
            </div>
          </div>
          <div class="mt-4 pt-3 flex items-center justify-between text-xs">
            <span class="font-semibold text-primary bg-primary-fixed/50 px-2 py-0.5 rounded-md">
              Divisa {{ monedaActiva }}
            </span>
            <span
              class="font-mono font-medium"
              :class="flujoNetoPeriodo >= 0 ? 'text-emerald-700' : 'text-tertiary'"
            >
              Flujo: {{ flujoNetoPeriodo >= 0 ? '+' : '-' }}{{ simbolo }}{{
                Math.abs(flujoNetoPeriodo).toLocaleString('es-AR', { minimumFractionDigits: 2 })
              }}
            </span>
          </div>
        </div>

        <div class="bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs font-medium text-on-surface-variant mb-2">
              <span class="tracking-wide uppercase text-[11px] font-semibold text-secondary">Invertido en {{ monedaActiva }}</span>
              <span class="material-symbols-outlined text-primary text-[20px]">trending_up</span>
            </div>
            <div class="font-headline text-3xl text-primary tracking-tight font-medium mt-1">
              {{ simbolo }}{{ inversionPeriodo.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
            </div>
          </div>
          <div class="mt-4 pt-3 flex items-center justify-between text-xs">
            <span class="font-medium text-on-surface bg-surface-container-high px-2 py-0.5 rounded-md">
              {{ tasaAsignacion }}% asignado
            </span>
            <span class="text-on-surface-variant/80 font-light">En período</span>
          </div>
        </div>

        <div class="bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs font-medium text-on-surface-variant mb-2">
              <span class="tracking-wide uppercase text-[11px] font-semibold text-secondary">Ingresos ({{ monedaActiva }})</span>
              <span class="material-symbols-outlined text-secondary text-[20px]">arrow_downward_alt</span>
            </div>
            <div class="font-headline text-3xl text-on-surface tracking-tight font-medium mt-1">
              +{{ simbolo }}{{ ingresosPeriodo.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
            </div>
          </div>
          <div class="mt-4 pt-3 flex items-center justify-between text-xs">
            <span class="text-primary font-medium">Aportes y retornos</span>
            <span class="text-on-surface-variant/80 font-light">{{ monedaActiva }}</span>
          </div>
        </div>

        <div class="bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs font-medium text-on-surface-variant mb-2">
              <span class="tracking-wide uppercase text-[11px] font-semibold text-secondary">Gastos ({{ monedaActiva }})</span>
              <span class="material-symbols-outlined text-tertiary text-[20px]">arrow_upward_alt</span>
            </div>
            <div class="font-headline text-3xl text-tertiary tracking-tight font-medium mt-1">
              -{{ simbolo }}{{ gastosPeriodo.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
            </div>
          </div>
          <div class="mt-4 pt-3 flex items-center justify-between text-xs">
            <span class="font-medium" :class="liquidezPeriodo < 0 ? 'text-tertiary font-bold' : 'text-on-surface'">
              {{ liquidezPeriodo < 0 ? 'Descubierto:' : 'Liquidez:' }}
              {{ liquidezPeriodo < 0 ? '-' : '' }}{{ simbolo }}{{
                Math.abs(liquidezPeriodo).toLocaleString('es-AR', { minimumFractionDigits: 2 })
              }}
            </span>
            <span class="text-on-surface-variant/80 font-light">{{ monedaActiva }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Seguimiento de Inversiones en Activos / Cripto (Cotización Actualizada) -->
    <section class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 py-4">
      <div class="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <span class="text-[11px] font-bold tracking-widest text-primary uppercase">Valuación a Precio de Mercado</span>
            <h2 class="font-headline text-2xl text-on-surface font-medium">
              Seguimiento de Activos / Cripto ({{ monedaActiva }})
            </h2>
            <p class="text-xs text-on-surface-variant font-light mt-0.5">
              Comparativa entre el capital invertido en cada compra y su valor actual según la cotización en vivo.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <span
              v-if="financeStore.posicionesSinCotizacion > 0"
              class="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-[11px] font-semibold"
            >
              Valuación parcial: {{ financeStore.posicionesSinCotizacion }}
              {{ financeStore.posicionesSinCotizacion === 1 ? 'posición valuada' : 'posiciones valuadas' }} al costo
            </span>
            <span
              v-if="monedaActiva === 'ARS' && financeStore.cotizacionEstimada"
              class="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-[11px] font-semibold"
            >
              Tipo de cambio ARS estimado
            </span>
            <span v-if="financeStore.ultimaActualizacionPrecios" class="text-[11px] text-secondary">
              Actualizado {{ financeStore.ultimaActualizacionPrecios }} hs
            </span>
            <button
              type="button"
              @click="financeStore.cargarPreciosCripto()"
              :disabled="financeStore.cargandoPrecios"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-on-surface transition-colors cursor-pointer disabled:opacity-60"
            >
              <span class="material-symbols-outlined text-[16px] text-primary">refresh</span>
              <span>{{ financeStore.cargandoPrecios ? 'Actualizando...' : 'Actualizar Precios' }}</span>
            </button>
          </div>
        </div>

        <div
          v-if="!financeStore.carteraActivos?.length"
          class="p-8 rounded-2xl bg-surface-container-low text-center text-xs text-secondary"
        >
          Todavía no registraste compras de criptoactivos en {{ monedaActiva }}. Podés cargarlas desde
          <RouterLink to="/transacciones" class="text-primary font-semibold hover:underline">
            Transacciones → Inversión → Compra Activo / Cripto
          </RouterLink>.
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="activo in financeStore.carteraActivos"
            :key="activo.simbolo"
            class="p-5 rounded-2xl bg-surface border border-outline-variant/25 flex flex-col justify-between gap-4"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center font-headline font-bold text-sm">
                  {{ activo.simbolo }}
                </div>
                <div>
                  <h3 class="font-headline text-lg font-semibold text-on-surface leading-tight">
                    {{ activo.nombre }}
                  </h3>
                  <span class="text-xs font-mono text-secondary">
                    Tenencia: {{ activo.cantidadTotal.toLocaleString('es-AR', { maximumFractionDigits: 6 }) }} {{ activo.simbolo }}
                  </span>
                </div>
              </div>

              <span
                v-if="activo.precioActual > 0"
                :class="[
                  'px-2.5 py-1 rounded-lg font-mono text-xs font-bold',
                  activo.gananciaPerdida >= 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-error-container text-tertiary'
                ]"
              >
                {{ activo.gananciaPerdida >= 0 ? '+' : '' }}{{ activo.rendimientoPorcentaje.toFixed(2) }}%
              </span>
              <span
                v-else
                class="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800"
              >
                Sin cotización (al costo)
              </span>
            </div>

            <div class="grid grid-cols-2 gap-3 pt-3 border-t border-outline-variant/20 text-xs">
              <div>
                <span class="text-[10px] uppercase tracking-wider text-secondary block">Invertido Total</span>
                <span class="font-mono font-semibold text-on-surface text-sm">
                  {{ simbolo }}{{ activo.totalInvertido.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                </span>
                <span class="text-[10px] text-secondary block mt-0.5">
                  Entrada: {{ simbolo }}{{ activo.precioPromedio.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                </span>
              </div>

              <div class="text-right">
                <span class="text-[10px] uppercase tracking-wider text-secondary block">Valor Actual Hoy</span>
                <span class="font-mono font-semibold text-primary text-sm">
                  {{ simbolo }}{{ activo.valorActual.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                </span>
                <span v-if="activo.precioActual > 0" class="text-[10px] text-secondary block mt-0.5">
                  Mercado: {{ simbolo }}{{ activo.precioActual.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                </span>
                <span v-else class="text-[10px] text-amber-700 block mt-0.5">
                  Valuado al costo
                </span>
              </div>
            </div>

            <div
              v-if="activo.precioActual > 0"
              class="pt-2.5 border-t border-outline-variant/20 flex items-center justify-between text-xs"
            >
              <span class="text-on-surface-variant">Resultado neto:</span>
              <span
                class="font-mono font-bold"
                :class="activo.gananciaPerdida >= 0 ? 'text-emerald-700' : 'text-tertiary'"
              >
                {{ activo.gananciaPerdida >= 0 ? '+' : '-' }}{{ simbolo }}{{
                  Math.abs(activo.gananciaPerdida).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Resumen Independiente por Moneda -->
    <section v-if="financeStore.resumenPorMoneda?.length" class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 py-4">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <span class="text-[11px] font-bold tracking-widest text-primary uppercase">Carteras Separadas</span>
          <h2 class="font-headline text-2xl text-on-surface font-medium">Resumen Independiente por Moneda</h2>
        </div>
        <span class="text-xs text-secondary hidden sm:inline">Hacé clic en una tarjeta para enfocar esa divisa</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          v-for="item in financeStore.resumenPorMoneda"
          :key="item.moneda"
          type="button"
          @click="financeStore.monedaSeleccionada = item.moneda"
          :class="[
            'text-left p-5 rounded-2xl transition-all cursor-pointer flex flex-col justify-between bg-surface-container-lowest shadow-sm hover:shadow-md',
            monedaActiva === item.moneda ? 'ring-2 ring-primary' : ''
          ]"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="px-2.5 py-0.5 rounded-md text-xs font-bold tracking-wider bg-primary-fixed text-on-primary-fixed-variant">
              {{ item.moneda }}
            </span>
            <span class="text-[11px] text-secondary">
              {{ item.cuentasCount }} {{ item.cuentasCount === 1 ? 'cuenta' : 'cuentas' }}
            </span>
          </div>

          <div class="font-headline text-2xl font-semibold text-on-surface tracking-tight mb-3">
            {{ financeStore.simboloMoneda(item.moneda) }}{{
              item.patrimonio.toLocaleString('es-AR', { minimumFractionDigits: 2 })
            }}
          </div>

          <div class="space-y-1.5">
            <div class="flex justify-between text-[11px] text-on-surface-variant">
              <span>Invertido: <strong class="text-primary">{{ item.porcentajeInvertido }}%</strong></span>
              <span>{{ financeStore.simboloMoneda(item.moneda) }}{{ item.invertido.toLocaleString('es-AR') }}</span>
            </div>
            <div class="w-full h-2 bg-surface-container-high rounded-full overflow-hidden flex">
              <div class="bg-primary h-full transition-all" :style="{ width: anchoPorcentaje(item.porcentajeInvertido) }"></div>
              <div class="bg-secondary-fixed-dim h-full transition-all" :style="{ width: anchoPorcentaje(100 - item.porcentajeInvertido) }"></div>
            </div>
            <div class="flex justify-between text-[10px] text-secondary pt-1">
              <span>Ing: +{{ financeStore.simboloMoneda(item.moneda) }}{{ item.ingresos.toLocaleString('es-AR') }}</span>
              <span class="text-tertiary">Gas: -{{ financeStore.simboloMoneda(item.moneda) }}{{ item.gastos.toLocaleString('es-AR') }}</span>
            </div>
          </div>
        </button>
      </div>
    </section>

    <!-- Dona de Composición & Movimientos Destacados -->
    <section class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-5 bg-surface-container-lowest p-6 sm:p-8 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <div>
                <span class="text-[11px] font-bold tracking-widest text-secondary uppercase">Composición {{ monedaActiva }}</span>
                <h3 class="font-headline text-2xl text-on-surface font-medium">Distribución en {{ monedaActiva }}</h3>
              </div>
              <span class="material-symbols-outlined text-on-surface-variant text-[22px]">pie_chart</span>
            </div>
            <p class="text-xs text-on-surface-variant font-light mb-6">
              Composición actual de la cartera entre capital invertido y liquidez en {{ monedaActiva }}.
            </p>

            <div class="relative flex items-center justify-center my-4">
              <svg class="w-48 h-48 -rotate-90 transform" viewBox="0 0 120 120">
                <circle cx="60" cy="60" fill="transparent" r="46" stroke="#f2ece4" stroke-width="12"></circle>
                <circle
                  cx="60"
                  cy="60"
                  fill="transparent"
                  r="46"
                  stroke="#c2652a"
                  :stroke-dasharray="dasharrayInversion"
                  stroke-dashoffset="0"
                  stroke-linecap="round"
                  stroke-width="12"
                ></circle>
                <circle
                  cx="60"
                  cy="60"
                  fill="transparent"
                  r="46"
                  stroke="#78706a"
                  :stroke-dasharray="dasharrayLiquidez"
                  :stroke-dashoffset="-arcoInversion"
                  stroke-width="12"
                ></circle>
              </svg>

              <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                <span class="text-[10px] uppercase font-bold tracking-widest text-on-surface-variant">{{ monedaActiva }}</span>
                <span class="font-headline text-lg font-medium text-on-surface leading-tight">
                  {{ simbolo }}{{ patrimonioPeriodo.toLocaleString('es-AR') }}
                </span>
                <span class="text-[10px] text-primary font-semibold">{{ tasaAsignacion }}% Inv.</span>
              </div>
            </div>
          </div>

          <div class="space-y-3 pt-6 mt-4 border-t border-outline-variant/20">
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-2.5">
                <span class="w-3 h-3 rounded-md bg-primary"></span>
                <span class="font-medium text-on-surface">Capital Invertido ({{ monedaActiva }})</span>
              </div>
              <div>
                <span class="font-bold text-on-surface">
                  {{ simbolo }}{{ financeStore.totalInvertido.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
                </span>
                <span class="text-secondary text-[11px] ml-1">({{ tasaAsignacion }}%)</span>
              </div>
            </div>

            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-2.5">
                <span class="w-3 h-3 rounded-md bg-secondary"></span>
                <span class="font-medium text-on-surface">
                  {{ liquidezPeriodo < 0 ? 'Descubierto' : 'Liquidez Disponible' }} ({{ monedaActiva }})
                </span>
              </div>
              <div>
                <span class="font-bold" :class="liquidezPeriodo < 0 ? 'text-tertiary' : 'text-on-surface'">
                  {{ liquidezPeriodo < 0 ? '-' : '' }}{{ simbolo }}{{
                    Math.abs(liquidezPeriodo).toLocaleString('es-AR', { minimumFractionDigits: 2 })
                  }}
                </span>
                <span class="text-secondary text-[11px] ml-1">({{ porcentajeLiquidez }}%)</span>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-7 bg-surface-container-lowest p-6 sm:p-8 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <div>
                <span class="text-[11px] font-bold tracking-widest text-secondary uppercase">Libro Mayor • {{ monedaActiva }}</span>
                <h3 class="font-headline text-2xl text-on-surface font-medium">Movimientos en {{ monedaActiva }}</h3>
              </div>
              <RouterLink to="/transacciones" class="text-xs font-semibold text-primary hover:underline">
                Ir al Libro Mayor
              </RouterLink>
            </div>
            <p class="text-xs text-on-surface-variant font-light mb-5">
              Operaciones de mayor monto registradas en cuentas denominadas en {{ monedaActiva }}.
            </p>

            <div v-if="movimientosDestacados.length === 0" class="p-8 rounded-2xl bg-surface-container-low text-center text-xs text-secondary">
              No hay transacciones registradas en {{ monedaActiva }} para este período.
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="tx in movimientosDestacados"
                :key="tx.id"
                class="p-3.5 bg-surface rounded-2xl flex items-center justify-between gap-3 hover:bg-surface-container transition-colors"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    :class="claseIconoTx(tx.tipo)"
                  >
                    <span class="material-symbols-outlined text-[20px]">
                      {{ tx.tipo === 'inversion' ? 'token' : tx.tipo === 'gasto' ? 'arrow_upward_alt' : 'arrow_downward_alt' }}
                    </span>
                  </div>
                  <div class="min-w-0">
                    <div class="font-medium text-sm text-on-surface truncate">
                      {{ tx.descripcion || 'Movimiento registrado' }}
                    </div>
                    <div class="text-[11px] text-on-surface-variant font-light truncate">
                      {{ tx.cuentas?.nombre || 'Cuenta' }} • {{ formatearFecha(tx.fecha) }}
                    </div>
                  </div>
                </div>

                <div class="text-right flex-shrink-0">
                  <div
                    class="font-headline font-semibold text-base font-mono"
                    :class="claseMontoTx(tx.tipo)"
                  >
                    {{ tx.tipo === 'ingreso' ? '+' : tx.tipo === 'gasto' ? '-' : '' }}{{ simbolo }}{{
                      Number(tx.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })
                    }}
                  </div>
                  <div class="text-[10px] uppercase tracking-wider text-secondary font-semibold">
                    {{ monedaActiva }} • {{ tx.tipo }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="pt-5 mt-4 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
            <span>Cálculo aislado por divisa y período</span>
            <span class="font-semibold text-primary">{{ monedaActiva }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Análisis Detallado de Gastos por Rubro & Evolución Mensual -->
    <section class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 pb-14">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <span class="text-[11px] font-bold tracking-widest text-primary uppercase">Análisis de Egresos</span>
          <h2 class="font-headline text-2xl text-on-surface font-medium">Distribución por Rubro y Evolución Mensual</h2>
        </div>

        <div class="inline-flex p-1 bg-surface-container-high rounded-xl text-xs font-semibold">
          <button
            type="button"
            @click="vistaAnalisis = 'ambos'"
            :class="[
              'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
              vistaAnalisis === 'ambos' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            ]"
          >
            Vista completa
          </button>
          <button
            type="button"
            @click="vistaAnalisis = 'rubro'"
            :class="[
              'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
              vistaAnalisis === 'rubro' ? 'bg-surface text-tertiary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            ]"
          >
            Por rubro
          </button>
          <button
            type="button"
            @click="vistaAnalisis = 'mes'"
            :class="[
              'px-3 py-1.5 rounded-lg transition-all cursor-pointer',
              vistaAnalisis === 'mes' ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            ]"
          >
            Por mes
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Desglose de Gastos por Rubro (Fijos vs Variables) -->
        <div
          v-if="vistaAnalisis !== 'mes'"
          :class="vistaAnalisis === 'rubro' ? 'lg:col-span-12' : 'lg:col-span-6'"
          class="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl shadow-sm flex flex-col justify-between"
        >
          <div>
            <div class="flex items-center justify-between mb-3">
              <div>
                <span class="text-[11px] font-bold tracking-widest text-tertiary uppercase">Estructura de Egresos</span>
                <h3 class="font-headline text-2xl text-on-surface font-medium">Gastos por Rubro ({{ monedaActiva }})</h3>
              </div>
              <span class="material-symbols-outlined text-tertiary text-[22px]">receipt_long</span>
            </div>

            <!-- Fijos vs Variables -->
            <div v-if="desgloseGastosPorCategoria.length" class="grid grid-cols-2 gap-3 my-4 p-3.5 rounded-2xl bg-surface-container-low text-xs">
              <div>
                <span class="text-[10px] uppercase tracking-wider font-bold text-secondary block">Gastos Fijos / Servicios</span>
                <span class="font-mono font-bold text-on-surface text-sm">
                  {{ simbolo }}{{ estructuraGastos.fijos.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
                </span>
                <span class="text-[10px] text-primary font-semibold ml-1">({{ estructuraGastos.porcentajeFijos }}%)</span>
              </div>
              <div class="text-right">
                <span class="text-[10px] uppercase tracking-wider font-bold text-secondary block">Gastos Variables / Consumo</span>
                <span class="font-mono font-bold text-tertiary text-sm">
                  {{ simbolo }}{{ estructuraGastos.variables.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
                </span>
                <span class="text-[10px] text-tertiary font-semibold ml-1">({{ estructuraGastos.porcentajeVariables }}%)</span>
              </div>
            </div>

            <div v-if="!desgloseGastosPorCategoria.length" class="p-8 rounded-2xl bg-surface-container-low text-center text-xs text-secondary mt-4">
              No hay gastos registrados en {{ monedaActiva }} dentro del período seleccionado.
            </div>

            <div v-else class="space-y-3.5 mt-4">
              <div v-for="rubro in desgloseGastosPorCategoria" :key="rubro.nombre" class="space-y-1">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-medium text-on-surface">
                    {{ rubro.nombre }}
                    <span class="text-[10px] text-secondary ml-1">({{ rubro.cantidad }} ops)</span>
                  </span>
                  <span class="font-mono font-semibold text-tertiary">
                    -{{ simbolo }}{{ rubro.total.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
                    <span class="text-[10px] text-on-surface-variant ml-1">({{ rubro.porcentaje }}%)</span>
                  </span>
                </div>
                <div class="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                  <div class="bg-tertiary h-full rounded-full transition-all" :style="{ width: rubro.anchoBarra }"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="pt-5 mt-6 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
            <span>Desglose filtrado por período y divisa</span>
            <span class="font-mono font-semibold text-tertiary">
              Total: -{{ simbolo }}{{ gastosPeriodo.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
            </span>
          </div>
        </div>

        <!-- Gráfico de Barras: Comparativa de Gastos por Mes -->
        <GastosMensualesChart
          v-if="vistaAnalisis !== 'rubro'"
          :class="vistaAnalisis === 'mes' ? 'lg:col-span-12' : 'lg:col-span-6'"
          :datos="resumenMensual"
          :moneda="monedaActiva"
          :simbolo="simbolo"
        />
      </div>
    </section>
  </div>
</template>