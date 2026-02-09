import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import ItemProfile from "@/pages/inventory/ItemProfile";
import Sales from "@/pages/Sales";
import POS from "@/pages/POS";
import Purchasing from "@/pages/Purchasing";
import Customers from "@/pages/Customers";
import Suppliers from "@/pages/Suppliers";
import PersonalExpenses from "@/pages/PersonalExpenses";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import Setup from "@/pages/Setup";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/setup" element={<Setup />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                {/* Dashboard */}
                <Route path="/" element={<Dashboard />} />

                {/* Inventory */}
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/inventory/new" element={<ItemProfile />} />
                <Route path="/inventory/:id" element={<ItemProfile />} />
                <Route path="/categories" element={<Inventory />} />
                <Route path="/adjustments" element={<Inventory />} />

                {/* Sales */}
                <Route path="/sales" element={<Sales />} />
                <Route path="/sales/new" element={<POS />} />
                <Route path="/sales/:id" element={<Sales />} />

                {/* Purchasing */}
                <Route path="/purchasing" element={<Purchasing />} />
                <Route path="/purchasing/new" element={<Purchasing />} />
                <Route path="/purchasing/:id" element={<Purchasing />} />

                {/* Customers */}
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/credits" element={<Customers />} />
                <Route path="/customers/:id" element={<Customers />} />

                {/* Suppliers/Traders */}
                <Route path="/traders" element={<Suppliers />} />
                <Route path="/traders/new" element={<Suppliers />} />
                <Route path="/traders/payables" element={<Suppliers />} />
                <Route path="/traders/:id" element={<Suppliers />} />

                {/* Personal Expenses */}
                <Route path="/personal-expenses" element={<PersonalExpenses />} />
                <Route path="/personal-expenses/new" element={<PersonalExpenses />} />

                {/* Reports */}
                <Route path="/reports/sales" element={<Reports />} />
                <Route path="/reports/inventory" element={<Reports />} />
                <Route path="/reports/financial" element={<Reports />} />
                <Route path="/reports/tax" element={<Reports />} />

                {/* Settings */}
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
