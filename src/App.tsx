import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Inventory from "./pages/Inventory";
import PurchaseOrders from "./pages/PurchaseOrders";
import Shipments from "./pages/Shipments";
import UserManagement from "./pages/UserManagement";
import Approvals from "./pages/Approvals";
import PlaceholderPage from "./components/PlaceholderPage";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <div className="dark">
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Protected onboarding - requires auth but no org */}
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              } />
              
              {/* Protected dashboard routes */}
              <Route element={<DashboardLayout />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="skus" element={<PlaceholderPage title="SKUs" description="Manage product SKUs and variants" />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="purchase-orders" element={<PurchaseOrders />} />
                <Route path="shipments" element={<Shipments />} />
                <Route path="suppliers" element={<PlaceholderPage title="Suppliers" description="Manage your supplier relationships" />} />
                <Route path="warehouses" element={<PlaceholderPage title="Warehouses" description="Configure warehouse locations" />} />
                <Route path="approvals" element={<Approvals />} />
                <Route path="reports" element={<PlaceholderPage title="Reports" description="View analytics and reports" />} />
                <Route path="billing" element={<PlaceholderPage title="Billing" description="Manage subscription and payments" />} />
                <Route path="settings" element={<PlaceholderPage title="Settings" description="Configure organization settings" />} />
                <Route path="users" element={<UserManagement />} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
