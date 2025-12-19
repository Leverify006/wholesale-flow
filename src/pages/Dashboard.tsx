import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ShoppingCart,
  Warehouse,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: React.ElementType;
  trend: "up" | "down" | "neutral";
}

const KpiCard = ({ title, value, change, changeLabel, icon: Icon, trend }: KpiCardProps) => {
  const isPositive = trend === "up";
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:border-border transition-colors">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          <Badge
            variant="secondary"
            className={cn(
              "text-xs px-1.5 py-0 h-5 gap-0.5",
              isPositive ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {Math.abs(change)}%
          </Badge>
          <span className="text-xs text-muted-foreground">{changeLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
};

const kpiData: KpiCardProps[] = [
  {
    title: "Total Revenue",
    value: "$245,890",
    change: 12.5,
    changeLabel: "from last month",
    icon: DollarSign,
    trend: "up",
  },
  {
    title: "Active Products",
    value: "1,248",
    change: 8.2,
    changeLabel: "from last month",
    icon: Package,
    trend: "up",
  },
  {
    title: "Pending Orders",
    value: "34",
    change: -5.4,
    changeLabel: "from last week",
    icon: ShoppingCart,
    trend: "down",
  },
  {
    title: "Inventory Value",
    value: "$892,450",
    change: 15.3,
    changeLabel: "from last month",
    icon: Warehouse,
    trend: "up",
  },
];

const Dashboard = () => {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your wholesale operations
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Charts placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Monthly revenue for the current year</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <BarChart className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Chart will be available when backend is connected</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Inventory by Category</CardTitle>
            <CardDescription>Distribution of inventory across categories</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <PieChartIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Chart will be available when backend is connected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest updates across your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { action: "Purchase Order #1234 approved", time: "2 minutes ago", type: "success" },
              { action: "New product SKU added: B08N5WRWNW", time: "15 minutes ago", type: "info" },
              { action: "Inventory received at Main Warehouse", time: "1 hour ago", type: "success" },
              { action: "Low stock alert: Product XYZ-123", time: "3 hours ago", type: "warning" },
              { action: "Supplier payment processed", time: "5 hours ago", type: "info" },
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    activity.type === "success" && "bg-accent",
                    activity.type === "warning" && "bg-warning",
                    activity.type === "info" && "bg-info"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{activity.action}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Placeholder icons for charts
const BarChart = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="12" width="4" height="8" rx="1" />
    <rect x="10" y="8" width="4" height="12" rx="1" />
    <rect x="17" y="4" width="4" height="16" rx="1" />
  </svg>
);

const PieChartIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a10 10 0 0 1 10 10h-10z" />
  </svg>
);

export default Dashboard;
