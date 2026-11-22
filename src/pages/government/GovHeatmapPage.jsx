import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { CivicMap } from '../../components/maps/CivicMap.jsx';
import { CategoryBarChart } from '../../components/charts/CivicCharts.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { ComplaintDetailModal } from '../../components/complaints/ComplaintDetailModal.jsx';
import { motion } from 'motion/react';
import { FG_EASE, SegmentedTabs } from '../../components/ui/MotionPrimitives.jsx';

export function GovHeatmapPage() {
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [layer, setLayer] = useState('heatmap');
  const [detailId, setDetailId] = useState(null);

  useEffect(() => {
    apiRequest('/api/government/complaints').then((d) => setComplaints(d.complaints || []));
    apiRequest('/api/public/stats').then(setStats);
  }, []);

  const maxWardCount = Math.max(1, ...(stats?.byWard || []).map((w) => Number(w.count) || 0));

  return (
    <DashboardLayout
      title="Live Map & Hotspot Heatmap"
      subtitle="See where issues cluster across Mathura wards and inspect individual reports"
    >
      <div className="space-y-6">
        <Card animate padding="p-4" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#55665F]">
              Switch map layers between hotspot heatmap, area clusters, and urgent pins. Click any marker to inspect.
            </p>
            <SegmentedTabs
              layoutId="gov-heatmap-layer"
              value={layer}
              onChange={setLayer}
              options={[
                { value: 'heatmap', label: 'Heatmap' },
                { value: 'clusters', label: 'Clusters' },
                { value: 'markers', label: 'Pins' },
              ]}
            />
          </div>

          <CivicMap
            complaints={complaints}
            mode={layer}
            height="460px"
            onSelectComplaint={(c) => setDetailId(c.id)}
          />
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card animate delay={0.06}>
            <h2 className="font-display text-base font-bold text-[#245B45] mb-3">
              Issues by Category
            </h2>
            <CategoryBarChart data={stats?.byCategory || []} />
          </Card>

          <Card animate delay={0.12} className="space-y-3">
            <h2 className="font-display text-base font-bold text-[#245B45]">
              Reports by Ward / Locality
            </h2>
            <div className="space-y-3">
              {(stats?.byWard || []).map((w) => {
                const pct = Math.round(((Number(w.count) || 0) / maxWardCount) * 100);
                return (
                  <div key={w.ward} className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#24332D]">{w.ward || 'Mathura Central'}</span>
                      <span className="font-mono-tabular font-bold text-[#F07832]">{w.count} issue(s)</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#E8E4CE] overflow-hidden">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.45, ease: FG_EASE }}
                        style={{ originX: 0, width: `${pct}%` }}
                        className="h-full bg-[#245B45]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <ComplaintDetailModal
        complaintId={detailId}
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
      />
    </DashboardLayout>
  );
}
