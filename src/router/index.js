import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'

const routes = [
  {
    path: '/',
    redirect: '/cartera'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/cartera',
    name: 'MiCartera',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/transacciones',
    name: 'Transacciones',
    component: () => import('@/views/TransaccionesView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/cuentas',
    name: 'Cuentas',
    component: () => import('@/views/CuentasView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/dashboard',
    name: 'DashboardAdmin',
    component: () => import('@/views/CategoriasView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/categorias',
    redirect: '/dashboard'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!authStore.initialized) {
    await authStore.initAuth()
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return '/login'
  }

  if (to.meta.guestOnly && authStore.isAuthenticated) {
    return authStore.isAdmin ? '/dashboard' : '/cartera'
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return '/cartera'
  }
})

export default router