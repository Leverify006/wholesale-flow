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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const PurchaseOrders = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPO, setNewPO] = useState({ po_number: "", notes: "" });
  const { user, organizationId, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch purchase orders
  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ["purchase_orders", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let query = supabase
        .from("purchase_orders")
        .select(`
          *,
          profiles:created_by(full_name)
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
    mutationFn: async (poData: { po_number: string; notes?: string }) => {
      if (!organizationId || !user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .insert({
          organization_id: organizationId,
          po_number: poData.po_number,
          po_date: new Date().toISOString().split("T")[0],
          created_by: user.id,
          status: "draft",
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      setIsCreateDialogOpen(false);
      setNewPO({ po_number: "", notes: "" });
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
          <DialogContent>
            <form onSubmit={handleCreatePO}>
              <DialogHeader>
                <DialogTitle>Create Purchase Order</DialogTitle>
                <DialogDescription>
                  Create a new purchase order. It will be saved as a draft.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="po_number">PO Number</Label>
                  <Input
                    id="po_number"
                    placeholder="PO-2024-001"
                    value={newPO.po_number}
                    onChange={(e) => setNewPO({ ...newPO, po_number: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes..."
                    value={newPO.notes}
                    onChange={(e) => setNewPO({ ...newPO, notes: e.target.value })}
                  />
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
                  <TableHead>Status</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Created</TableHead>
                  {isAdmin && <TableHead>Created By</TableHead>}
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="h-32 text-center">
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
                        {isAdmin && (
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {order.profiles?.full_name || "Unknown"}
                            </span>
                          </TableCell>
                        )}
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