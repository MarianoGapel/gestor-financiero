<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'
import { useFinanceStore } from '@/stores/useFinanceStore'
import NavBar from '@/components/NavBar.vue'

const route = useRoute()
const authStore = useAuthStore()
const financeStore = useFinanceStore()

const mostrarNav = computed(() => authStore.isAuthenticated && route.name !== 'Login')

watch(
  () => authStore.user?.id,
  async (nuevoId, anteriorId) => {
    if (anteriorId && nuevoId !== anteriorId) {
      financeStore.limpiarDatos()
    }
    if (nuevoId) {
      await Promise.all([financeStore.cargarTodo(), financeStore.cargarPreciosCripto()])
    } else {
      financeStore.limpiarDatos()
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="min-h-screen bg-surface text-on-surface flex flex-col">
    <NavBar v-if="mostrarNav" />

    <!-- Banner de Carga -->
    <div
      v-if="mostrarNav && financeStore.loading"
      class="bg-primary-fixed/60 border-b border-primary/20 px-4 py-2 text-center text-xs font-medium text-primary flex items-center justify-center gap-2"
    >
      <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
      <span>Sincronizando datos financieros...</span>
    </div>

    <!-- Banner de Error con Reintento -->
    <div
      v-if="mostrarNav && financeStore.error"
      class="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-12 pt-4"
    >
      <div class="p-4 rounded-xl bg-error-container text-on-error-container flex items-center justify-between gap-4 text-xs">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">error</span>
          <span>No se pudieron cargar los datos: <strong>{{ financeStore.error }}</strong></span>
        </div>
        <button
          type="button"
          @click="financeStore.cargarTodo()"
          class="px-3 py-1.5 rounded-lg bg-tertiary text-white font-semibold uppercase tracking-wider cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    </div>

    <main class="flex-1">
      <RouterView />
    </main>
  </div>
</template>