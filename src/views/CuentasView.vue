<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useFinanceStore } from '@/stores/useFinanceStore'
import { hoyLocal, escaparCeldaCSV } from '@/composables/useFormatters'

const financeStore = useFinanceStore()
const router = useRouter()

const editandoId = ref(null)
const guardando = ref(false)
const exitoMsg = ref(false)

const monedaActiva = computed(() => financeStore.monedaSeleccionada || 'USD')
const simbolo = computed(() => financeStore.simboloMoneda(monedaActiva.value))

const form = ref({
  nombre: '',
  tipo: 'banco',
  moneda: monedaActiva.value,
  saldo_inicial: ''
})

const totalCripto = computed(() =>
  financeStore.cuentasMonedaActiva
    .filter((c) => c.tipo === 'crypto')
    .reduce((acc, c) => acc + financeStore.saldoActualCuenta(c), 0)
)

const totalBancos = computed(() =>
  financeStore.cuentasMonedaActiva
    .filter((c) => c.tipo === 'banco' || c.tipo === 'broker')
    .reduce((acc, c) => acc + financeStore.saldoActualCuenta(c), 0)
)

const totalEfectivo = computed(() =>
  financeStore.cuentasMonedaActiva
    .filter((c) => c.tipo === 'efectivo')
    .reduce((acc, c) => acc + financeStore.saldoActualCuenta(c), 0)
)

const cuentaEditandoTieneMovimientos = computed(() => {
  if (!editandoId.value) return false
  return financeStore.transacciones.some((t) => t.cuenta_id === editandoId.value)
})

function porcentajeSobreTotal(monto) {
  if (financeStore.patrimonioTotal <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((monto / financeStore.patrimonioTotal) * 100)))
}

function anchoPorcentaje(monto) {
  return porcentajeSobreTotal(monto) + '%'
}

function etiquetaTipo(tipo) {
  const mapa = {
    crypto: 'Billetera Cripto',
    banco: 'Banca Tradicional',
    broker: 'Broker / Inversiones',
    efectivo: 'Efectivo / Custodia'
  }
  return mapa[tipo] || 'Cuenta Patrimonial'
}

function iconoTipo(tipo) {
  const mapa = {
    crypto: 'currency_bitcoin',
    banco: 'account_balance',
    broker: 'monitoring',
    efectivo: 'payments'
  }
  return mapa[tipo] || 'account_balance_wallet'
}

function resetForm() {
  editandoId.value = null
  form.value = {
    nombre: '',
    tipo: 'banco',
    moneda: monedaActiva.value,
    saldo_inicial: ''
  }
}

