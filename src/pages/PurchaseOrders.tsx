import { useState } from "react";
import { Plus, Search, Filter, MoreHorizontal, ShoppingCart, Clock, CheckCircle, XCircle } from "lucide-react";
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
import { cn } from "@/lib/utils";

// Demo data
const demoPurchaseOrders = [
  { id: "PO-2024-001", supplier: "Tech Distributors Inc", status: "approved", totalCost: 45890.00, itemCount: 12, createdAt: "2024-01-18", createdBy: "John Doe" },
  { id: "PO-2024-002", supplier: "Global Electronics", status: "submitted", totalCost: 23450.50, itemCount: 8, createdAt: "2024-01-17", createdBy: "Jane Smith" },
  { id: "PO-2024-003", supplier: "Prime Wholesale", status: "draft", totalCost: 67200.00, itemCount: 24, createdAt: "2024-01-16", createdBy: "Mike Johnson" },
  { id: "PO-2024-004", supplier: "Tech Distributors Inc", status: "received", totalCost: 34100.00, itemCount: 15, createdAt: "2024-01-12", createdBy: "John Doe" },
  { id: "PO-2024-005", supplier: "Eastern Supply Co", status: "cancelled", totalCost: 12800.00, itemCount: 5, createdAt: "2024-01-10", createdBy: "Sarah Wilson" },
];

const PurchaseOrders = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrders = demoPurchaseOrders.filter(
    (order) =>
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.supplier.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "draft":
        return { icon: Clock, label: "Draft", className: "bg-muted text-muted-foreground" };
      case "submitted":
        return { icon: Clock, label: "Pending Approval", className: "bg-warning/10 text-warning" };
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

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">Create and manage purchase orders</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create PO
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Draft", count: 1, color: "text-muted-foreground" },
          { label: "Pending", count: 1, color: "text-warning" },
          { label: "Approved", count: 1, color: "text-primary" },
          { label: "Received", count: 1, color: "text-accent" },
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

      {/* Purchase Orders Table */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>All Purchase Orders</CardTitle>
          <CardDescription>
            {filteredOrders.length} orders found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 opacity-50" />
                      <p>No purchase orders found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const statusConfig = getStatusConfig(order.status);
                  const StatusIcon = statusConfig.icon;
                  return (
                    <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <span className="font-medium">{order.id}</span>
                      </TableCell>
                      <TableCell>{order.supplier}</TableCell>
                      <TableCell>{order.itemCount} items</TableCell>
                      <TableCell className="font-medium">
                        ${order.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("gap-1", statusConfig.className)}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{new Date(order.createdAt).toLocaleDateString()}</p>
                          <p className="text-muted-foreground text-xs">{order.createdBy}</p>
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
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            {order.status === "draft" && (
                              <DropdownMenuItem>Submit for Approval</DropdownMenuItem>
                            )}
                            {order.status === "submitted" && (
                              <>
                                <DropdownMenuItem>Approve</DropdownMenuItem>
                                <DropdownMenuItem>Reject</DropdownMenuItem>
                              </>
                            )}
                            {order.status === "approved" && (
                              <DropdownMenuItem>Mark as Received</DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive">Cancel</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PurchaseOrders;
