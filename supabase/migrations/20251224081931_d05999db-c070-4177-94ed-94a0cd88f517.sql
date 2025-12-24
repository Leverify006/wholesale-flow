-- Drop the problematic RLS policies on pending_users
DROP POLICY IF EXISTS "Admins can manage pending users" ON public.pending_users;
DROP POLICY IF EXISTS "Users can view own pending request" ON public.pending_users;

-- Create fixed admin policy using has_role function with default org
CREATE POLICY "Admins can manage pending users" 
ON public.pending_users 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'::app_role
  )
);

-- Create a simpler policy for users to view their own pending request (by email match with profile)
CREATE POLICY "Users can view own pending request" 
ON public.pending_users 
FOR SELECT 
TO authenticated
USING (
  email = (
    SELECT email FROM auth.users WHERE id = auth.uid()
  )::text
);