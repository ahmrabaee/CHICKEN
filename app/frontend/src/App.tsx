import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "@/pages/Dashboard";
import Inventory from "@/pages/Inventory";
import ItemProfile from "@/pages/inventory/ItemProfile";
import Sales from "@/pages/Sales";
import POS from "@/pages/POS";
import Purchasing from "@/pages/Purchasing";
import PurchaseProfile from "@/pages/purchasing/PurchaseProfile";
import Customers from "@/pages/Customers";
import CustomerProfile from "@/pages/customers/CustomerProfile";
import Suppliers from "@/pages/Suppliers";
import SupplierProfile from "@/pages/suppliers/SupplierProfile";
import Payments from "@/pages/Payments";
import PaymentProfile from "@/pages/payments/PaymentProfile";
import Reconciliation from "@/pages/Reconciliation";
import CreditNotes from "@/pages/CreditNotes";
import Expenses from "@/pages/Expenses";
import ExpenseProfile from "@/pages/expenses/ExpenseProfile";
import Debts from "@/pages/Debts";
import Wastage from "@/pages/Wastage";
import WastageProfile from "@/pages/wastage/WastageProfile";
import Reports from "@/pages/Reports";
import Audit from "@/pages/Audit";
import Accounting from "@/pages/Accounting";
import JournalEntryProfile from "@/pages/accounting/JournalEntryProfile";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import Setup from "@/pages/Setup";
import Branches from "@/pages/Branches";
import BranchProfile from "@/pages/branches/BranchProfile";
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
                <Route path="/categories" element={<Navigate to="/inventory?tab=categories" replace />} />
                <Route path="/adjustments" element={<Navigate to="/inventory" replace />} />

                {/* Sales */}
                <Route path="/sales" element={<Sales />} />
                <Route path="/sales/new" element={<POS />} />
                <Route path="/sales/:id" element={<Sales />} />

                {/* Purchasing */}
                <Route path="/purchasing" element={<Purchasing />} />
                <Route path="/purchasing/new" element={<PurchaseProfile />} />
                <Route path="/purchasing/:id" element={<Purchasing />} />

                {/* Customers */}
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/new" element={<CustomerProfile />} />
                <Route path="/customers/:id" element={<CustomerProfile />} />

                {/* Suppliers/Traders */}
                <Route path="/traders" element={<Suppliers />} />
                <Route path="/traders/new" element={<SupplierProfile />} />
                <Route path="/traders/:id" element={<SupplierProfile />} />

                {/* Payments */}
                <Route path="/payments" element={<Payments />} />
                <Route path="/payments/new" element={<PaymentProfile />} />
                <Route path="/payments/:id" element={<PaymentProfile />} />
                <Route path="/reconciliation" element={<Reconciliation />} />
                <Route path="/credit-notes" element={<CreditNotes />} />

                {/* Expenses */}
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/expenses/new" element={<ExpenseProfile />} />
                <Route path="/expenses/:id" element={<ExpenseProfile />} />

                {/* Debts */}
                <Route path="/debts" element={<Debts />} />

                {/* Wastage */}
                <Route path="/wastage" element={<Wastage />} />
                <Route path="/wastage/new" element={<WastageProfile />} />

                {/* Reports */}
                <Route path="/reports/sales" element={<Reports />} />
                <Route path="/reports/purchases" element={<Reports />} />
                <Route path="/reports/inventory" element={<Reports />} />
                <Route path="/reports/expenses" element={<Reports />} />
                <Route path="/reports/profit-loss" element={<Reports />} />
                <Route path="/reports/wastage" element={<Reports />} />
                <Route path="/reports/stock-vs-gl" element={<Reports />} />
                <Route path="/reports/financial" element={<Reports />} />
                <Route path="/reports/tax" element={<Reports />} />
                <Route path="/reports/vat" element={<Reports />} />

                {/* Accounting */}
                <Route path="/accounting" element={<Accounting />} />
                <Route path="/accounting/journal/new" element={<JournalEntryProfile />} />

                {/* Audit */}
                <Route path="/audit" element={<Audit />} />

                {/* Settings */}
                <Route path="/settings" element={<Settings />} />

                {/* Branches */}
                <Route path="/branches" element={<Branches />} />
                <Route path="/branches/new" element={<BranchProfile />} />
                <Route path="/branches/:id" element={<BranchProfile />} />
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
