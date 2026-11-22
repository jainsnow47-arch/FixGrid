import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDateTime } from '../../utils/formatters.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function AdminAuditLogsPage() {
  const { showToast } = useToast();
  const [auditLogs, setAuditLogs] = useState([]);
  const [comments, setComments] = useState([]);
  const [search, setSearch] = useState('');

  const load = () => {
    apiRequest('/api/admin/overview').then((d) => {
      setAuditLogs(d.auditLogs || []);
      setComments(d.comments || []);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const toggleComment = async (id, isHidden) => {
    try {
      const res = await apiRequest(`/api/admin/comments/${id}/moderate`, {
        method: 'PATCH',
        body: { isHidden },
      });
      showToast(res.message, 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (log.action || '').toLowerCase().includes(q) ||
      (log.actor_name || '').toLowerCase().includes(q) ||
      (log.entity_type || '').toLowerCase().includes(q) ||
      (log.details_json || '').toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout
      title="Audit & Moderation"
      subtitle="Review all system actions and moderate public comments if needed"
    >
      <div className="space-y-6">
        <Card animate className="space-y-3">
          <h2 className="font-display text-base font-bold text-[#245B45]">Community Comment Moderation</h2>
          {comments.length === 0 ? (
            <p className="text-xs text-[#55665F]">No community comments posted yet.</p>
          ) : (
            <StaggerGrid immediate className="space-y-2.5">
              {comments.map((cm) => (
                <StaggerItem key={cm.id}>
                  <div className="rounded-xl bg-white border border-[#245B45]/12 p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-[#24332D]">
                        {cm.author_name} on <span className="font-mono-tabular text-[#245B45]">{cm.tracking_code}</span>
                      </p>
                      <p className={`mt-0.5 ${cm.is_hidden ? 'line-through text-[#55665F]' : 'text-[#24332D]'}`}>{cm.body}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => toggleComment(cm.id, !cm.is_hidden)}>
                      {cm.is_hidden ? 'Restore' : 'Hide'}
                    </Button>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGrid>
          )}
        </Card>

        <Card animate delay={0.08} padding="p-0" className="overflow-x-auto">
          <div className="px-4 py-3 border-b border-[#245B45]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold text-[#245B45]">System Audit Trail</h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#55665F] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter actions or actors..."
                className="w-full rounded-lg border border-[#245B45]/20 bg-white pl-8 pr-3 py-1.5 text-xs"
              />
            </div>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-[#E8E4CE] text-[#245B45] font-semibold">
              <tr>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5">Actor</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Target</th>
                <th className="px-4 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#245B45]/10">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/60 transition-colors">
                  <td className="px-4 py-2.5 font-mono-tabular text-[#55665F] whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="px-4 py-2.5">{log.actor_name || 'System'} ({log.actor_role})</td>
                  <td className="px-4 py-2.5 font-mono-tabular font-semibold text-[#245B45]">{log.action}</td>
                  <td className="px-4 py-2.5 font-mono-tabular">{log.entity_type} #{log.entity_id}</td>
                  <td className="px-4 py-2.5 text-[#55665F] max-w-xs truncate">{log.details_json}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
