# Gestor Financiero Multi-Moneda (PNT2)

Aplicación web progresiva (**PWA**) desarrollada con **Vue 3 (Composition API)**, **Pinia**, **Vue Router**, **Tailwind CSS**, **Chart.js** y **Supabase** para la gestión integral de cuentas bancarias/billeteras, registro de movimientos contables y valuación en tiempo real de activos financieros en **USD**, **USDT**, **ARS** y **EUR**.

- **Repositorio GitHub:** https://github.com/MarianoGapel/gestor-financiero
- **Aplicación Publicada (GitHub Pages):** https://marianogapel.github.io/gestor-financiero/

---

## Stack Tecnológico

- **Frontend:** Vue 3 (`<script setup>`), Vue Router 4 (guards de autenticación y rol), Pinia (gestión de estado reactivo), Tailwind CSS.
- **Visualización y Exportación:** Chart.js (`vue-chartjs`) para comparativas mensuales y exportación a CSV / Excel.
- **Backend as a Service (BaaS):** Supabase (PostgreSQL, Auth con JWT, Row Level Security y funciones RPC `SECURITY DEFINER`).
- **PWA y Calidad:** `vite-plugin-pwa` (Service Worker + Web App Manifest) y Vitest (`@vue/test-utils`).

---

## Funcionalidades Principales

- **Carteras Aisladas por Divisa (`USD`, `USDT`, `ARS`, `EUR`):** Cálculo independiente de patrimonio al costo, efectivo líquido disponible, descubiertos y rendimiento por moneda.
- **Valuación a Precio de Mercado y PnL en Vivo:** Cotizaciones actualizadas de criptoactivos (`BTC`, `ETH`, `SOL`, `BNB`, `ADA`, `XRP`) mediante Binance API con respaldo en CryptoCompare, conversión a pesos con DolarAPI, cálculo de **PnL no realizado** en la barra superior y aviso de valuación parcial cuando un activo no tiene precio disponible.
- **Libro Mayor (`/transacciones`) y Clasificación por Reglas:** Alta, edición, duplicado y baja de movimientos con sugerencia automática de tipo y categoría mediante diccionario de palabras clave, filtro por cuenta sincronizado por URL (`?cuenta=`), alerta de efectivo disponible y exportación CSV (completa o por selección para Excel).
- **Panel Personal (`/cartera`) y Análisis de Egresos:** KPIs por período (*Últimos 30 días*, *Año actual*, *Histórico*), desglose por rubro (gastos fijos vs. variables), gráfico de barras comparativo mensual e impresión/exportación de reporte.
- **Control de Acceso por Roles (RLS + Guards):**
  - **Usuario (`usuario`):** Acceso a **Mi Cartera (`/cartera`)**, **Libro Mayor (`/transacciones`)** y **Cuentas (`/cuentas`)** con aislamiento estricto de datos por `user_id`.
  - **Administrador (`admin`):** Acceso adicional al **Dashboard Administrativo (`/dashboard`)** para gestionar el catálogo global de categorías y consultar métricas agregadas del sistema mediante la función `admin_stats()`.

---

## Guía de Instalación y Ejecución Local

### 1. Clonar el repositorio e instalar dependencias

```bash
git clone [https://github.com/MarianoGapel/gestor-financiero.git](https://github.com/MarianoGapel/gestor-financiero.git)
cd gestor-financiero
npm install
```

### 2. Configurar variables de entorno (`.env`)

Creá un archivo `.env` en la raíz del proyecto tomando como plantilla `.env.example`:

```bash
cp .env.example .env
```

Completalo con las credenciales públicas de tu proyecto en **Supabase → Project Settings → API**:

