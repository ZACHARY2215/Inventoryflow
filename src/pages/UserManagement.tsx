import { useEffect, useState } from 'react'
import { supabase, invokeEdgeFunction } from '@/lib/supabase'
import { cn, formatDateTime, exportToCsv } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'
import Pagination from '@/components/Pagination'
import PrintButton from '@/components/PrintButton'
import {
  Search, Shield, ShieldOff, X, KeyRound, Download,
  ToggleLeft, ToggleRight, Clock, AlertTriangle,
  UserCheck, UserX, Mail, Phone, User,
} from 'lucide-react'
import usePageTitle from '@/hooks/usePageTitle'

interface UserProfile {
  id: string; email: string; role: 'admin' | 'staff'
  display_name: string | null; last_login_at: string | null
  is_active: boolean; created_at: string
}

interface RegistrationRequest {
  id: string; first_name: string; last_name: string; username: string
  email: string; phone: string; status: string; created_at: string
}

export default function UserManagement() {
  usePageTitle('User Management')
  const [activeTab, setActiveTab] = useState<'users' | 'pending'>('users')
  const [users, setUsers] = useState<UserProfile[]>([])
  const [requests, setRequests] = useState<RegistrationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleDialog, setRoleDialog] = useState<UserProfile | null>(null)
  const [resetDialog, setResetDialog] = useState<UserProfile | null>(null)
  const [resetPw, setResetPw] = useState('')
  const [resettingPw, setResettingPw] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<RegistrationRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [usersData, reqData] = await Promise.all([
        apiFetch<UserProfile[]>('/api/query', {
          method: 'POST',
          body: JSON.stringify({ table: 'blast_users', order: { column: 'created_at', ascending: false } })
        }),
        apiFetch<RegistrationRequest[]>('/api/query', {
          method: 'POST',
          body: JSON.stringify({ table: 'blast_registration_requests', eq: { status: 'pending' }, order: { column: 'created_at', ascending: false } })
        })
      ])
      setUsers(usersData || [])
      setRequests(reqData || [])
    } catch (err: any) {
      toast.error(err.message || 'Failed to load user data')
    } finally {
      setLoading(false)
    }
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.display_name || '').toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => { setPage(1) }, [search])
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const confirmRoleChange = async () => {
    if (!roleDialog) return
    const newRole = roleDialog.role === 'admin' ? 'staff' : 'admin'
    const { error } = await supabase.from('blast_users').update({ role: newRole }).eq('id', roleDialog.id)
    if (error) toast.error(error.message)
    else { toast.success(`Role changed to ${newRole}`); load() }
    setRoleDialog(null)
  }

  const toggleActive = async (u: UserProfile) => {
    const newActive = !u.is_active
    const { error } = await supabase.from('blast_users').update({ is_active: newActive }).eq('id', u.id)
    if (error) toast.error(error.message)
    else { toast.success(newActive ? 'User activated' : 'User deactivated'); load() }
  }

  const handleResetPassword = async () => {
    if (!resetDialog || !resetPw) return
    if (resetPw.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setResettingPw(true)
    try {
      const { error } = await invokeEdgeFunction('inv_admin_reset_password', {
        body: { user_id: resetDialog.id, new_password: resetPw },
      })
      if (error) throw error
      toast.success(`Password reset for ${resetDialog.display_name || resetDialog.email}`)
      setResetDialog(null); setResetPw('')
    } catch {
      toast.error('Password reset requires admin API. Use Supabase Dashboard > Authentication > Users.')
    } finally {
      setResettingPw(false)
    }
  }

  const handleApprove = async (req: RegistrationRequest) => {
    setActionLoading(req.id)
    try {
      const { error } = await invokeEdgeFunction('inv_approve_registration', {
        body: { action: 'approve', request_id: req.id },
      })
      if (error) throw error
      toast.success(`${req.username} approved! A password setup email has been sent to ${req.email}.`)
      load()
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve request')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setActionLoading(rejectTarget.id)
    try {
      const { error } = await invokeEdgeFunction('inv_approve_registration', {
        body: { action: 'reject', request_id: rejectTarget.id, reject_reason: rejectReason.trim() || null },
      })
      if (error) throw error
      toast.success(`Request from ${rejectTarget.email} rejected.`)
      setRejectTarget(null)
      setRejectReason('')
      load()
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request')
    } finally {
      setActionLoading(null)
    }
  }

  const adminCount = users.filter(u => u.role === 'admin').length
  const staffCount = users.filter(u => u.role === 'staff').length
  const activeCount = users.filter(u => u.is_active !== false).length
  const pendingCount = requests.length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-text-cta">User Management</h1><p className="text-sm text-text-secondary mt-1">Manage employee accounts and roles</p></div>
        <div className="flex items-center gap-2 no-print">
          <PrintButton />
          <button
            onClick={() => exportToCsv('users', users.map(u => ({
              name: u.display_name || '', email: u.email, role: u.role,
              status: u.is_active !== false ? 'Active' : 'Inactive',
              last_login: u.last_login_at ? formatDateTime(u.last_login_at) : 'Never',
              joined: formatDateTime(u.created_at)
            })), [
              { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' },
              { key: 'status', label: 'Status' }, { key: 'last_login', label: 'Last Login' }, { key: 'joined', label: 'Joined' },
            ])}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-border text-sm font-medium rounded-xl hover:bg-background-alt transition-all duration-200"
          >
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cta/10 text-primary flex items-center justify-center"><Shield className="w-5 h-5" /></div>
          <div><p className="text-xs text-text-tertiary">Admins</p><p className="text-lg font-bold font-mono">{adminCount}</p></div>
        </div>
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-info-light text-info flex items-center justify-center"><ShieldOff className="w-5 h-5" /></div>
          <div><p className="text-xs text-text-tertiary">Staff</p><p className="text-lg font-bold font-mono">{staffCount}</p></div>
        </div>
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success-light text-success flex items-center justify-center"><ToggleRight className="w-5 h-5" /></div>
          <div><p className="text-xs text-text-tertiary">Active</p><p className="text-lg font-bold font-mono">{activeCount}/{users.length}</p></div>
        </div>
        <div className={cn('neu-card p-4 flex items-center gap-3', pendingCount > 0 && 'ring-2 ring-warning/30')}>
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', pendingCount > 0 ? 'bg-warning-light text-warning' : 'bg-background-alt text-text-tertiary')}><User className="w-5 h-5" /></div>
          <div><p className="text-xs text-text-tertiary">Pending</p><p className={cn('text-lg font-bold font-mono', pendingCount > 0 && 'text-warning')}>{pendingCount}</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: 'users', label: 'Active Users', count: users.length },
          { key: 'pending', label: 'Pending Requests', count: pendingCount },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
              activeTab === tab.key ? 'border-cta text-cta' : 'border-transparent text-text-secondary hover:text-text-primary')}>
            {tab.label}
            {tab.count > 0 && (
              <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
                activeTab === tab.key ? 'bg-cta text-white' : tab.key === 'pending' && pendingCount > 0 ? 'bg-warning text-white' : 'bg-background-alt text-text-secondary'
              )}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input type="text" placeholder="Search by email or name..." className="w-full h-10 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="neu-card overflow-hidden">
            {loading ? <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" /></div> :
            <><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border/50 bg-background-alt">
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">User</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Last Login</th>
                  <th className="text-left py-3 px-4 font-medium text-text-secondary">Joined</th>
                  <th className="text-right py-3 px-4 font-medium text-text-secondary">Actions</th>
                </tr></thead>
                <tbody>{paged.map(u => (
                  <tr key={u.id} className={cn('border-b border-border/50 last:border-0 hover:bg-background-alt/50', u.is_active === false && 'opacity-50')}>
                    <td className="py-3 px-4">
                      <p className="font-medium">{u.display_name || u.email}</p>
                      {u.display_name && <p className="text-xs text-text-tertiary">{u.email}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase', u.role === 'admin' ? 'bg-cta/10 text-cta' : 'bg-background-alt text-text-secondary')}>
                        {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />} {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {u.is_active !== false
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-light text-success uppercase">Active</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-background-alt text-text-tertiary uppercase">Inactive</span>}
                    </td>
                    <td className="py-3 px-4 text-text-secondary text-xs">
                      {u.last_login_at ? <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDateTime(u.last_login_at)}</span> : <span className="text-text-tertiary">Never</span>}
                    </td>
                    <td className="py-3 px-4 text-text-secondary text-xs">{formatDateTime(u.created_at)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toggleActive(u)} className="p-1.5 rounded-md hover:bg-background-alt text-text-secondary hover:text-text-primary transition-colors" title={u.is_active !== false ? 'Deactivate' : 'Activate'}>
                          {u.is_active !== false ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setRoleDialog(u)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-background-alt transition-all duration-200">
                          <KeyRound className="w-3 h-3" /> Toggle Role
                        </button>
                        <button onClick={() => { setResetDialog(u); setResetPw('') }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border hover:bg-background-alt transition-all duration-200">
                          <KeyRound className="w-3 h-3" /> Reset PW
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <Pagination currentPage={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1) }} />
            </>}
          </div>
        </>
      )}

      {/* Pending Requests Tab */}
      {activeTab === 'pending' && (
        <div className="neu-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-cta/30 border-l-cta rounded-full animate-spin" /></div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16">
              <UserCheck className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-50" />
              <p className="text-text-secondary font-medium">No pending requests</p>
              <p className="text-xs text-text-tertiary mt-1">New employee registration requests will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {requests.map(req => (
                <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-warning-light flex items-center justify-center shrink-0 text-warning font-bold text-sm uppercase">
                    {req.first_name[0]}{req.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{req.first_name} {req.last_name} <span className="text-text-tertiary font-normal text-sm">@{req.username}</span></p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-text-secondary">
                      <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{req.email}</span>
                      <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{req.phone}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatDateTime(req.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(req)}
                      disabled={actionLoading === req.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success text-white text-xs font-medium hover:bg-success/90 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === req.id
                        ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <UserCheck className="w-3.5 h-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => { setRejectTarget(req); setRejectReason('') }}
                      disabled={actionLoading === req.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-error/30 text-error text-xs font-medium hover:bg-error-light transition-colors disabled:opacity-50"
                    >
                      <UserX className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Role Change Dialog */}
      {roleDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
          <div className="neu-card shadow-xl w-full max-w-sm mx-4">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-warning-light flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-warning" />
              </div>
              <p className="font-medium mb-1">Change Role?</p>
              <p className="text-sm text-text-secondary">
                Change <strong>{roleDialog.display_name || roleDialog.email}</strong>'s role from <strong>{roleDialog.role}</strong> to <strong>{roleDialog.role === 'admin' ? 'staff' : 'admin'}</strong>?
              </p>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border/50">
              <button onClick={() => setRoleDialog(null)} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200">Cancel</button>
              <button onClick={confirmRoleChange} className="flex-1 h-10 rounded-xl bg-warning hover:bg-warning/90 text-white text-sm font-medium transition-colors">Change Role</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
          <div className="neu-card shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-heading font-semibold text-lg flex items-center gap-2"><UserX className="w-5 h-5 text-error" /> Reject Request</h2>
              <button onClick={() => setRejectTarget(null)} className="p-1 rounded-md hover:bg-background-alt text-text-tertiary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-background-alt rounded-lg p-3">
                <p className="text-sm font-medium">{rejectTarget.first_name} {rejectTarget.last_name}</p>
                <p className="text-xs text-text-tertiary">{rejectTarget.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Reason (optional)</label>
                <textarea className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:border-cta outline-none resize-none" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Not a current employee..." />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border/50">
              <button onClick={() => setRejectTarget(null)} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-background-alt transition-all duration-200">Cancel</button>
              <button onClick={handleReject} disabled={!!actionLoading} className="flex-1 h-10 rounded-xl bg-error hover:bg-error/90 text-white text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserX className="w-4 h-4" /> Reject</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Dialog */}
      {resetDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-[2px]">
          <div className="neu-card shadow-xl w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-heading font-semibold text-lg flex items-center gap-2"><KeyRound className="w-5 h-5 text-cta" /> Reset Password</h2>
              <button onClick={() => setResetDialog(null)} className="p-1 rounded-md hover:bg-background-alt text-text-tertiary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-background-alt rounded-lg p-3">
                <p className="text-sm font-medium">{resetDialog.display_name || resetDialog.email}</p>
                <p className="text-xs text-text-tertiary">{resetDialog.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">New Password</label>
                <input type="password" className="w-full h-10 px-3 rounded-xl border border-border text-sm focus:border-cta focus:ring-2 focus:ring-primary/20 outline-none" value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder="Min 8 characters" />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-border/50">
              <button onClick={() => setResetDialog(null)} className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-background-alt hover:shadow-[var(--shadow-xs)] transition-all duration-200">Cancel</button>
              <button onClick={handleResetPassword} disabled={resettingPw || resetPw.length < 8} className="flex-1 h-10 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {resettingPw ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><KeyRound className="w-4 h-4" /> Reset Password</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
