import { useState } from "react";
import { Plus, Search, Filter, MoreHorizontal, ShoppingCart, Clock, CheckCircle, XCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface POFormData {
  po_number: string;
  supplier_id: string;
  product_id: string;
  sku_id: string;
  asin: string;
  region: string;
  quantity: number;
  cost_per_unit: number;
}

const PurchaseOrders = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPO, setNewPO] = useState<POFormData>({
    po_number: "",
    supplier_id: "",
    product_id: "",
    sku_id: "",
    asin: "",
    region: "",
    quantity: 1,
    cost_per_unit: 0,
  });
  const { user, organizationId, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("organization_id", organizationId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["products", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("organization_id", organizationId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Fetch SKUs based on selected product
  const { data: skus = [] } = useQuery({
    queryKey: ["skus", organizationId, newPO.product_id],
    queryFn: async () => {
      if (!organizationId) return [];
      let query = supabase
        .from("skus")
        .select("*")
        .eq("organization_id", organizationId);
      
      if (newPO.product_id) {
        query = query.eq("product_id", newPO.product_id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Fetch purchase orders - fixed query without invalid join
  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ["purchase_orders", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let query = supabase
        .from("purchase_orders")
        .select(`
          *,
          suppliers(name)
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      
      // Non-admins can only see their own POs
      if (!isAdmin && user) {
        query = query.eq("created_by", user.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Create purchase order mutation
  const createPOMutation = useMutation({
    mutationFn: async (poData: POFormData) => {
      if (!organizationId || !user) throw new Error("Not authenticated");
      
      const totalCost = poData.quantity * poData.cost_per_unit;
      
      const { data: poOrder, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          organization_id: organizationId,
          po_number: poData.po_number,
          po_date: new Date().toISOString().split("T")[0],
          created_by: user.id,
          status: "draft",
          supplier_id: poData.supplier_id || null,
          total_cost: totalCost,
        })
        .select()
        .single();
      
      if (poError) throw poError;

      // Create PO line item if SKU is selected
      if (poData.sku_id && poOrder) {
        const { error: itemError } = await supabase
          .from("purchase_order_items")
          .insert({
            purchase_order_id: poOrder.id,
            sku_id: poData.sku_id,
            quantity: poData.quantity,
            unit_cost: poData.cost_per_unit,
          });
        
        if (itemError) throw itemError;
      }

      return poOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      setIsCreateDialogOpen(false);
      setNewPO({
        po_number: "",
        supplier_id: "",
        product_id: "",
        sku_id: "",
        asin: "",
        region: "",
        quantity: 1,
        cost_per_unit: 0,
      });
      toast({
        title: "Purchase Order Created",
        description: "Your PO has been created as a draft.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create purchase order.",
        variant: "destructive",
      });
    },
  });

  // Update PO status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast({
        title: "Status Updated",
        description: "Purchase order status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update status.",
        variant: "destructive",
      });
    },
  });

  const filteredOrders = purchaseOrders.filter(
    (order: any) =>
      order.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "draft":
        return { icon: Clock, label: "Draft", className: "bg-muted text-muted-foreground" };
      case "submitted":
        return { icon: Send, label: "Pending Approval", className: "bg-warning/10 text-warning" };
      case "approved":
        return { icon: CheckCircle, label: "Approved", className: "bg-primary/10 text-primary" };
      case "received":
        return { icon: CheckCircle, label: "Received", className: "bg-accent/10 text-accent" };
      case "cancelled":
        return { icon: XCircle, label: "Cancelled", className: "bg-destructive/10 text-destructive" };
      default:
        return { icon: Clock, label: status, className: "bg-muted text-muted-foreground" };
    }
  };

  const statusCounts = {
    draft: purchaseOrders.filter((o: any) => o.status === "draft").length,
    submitted: purchaseOrders.filter((o: any) => o.status === "submitted").length,
    approved: purchaseOrders.filter((o: any) => o.status === "approved").length,
    received: purchaseOrders.filter((o: any) => o.status === "received").length,
  };

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPO.po_number.trim()) return;
    createPOMutation.mutate(newPO);
  };

  // Update ASIN when SKU changes
  const handleSkuChange = (skuId: string) => {
    const selectedSku = skus.find((s: any) => s.id === skuId);
    setNewPO({
      ...newPO,
      sku_id: skuId,
      asin: selectedSku?.asin || "",
      cost_per_unit: selectedSku?.cost || 0,
    });
  };

  const totalCost = newPO.quantity * newPO.cost_per_unit;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Manage all purchase orders" : "Create and view your purchase orders"}
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create PO
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleCreatePO}>
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
                <DialogDescription>
                  Create a new purchase order. It will be saved as a draft.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="po_number">PO Number *</Label>
                  <Input
                    id="po_number"
                    placeholder="PO-2024-001"
                    value={newPO.po_number}
                    onChange={(e) => setNewPO({ ...newPO, po_number: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Select
                    value={newPO.supplier_id}
                    onValueChange={(value) => setNewPO({ ...newPO, supplier_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier: any) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product">Product</Label>
                  <Select
                    value={newPO.product_id}
                    onValueChange={(value) => setNewPO({ ...newPO, product_id: value, sku_id: "", asin: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product: any) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.title} {product.brand && `(${product.brand})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Select
                    value={newPO.sku_id}
                    onValueChange={handleSkuChange}
                    disabled={!newPO.product_id && skus.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select SKU" />
                    </SelectTrigger>
                    <SelectContent>
                      {skus.map((sku: any) => (
                        <SelectItem key={sku.id} value={sku.id}>
                          {sku.sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="asin">ASIN</Label>
                  <Input
                    id="asin"
                    placeholder="B0XXXXXXXX"
                    value={newPO.asin}
                    onChange={(e) => setNewPO({ ...newPO, asin: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region">Region</Label>
                  <Select
                    value={newPO.region}
                    onValueChange={(value) => setNewPO({ ...newPO, region: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">US</SelectItem>
                      <SelectItem value="EU">EU</SelectItem>
                      <SelectItem value="UK">UK</SelectItem>
                      <SelectItem value="CA">CA</SelectItem>
                      <SelectItem value="AU">AU</SelectItem>
                      <SelectItem value="JP">JP</SelectItem>
                      <SelectItem value="MX">MX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={newPO.quantity}
                    onChange={(e) => setNewPO({ ...newPO, quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost_per_unit">Cost per Unit ($)</Label>
                  <Input
                    id="cost_per_unit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPO.cost_per_unit}
                    onChange={(e) => setNewPO({ ...newPO, cost_per_unit: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="col-span-2 p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Cost:</span>
                    <span className="text-2xl font-bold text-primary">
                      ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPOMutation.isPending}>
                  {createPOMutation.isPending ? "Creating..." : "Create PO"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Draft", count: statusCounts.draft, color: "text-muted-foreground" },
          { label: "Pending", count: statusCounts.submitted, color: "text-warning" },
          { label: "Approved", count: statusCounts.approved, color: "text-primary" },
          { label: "Received", count: statusCounts.received, color: "text-accent" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <p className={cn("text-2xl font-bold", stat.color)}>{stat.count}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders Table */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>
            {isAdmin ? "All Purchase Orders" : "Your Purchase Orders"}
          </CardTitle>
          <CardDescription>
            {filteredOrders.length} orders found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ShoppingCart className="h-8 w-8 opacity-50" />
                        <p>No purchase orders found</p>
                        <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                          Create your first PO
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order: any) => {
                    const statusConfig = getStatusConfig(order.status);
                    const StatusIcon = statusConfig.icon;
                    return (
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <span className="font-medium">{order.po_number || order.id.slice(0, 8)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {order.suppliers?.name || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("gap-1", statusConfig.className)}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          ${(order.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{new Date(order.created_at).toLocaleDateString()}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              {order.status === "draft" && (
                                <DropdownMenuItem 
                                  onClick={() => updateStatusMutation.mutate({ id: order.id, status: "submitted" })}
                                >
                                  Submit for Approval
                                </DropdownMenuItem>
                              )}
                              {isAdmin && order.status === "submitted" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => updateStatusMutation.mutate({ id: order.id, status: "approved" })}
                                  >
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => updateStatusMutation.mutate({ id: order.id, status: "cancelled" })}
                                    className="text-destructive"
                                  >
                                    Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                              {isAdmin && order.status === "approved" && (
                                <DropdownMenuItem
                                  onClick={() => updateStatusMutation.mutate({ id: order.id, status: "received" })}
                                >
                                  Mark as Received
                                </DropdownMenuItem>
                              )}
                              {isAdmin && order.status !== "cancelled" && order.status !== "received" && (
                                <DropdownMenuItem 
                                  onClick={() => updateStatusMutation.mutate({ id: order.id, status: "cancelled" })}
                                  className="text-destructive"
                                >
                                  Cancel
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PurchaseOrders;