import { useState } from "react";
import { Search, Filter, CheckCircle, XCircle, Clock, ShoppingCart, Eye } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const Approvals = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const { user, organizationId, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pending approval POs
  const { data: pendingPOs = [], isLoading } = useQuery({
    queryKey: ["pending_approvals", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          suppliers(name)
        `)
        .eq("organization_id", organizationId)
        .eq("status", "submitted")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId && isAdmin,
  });

  // Fetch all POs for history
  const { data: allPOs = [] } = useQuery({
    queryKey: ["all_po_approvals", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          suppliers(name)
        `)
        .eq("organization_id", organizationId)
        .in("status", ["approved", "rejected"])
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId && isAdmin,
  });

  // Approve PO mutation
  const approveMutation = useMutation({
    mutationFn: async (poId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("purchase_orders")
        .update({ 
          status: "approved",
          approved_by: user.id 
        })
        .eq("id", poId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_approvals"] });
      queryClient.invalidateQueries({ queryKey: ["all_po_approvals"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["approved_pos"] });
      toast({
        title: "PO Approved",
        description: "The purchase order has been approved and is now ready for shipment.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve PO.",
        variant: "destructive",
      });
    },
  });

  // Reject PO mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ poId, reason }: { poId: string; reason?: string }) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: "rejected" })
        .eq("id", poId);
      
      if (error) throw error;

      // Log rejection reason to audit logs
      if (reason && organizationId) {
        await supabase.from("audit_logs").insert({
          organization_id: organizationId,
          user_id: user?.id,
          action: "po_rejected",
          entity_type: "purchase_order",
          entity_id: poId,
          metadata: { reason },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_approvals"] });
      queryClient.invalidateQueries({ queryKey: ["all_po_approvals"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      setIsRejectDialogOpen(false);
      setSelectedPO(null);
      setRejectReason("");
      toast({
        title: "PO Rejected",
        description: "The purchase order has been rejected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject PO.",
        variant: "destructive",
      });
    },
  });

  const filteredPOs = pendingPOs.filter(
    (po: any) =>
      po.po_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.suppliers?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApprove = (po: any) => {
    approveMutation.mutate(po.id);
  };

  const handleOpenReject = (po: any) => {
    setSelectedPO(po);
    setIsRejectDialogOpen(true);
  };

  const handleReject = () => {
    if (selectedPO) {
      rejectMutation.mutate({ poId: selectedPO.id, reason: rejectReason });
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">
              Only administrators can manage approvals.
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
          <h1 className="text-3xl font-bold tracking-tight">Approvals</h1>
          <p className="text-muted-foreground">Review and approve purchase orders</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-warning/10 text-warning">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">{pendingPOs.length}</p>
              <p className="text-sm text-muted-foreground">Pending Approval</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10 text-primary">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                {allPOs.filter((po: any) => po.status === "approved").length}
              </p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">
                {allPOs.filter((po: any) => po.status === "rejected").length}
              </p>
              <p className="text-sm text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by PO number or supplier..."
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

      {/* Pending Approvals Table */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Pending Approvals
          </CardTitle>
          <CardDescription>
            {filteredPOs.length} purchase orders awaiting your approval
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
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPOs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <CheckCircle className="h-8 w-8 opacity-50" />
                        <p>No pending approvals</p>
                        <p className="text-sm">All purchase orders have been reviewed</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPOs.map((po: any) => (
                    <TableRow key={po.id} className="hover:bg-muted/50">
                      <TableCell>
                        <span className="font-medium">{po.po_number || po.id.slice(0, 8)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {po.suppliers?.name || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        ${(po.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{new Date(po.created_at).toLocaleDateString()}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleApprove(po)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleOpenReject(po)}
                            disabled={rejectMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Decisions Table */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Recent Decisions</CardTitle>
          <CardDescription>
            History of approved and rejected purchase orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allPOs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No decisions made yet
                  </TableCell>
                </TableRow>
              ) : (
                allPOs.map((po: any) => (
                  <TableRow key={po.id} className="hover:bg-muted/50">
                    <TableCell>
                      <span className="font-medium">{po.po_number || po.id.slice(0, 8)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {po.suppliers?.name || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      ${(po.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "gap-1",
                        po.status === "approved" 
                          ? "bg-primary/10 text-primary" 
                          : "bg-destructive/10 text-destructive"
                      )}>
                        {po.status === "approved" ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {po.status === "approved" ? "Approved" : "Rejected"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(po.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject PO {selectedPO?.po_number || selectedPO?.id?.slice(0, 8)}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Enter a reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject PO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Approvals;
