-- Create app_role enum for role-based access control
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'purchasing', 'warehouse', 'accounting', 'viewer');

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- USER PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- USER ROLES (separate table to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

-- WAREHOUSES
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SUPPLIERS
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  contact_email TEXT,
  payment_terms TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  brand TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SKUS
CREATE TABLE public.skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  sku TEXT NOT NULL,
  asin TEXT,
  fnsku TEXT,
  cost NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, sku)
);

-- INVENTORY
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID REFERENCES public.skus(id) ON DELETE CASCADE NOT NULL,
  warehouse_id UUID REFERENCES public.warehouses(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sku_id, warehouse_id)
);

-- PURCHASE ORDERS
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('draft', 'submitted', 'approved', 'received', 'cancelled')) DEFAULT 'draft',
  total_cost NUMERIC(12,2),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PURCHASE ORDER ITEMS
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  sku_id UUID REFERENCES public.skus(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(10,2)
);

-- APPROVALS
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT,
  current_period_end TIMESTAMPTZ,
  UNIQUE (organization_id)
);

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _org_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = _role
  )
$$;

-- Function to check if user is member of org
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;

-- Function to get user's role in an org
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID, _org_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
    AND organization_id = _org_id
  LIMIT 1
$$;

-- PROFILES POLICIES
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ORGANIZATIONS POLICIES
CREATE POLICY "Org members can view their orgs"
ON public.organizations FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create orgs"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- USER ROLES POLICIES
CREATE POLICY "Users can view roles in their orgs"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), organization_id, 'admin'));

-- WAREHOUSES POLICIES
CREATE POLICY "Org members can view warehouses"
ON public.warehouses FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can manage warehouses"
ON public.warehouses FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), organization_id, 'admin'));

-- SUPPLIERS POLICIES
CREATE POLICY "Org members can view suppliers"
ON public.suppliers FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins and purchasing can manage suppliers"
ON public.suppliers FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), organization_id, 'admin') OR
  public.has_role(auth.uid(), organization_id, 'purchasing')
);

-- PRODUCTS POLICIES
CREATE POLICY "Org members can view products"
ON public.products FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins and purchasing can manage products"
ON public.products FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), organization_id, 'admin') OR
  public.has_role(auth.uid(), organization_id, 'purchasing')
);

-- SKUS POLICIES
CREATE POLICY "Org members can view SKUs"
ON public.skus FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins and purchasing can manage SKUs"
ON public.skus FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), organization_id, 'admin') OR
  public.has_role(auth.uid(), organization_id, 'purchasing')
);

-- INVENTORY POLICIES
CREATE POLICY "Org members can view inventory"
ON public.inventory FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Warehouse and admins can manage inventory"
ON public.inventory FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), organization_id, 'admin') OR
  public.has_role(auth.uid(), organization_id, 'warehouse')
);

-- PURCHASE ORDERS POLICIES
CREATE POLICY "Org members can view POs"
ON public.purchase_orders FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Purchasing can create POs"
ON public.purchase_orders FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), organization_id, 'admin') OR
  public.has_role(auth.uid(), organization_id, 'purchasing')
);

CREATE POLICY "Manager and admin can update POs"
ON public.purchase_orders FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), organization_id, 'admin') OR
  public.has_role(auth.uid(), organization_id, 'manager')
);

-- PURCHASE ORDER ITEMS POLICIES
CREATE POLICY "Org members can view PO items"
ON public.purchase_order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
    AND public.is_org_member(auth.uid(), po.organization_id)
  )
);

CREATE POLICY "Purchasing can manage PO items"
ON public.purchase_order_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_id
    AND (
      public.has_role(auth.uid(), po.organization_id, 'admin') OR
      public.has_role(auth.uid(), po.organization_id, 'purchasing')
    )
  )
);

-- APPROVALS POLICIES
CREATE POLICY "Org members can view approvals"
ON public.approvals FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "Managers and admins can manage approvals"
ON public.approvals FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), organization_id, 'admin') OR
  public.has_role(auth.uid(), organization_id, 'manager')
);

-- AUDIT LOGS POLICIES
CREATE POLICY "Org members can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_org_member(auth.uid(), organization_id));

-- SUBSCRIPTIONS POLICIES
CREATE POLICY "Admins can view subscriptions"
ON public.subscriptions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), organization_id, 'admin'));

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to create org and assign admin role
CREATE OR REPLACE FUNCTION public.create_organization_with_admin(org_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  INSERT INTO public.organizations (name)
  VALUES (org_name)
  RETURNING id INTO new_org_id;
  
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (auth.uid(), new_org_id, 'admin');
  
  RETURN new_org_id;
END;
$$;

-- Trigger to update inventory timestamp
CREATE OR REPLACE FUNCTION public.update_inventory_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inventory_timestamp();