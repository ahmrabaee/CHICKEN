import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import Sales from "@/pages/Sales";
import POS from "@/pages/POS";
import Purchasing from "@/pages/Purchasing";
import Customers from "@/pages/Customers";
import Suppliers from "@/pages/Suppliers";
import PersonalExpenses from "@/pages/PersonalExpenses";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            {/* Dashboard */}
            <Route path="/" element={<Dashboard />} />
            
            {/* Inventory */}
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/new" element={<Inventory />} />
            <Route path="/inventory/:id" element={<Inventory />} />
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
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
