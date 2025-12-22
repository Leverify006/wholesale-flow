-- Fix function search path for update_inventory_timestamp
CREATE OR REPLACE FUNCTION public.update_inventory_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;