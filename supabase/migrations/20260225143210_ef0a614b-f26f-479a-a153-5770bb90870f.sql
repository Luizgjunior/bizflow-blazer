
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
  _empresa_nome text;
  _plano text;
BEGIN
  _empresa_nome := NEW.raw_user_meta_data->>'empresa_nome';
  _plano := COALESCE(NEW.raw_user_meta_data->>'plano', 'starter');

  -- Create tenant if empresa_nome is provided
  IF _empresa_nome IS NOT NULL AND _empresa_nome != '' THEN
    INSERT INTO public.tenants (nome, plano)
    VALUES (_empresa_nome, _plano)
    RETURNING id INTO _tenant_id;
  END IF;

  -- Create profile linked to tenant
  INSERT INTO public.profiles (id, email, nome, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    _tenant_id
  );

  -- Assign empresa role if tenant was created
  IF _tenant_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'empresa');
  END IF;

  RETURN NEW;
END;
$$;
