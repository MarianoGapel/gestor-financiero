-- ==============================================================================
-- ESQUEMA, POLÍTICAS RLS Y DATOS INICIALES — GESTOR FINANCIERO (PNT II)
-- ==============================================================================

-- 1. Tabla de Perfiles y Roles
CREATE TABLE IF NOT EXISTS public.perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  rol text NOT NULL DEFAULT 'usuario' CHECK (rol IN ('usuario', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Función auxiliar SECURITY DEFINER para validar rol admin sin recursión en RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND rol = 'admin'
  );
$$;

-- 2. Tabla de Cuentas Patrimoniales (aislada por user_id)
CREATE TABLE IF NOT EXISTS public.cuentas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('banco', 'broker', 'crypto', 'efectivo')),
  moneda text NOT NULL DEFAULT 'USD' CHECK (moneda IN ('USD', 'USDT', 'ARS', 'EUR')),
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Tabla de Categorías (catálogo global administrado por admin)
CREATE TABLE IF NOT EXISTS public.categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ingreso', 'gasto', 'inversion')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Tabla de Transacciones (aislada por user_id + seguimiento de activos/cripto)
CREATE TABLE IF NOT EXISTS public.transacciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  cuenta_id uuid NOT NULL REFERENCES public.cuentas(id) ON DELETE RESTRICT,
  categoria_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('ingreso', 'gasto', 'inversion')),
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  descripcion text,
  fecha date NOT NULL DEFAULT current_date,
  activo_simbolo text,
  activo_cantidad numeric(18,8),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transacciones
  ADD COLUMN IF NOT EXISTS activo_simbolo text,
  ADD COLUMN IF NOT EXISTS activo_cantidad numeric(18,8);

-- ==============================================================================
-- PERMISOS DE ESQUEMA Y TABLAS PARA USUARIOS AUTENTICADOS
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.perfiles,
  public.cuentas,
  public.categorias,
  public.transacciones
TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ==============================================================================
-- ACTIVACIÓN DE ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacciones ENABLE ROW LEVEL SECURITY;

-- Políticas para PERFILES
DROP POLICY IF EXISTS "Usuarios leen su perfil y admin lee todos" ON public.perfiles;
CREATE POLICY "Usuarios leen su perfil y admin lee todos"
  ON public.perfiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Usuarios crean su propio perfil como usuario" ON public.perfiles;
CREATE POLICY "Usuarios crean su propio perfil como usuario"
  ON public.perfiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND rol = 'usuario');

-- Políticas para CUENTAS
DROP POLICY IF EXISTS "Usuarios gestionan solo sus cuentas" ON public.cuentas;
CREATE POLICY "Usuarios gestionan solo sus cuentas"
  ON public.cuentas FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Políticas para TRANSACCIONES
DROP POLICY IF EXISTS "Usuarios gestionan solo sus transacciones" ON public.transacciones;
CREATE POLICY "Usuarios gestionan solo sus transacciones"
  ON public.transacciones FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Políticas para CATEGORÍAS
DROP POLICY IF EXISTS "Usuarios autenticados leen categorias" ON public.categorias;
CREATE POLICY "Usuarios autenticados leen categorias"
  ON public.categorias FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Solo admin inserta categorias" ON public.categorias;
CREATE POLICY "Solo admin inserta categorias"
  ON public.categorias FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Solo admin actualiza categorias" ON public.categorias;
CREATE POLICY "Solo admin actualiza categorias"
  ON public.categorias FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Solo admin elimina categorias" ON public.categorias;
CREATE POLICY "Solo admin elimina categorias"
  ON public.categorias FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ==============================================================================
