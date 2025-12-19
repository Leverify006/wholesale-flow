import { useState } from "react";
import { Plus, Search, Filter, MoreHorizontal, Warehouse as WarehouseIcon, AlertTriangle } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Demo data
const demoInventory = [
  { id: "1", sku: "APL-APP-001", product: "Apple AirPods Pro", warehouse: "Main Warehouse", quantity: 245, minStock: 50, maxStock: 500 },
  { id: "2", sku: "SAM-GS24-002", product: "Samsung Galaxy S24 Case", warehouse: "Main Warehouse", quantity: 32, minStock: 100, maxStock: 500 },
  { id: "3", sku: "ANK-CHG-003", product: "Anker USB-C Charger", warehouse: "East Coast DC", quantity: 890, minStock: 200, maxStock: 1000 },
  { id: "4", sku: "SNY-WH5-004", product: "Sony WH-1000XM5", warehouse: "West Coast DC", quantity: 156, minStock: 50, maxStock: 300 },
  { id: "5", sku: "LOG-MX3-005", product: "Logitech MX Master 3S", warehouse: "Main Warehouse", quantity: 78, minStock: 30, maxStock: 200 },
];

const Inventory = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredInventory = demoInventory.filter(
    (item) =>
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.warehouse.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStockStatus = (quantity: number, minStock: number, maxStock: number) => {
    const percentage = (quantity / maxStock) * 100;
    if (quantity <= minStock) return { label: "Low Stock", color: "destructive" as const, percentage };
    if (percentage >= 80) return { label: "Overstocked", color: "warning" as const, percentage };
    return { label: "In Stock", color: "success" as const, percentage };
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">Track stock levels across warehouses</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Adjust Inventory
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <WarehouseIcon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">1,401</p>
                <p className="text-sm text-muted-foreground">Total Units</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">1</p>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <WarehouseIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Warehouses</p>
              </div>
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
                placeholder="Search by SKU, product, or warehouse..."
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

      {/* Inventory Table */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Inventory Levels</CardTitle>
          <CardDescription>
            {filteredInventory.length} items tracked
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Stock Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <WarehouseIcon className="h-8 w-8 opacity-50" />
                      <p>No inventory items found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredInventory.map((item) => {
                  const status = getStockStatus(item.quantity, item.minStock, item.maxStock);
                  return (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-0.5 rounded">
                          {item.sku}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium">{item.product}</TableCell>
                      <TableCell className="text-muted-foreground">{item.warehouse}</TableCell>
                      <TableCell>{item.quantity.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="w-24">
                          <Progress
                            value={status.percentage}
                            className={cn(
                              "h-2",
                              status.color === "destructive" && "[&>div]:bg-destructive",
                              status.color === "warning" && "[&>div]:bg-warning",
                              status.color === "success" && "[&>div]:bg-accent"
                            )}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={status.color === "success" ? "default" : "secondary"}
                          className={cn(
                            status.color === "destructive" && "bg-destructive/10 text-destructive hover:bg-destructive/20",
                            status.color === "warning" && "bg-warning/10 text-warning hover:bg-warning/20",
                            status.color === "success" && "bg-accent/10 text-accent hover:bg-accent/20"
                          )}
                        >
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View History</DropdownMenuItem>
                            <DropdownMenuItem>Adjust Quantity</DropdownMenuItem>
                            <DropdownMenuItem>Transfer Stock</DropdownMenuItem>
                            <DropdownMenuItem>Create PO</DropdownMenuItem>
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

export default Inventory;
