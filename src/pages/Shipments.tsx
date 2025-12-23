import { useState } from "react";
import { Plus, Search, Filter, MoreHorizontal, Truck, Clock, CheckCircle, Package, MapPin, Link } from "lucide-react";
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
  DropdownMenuSeparator,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const Shipments = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newShipment, setNewShipment] = useState({
    tracking_number: "",
    carrier: "",
    purchase_order_id: "",
    notes: "",
  });
  const { user, organizationId, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch shipments
  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["shipments", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("shipments")
        .select(`
          *,
          purchase_orders:purchase_order_id(po_number, total_cost, suppliers(name))
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Fetch approved purchase orders for shipment creation
  const { data: approvedPOs = [] } = useQuery({
    queryKey: ["approved_pos", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      // Get POs that are approved but don't have shipments yet
      const { data: existingShipments } = await supabase
        .from("shipments")
        .select("purchase_order_id")
        .eq("organization_id", organizationId);
      
      const usedPOIds = (existingShipments || []).map((s: any) => s.purchase_order_id).filter(Boolean);
      
      let query = supabase
        .from("purchase_orders")
        .select("id, po_number, total_cost, suppliers(name)")
        .eq("organization_id", organizationId)
        .eq("status", "approved");
      
      if (usedPOIds.length > 0) {
        query = query.not("id", "in", `(${usedPOIds.join(",")})`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId && isAdmin,
  });

  // Create shipment mutation
  const createShipmentMutation = useMutation({
    mutationFn: async (shipmentData: typeof newShipment) => {
      if (!organizationId || !user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("shipments")
        .insert({
          organization_id: organizationId,
          tracking_number: shipmentData.tracking_number,
          carrier: shipmentData.carrier,
          purchase_order_id: shipmentData.purchase_order_id || null,
          notes: shipmentData.notes || null,
          created_by: user.id,
          status: "pending",
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["approved_pos"] });
      setIsCreateDialogOpen(false);
      setNewShipment({ tracking_number: "", carrier: "", purchase_order_id: "", notes: "" });
      toast({
        title: "Shipment Created",
        description: "Your shipment has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create shipment.",
        variant: "destructive",
      });
    },
  });

  // Update shipment status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, updates }: { id: string; status: string; updates?: Record<string, any> }) => {
      const { error } = await supabase
        .from("shipments")
        .update({ status, ...updates })
        .eq("id", id);
      
      if (error) throw error;

      // If delivered, also update the PO to received
      if (status === "delivered") {
        const shipment = shipments.find((s: any) => s.id === id);
        if (shipment?.purchase_order_id) {
          await supabase
            .from("purchase_orders")
            .update({ status: "received" })
            .eq("id", shipment.purchase_order_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast({
        title: "Shipment Updated",
        description: "Shipment status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update shipment.",
        variant: "destructive",
      });
    },
  });

  const filteredShipments = shipments.filter(
    (shipment: any) =>
      shipment.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.carrier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.purchase_orders?.po_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return { icon: Clock, label: "Pending", className: "bg-muted text-muted-foreground", next: "in_transit" };
      case "in_transit":
        return { icon: Truck, label: "In Transit", className: "bg-warning/10 text-warning", next: "delivered" };
      case "delivered":
        return { icon: CheckCircle, label: "Delivered", className: "bg-primary/10 text-primary", next: null };
      case "cancelled":
        return { icon: Package, label: "Cancelled", className: "bg-destructive/10 text-destructive", next: null };
      default:
        return { icon: Clock, label: status, className: "bg-muted text-muted-foreground", next: null };
    }
  };

  const statusCounts = {
    pending: shipments.filter((s: any) => s.status === "pending").length,
    in_transit: shipments.filter((s: any) => s.status === "in_transit").length,
    delivered: shipments.filter((s: any) => s.status === "delivered").length,
  };

  const handleCreateShipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShipment.tracking_number.trim()) return;
    createShipmentMutation.mutate(newShipment);
  };

  const getNextStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Mark as Shipped";
      case "in_transit": return "Mark as Delivered";
      default: return null;
    }
  };

  // Only admins can access shipments
  if (!isAdmin) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm max-w-md">
          <CardContent className="p-8 text-center">
            <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">
              Only administrators can manage shipments.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipments</h1>
          <p className="text-muted-foreground">Track and manage shipments from approved POs</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Shipment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateShipment}>
              <DialogHeader>
                <DialogTitle>Create Shipment</DialogTitle>
                <DialogDescription>
                  Create a new shipment from an approved purchase order.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_order" className="flex items-center gap-2">
                    <Link className="h-4 w-4" />
                    Link to Approved PO *
                  </Label>
                  <Select
                    value={newShipment.purchase_order_id}
                    onValueChange={(value) => setNewShipment({ ...newShipment, purchase_order_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select approved PO" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvedPOs.length === 0 ? (
                        <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                          No approved POs available
                        </div>
                      ) : (
                        approvedPOs.map((po: any) => (
                          <SelectItem key={po.id} value={po.id}>
                            <div className="flex flex-col">
                              <span>{po.po_number || po.id.slice(0, 8)}</span>
                              <span className="text-xs text-muted-foreground">
                                {po.suppliers?.name} • ${po.total_cost?.toLocaleString()}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tracking_number">Tracking Number *</Label>
                  <Input
                    id="tracking_number"
                    placeholder="1Z999AA10123456784"
                    value={newShipment.tracking_number}
                    onChange={(e) => setNewShipment({ ...newShipment, tracking_number: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="carrier">Carrier</Label>
                  <Select
                    value={newShipment.carrier}
                    onValueChange={(value) => setNewShipment({ ...newShipment, carrier: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select carrier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ups">UPS</SelectItem>
                      <SelectItem value="fedex">FedEx</SelectItem>
                      <SelectItem value="usps">USPS</SelectItem>
                      <SelectItem value="dhl">DHL</SelectItem>
                      <SelectItem value="amazon">Amazon Logistics</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes..."
                    value={newShipment.notes}
                    onChange={(e) => setNewShipment({ ...newShipment, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createShipmentMutation.isPending || !newShipment.purchase_order_id}
                >
                  {createShipmentMutation.isPending ? "Creating..." : "Create Shipment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Pending", count: statusCounts.pending, color: "text-muted-foreground", icon: Clock },
          { label: "In Transit", count: statusCounts.in_transit, color: "text-warning", icon: Truck },
          { label: "Delivered", count: statusCounts.delivered, color: "text-primary", icon: CheckCircle },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn("p-3 rounded-lg bg-muted/50", stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className={cn("text-2xl font-bold", stat.color)}>{stat.count}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
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
                placeholder="Search by tracking number, carrier, or PO..."
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

      {/* Shipments Table */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>All Shipments</CardTitle>
          <CardDescription>
            {filteredShipments.length} shipments found
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
                  <TableHead>Tracking Number</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Linked PO</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShipments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Truck className="h-8 w-8 opacity-50" />
                        <p>No shipments found</p>
                        {approvedPOs.length > 0 ? (
                          <Button variant="outline" size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                            Create your first shipment
                          </Button>
                        ) : (
                          <p className="text-sm">Approve a PO first to create shipments</p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredShipments.map((shipment: any) => {
                    const statusConfig = getStatusConfig(shipment.status);
                    const StatusIcon = statusConfig.icon;
                    const nextStatusLabel = getNextStatusLabel(shipment.status);
                    
                    return (
                      <TableRow key={shipment.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <span className="font-medium font-mono">{shipment.tracking_number}</span>
                        </TableCell>
                        <TableCell className="capitalize">{shipment.carrier || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {shipment.purchase_orders?.po_number || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {shipment.purchase_orders?.suppliers?.name || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("gap-1", statusConfig.className)}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{new Date(shipment.created_at).toLocaleDateString()}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover">
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              {nextStatusLabel && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      const updates: Record<string, any> = {};
                                      if (shipment.status === "pending") {
                                        updates.shipped_at = new Date().toISOString();
                                      } else if (shipment.status === "in_transit") {
                                        updates.actual_arrival = new Date().toISOString();
                                      }
                                      updateStatusMutation.mutate({ 
                                        id: shipment.id, 
                                        status: statusConfig.next!,
                                        updates
                                      });
                                    }}
                                  >
                                    {nextStatusLabel}
                                  </DropdownMenuItem>
                                </>
                              )}
                              {shipment.status !== "delivered" && shipment.status !== "cancelled" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => updateStatusMutation.mutate({ id: shipment.id, status: "cancelled" })}
                                    className="text-destructive"
                                  >
                                    Cancel Shipment
                                  </DropdownMenuItem>
                                </>
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

export default Shipments;
