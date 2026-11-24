<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useFinanceStore } from '@/stores/useFinanceStore'

const financeStore = useFinanceStore()

const editandoId = ref(null)
const guardando = ref(false)
const exitoMsg = ref(false)
const filtroTab = ref('all')
const inputNombreRef = ref(null)
const busqueda = ref('')

const monedaActiva = computed(() => financeStore.monedaSeleccionada || 'USD')
const simbolo = computed(() => financeStore.simboloMoneda(monedaActiva.value))

const form = ref({
  nombre: '',
  tipo: 'gasto',
  requiere_activo: false
})

onMounted(async () => {
  await financeStore.cargarEstadisticasAdmin()
})

const categoriasFiltradas = computed(() => {
  return financeStore.categorias.filter((cat) => {
    const tipoCat = (cat.tipo || 'gasto').toLowerCase()
    const coincideTab = filtroTab.value === 'all' || tipoCat === filtroTab.value
    const q = busqueda.value.toLowerCase().trim()
    const coincideTexto = !q || (cat.nombre && cat.nombre.toLowerCase().includes(q))
    return coincideTab && coincideTexto
  })
})

const conteoPorTipo = computed(() => {
  const gastos = financeStore.categorias.filter((c) => (c.tipo || 'gasto') === 'gasto').length
  const inversiones = financeStore.categorias.filter((c) => c.tipo === 'inversion').length
  const ingresos = financeStore.categorias.filter((c) => c.tipo === 'ingreso').length
  return { gastos, inversiones, ingresos }
})

const porcentajesCatalogo = computed(() => {
  const total = financeStore.categorias.length
  if (total === 0) {
    return {
      gastosPct: 0,
      inversionesWidth: '0%',
      gastosWidth: '0%',
      ingresosWidth: '0%'
    }
  }
  const { gastos, inversiones, ingresos } = conteoPorTipo.value
  return {
    gastosPct: Math.round((gastos / total) * 100),
    inversionesWidth: ((inversiones / total) * 100).toFixed(2) + '%',
    gastosWidth: ((gastos / total) * 100).toFixed(2) + '%',
    ingresosWidth: ((ingresos / total) * 100).toFixed(2) + '%'
  }
})

const topCategoriasSistema = computed(() => financeStore.estadisticasSistema.topCategorias || [])
const distribucionMonedasSistema = computed(() => financeStore.estadisticasSistema.porMoneda || [])

const maxUsoCategoria = computed(() => {
  if (!topCategoriasSistema.value.length) return 1
  return Math.max(1, ...topCategoriasSistema.value.map((c) => Number(c.cantidad || 0)))
})

function anchoBarraCategoria(cantidad) {
  return Math.round((Number(cantidad || 0) / maxUsoCategoria.value) * 100) + '%'
}

function claseIconoCategoria(tipo) {
  if (tipo === 'inversion') return 'bg-primary-fixed text-primary'
  if (tipo === 'gasto') return 'bg-error-container text-tertiary'
  return 'bg-secondary-container text-on-secondary-container'
}

function claseBadgeCategoria(tipo) {
  if (tipo === 'inversion') return 'bg-primary-fixed text-on-primary-fixed-variant'
  if (tipo === 'gasto') return 'bg-error-container text-on-error-container'
  return 'bg-secondary-container text-on-secondary-container'
}

function resumenPorCategoria(catId) {
  const movs = financeStore.transaccionesMonedaActiva.filter((t) => t.categoria_id === catId)
  const total = movs.reduce((acc, t) => acc + Number(t.monto || 0), 0)
  return { cantidad: movs.length, total }
}

function resetForm() {
  editandoId.value = null
  form.value = {
    nombre: '',
    tipo: 'gasto',
    requiere_activo: false
  }
}

function seleccionarEditar(cat) {
  editandoId.value = cat.id
  form.value = {
    nombre: cat.nombre,
    tipo: cat.tipo || 'gasto',
    requiere_activo: Boolean(cat.requiere_activo)
  }
  nextTick(() => {
    inputNombreRef.value?.focus({ preventScroll: true })
    inputNombreRef.value?.select()
  })
}

