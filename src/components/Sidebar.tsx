import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Warehouse,
  ShoppingCart,
  Users,
  Building,
  CheckSquare,
  BarChart3,
  CreditCard,
  Settings,
  ChevronLeft,
  LogOut,
  Menu,
  UserPlus,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import OrganizationSwitcher from "./OrganizationSwitcher";
import { useAuth } from "@/contexts/AuthContext";

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

// Define navigation with role restrictions
const getNavigation = (isAdmin: boolean) => {
  // Base navigation available to all authenticated users
  const baseNav = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, adminOnly: false },
    { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart, adminOnly: false },
    { name: "Approvals", href: "/approvals", icon: CheckSquare, adminOnly: false },
    { name: "Shipments", href: "/shipments", icon: Truck, adminOnly: false },
  ];

  // Admin-only navigation items
  const adminNav = [
    { name: "Products", href: "/products", icon: Package, adminOnly: true },
    { name: "SKUs", href: "/skus", icon: Boxes, adminOnly: true },
    { name: "Inventory", href: "/inventory", icon: Warehouse, adminOnly: true },
    { name: "Suppliers", href: "/suppliers", icon: Users, adminOnly: true },
    { name: "Warehouses", href: "/warehouses", icon: Building, adminOnly: true },
    { name: "Reports", href: "/reports", icon: BarChart3, adminOnly: true },
    { name: "User Management", href: "/users", icon: UserPlus, adminOnly: true },
  ];

  if (isAdmin) {
    return [...baseNav, ...adminNav];
  }
  
  return baseNav;
};

const getSecondaryNav = (isAdmin: boolean) => {
  const base = [
    { name: "Settings", href: "/settings", icon: Settings, adminOnly: false },
  ];
  
  if (isAdmin) {
    return [
      { name: "Billing", href: "/billing", icon: CreditCard, adminOnly: true },
      ...base,
    ];
  }
  
  return base;
};

const Sidebar = ({ collapsed, onCollapse }: SidebarProps) => {
  const navigate = useNavigate();
  const { signOut, isAdmin, user } = useAuth();

  const navigation = getNavigation(isAdmin);
  const secondaryNav = getSecondaryNav(isAdmin);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const NavItem = ({ item }: { item: typeof navigation[0] }) => {
    const content = (
      <NavLink
        to={item.href}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isActive
              ? "bg-sidebar-accent text-sidebar-primary font-medium"
              : "text-sidebar-foreground"
          )
        }
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.name}</span>}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-normal">
            {item.name}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
        {!collapsed && <OrganizationSwitcher />}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCollapse(!collapsed)}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Role Badge */}
      {!collapsed && user && (
        <div className="px-3 py-2 border-b border-sidebar-border">
          <div className={cn(
            "text-xs font-medium px-2 py-1 rounded-full text-center",
            isAdmin 
              ? "bg-primary/20 text-primary" 
              : "bg-muted text-muted-foreground"
          )}>
            {isAdmin ? "Admin" : "User"}
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              <NavItem item={item} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Secondary Navigation */}
      <div className="px-2 pb-3">
        <Separator className="my-2 bg-sidebar-border" />
        <ul className="space-y-1">
          {secondaryNav.map((item) => (
            <li key={item.name}>
              <NavItem item={item} />
            </li>
          ))}
        </ul>
        <Separator className="my-2 bg-sidebar-border" />
        
        {/* Logout */}
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="w-full h-9 text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Logout</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
