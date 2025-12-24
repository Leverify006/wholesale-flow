-- Create the default organization "Wholesale FBA" if it doesn't exist
INSERT INTO public.organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Wholesale FBA')
ON CONFLICT (id) DO NOTHING;

-- Create a function to auto-assign users to the default organization
CREATE OR REPLACE FUNCTION public.auto_assign_user_to_default_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_org_id UUID := '00000000-0000-0000-0000-000000000001';
  requested_role app_role;
BEGIN
  -- Get the requested role from user metadata, default to 'viewer'
  requested_role := COALESCE(
    (NEW.raw_user_meta_data ->> 'requested_role')::app_role,
    'viewer'::app_role
  );
  
  -- Assign the user to the default organization with their requested role
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (NEW.id, default_org_id, requested_role)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign users on signup
DROP TRIGGER IF EXISTS on_auth_user_created_assign_org ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_org
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_user_to_default_org();