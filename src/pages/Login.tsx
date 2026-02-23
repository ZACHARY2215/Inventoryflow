import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import {
  Lock, Mail, Package, BarChart3, Shield, Zap, Eye, EyeOff,
  User, Phone, ChevronRight, CheckCircle, ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import usePageTitle from '@/hooks/usePageTitle'

export default function Login() {
  usePageTitle('Login')
  const [mode, setMode] = useState<'login' | 'register' | 'success'>('login')

  // Login state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Pending approval banner (from Google OAuth flow)
  const [pending, setPending] = useState<string | null>(() => localStorage.getItem('pendingApproval'))

  // Register state
  const [reg, setReg] = useState({
    first_name: '', last_name: '', username: '', email: '', phone: '', password: '', confirm: '',
  })
  const [showRegPw, setShowRegPw] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [regError, setRegError] = useState('')

  const navigate = useNavigate()
  const { user } = useAuth()

  if (user) {
    navigate('/', { replace: true })
    return null
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setErrorMsg(error.message)
      else navigate('/', { replace: true })
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) { setErrorMsg(error.message); setGoogleLoading(false) }
    // On success: browser redirects to Google, then back here
    // AuthContext handles the pending-approval logic after redirect
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError('')
    if (!reg.first_name || !reg.last_name || !reg.username || !reg.email || !reg.phone) {
      setRegError('All fields are required'); return
    }
    const usernameRegex = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!usernameRegex.test(reg.username)) {
      setRegError('Username must start with a letter or underscore, and contain only letters, numbers, and underscores.');
      return;
    }
    if (reg.password.length < 8) { setRegError('Password must be at least 8 characters'); return }
    if (reg.password !== reg.confirm) { setRegError('Passwords do not match'); return }
    setRegistering(true)
    try {
      const { error } = await supabase.from('blast_registration_requests').insert({
        first_name: reg.first_name.trim(),
        last_name: reg.last_name.trim(),
        username: reg.username.trim(),
        email: reg.email.trim().toLowerCase(),
        phone: reg.phone.trim(),
      })
      if (error) throw error
      setMode('success')
    } catch (err: any) {
      setRegError(err.message || 'Registration failed. Please try again.')
    } finally {
      setRegistering(false)
    }
  }

  const features = [
    { icon: Package, label: 'Real-time Inventory', desc: 'Track stock across all locations' },
    { icon: BarChart3, label: 'Sales Analytics', desc: 'Insights that drive growth' },
    { icon: Shield, label: 'Full Audit Trail', desc: 'Non-repudiation guaranteed' },
    { icon: Zap, label: 'Instant Invoicing', desc: 'Generate PDFs in seconds' },
  ]

  const inputCls = 'w-full h-12 rounded-xl bg-surface text-sm transition-all duration-200 neu-input placeholder:text-text-tertiary'

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 mesh-gradient bg-primary-dark relative">
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 text-white">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-14 h-14 drop-shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
              <img src="/logo.png" alt="InventoryFlow" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-heading font-bold tracking-tight">InventoryFlow</span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-heading font-bold mb-4 leading-tight">
            Smart inventory<br />for modern<br />businesses
          </h1>
          <p className="text-lg text-white/70 mb-12 max-w-md leading-relaxed">
            Eliminate paper chaos with real-time tracking, automated invoicing, and complete audit trails.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {features.map((f, i) => (
              <div key={i} className="glass-card p-5 transition-all duration-300">
                <f.icon className="w-5 h-5 mb-2.5 text-white/80" />
                <p className="font-heading font-semibold text-sm">{f.label}</p>
                <p className="text-xs text-white/50 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-11 h-11">
              <img src="/logo.png" alt="InventoryFlow" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-heading font-bold text-text-primary">InventoryFlow</span>
          </div>

          {/* ── SUCCESS SCREEN ── */}
          {mode === 'success' && (
            <div className="text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-success" />
              </div>
              <div>
                <h2 className="text-2xl font-heading font-bold text-text-primary">Request Submitted!</h2>
                <p className="text-text-secondary text-sm mt-2 leading-relaxed">
                  Your registration request has been sent to an administrator for review.
                  You will be able to sign in once your account is approved.
                </p>
              </div>
              <div className="bg-info-light border border-info/20 rounded-xl p-4 text-sm text-info text-left">
                <p className="font-medium mb-1">What happens next?</p>
                <ol className="text-xs space-y-1 list-decimal list-inside text-info/80">
                  <li>Admin reviews your request</li>
                  <li>You receive a password setup email</li>
                  <li>Set your password and sign in</li>
                </ol>
              </div>
              <button
                onClick={() => { setMode('login'); setReg({ first_name: '', last_name: '', username: '', email: '', phone: '', password: '', confirm: '' }) }}
                className="inline-flex items-center gap-2 text-sm text-cta hover:underline"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </button>
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {mode === 'login' && (
            <>
              <h2 className="text-2xl font-heading font-bold text-text-primary mb-1">Welcome back</h2>
              <p className="text-text-secondary text-sm mb-8">Sign in to your employee portal</p>

              {/* Pending approval banner */}
              {pending && (
                <div className={`mb-6 flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${pending === 'rejected' ? 'bg-error-light border-error/20 text-error' : 'bg-info-light border-info/20 text-info'}`}>
                  <span className="text-lg">{pending === 'rejected' ? '❌' : '⏳'}</span>
                  <div className="flex-1">
                    {pending === 'rejected'
                      ? <><p className="font-medium">Request rejected</p><p className="text-xs mt-0.5 opacity-80">Your registration was not approved. Contact an administrator.</p></>
                      : <><p className="font-medium">Pending admin approval</p><p className="text-xs mt-0.5 opacity-80">Your account request is under review. Try signing in with Google again once approved.</p></>}
                  </div>
                  <button onClick={() => { localStorage.removeItem('pendingApproval'); setPending(null) }} className="opacity-60 hover:opacity-100 transition-opacity text-lg leading-none">×</button>
                </div>
              )}

              {/* Google OAuth button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full h-12 rounded-xl border border-border bg-surface hover:bg-background-alt text-sm font-medium transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-60 mb-5"
              >
                {googleLoading
                  ? <div className="w-5 h-5 border-2 border-border border-t-cta rounded-full animate-spin" />
                  : <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                }
                Continue with Google
              </button>

              <div className="relative flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text-tertiary">or sign in with email</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary" />
                    <input type="email" className={cn(inputCls, 'pl-11 pr-4')} placeholder="name@company.com"
                      value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary" />
                    <input type={showPassword ? 'text' : 'password'} className={cn(inputCls, 'pl-11 pr-11')} placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary transition-colors focus:outline-none" tabIndex={-1}>
                      {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </div>

                {errorMsg && (
                  <div className="bg-error-light border border-error/20 rounded-xl px-4 py-3 text-sm text-error">
                    {errorMsg}
                  </div>
                )}

                <button type="submit"
                  className={cn('w-full h-12 rounded-xl text-white font-medium text-sm neu-btn-primary flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none')}
                  disabled={loading}>
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-l-white rounded-full animate-spin" /> : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-text-secondary">
                  New employee?{' '}
                  <button onClick={() => { setMode('register'); setErrorMsg('') }}
                    className="text-cta font-medium hover:underline inline-flex items-center gap-1">
                    Request access <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </p>
              </div>

              {/* Trust indicators */}
              <div className="mt-10 pt-8 border-t border-border/40">
                <div className="flex items-center justify-center gap-6 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                    <div className="w-4 h-4 rounded-full bg-success/15 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-success" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    256-bit encrypted
                  </div>
                  <div className="w-px h-3 bg-border" />
                  <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                    <div className="w-4 h-4 rounded-full bg-cta/10 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-cta" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    Private deployment
                  </div>
                  <div className="w-px h-3 bg-border" />
                  <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                    <div className="w-4 h-4 rounded-full bg-background-alt flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-text-tertiary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    Real-time sync
                  </div>
                </div>
                <p className="text-[11px] text-text-tertiary text-center">
                  Contact your administrator for account access
                </p>
              </div>
            </>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === 'register' && (
            <>
              <button onClick={() => { setMode('login'); setRegError('') }}
                className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </button>
              <h2 className="text-2xl font-heading font-bold text-text-primary mb-1">Request Access</h2>
              <p className="text-text-secondary text-sm mb-6">Fill in your details — an admin will approve your account</p>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">First Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                      <input className={cn(inputCls, 'pl-10 pr-3')} placeholder="Juan"
                        value={reg.first_name} onChange={e => setReg({ ...reg, first_name: e.target.value })} required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Last Name *</label>
                    <input className={cn(inputCls, 'px-3')} placeholder="Dela Cruz"
                      value={reg.last_name} onChange={e => setReg({ ...reg, last_name: e.target.value })} required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Username / Display Name *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary text-sm font-medium">@</span>
                    <input className={cn(inputCls, 'pl-9 pr-4')} placeholder="juandc"
                      value={reg.username} onChange={e => setReg({ ...reg, username: e.target.value })} required />
                  </div>
                  <p className="text-xs text-text-tertiary mt-1">Letters, numbers, and underscores only. Must start with a letter.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary" />
                    <input type="email" className={cn(inputCls, 'pl-11 pr-4')} placeholder="juan@company.com"
                      value={reg.email} onChange={e => setReg({ ...reg, email: e.target.value })} required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Phone *</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary" />
                    <input type="tel" className={cn(inputCls, 'pl-11 pr-4')} placeholder="09XX XXX XXXX"
                      value={reg.phone} onChange={e => setReg({ ...reg, phone: e.target.value })} required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary" />
                    <input type={showRegPw ? 'text' : 'password'} className={cn(inputCls, 'pl-11 pr-11')} placeholder="Min 8 characters"
                      value={reg.password} onChange={e => setReg({ ...reg, password: e.target.value })} required />
                    <button type="button" onClick={() => setShowRegPw(!showRegPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-primary focus:outline-none" tabIndex={-1}>
                      {showRegPw ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">Confirm Password *</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary" />
                    <input type={showRegPw ? 'text' : 'password'} className={cn(inputCls, 'pl-11 pr-4')} placeholder="Re-enter password"
                      value={reg.confirm} onChange={e => setReg({ ...reg, confirm: e.target.value })} required />
                  </div>
                  {reg.confirm && reg.password !== reg.confirm && (
                    <p className="text-xs text-error mt-1">Passwords do not match</p>
                  )}
                  {reg.confirm && reg.password === reg.confirm && reg.password.length >= 8 && (
                    <p className="text-xs text-success mt-1">Passwords match ✓</p>
                  )}
                </div>

                {regError && (
                  <div className="bg-error-light border border-error/20 rounded-xl px-4 py-3 text-sm text-error">
                    {regError}
                  </div>
                )}

                <button type="submit"
                  className="w-full h-12 rounded-xl text-white font-medium text-sm neu-btn-primary flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                  disabled={registering}>
                  {registering
                    ? <div className="w-5 h-5 border-2 border-white/30 border-l-white rounded-full animate-spin" />
                    : 'Submit Request'}
                </button>
              </form>

              <p className="text-[11px] text-text-tertiary text-center mt-6">
                Note: your password is stored securely. An admin will create your account after approval — you'll receive a setup email.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
