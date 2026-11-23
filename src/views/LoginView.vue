<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'

const authStore = useAuthStore()
const router = useRouter()

const esRegistro = ref(false)
const email = ref('')
const password = ref('')
const mostrarPassword = ref(false)
const errorMsg = ref('')
const infoMsg = ref('')
const logoUrl = import.meta.env.BASE_URL + 'logo.jpg'

async function handleAuthSubmit() {
  errorMsg.value = ''
  infoMsg.value = ''
  try {
    if (esRegistro.value) {
      await authStore.register(email.value, password.value)
      if (!authStore.isAuthenticated) {
        infoMsg.value = 'Cuenta creada. Revisá tu correo para confirmar o iniciá sesión.'
        esRegistro.value = false
        return
      }
    } else {
      await authStore.login(email.value, password.value)
    }
    router.push(authStore.isAdmin ? '/dashboard' : '/cartera')
  } catch (err) {
    errorMsg.value = err.message || 'No se pudo verificar las credenciales'
  }
}
</script>

<template>
  <div class="bg-surface font-body text-on-surface min-h-screen flex flex-col justify-center">
    <header class="w-full pt-6 pb-2 flex items-center justify-center">
      <div class="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface-container-low shadow-[0_1px_8px_rgba(58,48,42,0.04)]">
        <span class="w-2 h-2 rounded-full bg-primary"></span>
        <span class="font-headline text-lg tracking-wide text-on-surface font-medium">Gestor Financiero</span>
      </div>
    </header>

    <main class="w-full flex items-center justify-center px-6 py-6">
      <div class="relative w-full max-w-xl flex flex-col items-center">
        <div class="absolute -top-16 -left-12 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
        <div class="absolute -bottom-16 -right-12 w-64 h-64 bg-primary-fixed-dim/20 rounded-full blur-3xl pointer-events-none -z-10"></div>

        <div class="w-full bg-surface-container-lowest rounded-2xl shadow-[0_4px_30px_rgba(58,48,42,0.06)] px-8 sm:px-12 py-10 transition-all">
          <div class="flex flex-col items-center text-center">
            <div class="mb-2 flex justify-center">
              <img
                :src="logoUrl"
                alt="Logo Gestor Financiero"
                class="h-28 sm:h-32 w-auto object-contain mix-blend-multiply transition-transform duration-300 hover:scale-105"
              />
            </div>

            <span class="text-[11px] font-label font-bold tracking-[0.22em] text-primary uppercase mb-2">
              Portal Patrimonial Privado
            </span>
            <h1 class="font-headline text-3xl sm:text-4xl font-medium tracking-tight text-on-surface leading-tight">
              Gestor Financiero
            </h1>
            <p class="font-body text-secondary text-sm sm:text-base mt-2 max-w-sm font-normal leading-relaxed">
              Control patrimonial sereno, gestión de gastos y rentabilidad de inversiones.
            </p>
          </div>

          <div class="mt-8 p-1 bg-surface-container-low rounded-xl flex items-center shadow-inner">
            <button
              type="button"
              @click="esRegistro = false; errorMsg = ''; infoMsg = ''"
              :class="[
                'flex-1 py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer',
                !esRegistro
                  ? 'bg-surface-container-lowest text-on-surface shadow-[0_1px_6px_rgba(58,48,42,0.08)]'
                  : 'text-secondary hover:text-on-surface'
              ]"
            >
              <span class="material-symbols-outlined text-[17px]" :class="!esRegistro ? 'text-primary' : ''">login</span>
              <span>Iniciar sesión</span>
            </button>

            <button
              type="button"
              @click="esRegistro = true; errorMsg = ''; infoMsg = ''"
              :class="[
                'flex-1 py-2.5 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer',
                esRegistro
                  ? 'bg-surface-container-lowest text-on-surface shadow-[0_1px_6px_rgba(58,48,42,0.08)]'
                  : 'text-secondary hover:text-on-surface'
              ]"
            >
              <span class="material-symbols-outlined text-[17px]" :class="esRegistro ? 'text-primary' : ''">badge</span>
              <span>Registrarse</span>
            </button>
          </div>

          <form class="mt-7 space-y-5" @submit.prevent="handleAuthSubmit">
            <div class="flex flex-col gap-1.5 text-left">
              <label class="font-label text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase px-0.5" for="email-field">
                Correo Electrónico
              </label>
              <div class="relative flex items-center">
                <span class="material-symbols-outlined absolute left-3.5 text-secondary text-[20px] pointer-events-none">
                  alternate_email
                </span>
                <input
                  id="email-field"
                  v-model="email"
                  type="email"
                  required
                  placeholder="usuario@ort.edu.ar"
                  class="w-full pl-11 pr-4 py-3 bg-surface-container-low hover:bg-surface-container/70 focus:bg-surface-container-lowest text-on-surface text-sm rounded-xl outline-none focus:ring-2 focus:ring-primary/40 transition-all font-body border-none"
                />
              </div>
            </div>

            <div class="flex flex-col gap-1.5 text-left">
              <label class="font-label text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase px-0.5" for="password-field">
                Contraseña
              </label>
              <div class="relative flex items-center">
                <span class="material-symbols-outlined absolute left-3.5 text-secondary text-[20px] pointer-events-none">
                  lock
                </span>
                <input
                  id="password-field"
                  v-model="password"
                  :type="mostrarPassword ? 'text' : 'password'"
                  required
                  minlength="6"
                  placeholder="••••••••••••"
                  class="w-full pl-11 pr-11 py-3 bg-surface-container-low hover:bg-surface-container/70 focus:bg-surface-container-lowest text-on-surface text-sm rounded-xl outline-none focus:ring-2 focus:ring-primary/40 transition-all font-body tracking-wider border-none"
                />
                <button
                  type="button"
                  @click="mostrarPassword = !mostrarPassword"
                  aria-label="Alternar visibilidad de contraseña"
                  class="absolute right-3.5 text-secondary hover:text-on-surface transition-colors p-1 flex items-center justify-center focus:outline-none bg-transparent cursor-pointer"
                >
                  <span class="material-symbols-outlined text-[19px]">
                    {{ mostrarPassword ? 'visibility_off' : 'visibility' }}
                  </span>
                </button>
              </div>
            </div>

            <div v-if="errorMsg" class="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-medium flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">error</span>
              <span>{{ errorMsg }}</span>
            </div>

            <div v-if="infoMsg" class="p-3 rounded-xl bg-primary-fixed text-on-primary-fixed-variant text-xs font-medium flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px]">info</span>
              <span>{{ infoMsg }}</span>
            </div>

            <div class="pt-2">
              <button
                type="submit"
                :disabled="authStore.loading"
                class="w-full py-3.5 px-6 rounded-xl bg-primary hover:bg-on-primary-fixed-variant active:scale-[0.99] text-on-primary font-medium text-sm tracking-wide shadow-[0_4px_16px_rgba(194,101,42,0.28)] transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-60"
              >
                <span>
                  {{
                    authStore.loading
                      ? 'Verificando credenciales...'
                      : esRegistro
                      ? 'Crear cuenta personal'
                      : 'Ingresar al sistema'
                  }}
                </span>
                <span class="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-1">
                  arrow_forward
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>