function seleccionarEditar(cuenta) {
  editandoId.value = cuenta.id
  form.value = {
    nombre: cuenta.nombre,
    tipo: cuenta.tipo || 'banco',
    moneda: (cuenta.moneda || 'USD').toUpperCase(),
    saldo_inicial: Number(cuenta.saldo_inicial || 0)
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function guardarCuenta() {
  if (!form.value.nombre.trim()) return
  guardando.value = true
  try {
    const monedaGuardada = (form.value.moneda || 'USD').toUpperCase()
    const payload = {
      nombre: form.value.nombre.trim(),
      tipo: form.value.tipo,
      moneda: monedaGuardada,
      saldo_inicial: Number(form.value.saldo_inicial) || 0
    }
    if (editandoId.value) {
      await financeStore.editarCuenta(editandoId.value, payload)
    } else {
      await financeStore.agregarCuenta(payload)
    }
    financeStore.monedaSeleccionada = monedaGuardada
    resetForm()
    exitoMsg.value = true
    setTimeout(() => (exitoMsg.value = false), 2000)
  } catch (err) {
    alert('Error al guardar la cuenta: ' + err.message)
  } finally {
    guardando.value = false
  }
}

async function borrarCuenta(id) {
  if (!confirm('¿Eliminar esta cuenta patrimonial?')) return
  try {
    await financeStore.eliminarCuenta(id)
  } catch (err) {
    alert('No se pudo eliminar la cuenta (verificá que no tenga movimientos asociados): ' + err.message)
  }
}

function exportarBalanceCSV() {
  const encabezados = ['Cuenta', 'Tipo', 'Moneda', 'Saldo_Inicial', 'Saldo_Actual']
  const filas = financeStore.cuentas.map((c) => [
    escaparCeldaCSV(c.nombre),
    escaparCeldaCSV(c.tipo || 'banco'),
    escaparCeldaCSV((c.moneda || 'USD').toUpperCase()),
    Number(c.saldo_inicial || 0),
    financeStore.saldoActualCuenta(c)
  ])
  const csv = [encabezados.join(','), ...filas.map((f) => f.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `balance_cuentas_${hoyLocal()}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<template>
  <div class="flex flex-col w-full">
    <div class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 py-8 lg:py-10 space-y-10">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div class="space-y-3">
          <div class="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-secondary uppercase font-body">
            <span>Contabilidad</span>
            <span class="text-primary">•</span>
            <span>Cartera en {{ monedaActiva }}</span>
          </div>
          <h1 class="font-headline text-3xl sm:text-5xl text-on-surface font-normal tracking-tight leading-[1.08]">
            Cuentas <span class="italic font-light text-primary">— Balance en {{ monedaActiva }}</span>
          </h1>
          <p class="text-secondary text-sm sm:text-base max-w-2xl font-body font-light leading-relaxed">
            Saldo actual recalculado automáticamente a partir del saldo de apertura más ingresos y menos gastos de cada cuenta.
          </p>
        </div>

        <button
          type="button"
          @click="exportarBalanceCSV"
          class="inline-flex items-center gap-2 px-5 py-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-lg text-xs font-semibold tracking-wider uppercase transition-colors self-start md:self-auto cursor-pointer"
        >
          <span class="material-symbols-outlined text-[18px] text-primary">file_download</span>
          <span>Exportar Balance CSV</span>
        </button>
      </div>

      <!-- KPI Bento Bar -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="relative overflow-hidden bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs text-secondary font-medium tracking-wide uppercase">
            <span>Consolidado ({{ monedaActiva }})</span>
            <span class="material-symbols-outlined text-primary text-xl">account_balance_wallet</span>
          </div>
          <div class="mt-4">
            <div class="font-headline text-3xl text-on-surface font-medium tracking-tight">
              {{ simbolo }}{{ financeStore.patrimonioTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
            </div>
            <p class="text-xs text-secondary mt-1.5">
              {{ financeStore.cuentasMonedaActiva.length }} entidades en {{ monedaActiva }}
            </p>
          </div>
          <div class="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mt-5 flex">
            <div class="bg-primary h-full transition-all" :style="{ width: anchoPorcentaje(totalCripto) }"></div>
            <div class="bg-primary-container h-full transition-all" :style="{ width: anchoPorcentaje(totalBancos) }"></div>
            <div class="bg-secondary-fixed-dim h-full transition-all" :style="{ width: anchoPorcentaje(totalEfectivo) }"></div>
          </div>
        </div>

        <div class="bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs text-secondary font-medium tracking-wide uppercase">
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-primary"></span> Cripto / Custodia</span>
            <span class="text-[11px] font-semibold text-primary px-2 py-0.5 bg-primary-fixed rounded">
              {{ porcentajeSobreTotal(totalCripto) }}%
            </span>
          </div>
          <div class="mt-4">
            <div class="font-headline text-3xl text-on-surface font-medium tracking-tight">
              {{ simbolo }}{{ totalCripto.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
            </div>
            <p class="text-xs text-secondary mt-1.5">Exchanges y Cold Wallets ({{ monedaActiva }})</p>
          </div>
        </div>

        <div class="bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs text-secondary font-medium tracking-wide uppercase">
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-primary-container"></span> Bancos y Brokers</span>
            <span class="text-[11px] font-semibold text-on-secondary-container px-2 py-0.5 bg-secondary-container rounded">
              {{ porcentajeSobreTotal(totalBancos) }}%
            </span>
          </div>
          <div class="mt-4">
            <div class="font-headline text-3xl text-on-surface font-medium tracking-tight">
              {{ simbolo }}{{ totalBancos.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
            </div>
            <p class="text-xs text-secondary mt-1.5">Cuentas bancarias y bursátiles ({{ monedaActiva }})</p>
          </div>
        </div>

        <div class="bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between text-xs text-secondary font-medium tracking-wide uppercase">
            <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-outline"></span> Liquidez Física</span>
            <span class="text-[11px] font-semibold text-on-surface-variant px-2 py-0.5 bg-surface-container-high rounded">
              {{ porcentajeSobreTotal(totalEfectivo) }}%
            </span>
          </div>
          <div class="mt-4">
            <div class="font-headline text-3xl text-on-surface font-medium tracking-tight">
              {{ simbolo }}{{ totalEfectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 }) }}
            </div>
            <p class="text-xs text-secondary mt-1.5">Reserva líquida en efectivo ({{ monedaActiva }})</p>
          </div>
        </div>
      </div>

      <!-- Workspace: Grilla de Entidades + Formulario -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div class="lg:col-span-8 space-y-5">
          <div class="flex items-center justify-between">
            <h2 class="font-headline text-2xl text-on-surface tracking-tight">
              Entidades en {{ monedaActiva }}
            </h2>
            <span class="text-xs font-medium text-secondary uppercase tracking-widest">
              {{ financeStore.cuentasMonedaActiva.length }} registradas
            </span>
          </div>

          <div
            v-if="financeStore.cuentasMonedaActiva.length === 0"
            class="rounded-2xl bg-surface-container-lowest p-10 text-center text-sm text-secondary shadow-sm"
          >
            No tenés cuentas registradas en {{ monedaActiva }}. Cambiá la moneda arriba o creá una nueva desde el formulario.
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div
              v-for="cuenta in financeStore.cuentasMonedaActiva"
              :key="cuenta.id"
              class="group bg-surface-container-lowest rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden"
            >
              <div>
                <div class="flex items-start justify-between gap-3 mb-4">
                  <div class="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                    <span class="material-symbols-outlined text-xl">{{ iconoTipo(cuenta.tipo) }}</span>
                  </div>
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-surface-container-high text-on-surface-variant tracking-wider uppercase">
                    {{ (cuenta.moneda || 'USD').toUpperCase() }}
                  </span>
                </div>

                <p class="text-xs font-semibold tracking-wider uppercase text-secondary">
                  {{ etiquetaTipo(cuenta.tipo) }}
                </p>
                <h3 class="font-headline text-xl text-on-surface font-semibold tracking-tight mt-0.5">
                  {{ cuenta.nombre }}
                </h3>

                <div class="mt-4">
                  <div class="font-headline text-3xl text-on-surface tracking-tight font-medium">
                    {{ financeStore.simboloMoneda(cuenta.moneda) }}{{
                      financeStore.saldoActualCuenta(cuenta).toLocaleString('es-AR', { minimumFractionDigits: 2 })
                    }}
                  </div>
                  <p class="text-[11px] text-secondary mt-1">
                    Apertura: {{ financeStore.simboloMoneda(cuenta.moneda) }}{{
                      Number(cuenta.saldo_inicial || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })
                    }}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 pt-5 mt-6 bg-surface-container-low/60 -mx-6 -mb-6 p-3.5 px-6 rounded-b-2xl">
                <button
                  type="button"
                  @click="seleccionarEditar(cuenta)"
                  class="flex-1 py-2 text-xs font-semibold tracking-wider text-primary uppercase hover:bg-surface-container transition-colors rounded-md text-center cursor-pointer"
                >
                  Editar
                </button>
                <button
                  type="button"
                  @click="router.push({ path: '/transacciones', query: { cuenta: cuenta.id } })"
                  class="flex-1 py-2 text-xs font-semibold tracking-wider text-secondary uppercase hover:text-on-surface hover:bg-surface-container transition-colors rounded-md text-center cursor-pointer"
                >
                  Movimientos
                </button>
                <button
                  type="button"
                  @click="borrarCuenta(cuenta.id)"
                  title="Eliminar cuenta"
                  class="p-2 text-secondary hover:text-error hover:bg-error-container/60 transition-colors rounded-md cursor-pointer"
                >
                  <span class="material-symbols-outlined text-[17px]">delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Formulario Registrar / Editar Cuenta -->
        <div class="lg:col-span-4 bg-surface-container-lowest rounded-2xl p-6 sm:p-7 shadow-sm">
          <div class="space-y-1 mb-6">
            <span class="text-[10px] font-semibold tracking-widest uppercase text-primary">
              {{ editandoId ? 'Modificación' : 'Registro Veloz' }}
            </span>
            <h2 class="font-headline text-2xl text-on-surface font-medium">
              {{ editandoId ? 'Editar Cuenta' : 'Nueva Cuenta' }}
            </h2>
            <p class="text-xs text-secondary font-light">
              Incorporá o actualizá una cartera en tu esquema patrimonial.
            </p>
          </div>

          <form class="space-y-4" @submit.prevent="guardarCuenta">
            <div>
              <label class="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
                Nombre de la Cuenta
              </label>
              <input
                v-model="form.nombre"
                required
                class="w-full bg-surface-container-low px-4 py-2.5 rounded-lg text-sm text-on-surface placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                placeholder="Ej. Binance, Santander USD, MercadoPago..."
                type="text"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
                Tipo de Entidad
              </label>
              <div class="relative">
                <select
                  v-model="form.tipo"
                  class="w-full appearance-none bg-surface-container-low px-4 py-2.5 rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all pr-8 cursor-pointer"
                >
                  <option value="banco">Banco Tradicional</option>
                  <option value="broker">Broker / Inversión Bursátil</option>
                  <option value="crypto">Billetera Cripto / Vault</option>
                  <option value="efectivo">Efectivo / Caja Física</option>
                </select>
                <span class="material-symbols-outlined absolute right-3 top-3 text-secondary pointer-events-none text-base">
                  expand_more
                </span>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
                  Moneda Base
                </label>
                <div class="relative">
                  <select
                    v-model="form.moneda"
                    :disabled="cuentaEditandoTieneMovimientos"
                    class="w-full appearance-none bg-surface-container-low px-4 py-2.5 rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all pr-8 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="USD">Dólares (USD)</option>
                    <option value="USDT">USDT</option>
                    <option value="ARS">Pesos (ARS)</option>
                    <option value="EUR">Euros (EUR)</option>
                  </select>
                  <span class="material-symbols-outlined absolute right-3 top-3 text-secondary pointer-events-none text-base">
                    expand_more
                  </span>
                </div>
                <span v-if="cuentaEditandoTieneMovimientos" class="text-[11px] text-tertiary mt-1 block">
                  Divisa bloqueada: esta cuenta ya tiene movimientos registrados.
                </span>
              </div>

              <div>
                <label class="block text-xs font-semibold text-secondary uppercase tracking-wider mb-1.5">
                  Saldo Inicial
                </label>
                <input
                  v-model.number="form.saldo_inicial"
                  required
                  step="0.01"
                  type="number"
                  placeholder="0.00"
                  class="w-full bg-surface-container-low px-4 py-2.5 rounded-lg text-sm text-on-surface placeholder:text-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-mono"
                />
              </div>
            </div>

            <div class="flex gap-2 pt-2">
              <button
                v-if="editandoId"
                type="button"
                @click="resetForm"
                class="px-4 py-3.5 bg-surface-container hover:bg-surface-container-high text-on-surface-variant rounded-lg text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                :disabled="guardando"
                :class="[
                  'flex-1 py-3.5 text-on-primary rounded-lg text-xs font-semibold tracking-wider uppercase shadow-sm transition-all cursor-pointer',
                  exitoMsg ? 'bg-on-surface' : 'bg-primary hover:bg-primary-container'
                ]"
              >
                {{ exitoMsg ? 'Guardado con éxito' : editandoId ? 'Actualizar Cuenta' : 'Guardar Cuenta' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>