| Variable | Descripción | Ejemplo |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | URL base de la API REST y Auth de tu proyecto Supabase. | `https://xyzcompany.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clave pública anónima (`anon` / `public`), segura para el cliente gracias a las políticas RLS. | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |

### 3. Configurar la base de datos en Supabase (`supabase/schema.sql`)

1. Ingresá al panel de tu proyecto en [supabase.com](https://supabase.com) y abrí **SQL Editor → New query**.
2. Copiá y ejecutá el contenido completo de **`supabase/schema.sql`**. Este script crea:
   - Tablas `perfiles`, `cuentas`, `categorias` y `transacciones` con integridad referencial.
   - Políticas **Row Level Security (RLS)** para que cada usuario acceda únicamente a sus propios registros y solo el rol `admin` modifique categorías globales.
   - Trigger `handle_new_user()` que genera el perfil en `public.perfiles` con rol `'usuario'` al registrarse.
   - Trigger `prevent_cuenta_moneda_change()` que bloquea el cambio de divisa en cuentas que ya poseen transacciones.
   - Función RPC `admin_stats()` (`SECURITY DEFINER`) para consultar métricas globales sin exponer datos privados de otros usuarios.

### 4. Ejecutar en desarrollo y correr pruebas

```bash
# Servidor local de desarrollo (http://localhost:5173)
npm run dev

# Ejecutar suite de pruebas unitarias y de integración
npx vitest run

# Compilar bundle de producción
npm run build
```

---

## Promoción de un Usuario a Administrador

Por seguridad, todo registro nuevo desde `/login` recibe automáticamente el rol `'usuario'`. Para habilitar una cuenta con rol `'admin'`:

1. Registrá el usuario normalmente desde la pantalla `/login` de la aplicación.
2. Ejecutá la siguiente sentencia en el **SQL Editor** de Supabase:

```sql
UPDATE public.perfiles
SET rol = 'admin'
WHERE email = 'admin@ort.edu.ar';
```

3. Cerrá sesión y volvé a ingresar: la barra de navegación habilitará la pestaña **Dashboard (`/dashboard`)** y el badge de rol mostrará `ADMIN`.

---

## Explicación Detallada de los Secrets de GitHub y CI/CD

El repositorio incluye el flujo automatizado **`.github/workflows/ci-cd.yml`**, que se ejecuta en cada `push` a `main`:

1. Instala dependencias con `npm ci`.
2. Ejecuta los tests automatizados (`npx vitest run`).
3. Compila la aplicación (`npm run build`) configurando `VITE_BASE_PATH=/gestor-financiero/` para que las rutas de assets y el Service Worker funcionen bajo la subcarpeta de GitHub Pages.
4. Publica la carpeta `dist/` en **GitHub Pages**.

Como Vite inyecta las variables `VITE_*` en tiempo de compilación (*build-time*) y el archivo `.env` está excluido del repositorio por `.gitignore`, es obligatorio registrar estos **dos Secrets** en **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

| Secret en GitHub Actions | Valor requerido | Función en el pipeline |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase (`https://...supabase.co`) | Permite que el bundle compilado en GitHub Actions se conecte a la instancia de producción de Supabase. |
| `VITE_SUPABASE_ANON_KEY` | Clave pública `anon` de Supabase | Habilita la autenticación y consultas protegidas por RLS desde el frontend publicado sin exponer credenciales en el código fuente. |

---

## Configuración de GitHub Pages y Auth URLs en Supabase

1. **Activar GitHub Pages:** En tu repositorio de GitHub, entrá a **Settings → Pages** y en **Build and deployment → Source** seleccioná **GitHub Actions**.
2. **Habilitar redirecciones en Supabase:** Entrá a **Supabase → Authentication → URL Configuration** y configurá:
   - **Site URL:** `https://marianogapel.github.io/gestor-financiero/`
   - **Redirect URLs:**
     - `https://marianogapel.github.io/gestor-financiero/**`
     - `http://localhost:5173/**`

---

## Cuentas de Demostración y Recorrido Sugerido

- **Usuario estándar:** `demo@ort.edu.ar` (contraseña: `123456`) — Precargado con cuentas en `USD` y `ARS`, movimientos históricos entre agosto y noviembre de 2026 y posiciones en `BTC`, `ETH` y `SOL`.
- **Usuario administrador:** Cualquier cuenta promovida mediante el paso de SQL anterior para demostrar el CRUD de categorías globales y las métricas agregadas en `/dashboard`.