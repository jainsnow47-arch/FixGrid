import { useEffect, useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ROLE_LABELS } from '../../utils/formatters.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { AnimatePresence, motion } from 'motion/react';
import { FG_EASE } from '../../components/ui/MotionPrimitives.jsx';

export function AdminUsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const load = () => {
    apiRequest('/api/admin/overview').then((d) => setUsers(d.users || []));
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
      subtitle="Control role permissions and verify university, official, or CSR partner accounts"
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
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#245B45]/10">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-white/60 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-[#24332D]">{u.name}</p>
                    <p className="text-[#55665F]">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-[#55665F]">{u.institution_or_org || '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => updateUser(u.id, { role: e.target.value })}
                      className="rounded-lg border border-[#245B45]/20 bg-white px-2.5 py-1.5 text-xs"
                    >
                      {Object.entries(ROLE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {u.verified ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#245B45]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </span>
                    ) : (
                      <span className="text-[#9A5B13] font-semibold">Pending Review</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant={u.verified ? 'outline' : 'forest'}
                      onClick={() => updateUser(u.id, { verified: !u.verified })}
                    >
                      {u.verified ? 'Revoke' : 'Verify'}
                    </Button>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
