import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute'
import AppShell from '@/components/AppShell'
import OfflineIndicator from '@/components/OfflineIndicator'

// Code-split page imports for better initial load performance
const Login = lazy(() => import('@/pages/Login'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Pos = lazy(() => import('@/pages/Pos'))
const Orders = lazy(() => import('@/pages/Orders'))
const OrderDetail = lazy(() => import('@/pages/OrderDetail'))
const Products = lazy(() => import('@/pages/Products'))
const Inventory = lazy(() => import('@/pages/Inventory'))
const InventoryAdjustments = lazy(() => import('@/pages/InventoryAdjustments'))
const Suppliers = lazy(() => import('@/pages/Suppliers'))
const Customers = lazy(() => import('@/pages/Customers'))
const CustomerDetail = lazy(() => import('@/pages/CustomerDetail'))
const Payments = lazy(() => import('@/pages/Payments'))
const Invoices = lazy(() => import('@/pages/Invoices'))
const Returns = lazy(() => import('@/pages/Returns'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const AuditLogs = lazy(() => import('@/pages/AuditLogs'))
const UserManagement = lazy(() => import('@/pages/UserManagement'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const Settings = lazy(() => import('@/pages/Settings'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-cta/30 border-t-cta rounded-full animate-spin" />
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected */}
            <Route element={<ProtectedRoute />}>
              <Route element={
                <AppShell>
                  <Suspense fallback={<PageLoader />}>
                    <Dashboard />
                  </Suspense>
                </AppShell>
              } path="/" />
              <Route path="/pos" element={<AppShell><Suspense fallback={<PageLoader />}><Pos /></Suspense></AppShell>} />
              <Route path="/orders" element={<AppShell><Suspense fallback={<PageLoader />}><Orders /></Suspense></AppShell>} />
              <Route path="/orders/:id" element={<AppShell><Suspense fallback={<PageLoader />}><OrderDetail /></Suspense></AppShell>} />
              <Route path="/products" element={<AppShell><Suspense fallback={<PageLoader />}><Products /></Suspense></AppShell>} />
              <Route path="/inventory" element={<AppShell><Suspense fallback={<PageLoader />}><Inventory /></Suspense></AppShell>} />
              <Route path="/inventory/adjustments" element={<AppShell><Suspense fallback={<PageLoader />}><InventoryAdjustments /></Suspense></AppShell>} />
              <Route path="/suppliers" element={<AppShell><Suspense fallback={<PageLoader />}><Suppliers /></Suspense></AppShell>} />
              <Route path="/customers" element={<AppShell><Suspense fallback={<PageLoader />}><Customers /></Suspense></AppShell>} />
              <Route path="/customers/:id" element={<AppShell><Suspense fallback={<PageLoader />}><CustomerDetail /></Suspense></AppShell>} />
              <Route path="/payments" element={<AppShell><Suspense fallback={<PageLoader />}><Payments /></Suspense></AppShell>} />
              <Route path="/invoices" element={<AppShell><Suspense fallback={<PageLoader />}><Invoices /></Suspense></AppShell>} />
              <Route path="/returns" element={<AppShell><Suspense fallback={<PageLoader />}><Returns /></Suspense></AppShell>} />
              <Route path="/analytics" element={<AppShell><Suspense fallback={<PageLoader />}><Analytics /></Suspense></AppShell>} />
              <Route path="/notifications" element={<AppShell><Suspense fallback={<PageLoader />}><Notifications /></Suspense></AppShell>} />
              <Route path="/settings" element={<AppShell><Suspense fallback={<PageLoader />}><Settings /></Suspense></AppShell>} />

              {/* Admin only */}
              <Route element={<AdminRoute />}>
                <Route path="/audit" element={<AppShell><Suspense fallback={<PageLoader />}><AuditLogs /></Suspense></AppShell>} />
                <Route path="/users" element={<AppShell><Suspense fallback={<PageLoader />}><UserManagement /></Suspense></AppShell>} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
        <OfflineIndicator />
      </Router>
    </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
