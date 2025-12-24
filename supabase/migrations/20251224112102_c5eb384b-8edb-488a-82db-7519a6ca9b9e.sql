-- Drop the problematic policy that references auth.users
DROP POLICY IF EXISTS "Users can view own pending request" ON public.pending_users;

-- Create a security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role = 'admin'::app_role
  )
$$;

-- Update the admin policy to use the new function
DROP POLICY IF EXISTS "Admins can manage pending users" ON public.pending_users;

CREATE POLICY "Admins can manage pending users" 
ON public.pending_users 
FOR ALL 
TO authenticated
USING (public.is_admin(auth.uid()));

-- For users viewing their own request, we'll use email stored in pending_users
-- This doesn't need auth.users lookup since pending requests are pre-authentication
CREATE POLICY "Anyone can insert pending request"
ON public.pending_users 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);