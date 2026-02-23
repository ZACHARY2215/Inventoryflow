
import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
  Users,
  RotateCcw,
  CreditCard,
  FileText,
  BarChart3,
  Bell,
  Shield,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  User,
  Factory,
  Moon,
  Sun,
} from 'lucide-react'

interface NavItem {
  label: string
  icon: React.ElementType
  href: string
  section: string
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/', section: 'MAIN' },
  { label: 'Point of Sale', icon: ShoppingCart, href: '/pos', section: 'MAIN' },
  { label: 'Orders', icon: ClipboardList, href: '/orders', section: 'MAIN' },
  { label: 'Products', icon: Package, href: '/products', section: 'INVENTORY' },
  { label: 'Inventory', icon: Package, href: '/inventory', section: 'INVENTORY' },
  { label: 'Suppliers', icon: Factory, href: '/suppliers', section: 'INVENTORY' },
  { label: 'Customers', icon: Users, href: '/customers', section: 'SALES' },
  { label: 'Payments', icon: CreditCard, href: '/payments', section: 'SALES' },
  { label: 'Invoices', icon: FileText, href: '/invoices', section: 'SALES' },
  { label: 'Returns', icon: RotateCcw, href: '/returns', section: 'SALES' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics', section: 'REPORTS' },
  { label: 'Audit Logs', icon: Shield, href: '/audit', section: 'SYSTEM', adminOnly: true },
  { label: 'User Management', icon: Users, href: '/users', section: 'SYSTEM', adminOnly: true },
  { label: 'Notifications', icon: Bell, href: '/notifications', section: 'SYSTEM' },
  { label: 'Settings', icon: Settings, href: '/settings', section: 'SYSTEM' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const sections = ['MAIN', 'INVENTORY', 'SALES', 'REPORTS', 'SYSTEM']
  const filteredItems = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-primary/20 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-surface transition-all duration-300 ease-in-out',
          'shadow-[var(--shadow-neu)]',
          collapsed ? 'w-[72px]' : 'w-[250px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo + Collapse Button */}
        <div className={cn(
          'flex items-center h-16 px-4 border-b border-border/50 shrink-0',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-[0_2px_8px_-2px_rgb(3_105_161/0.4)]">
              <img src="/logo.png" alt="InventoryFlow" className="w-full h-full object-contain" />
            </div>
            {!collapsed && (
              <span className="font-heading font-semibold text-lg text-text-primary tracking-tight">
                InventoryFlow
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-text-tertiary hover:bg-background-alt hover:text-text-primary transition-all duration-200"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 px-2.5">
          {sections.map(section => {
            const sectionItems = filteredItems.filter(i => i.section === section)
            if (sectionItems.length === 0) return null
            return (
              <div key={section} className="mb-2">
                {!collapsed && (
                  <p className="px-3 pt-5 mb-1.5 text-[10px] font-semibold tracking-widest text-text-tertiary/70 uppercase font-heading">
                    {section}
                  </p>
                )}
                {sectionItems.map(item => {
                  const Icon = item.icon
                  const active = location.pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 mb-0.5 relative',
                        active
                          ? 'bg-cta/10 text-cta shadow-[var(--shadow-neu-inset)]'
                          : 'text-text-secondary hover:bg-background-alt hover:text-text-primary hover:shadow-[var(--shadow-xs)]'
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-cta" />
                      )}
                      <Icon className={cn('w-5 h-5 shrink-0', active && 'text-cta')} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Dark Mode Toggle + User + Logout */}
        <div className="border-t border-border/50 p-3 shrink-0 space-y-2">
          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className={cn(
              'flex items-center w-full gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 text-text-secondary hover:bg-background-alt hover:text-text-primary',
              collapsed && 'justify-center px-0'
            )}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
            {!collapsed && (
              <div className="flex items-center justify-between flex-1">
                <span>Dark mode</span>
                <div className={cn(
                  'relative w-10 h-5.5 rounded-full transition-colors duration-200',
                  isDark ? 'bg-cta' : 'bg-border'
                )}>
                  <div className={cn(
                    'absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200',
                    isDark ? 'translate-x-[18px]' : 'translate-x-0.5'
                  )} />
                </div>
              </div>
            )}
          </button>

          {/* User profile */}
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-background-alt/50">
              <div className="w-9 h-9 rounded-xl bg-cta/10 flex items-center justify-center shadow-[var(--shadow-neu-inset)]">
                <User className="w-4 h-4 text-cta" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {(profile as any)?.display_name || profile?.email || user?.email || 'User'}
                </p>
                <p className="text-xs text-text-tertiary capitalize">{profile?.role || 'staff'}</p>
              </div>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-2 text-sm text-text-secondary hover:text-error transition-all duration-200 px-3 py-2 rounded-xl hover:bg-error-light w-full',
              collapsed && 'justify-center px-0'
            )}
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-surface flex items-center justify-between px-4 lg:px-8 xl:px-10 shrink-0 shadow-[var(--shadow-sm)]">
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 -ml-2 rounded-xl text-text-secondary hover:bg-background-alt transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Breadcrumb />
            <div className="flex-1" />
            <NotificationBell />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full">
          <div className="p-4 lg:p-8 xl:px-10 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

function Breadcrumb() {
  const location = useLocation()
  const path = location.pathname
  const segments = path.split('/').filter(Boolean)

  const labelMap: Record<string, string> = {
    pos: 'Point of Sale',
    orders: 'Orders',
    products: 'Products',
    inventory: 'Inventory',
    suppliers: 'Suppliers',
    customers: 'Customers',
    payments: 'Payments',
    invoices: 'Invoices',
    returns: 'Returns',
    analytics: 'Analytics',
    audit: 'Audit Logs',
    users: 'User Management',
    notifications: 'Notifications',
    settings: 'Settings',
    new: 'New',
  }

  return (
    <nav className="flex items-center flex-wrap gap-2 text-sm font-medium mt-0.5 lg:mt-0">
      <Link to="/" className="text-text-tertiary hover:text-cta transition-colors flex items-center">
        Home
      </Link>
      {segments.map((seg, i) => (
        <React.Fragment key={i}>
          <span className="text-text-tertiary/40 flex items-center pb-[1px]">/</span>
          {i === segments.length - 1 ? (
            <span className="text-text-primary flex items-center">{labelMap[seg] || seg}</span>
          ) : (
            <Link to={`/${segments.slice(0, i + 1).join('/')}`} className="text-text-tertiary hover:text-cta transition-colors flex items-center">
              {labelMap[seg] || seg}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

function NotificationBell() {
  return (
    <Link
      to="/notifications"
      className="relative p-2.5 rounded-xl text-text-secondary hover:bg-background-alt hover:text-cta hover:shadow-[var(--shadow-xs)] transition-all duration-200"
    >
      <Bell className="w-5 h-5" />
    </Link>
  )
}
