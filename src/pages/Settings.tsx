import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import { Shield, User, Info, Save, Eye, EyeOff, KeyRound, Clock } from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

export default function Settings() {
  usePageTitle('Settings')
  const { user, profile, refreshProfile, signOut } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [savingName, setSavingName] = useState(false)

  // Sync displayName input with profile when it loads/refreshes
  useEffect(() => {
    if (profile?.display_name !== undefined) {
      setDisplayName(profile.display_name || '')
    }
  }, [profile?.display_name])

  // Password change
  const [showPw, setShowPw] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [pwVisible, setPwVisible] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  const handleSaveName = async () => {
    setSavingName(true)
    try {
      const { error } = await supabase.from('blast_users').update({ display_name: displayName.trim() || null }).eq('id', user!.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Display name updated')
    } catch (err: any) { toast.error(err.message) }
    finally { setSavingName(false) }
  }

  const handleChangePassword = async () => {
    if (!pwForm.newPw || !pwForm.confirm) { toast.error('Please fill in all fields'); return }
    if (pwForm.newPw.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    setSavingPw(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
      if (error) throw error
      toast.success('Password updated successfully')
      setPwForm({ current: '', newPw: '', confirm: '' })
      setShowPw(false)
    } catch (err: any) { toast.error(err.message) }
    finally { setSavingPw(false) }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="text-2xl font-bold text-text-cta">Settings</h1><p className="text-sm text-text-secondary mt-1">Account information and preferences</p></div>

      {/* Account Info */}
      <div className="neu-card p-6 space-y-5">
        <h2 className="font-heading font-semibold flex items-center gap-2"><User className="w-4 h-4 text-cta" /> Account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
            <p className="text-sm font-medium">{user?.email}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Role</label>
            <p className="text-sm font-medium capitalize flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cta" /> {profile?.role || 'staff'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">User ID</label>
            <p className="text-xs font-mono text-text-tertiary break-all">{user?.id}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Joined</label>
            <p className="text-sm text-text-secondary flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '–'}
            </p>
          </div>
        </div>

        {/* Display name */}
        <div className="pt-3 border-t border-border/50">
          <label className="block text-sm font-medium mb-1.5">Display Name</label>
          <div className="flex gap-2">
            <input
              className="flex-1 h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Enter your display name..."
            />
            <button
              onClick={handleSaveName}
              disabled={savingName}
              className="px-4 h-10 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {savingName ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
          <p className="text-xs text-text-tertiary mt-1">This name will be shown across the app instead of your email</p>
        </div>
      </div>

      {/* Security */}
      <div className="neu-card p-6 space-y-4">
        <h2 className="font-heading font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4 text-cta" /> Security</h2>

        {!showPw ? (
          <button onClick={() => setShowPw(true)} className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-background-alt transition-all duration-200">
            <KeyRound className="w-4 h-4" /> Change Password
          </button>
        ) : (
          <div className="space-y-3 p-4 bg-background-alt rounded-xl">
            <div>
              <label className="block text-sm font-medium mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={pwVisible ? 'text' : 'password'}
                  className="w-full h-10 px-3 pr-10 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none"
                  value={pwForm.newPw}
                  onChange={e => setPwForm({...pwForm, newPw: e.target.value})}
                  placeholder="Minimum 8 characters"
                />
                <button onClick={() => setPwVisible(!pwVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                  {pwVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwForm.newPw && pwForm.newPw.length < 8 && <p className="text-xs text-error mt-1">Password must be at least 8 characters</p>}
              {pwForm.newPw && pwForm.newPw.length >= 8 && <p className="text-xs text-success mt-1">Password length OK ✓</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
              <input
                type={pwVisible ? 'text' : 'password'}
                className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none"
                value={pwForm.confirm}
                onChange={e => setPwForm({...pwForm, confirm: e.target.value})}
                placeholder="Re-enter new password"
              />
              {pwForm.confirm && pwForm.newPw !== pwForm.confirm && <p className="text-xs text-error mt-1">Passwords do not match</p>}
              {pwForm.confirm && pwForm.newPw === pwForm.confirm && pwForm.newPw.length >= 8 && <p className="text-xs text-success mt-1">Passwords match ✓</p>}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowPw(false); setPwForm({ current: '', newPw: '', confirm: '' }) }} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200">
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={savingPw || pwForm.newPw.length < 8 || pwForm.newPw !== pwForm.confirm}
                className="px-4 py-2 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {savingPw ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Update Password
              </button>
            </div>
          </div>
        )}

        {/* Session info */}
        <div className="pt-3 border-t border-border/50">
          <p className="text-xs text-text-tertiary">Sessions expire after 8 hours or 30 minutes of inactivity.</p>
          <button
            onClick={signOut}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 border border-error/30 rounded-xl text-sm font-medium text-error hover:bg-error-light transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* System */}
      <div className="neu-card p-6 space-y-4">
        <h2 className="font-heading font-semibold flex items-center gap-2"><Info className="w-4 h-4 text-cta" /> System</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><label className="block text-xs font-medium text-text-secondary mb-1">Version</label><p>BLAST InventoryFlow v1.0.0</p></div>
          <div><label className="block text-xs font-medium text-text-secondary mb-1">Platform</label><p>Supabase + React</p></div>
          <div><label className="block text-xs font-medium text-text-secondary mb-1">Database</label><p>PostgreSQL 15</p></div>
          <div><label className="block text-xs font-medium text-text-secondary mb-1">Frontend</label><p>React 19 + TypeScript + Tailwind</p></div>
        </div>
      </div>

      <div className="bg-info-light rounded-xl border border-info/20 p-4 flex gap-3">
        <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
        <div className="text-sm text-info">
          <p className="font-medium">Need help?</p>
          <p className="text-xs mt-0.5">Contact your system administrator for account changes and role assignments.</p>
        </div>
      </div>
    </div>
  )
}
