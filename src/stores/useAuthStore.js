import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useFinanceStore } from '@/stores/useFinanceStore'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const rol = ref('usuario')
  const loading = ref(false)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => rol.value === 'admin')

  async function cargarPerfil(userId) {
    const { data, error } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      rol.value = 'usuario'
      return
    }
    rol.value = data?.rol === 'admin' ? 'admin' : 'usuario'
  }

  async function initAuth() {
    if (initialized.value) return
    const { data } = await supabase.auth.getSession()
    const currentUser = data?.session?.user || null
    user.value = currentUser

    if (currentUser) {
      await cargarPerfil(currentUser.id)
    } else {
      rol.value = 'usuario'
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user || null
      user.value = authUser
      if (authUser) {
        await cargarPerfil(authUser.id)
      } else {
        rol.value = 'usuario'
      }
    })

    initialized.value = true
  }

  async function login(email, password) {
    loading.value = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      user.value = data.user
      await cargarPerfil(data.user.id)
    } finally {
      loading.value = false
    }
  }

  async function register(email, password) {
    loading.value = true
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      })
      if (error) throw error
      if (!data.user) {
        throw new Error('No se pudo crear la cuenta en el servidor de autenticación.')
      }

      if (data.session) {
        user.value = data.user
        await cargarPerfil(data.user.id)
      }
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    const financeStore = useFinanceStore()
    await supabase.auth.signOut()
    user.value = null
    rol.value = 'usuario'
    financeStore.limpiarDatos()
  }

  return {
    user,
    rol,
    loading,
    initialized,
    isAuthenticated,
    isAdmin,
    initAuth,
    login,
    register,
    logout
  }
})