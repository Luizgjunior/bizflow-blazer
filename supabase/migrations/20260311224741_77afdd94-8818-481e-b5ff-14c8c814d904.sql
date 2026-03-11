
-- Fix user_roles policies (also restrictive)
DROP POLICY IF EXISTS "Admin global can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;

CREATE POLICY "Admin global can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (is_admin_global())
WITH CHECK (is_admin_global());

CREATE POLICY "Users can read own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());