-- CATÁLOGO INICIAL DE CATEGORÍAS POR TIPO DE OPERACIÓN (IDEMPOTENTE)
-- ==============================================================================
INSERT INTO public.categorias (nombre, tipo)
SELECT v.nombre, v.tipo
FROM (VALUES
  ('Compra Activo / Cripto', 'inversion'),
  ('Plazo Fijo / FCI', 'inversion'),
  ('Renta Fija / Bonos', 'inversion'),
  ('Sueldo / Honorarios', 'ingreso'),
  ('Bienes Raíces', 'ingreso'),
  ('Transporte', 'gasto'),
  ('Alquiler', 'gasto'),
  ('Supermercado', 'gasto'),
  ('Servicios', 'gasto'),
  ('Impuestos', 'gasto'),
  ('Tarjeta de Crédito', 'gasto'),
  ('Indumentaria', 'gasto'),
  ('Tecnología', 'gasto'),
  ('Compras', 'gasto'),
  ('Suscripciones', 'gasto')

) AS v(nombre, tipo)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categorias c
  WHERE c.nombre = v.nombre AND c.tipo = v.tipo
);

-- ==============================================================================
-- TRIGGER AUTOMÁTICO DE PERFIL AL REGISTRAR USUARIO EN AUTH.USERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfiles (id, email, rol)
  VALUES (NEW.id, NEW.email, 'usuario')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- PROMOCIÓN CONTROLADA DE ADMINISTRADOR (ejecutar manualmente en SQL Editor)
-- ==============================================================================
-- UPDATE public.perfiles SET rol = 'admin' WHERE email = 'admin@ort.edu.ar';

-- ==============================================================================
-- ESTADÍSTICAS GLOBALES ANONIMIZADAS PARA DASHBOARD ADMINISTRATIVO
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuarios int;
  v_cuentas int;
  v_transacciones int;
  v_top_categorias jsonb;
  v_por_moneda jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin';
  END IF;

  SELECT count(*) INTO v_usuarios FROM public.perfiles;
  SELECT count(*) INTO v_cuentas FROM public.cuentas;
  SELECT count(*) INTO v_transacciones FROM public.transacciones;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_top_categorias
  FROM (
    SELECT c.nombre, c.tipo, count(tx.id)::int AS cantidad
    FROM public.categorias c
    LEFT JOIN public.transacciones tx ON tx.categoria_id = c.id
    GROUP BY c.id, c.nombre, c.tipo
    ORDER BY cantidad DESC, c.nombre ASC
    LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(m)), '[]'::jsonb)
  INTO v_por_moneda
  FROM (
    SELECT upper(coalesce(moneda, 'USD')) AS moneda, count(*)::int AS cuentas
    FROM public.cuentas
    GROUP BY upper(coalesce(moneda, 'USD'))
    ORDER BY cuentas DESC
  ) m;

  RETURN jsonb_build_object(
    'total_usuarios', v_usuarios,
    'total_cuentas', v_cuentas,
    'total_transacciones', v_transacciones,
    'top_categorias', v_top_categorias,
    'por_moneda', v_por_moneda
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;

-- ==============================================================================
-- BLOQUEAR CAMBIO DE MONEDA EN CUENTAS CON MOVIMIENTOS REGISTRADOS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.prevent_cuenta_moneda_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$ BEGIN IF NEW.moneda IS DISTINCT FROM OLD.moneda THEN IF EXISTS (SELECT 1 FROM public.transacciones WHERE cuenta_id = OLD.id) THEN RAISE EXCEPTION 'No se puede cambiar la moneda de una cuenta que ya tiene transacciones registradas'; END IF; END IF; RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_prevent_cuenta_moneda_change ON public.cuentas;
CREATE TRIGGER trg_prevent_cuenta_moneda_change
  BEFORE UPDATE OF moneda ON public.cuentas
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_cuenta_moneda_change();

  ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS requiere_activo boolean NOT NULL DEFAULT false;

UPDATE public.categorias
SET requiere_activo = true
WHERE tipo = 'inversion'
  AND (nombre ILIKE '%cripto%' OR nombre ILIKE '%activo%');