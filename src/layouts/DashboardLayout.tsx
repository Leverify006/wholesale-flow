import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { OrganizationProvider } from "@/contexts/OrganizationContext";

const DashboardLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <OrganizationProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </OrganizationProvider>
  );
};

export default DashboardLayout;
