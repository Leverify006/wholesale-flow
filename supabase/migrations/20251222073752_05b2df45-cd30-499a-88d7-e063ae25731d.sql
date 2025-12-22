-- Create shipments table
CREATE TABLE public.shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  purchase_order_id UUID REFERENCES public.purchase_orders(id),
  tracking_number TEXT,
  carrier TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  shipped_at TIMESTAMP WITH TIME ZONE,
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  actual_arrival TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Org members can view shipments"
ON public.shipments
FOR SELECT
USING (is_org_member(auth.uid(), organization_id));

CREATE POLICY "Admins can manage shipments"
ON public.shipments
FOR ALL
USING (has_role(auth.uid(), organization_id, 'admin'::app_role));

-- Add po_number column to purchase_orders if not exists
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS po_number TEXT;

-- Add po_date column to purchase_orders if not exists
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS po_date DATE DEFAULT CURRENT_DATE;

-- Create trigger for updated_at
CREATE TRIGGER update_shipments_updated_at
BEFORE UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.update_inventory_timestamp();