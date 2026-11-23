<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'
import { useFinanceStore } from '@/stores/useFinanceStore'

const router = useRouter()
const authStore = useAuthStore()
const financeStore = useFinanceStore()
const menuAbierto = ref(false)

const pnlTotal = computed(
  () => financeStore.patrimonioMercado - financeStore.patrimonioTotal
)

async function cerrarSesion() {
  menuAbierto.value = false
  await authStore.logout()
  router.push('/login')
}
</script>

<template>
  <header class="sticky top-0 z-40 w-full bg-surface/90 backdrop-blur-md border-b border-outline-variant/25">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 h-16 flex items-center justify-between gap-4">
      <!-- Marca & Patrimonio Rápido -->
      <div class="flex items-center gap-4">
        <RouterLink
          :to="authStore.isAdmin ? '/dashboard' : '/cartera'"
          class="inline-flex items-center gap-2 font-headline text-lg sm:text-xl font-medium text-on-surface hover:text-primary tracking-tight transition-colors"
        >
          <span class="w-2 h-2 rounded-full bg-primary"></span>
          <span>Gestor Financiero</span>
        </RouterLink>

        <!-- Selector de Divisa Activa -->
        <div class="flex items-center gap-2 pl-3 border-l border-outline-variant/30">
          <div class="hidden md:flex flex-col text-right">
            <span class="text-[9px] uppercase tracking-wider font-bold text-secondary">
              Patrimonio Costo ({{ financeStore.monedaSeleccionada }})
            </span>
            <span class="font-mono text-xs font-bold text-primary">
              {{ financeStore.simboloMoneda() }}{{
                financeStore.patrimonioTotal.toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })
              }}
              <span
                v-if="financeStore.carteraActivos.length"
                class="text-[10px] font-semibold ml-1"
                :class="pnlTotal >= 0 ? 'text-emerald-700' : 'text-tertiary'"
              >
                • PnL: {{ pnlTotal >= 0 ? '+' : '-' }}{{ financeStore.simboloMoneda() }}{{
                  Math.abs(pnlTotal).toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })
                }}
              </span>
            </span>
          </div>

          <select
            v-model="financeStore.monedaSeleccionada"
            aria-label="Seleccionar moneda activa"
            class="h-8 px-2.5 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
          >
            <option value="USD">Dólares (USD)</option>
            <option value="USDT">Tether (USDT)</option>
            <option value="ARS">Pesos (ARS)</option>
            <option value="EUR">Euros (EUR)</option>
          </select>
        </div>
      </div>

      <!-- Navegación Escritorio -->
      <nav class="hidden md:flex items-center gap-1 bg-surface-container-low p-1 rounded-xl">
        <RouterLink
          to="/cartera"
          active-class="bg-surface-container-lowest text-primary font-semibold shadow-sm"
          class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface transition-all"
        >
          Mi Cartera
        </RouterLink>
        <RouterLink
          to="/transacciones"
          active-class="bg-surface-container-lowest text-primary font-semibold shadow-sm"
          class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface transition-all"
        >
          Transacciones
        </RouterLink>
        <RouterLink
          to="/cuentas"
          active-class="bg-surface-container-lowest text-primary font-semibold shadow-sm"
          class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface transition-all"
        >
          Cuentas
        </RouterLink>
        <RouterLink
          v-if="authStore.isAdmin"
          to="/dashboard"
          active-class="bg-surface-container-lowest text-primary font-semibold shadow-sm"
          class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface transition-all"
        >
          Dashboard
        </RouterLink>
      </nav>

      <!-- Rol y Salir -->
      <div class="hidden md:flex items-center gap-3">
        <span
          class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
          :class="authStore.isAdmin ? 'bg-primary text-on-primary' : 'bg-primary-fixed text-on-primary-fixed-variant'"
        >
          {{ authStore.rol }}
        </span>
        <button
          type="button"
          @click="cerrarSesion"
          class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant hover:text-tertiary transition-colors cursor-pointer"
        >
          Salir
        </button>
      </div>

      <!-- Botón Menú Móvil -->
      <button
        type="button"
        @click="menuAbierto = !menuAbierto"
        class="md:hidden p-2 rounded-lg bg-surface-container-low text-on-surface cursor-pointer"
        aria-label="Abrir menú"
      >
        <span class="material-symbols-outlined text-[20px]">
          {{ menuAbierto ? 'close' : 'menu' }}
        </span>
      </button>
    </div>

    <!-- Menú Desplegable Móvil -->
    <div v-if="menuAbierto" class="md:hidden px-4 pt-2 pb-4 bg-surface-container-lowest border-t border-outline-variant/20 space-y-2">
      <RouterLink
        to="/cartera"
        @click="menuAbierto = false"
        active-class="bg-primary-fixed text-primary font-semibold"
        class="block px-3.5 py-2 rounded-lg text-xs font-medium text-on-surface"
      >
        Mi Cartera
      </RouterLink>
      <RouterLink
        to="/transacciones"
        @click="menuAbierto = false"
        active-class="bg-primary-fixed text-primary font-semibold"
        class="block px-3.5 py-2 rounded-lg text-xs font-medium text-on-surface"
      >
        Transacciones
      </RouterLink>
      <RouterLink
        to="/cuentas"
        @click="menuAbierto = false"
        active-class="bg-primary-fixed text-primary font-semibold"
        class="block px-3.5 py-2 rounded-lg text-xs font-medium text-on-surface"
      >
        Cuentas
      </RouterLink>
      <RouterLink
        v-if="authStore.isAdmin"
        to="/dashboard"
        @click="menuAbierto = false"
        active-class="bg-primary-fixed text-primary font-semibold"
        class="block px-3.5 py-2 rounded-lg text-xs font-medium text-on-surface"
      >
        Dashboard (Admin)
      </RouterLink>
      <div class="pt-2 border-t border-outline-variant/20 flex items-center justify-between px-2">
        <span class="text-[11px] uppercase font-bold text-secondary">Rol: {{ authStore.rol }}</span>
        <button
          type="button"
          @click="cerrarSesion"
          class="text-xs font-bold uppercase text-tertiary cursor-pointer"
        >
          Salir
        </button>
      </div>
    </div>
  </header>
</template>