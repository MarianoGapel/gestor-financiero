import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFinanceStore } from '@/stores/useFinanceStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { hoyLocal, escaparCeldaCSV } from '@/composables/useFormatters'
import { sugerirClasificacion } from '@/composables/useSmartCategorizer'

const mockInsert = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: mockInsert
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-test-1' } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null })
    }
  }
}))

vi.mock('vue-chartjs', () => ({
  Bar: { name: 'Bar', template: '<canvas data-testid="bar-chart"></canvas>' }
}))

describe('Suite Integral — Gestor Financiero (PNT II)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mockInsert.mockReset()
    mockInsert.mockResolvedValue({ error: null })
  })

  it('calcula saldo contable y efectivo líquido disponible descontando inversiones por cuenta', () => {
    const store = useFinanceStore()

    store.cuentas = [
      { id: 'c-usd', nombre: 'Binance', tipo: 'crypto', moneda: 'USD', saldo_inicial: 1000 },
      { id: 'c-ars', nombre: 'Banco ARS', tipo: 'banco', moneda: 'ARS', saldo_inicial: 2000000 }
    ]

    store.transacciones = [
      { id: 't1', cuenta_id: 'c-usd', tipo: 'inversion', monto: 400 },
      { id: 't2', cuenta_id: 'c-ars', tipo: 'gasto', monto: 300000 }
    ]

    expect(store.saldoActualCuenta(store.cuentas[0])).toBe(1000)
    expect(store.efectivoDisponibleCuenta(store.cuentas[0])).toBe(600)
    expect(store.saldoActualCuenta(store.cuentas[1])).toBe(1700000)

    store.monedaSeleccionada = 'USD'
    expect(store.patrimonioTotal).toBe(1000)
    expect(store.totalInvertido).toBe(400)
  })

  it('calcula tenencia, ganancia/pérdida en carteraActivos y patrimonioMercado', () => {
    const store = useFinanceStore()
    store.monedaSeleccionada = 'USD'
    store.cuentas = [{ id: 'c1', nombre: 'Binance', tipo: 'crypto', moneda: 'USD', saldo_inicial: 1000 }]
    store.transacciones = [
      {
        id: 'tx-eth',
        cuenta_id: 'c1',
        tipo: 'inversion',
        monto: 400,
        activo_simbolo: 'ETH',
        activo_cantidad: 1,
        fecha: '2026-11-20'
      }
    ]
    store.preciosCripto.ETH.USD = 500

    expect(store.carteraActivos).toHaveLength(1)
    expect(store.carteraActivos[0].valorActual).toBe(500)
    expect(store.carteraActivos[0].gananciaPerdida).toBe(100)
    expect(store.patrimonioTotal).toBe(1000)
    expect(store.patrimonioMercado).toBe(1100)
  })

  it('agrupa resumenPorMoneda solo para divisas con cuentas o movimientos activos', () => {
    const store = useFinanceStore()
    store.cuentas = [
      { id: 'c1', nombre: 'Santander', tipo: 'banco', moneda: 'USD', saldo_inicial: 5000 },
      { id: 'c2', nombre: 'MercadoPago', tipo: 'banco', moneda: 'ARS', saldo_inicial: 100000 }
    ]
    store.transacciones = [
      { id: 't1', cuenta_id: 'c1', tipo: 'inversion', monto: 2500 }
    ]

    const resumen = store.resumenPorMoneda
    expect(resumen.map((r) => r.moneda)).toEqual(['USD', 'ARS'])
    expect(resumen[0].porcentajeInvertido).toBe(50)
    expect(resumen[1].porcentajeInvertido).toBe(0)
  })

  it('evalúa correctamente los permisos de usuario estándar y administrador en useAuthStore', () => {
    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.isAdmin).toBe(false)

    auth.user = { id: 'u1', email: 'demo@ort.edu.ar' }
    auth.rol = 'usuario'
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isAdmin).toBe(false)

    auth.rol = 'admin'
    expect(auth.isAdmin).toBe(true)
  })

  it('limpia sesión, rol y datos financieros en memoria al ejecutar logout()', async () => {
    const auth = useAuthStore()
    const finance = useFinanceStore()

    auth.user = { id: 'u1', email: 'demo@ort.edu.ar' }
    auth.rol = 'admin'
    finance.cuentas = [{ id: 'c1', nombre: 'Cuenta Test', moneda: 'USD', saldo_inicial: 1000 }]
    finance.transacciones = [{ id: 't1', cuenta_id: 'c1', tipo: 'ingreso', monto: 500 }]
    finance.categorias = [{ id: 'cat1', nombre: 'Sueldo', tipo: 'ingreso' }]

    await auth.logout()

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.isAdmin).toBe(false)
    expect(finance.cuentas).toHaveLength(0)
    expect(finance.transacciones).toHaveLength(0)
    expect(finance.categorias).toHaveLength(0)
  })

  it('propaga errores de Supabase al fallar agregarTransaccion()', async () => {
    const store = useFinanceStore()
    mockInsert.mockResolvedValueOnce({ error: new Error('violates row-level security policy') })

    await expect(
      store.agregarTransaccion({ cuenta_id: 'c1', tipo: 'gasto', monto: 100, fecha: '2026-11-23' })
    ).rejects.toThrow('violates row-level security policy')
  })

  it('genera fecha local YYYY-MM-DD y sanitiza celdas CSV contra fórmulas y comillas', () => {
    expect(hoyLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(escaparCeldaCSV('Cuenta "Principal"')).toBe('"Cuenta ""Principal"""')
    expect(escaparCeldaCSV('=SUM(A1:A10)')).toBe('"\'=SUM(A1:A10)"')
  })

  it('clasifica palabras completas sin falsos positivos como ADA en empanadas o SOL en gasolina', () => {
    const cats = [
      { id: 'cat-super', nombre: 'Supermercado', tipo: 'gasto' },
      { id: 'cat-transp', nombre: 'Transporte', tipo: 'gasto' },
      { id: 'cat-cripto', nombre: 'Compra Activo / Cripto', tipo: 'inversion' }
    ]

    const resEmpanadas = sugerirClasificacion('Compré empanadas en Coto', cats)
    expect(resEmpanadas?.tipo).toBe('gasto')
    expect(resEmpanadas?.categoriaId).toBe('cat-super')

    const resGasolina = sugerirClasificacion('Cargué gasolina en YPF', cats)
    expect(resGasolina?.tipo).toBe('gasto')
    expect(resGasolina?.categoriaId).toBe('cat-transp')

    const resAda = sugerirClasificacion('Compré 100 ADA en Binance', cats)
    expect(resAda?.tipo).toBe('inversion')
    expect(resAda?.categoriaId).toBe('cat-cripto')
  })

  it('protege /dashboard en Vue Router redirigiendo usuarios no admin a /cartera', async () => {
    const { default: router } = await import('@/router/index.js')
    const auth = useAuthStore()

    auth.initialized = true
    auth.user = { id: 'u-normal', email: 'usuario@ort.edu.ar' }
    auth.rol = 'usuario'

    await router.push('/dashboard')
    expect(router.currentRoute.value.path).toBe('/cartera')
  })
})