-- Create pending_users table for signup requests awaiting admin approval
CREATE TABLE public.pending_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  requested_role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID
);

-- Enable Row Level Security
ALTER TABLE public.pending_users ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view and manage pending users
CREATE POLICY "Admins can manage pending users" 
ON public.pending_users 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy: Anyone can insert (for signup requests)
CREATE POLICY "Anyone can request signup" 
ON public.pending_users 
FOR INSERT 
WITH CHECK (true);

-- Policy: Users can view their own pending request
CREATE POLICY "Users can view own pending request" 
ON public.pending_users 
FOR SELECT 
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));