async function guardarCategoria() {
  if (!form.value.nombre.trim()) return
  guardando.value = true
  try {
    const payload = {
      nombre: form.value.nombre.trim(),
      tipo: form.value.tipo,
      requiere_activo: form.value.tipo === 'inversion' ? Boolean(form.value.requiere_activo) : false
    }
    if (editandoId.value) {
      await financeStore.editarCategoria(editandoId.value, payload)
    } else {
      await financeStore.agregarCategoria(payload)
    }
    resetForm()
    exitoMsg.value = true
    setTimeout(() => (exitoMsg.value = false), 2000)
  } catch (err) {
    alert('Error al guardar categoría (verificá permisos de administrador en Supabase): ' + err.message)
  } finally {
    guardando.value = false
  }
}

async function borrarCategoria(id) {
  if (!confirm('¿Eliminar esta categoría del catálogo global? Los movimientos asociados quedarán sin categoría.')) return
  try {
    await financeStore.eliminarCategoria(id)
  } catch (err) {
    alert('No se pudo eliminar la categoría: ' + err.message)
  }
}
</script>

<template>
  <div class="flex flex-col w-full">
    <div class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 py-8 lg:py-10">
      <!-- Header -->
      <div class="relative pb-8">
        <div class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-on-surface-variant uppercase font-body mb-3">
          <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
          <span>Dashboard Administrativo</span>
          <span class="text-outline/60">•</span>
          <span>Catálogo Global y Métricas del Sistema</span>
        </div>
        <h1 class="font-headline text-3xl sm:text-5xl text-on-surface font-normal tracking-tight leading-[1.08]">
          Dashboard <span class="italic font-normal text-primary font-headline">— Estadísticas y Catálogo</span>
        </h1>
        <p class="mt-3 text-sm sm:text-base text-on-surface-variant font-body font-light leading-relaxed max-w-2xl">
          Métricas agregadas de toda la plataforma y gestión centralizada del plan contable. Los importes por rubro reflejan la moneda activa ({{ monedaActiva }}).
        </p>
      </div>

      <!-- Aviso si admin_stats() no está disponible -->
      <div
        v-if="financeStore.estadisticasSistema.errorAdminStats"
        class="mb-6 p-4 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2"
      >
        <span class="material-symbols-outlined text-[18px]">warning</span>
        <span>Estadísticas globales no disponibles (verificá que la función <code>admin_stats()</code> esté ejecutada en Supabase).</span>
      </div>

      <!-- KPI Summary Grid (4 Tarjetas Reales del Sistema y Catálogo) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="p-6 rounded-2xl bg-surface-container-lowest shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs uppercase tracking-wider font-semibold text-on-surface-variant">Usuarios del Sistema</span>
            <span class="material-symbols-outlined text-primary text-[20px]">group</span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="font-headline text-3xl text-on-surface font-medium">
              {{ financeStore.estadisticasSistema.errorAdminStats ? '—' : financeStore.estadisticasSistema.totalUsuarios }}
            </span>
            <span class="text-xs text-on-surface-variant">perfiles activos</span>
          </div>
          <p class="mt-3 text-xs text-on-surface-variant">Registrados en la plataforma</p>
        </div>

        <div class="p-6 rounded-2xl bg-surface-container-lowest shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs uppercase tracking-wider font-semibold text-on-surface-variant">Categorías Globales</span>
            <span class="material-symbols-outlined text-primary text-[20px]">account_tree</span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="font-headline text-3xl text-on-surface font-medium">{{ financeStore.categorias.length }}</span>
            <span class="text-xs text-on-surface-variant">en catálogo</span>
          </div>
          <div class="mt-3 pt-2 flex items-center justify-between text-[11px] text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-lg">
            <span>{{ conteoPorTipo.gastos }} Gastos</span>
            <span>{{ conteoPorTipo.inversiones }} Invers.</span>
            <span>{{ conteoPorTipo.ingresos }} Ingr.</span>
          </div>
        </div>

        <div class="p-6 rounded-2xl bg-surface-container-lowest shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs uppercase tracking-wider font-semibold text-on-surface-variant">Composición Catálogo</span>
            <span class="material-symbols-outlined text-primary text-[20px]">pie_chart</span>
          </div>
          <div class="font-headline text-2xl text-on-surface font-medium">
            {{ porcentajesCatalogo.gastosPct }}% Gastos
          </div>
          <div class="w-full h-2 bg-surface-container-high rounded-full overflow-hidden flex mt-3">
            <div
              class="bg-primary h-full transition-all"
              :style="{ width: porcentajesCatalogo.inversionesWidth }"
            ></div>
            <div
              class="bg-tertiary h-full transition-all"
              :style="{ width: porcentajesCatalogo.gastosWidth }"
            ></div>
            <div
              class="bg-secondary h-full transition-all"
              :style="{ width: porcentajesCatalogo.ingresosWidth }"
            ></div>
          </div>
        </div>

        <div class="p-6 rounded-2xl bg-surface-container-lowest shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs uppercase tracking-wider font-semibold text-on-surface-variant">Actividad Plataforma</span>
            <span class="material-symbols-outlined text-primary text-[20px]">bar_chart</span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="font-headline text-3xl text-primary font-medium">
              {{ financeStore.estadisticasSistema.errorAdminStats ? '—' : financeStore.estadisticasSistema.totalTransaccionesSistema }}
            </span>
            <span class="text-xs text-on-surface-variant">movimientos</span>
          </div>
          <p class="mt-3 text-xs text-on-surface-variant">
            En {{ financeStore.estadisticasSistema.errorAdminStats ? '—' : financeStore.estadisticasSistema.totalCuentasSistema }} cuentas activas globales
          </p>
        </div>
      </div>

      <!-- Métricas Agregadas de Uso Global (RPC admin_stats) -->
      <div
        v-if="topCategoriasSistema.length || distribucionMonedasSistema.length"
        class="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8"
      >
        <div class="lg:col-span-7 p-6 rounded-2xl bg-surface-container-lowest shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-widest text-primary">Uso Global en Plataforma</span>
              <h2 class="font-headline text-xl text-on-surface font-medium">Categorías Más Utilizadas</h2>
            </div>
            <span class="material-symbols-outlined text-primary text-[20px]">leaderboard</span>
          </div>

          <div class="space-y-3">
            <div v-for="item in topCategoriasSistema" :key="item.nombre" class="space-y-1">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium text-on-surface">{{ item.nombre }}</span>
                <span class="font-mono text-on-surface-variant">{{ item.cantidad }} ops</span>
              </div>
              <div class="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  class="bg-primary h-full rounded-full transition-all"
                  :style="{ width: anchoBarraCategoria(item.cantidad) }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-5 p-6 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <div>
                <span class="text-[10px] font-bold uppercase tracking-widest text-primary">Cuentas por Divisa</span>
                <h2 class="font-headline text-xl text-on-surface font-medium">Distribución Multi-Moneda</h2>
              </div>
              <span class="material-symbols-outlined text-primary text-[20px]">currency_exchange</span>
            </div>

            <div class="space-y-2.5">
              <div
                v-for="m in distribucionMonedasSistema"
                :key="m.moneda"
                class="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-surface-container-low text-xs"
              >
                <span class="font-bold tracking-wider text-on-surface">{{ m.moneda }}</span>
                <span class="font-mono font-semibold text-primary">
                  {{ m.cuentas }} {{ m.cuentas === 1 ? 'cuenta' : 'cuentas' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Filter Pills & Search -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div class="inline-flex p-1 bg-surface-container-low rounded-xl overflow-x-auto">
          <button
            type="button"
            @click="filtroTab = 'all'"
            :class="[
              'px-3.5 py-2 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer',
              filtroTab === 'all' ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold' : 'text-on-surface-variant font-medium'
            ]"
          >
            Todas ({{ financeStore.categorias.length }})
          </button>
          <button
            type="button"
            @click="filtroTab = 'inversion'"
            :class="[
              'px-3.5 py-2 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer',
              filtroTab === 'inversion' ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold' : 'text-on-surface-variant font-medium'
            ]"
          >
            Inversiones ({{ conteoPorTipo.inversiones }})
          </button>
          <button
            type="button"
            @click="filtroTab = 'gasto'"
            :class="[
              'px-3.5 py-2 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer',
              filtroTab === 'gasto' ? 'bg-surface-container-lowest text-tertiary shadow-sm font-semibold' : 'text-on-surface-variant font-medium'
            ]"
          >
            Gastos ({{ conteoPorTipo.gastos }})
          </button>
          <button
            type="button"
            @click="filtroTab = 'ingreso'"
            :class="[
              'px-3.5 py-2 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer',
              filtroTab === 'ingreso' ? 'bg-surface-container-lowest text-on-surface shadow-sm font-semibold' : 'text-on-surface-variant font-medium'
            ]"
          >
            Ingresos ({{ conteoPorTipo.ingresos }})
          </button>
        </div>

        <div class="relative w-full sm:w-64">
          <input
            v-model="busqueda"
            type="text"
            placeholder="Buscar categoría..."
            class="w-full bg-surface-container-lowest text-on-surface placeholder:text-outline text-xs px-3.5 py-2.5 pl-9 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 shadow-sm"
          />
          <span class="material-symbols-outlined absolute left-2.5 top-2 text-outline text-[17px]">search</span>
        </div>
      </div>

      <!-- Main 2-Column Split -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div class="lg:col-span-4 lg:sticky lg:top-24 self-start">
          <div class="p-6 sm:p-7 rounded-2xl bg-surface-container-lowest shadow-sm">
            <div class="flex items-center justify-between pb-5">
              <div>
                <span class="text-[11px] font-semibold tracking-widest uppercase text-primary">
                  {{ editandoId ? 'Edición' : 'Catálogo Global' }}
                </span>
                <h2 class="font-headline text-2xl text-on-surface font-medium">
                  {{ editandoId ? 'Editar Categoría' : 'Nueva Categoría' }}
                </h2>
              </div>
              <div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[18px]">edit_note</span>
              </div>
            </div>

            <form class="space-y-4" @submit.prevent="guardarCategoria">
              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Nombre de la Categoría
                </label>
                <input
                  ref="inputNombreRef"
                  v-model="form.nombre"
                  required
                  type="text"
                  placeholder="Ej: Compra Activos / Cripto"
                  class="w-full bg-surface-container-low text-on-surface text-sm px-3.5 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-outline/70 transition-all"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Tipo de Flujo
                </label>
                <div class="grid grid-cols-3 gap-2 p-1 rounded-lg bg-surface-container-low">
                  <label class="cursor-pointer">
                    <input v-model="form.tipo" class="peer sr-only" name="flow_type" type="radio" value="inversion" />
                    <div class="py-2 text-center rounded-md text-xs font-medium text-on-surface-variant peer-checked:bg-surface-container-lowest peer-checked:text-primary peer-checked:shadow-sm transition-all">
                      Inversión
                    </div>
                  </label>
                  <label class="cursor-pointer">
                    <input v-model="form.tipo" class="peer sr-only" name="flow_type" type="radio" value="gasto" />
                    <div class="py-2 text-center rounded-md text-xs font-medium text-on-surface-variant peer-checked:bg-surface-container-lowest peer-checked:text-tertiary peer-checked:shadow-sm transition-all">
                      Gasto
                    </div>
                  </label>
                  <label class="cursor-pointer">
                    <input v-model="form.tipo" class="peer sr-only" name="flow_type" type="radio" value="ingreso" />
                    <div class="py-2 text-center rounded-md text-xs font-medium text-on-surface-variant peer-checked:bg-surface-container-lowest peer-checked:text-on-surface peer-checked:shadow-sm transition-all">
                      Ingreso
                    </div>
                  </label>
                </div>
              </div>

              <label
                v-if="form.tipo === 'inversion'"
                class="flex items-center gap-2.5 p-3 rounded-lg bg-primary-fixed/40 border border-primary/20 cursor-pointer text-xs text-on-surface"
              >
                <input v-model="form.requiere_activo" type="checkbox" class="accent-primary w-4 h-4 cursor-pointer" />
                <span>Solicitar símbolo y cantidad de activo/cripto al registrar movimientos</span>
              </label>

              <div class="flex gap-2 pt-2">
                <button
                  v-if="editandoId"
                  type="button"
                  @click="resetForm"
                  class="px-4 py-3 bg-surface-container hover:bg-surface-container-high text-on-surface-variant rounded-lg text-xs font-semibold uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="guardando"
                  :class="[
                    'flex-1 inline-flex items-center justify-center gap-2 text-on-primary py-3 rounded-lg font-body text-xs font-semibold uppercase tracking-wider transition-all shadow-sm cursor-pointer',
                    exitoMsg ? 'bg-on-surface' : 'bg-primary hover:bg-primary/90'
                  ]"
                >
                  <span class="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>{{ exitoMsg ? 'Guardada' : editandoId ? 'Actualizar' : 'Guardar Categoría' }}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Lista de Categorías -->
        <div class="lg:col-span-8 space-y-3">
          <div v-if="categoriasFiltradas.length === 0" class="p-10 rounded-2xl bg-surface-container-lowest text-center text-sm text-secondary shadow-sm">
            No se encontraron categorías para el filtro seleccionado.
          </div>

          <div
            v-for="cat in categoriasFiltradas"
            :key="cat.id"
            class="p-5 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-low/70 transition-all group shadow-sm"
          >
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div class="flex items-center gap-3.5">
                <div
                  class="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  :class="claseIconoCategoria(cat.tipo)"
                >
                  <span class="material-symbols-outlined text-[22px]">
                    {{ cat.tipo === 'inversion' ? 'trending_up' : cat.tipo === 'gasto' ? 'shopping_bag' : 'payments' }}
                  </span>
                </div>

                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="font-headline text-lg text-on-surface font-semibold tracking-tight">
                      {{ cat.nombre }}
                    </h4>
                    <span
                      class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded"
                      :class="claseBadgeCategoria(cat.tipo)"
                    >
                      {{ cat.tipo || 'general' }}
                    </span>
                    <span
                      v-if="cat.requiere_activo"
                      class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-surface-container text-primary"
                    >
                      Activo / Cripto
                    </span>
                  </div>
                  <p class="text-xs text-on-surface-variant mt-0.5">
                    {{ resumenPorCategoria(cat.id).cantidad }} movimientos en {{ monedaActiva }}
                  </p>
                </div>
              </div>

              <div class="flex items-center justify-between sm:justify-end gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-outline-variant/20">
                <div class="sm:text-right">
                  <div class="font-headline text-lg font-semibold text-on-surface font-mono">
                    {{ simbolo }}{{ resumenPorCategoria(cat.id).total.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
                  </div>
                  <div class="text-[11px] text-on-surface-variant">Acumulado {{ monedaActiva }}</div>
                </div>

                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    @click="seleccionarEditar(cat)"
                    title="Editar Categoría"
                    class="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                  >
                    <span class="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    type="button"
                    @click="borrarCategoria(cat.id)"
                    title="Eliminar Categoría"
                    class="p-2 rounded-lg bg-surface-container-low hover:bg-error-container text-on-surface-variant hover:text-error transition-colors cursor-pointer"
                  >
                    <span class="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>