import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, KeyRound, Search, ShieldPlus, UserCheck, UserX } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ROLE_LABELS } from '../../utils/formatters.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { AnimatePresence, motion } from 'motion/react';
import { FG_EASE } from '../../components/ui/MotionPrimitives.jsx';

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [issuedCodeInfo, setIssuedCodeInfo] = useState(null);
  const [officialForm, setOfficialForm] = useState({
    name: '',
    email: '',
    departmentOrCell: 'Mathura Municipal Operations Cell',
    ward: 'Central Zone',
    city: 'Mathura',
    mode: 'invite',
    password: '',
  });

  const load = () => {
    apiRequest('/api/admin/overview')
      .then((d) => setUsers(d.users || []))
      .catch((err) => showToast(err.message, 'error'));
  };

  useEffect(() => {
    load();
  }, []);

  const updateUser = async (id, patch) => {
    try {
      await apiRequest(`/api/admin/users/${id}`, { method: 'PATCH', body: patch });
      showToast('Account settings updated.', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateOfficial = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest('/api/admin/government-officials', {
        method: 'POST',
        body: officialForm,
      });
      showToast(res.message, 'success');
      if (res.activationCode) {
        setIssuedCodeInfo({
          email: res.email,
          activationCode: res.activationCode,
          expiresAt: res.expiresAt,
        });
      } else {
        setInviteOpen(false);
      }
      setOfficialForm({
        name: '',
        email: '',
        departmentOrCell: 'Mathura Municipal Operations Cell',
        ward: 'Central Zone',
        city: 'Mathura',
        mode: 'invite',
        password: '',
      });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReissueInvite = async (target) => {
    try {
      const res = await apiRequest(`/api/admin/users/${target.id}/resend-invite`, { method: 'POST' });
      setIssuedCodeInfo({
        email: target.email,
        activationCode: res.activationCode,
        expiresAt: res.expiresAt,
      });
      setInviteOpen(true);
      showToast('Fresh activation code generated.', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const copyActivationDetails = async () => {
    if (!issuedCodeInfo) return;
    const text = `FixGrid Government Official Activation\nEmail: ${issuedCodeInfo.email}\nActivation Code: ${issuedCodeInfo.activationCode}\nPortal: ${window.location.origin}/auth?portal=government&activate=${encodeURIComponent(issuedCodeInfo.activationCode)}&email=${encodeURIComponent(issuedCodeInfo.email)}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Activation link & code copied to clipboard.', 'success');
    } catch {
      showToast('Copy the activation code shown on screen.', 'info');
    }
  };

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.institution_or_org || '').toLowerCase().includes(q);
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <DashboardLayout
      title="Users & Roles"
      subtitle="Authorize Government Officials, verify Faculty & Industry accounts, and manage platform permissions"
      primaryAction={
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            setIssuedCodeInfo(null);
            setInviteOpen(true);
          }}
        >
          <ShieldPlus className="w-4 h-4" />
          <span>Invite / Create Official</span>
        </Button>
      }
    >
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: FG_EASE }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#55665F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or organization..."
              className="w-full rounded-lg border border-[#245B45]/20 bg-white pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
          >
            <option value="">All Roles ({users.length})</option>
            {Object.entries(ROLE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={roleFilter || 'all'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: FG_EASE }}
          >
            <Card padding="p-0" className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#E8E4CE] text-[#245B45] font-semibold">
                  <tr>
                    <th className="px-4 py-3">Account</th>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Assigned Role</th>
                    <th className="px-4 py-3">Verification & Access</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#245B45]/10">
                  {filtered.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    const acctStatus = u.account_status || 'active';
                    return (
                      <tr key={u.id} className="hover:bg-white/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#24332D]">{u.name}</p>
                          <p className="text-[#55665F]">{u.email}</p>
                        </td>
                        <td className="px-4 py-3 text-[#55665F]">{u.institution_or_org || '—'}</td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            disabled={isSelf}
                            onChange={(e) => updateUser(u.id, { role: e.target.value })}
                            className="rounded-lg border border-[#245B45]/20 bg-white px-2.5 py-1.5 text-xs disabled:opacity-60"
                          >
                            {Object.entries(ROLE_LABELS).map(([k, label]) => (
                              <option key={k} value={k}>{label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 space-y-1">
                          <div>
                            {u.verified ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-[#245B45]">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                              </span>
                            ) : (
                              <span className="text-[#9A5B13] font-semibold">Pending Verification</span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#55665F]">
                            Status:{' '}
                            <strong
                              className={
                                acctStatus === 'suspended'
                                  ? 'text-[#9B2226]'
                                  : acctStatus === 'invited'
                                    ? 'text-[#9A5B13]'
                                    : 'text-[#245B45]'
                              }
                            >
                              {acctStatus === 'invited'
                                ? 'Awaiting Activation'
                                : acctStatus === 'suspended'
                                  ? 'Suspended'
                                  : 'Active'}
                            </strong>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            {u.role === 'government' && acctStatus === 'invited' && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleReissueInvite(u)}
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>Invite Code</span>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant={u.verified ? 'outline' : 'forest'}
                              onClick={() => updateUser(u.id, { verified: !u.verified })}
                            >
                              {u.verified ? 'Revoke' : 'Verify'}
                            </Button>
                            {!isSelf && (
                              <Button
                                size="sm"
                                variant={acctStatus === 'suspended' ? 'secondary' : 'ghost'}
                                onClick={() =>
                                  updateUser(u.id, {
                                    accountStatus: acctStatus === 'suspended' ? 'active' : 'suspended',
                                  })
                                }
                              >
                                {acctStatus === 'suspended' ? (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>Activate</span>
                                  </>
                                ) : (
                                  <>
                                    <UserX className="w-3.5 h-3.5" />
                                    <span>Suspend</span>
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Admin-only Create / Invite Government Official Modal */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Authorize Government Official"
        subtitle="Only Platform Administrators can provision or invite Government Official accounts."
      >
        {issuedCodeInfo ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#D5EBDD]/55 border border-[#245B45]/20 p-4 space-y-2 text-xs">
              <p className="font-bold text-[#1A4332] text-sm">One-Time Official Invitation Ready</p>
              <p className="text-[#24332D]">
                Share this code securely with <strong>{issuedCodeInfo.email}</strong>. The official can activate their account on the <strong>Gov Official</strong> tab at Sign In.
              </p>
              <div className="rounded-lg bg-white border border-[#245B45]/20 px-3 py-2.5 font-mono-tabular text-base font-bold text-[#245B45] tracking-wide text-center select-all">
                {issuedCodeInfo.activationCode}
              </div>
              <p className="text-[11px] text-[#55665F]">
                For security, this activation code is stored hashed on the server and is only shown once.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button type="button" variant="secondary" onClick={copyActivationDetails}>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Invite Link & Code</span>
              </Button>
              <Button type="button" variant="forest" onClick={() => setInviteOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateOfficial} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Official Full Name</label>
                <input
                  type="text"
                  required
                  value={officialForm.name}
                  onChange={(e) => setOfficialForm({ ...officialForm, name: e.target.value })}
                  placeholder="e.g., Er. Sunita Mishra"
                  className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Authorized Email</label>
                <input
                  type="email"
                  required
                  value={officialForm.email}
                  onChange={(e) => setOfficialForm({ ...officialForm, email: e.target.value })}
                  placeholder="officer@municipality.gov"
                  className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Department / Municipal Cell</label>
                <input
                  type="text"
                  value={officialForm.departmentOrCell}
                  onChange={(e) => setOfficialForm({ ...officialForm, departmentOrCell: e.target.value })}
                  className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Jurisdiction / Ward</label>
                <input
                  type="text"
                  value={officialForm.ward}
                  onChange={(e) => setOfficialForm({ ...officialForm, ward: e.target.value })}
                  className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Provisioning Method</label>
              <select
                value={officialForm.mode}
                onChange={(e) => setOfficialForm({ ...officialForm, mode: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              >
                <option value="invite">Send One-Time Activation Invite (Official sets own password)</option>
                <option value="direct">Create Active Account Directly (Set initial password)</option>
              </select>
            </div>

            {officialForm.mode === 'direct' && (
              <div>
                <label className="block text-xs font-semibold mb-1">Initial Official Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={officialForm.password}
                  onChange={(e) => setOfficialForm({ ...officialForm, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                />
              </div>
            )}

            <Button type="submit" variant="forest" className="w-full" disabled={submitting}>
              {officialForm.mode === 'invite' ? 'Generate Official Invitation' : 'Create & Verify Official'}
            </Button>
          </form>
        )}
      </Modal>
    </DashboardLayout>
  );
}
