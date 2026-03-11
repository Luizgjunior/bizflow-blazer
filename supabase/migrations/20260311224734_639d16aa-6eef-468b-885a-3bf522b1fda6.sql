
-- Drop all existing restrictive policies on profiles
DROP POLICY IF EXISTS "Admin global can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Empresa can read tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admin global can manage all profiles"
ON public.profiles FOR ALL
TO authenticated
USING (is_admin_global())
WITH CHECK (is_admin_global());

CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Empresa can read tenant profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());
