import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { AnimatePresence, motion } from 'motion/react';
import { FG_EASE } from '../../components/ui/MotionPrimitives.jsx';

export function AdminSettingsPage() {
  const { showToast } = useToast();
  const [slaRules, setSlaRules] = useState([]);
  const [weights, setWeights] = useState({ skills: 35, domain: 25, experience: 15, availability: 15, proximity: 10 });

  useEffect(() => {
    apiRequest('/api/admin/overview').then((d) => {
      setSlaRules(d.slaRules || []);
      if (d.matchWeights) setWeights(d.matchWeights);
    });
  }, []);

  const totalWeight =
    (Number(weights.skills) || 0) +
    (Number(weights.domain) || 0) +
    (Number(weights.experience) || 0) +
    (Number(weights.availability) || 0) +
    (Number(weights.proximity) || 0);

  const saveSla = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/sla', { method: 'PUT', body: { rules: slaRules } });
      showToast('Deadline rules updated.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const saveWeights = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/match-weights', { method: 'PUT', body: weights });
      showToast('Student matching weights updated.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <DashboardLayout
      title="SLA & Match Rules"
      subtitle="Set repair response deadlines and adjust how FixGrid AI scores student challenge matches"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card animate>
          <h2 className="font-display text-base font-bold text-[#245B45] mb-1">
            Repair Deadlines (Hours)
          </h2>
          <p className="text-xs text-[#55665F] mb-4">
            Reports exceeding these hours automatically alert the escalation contact below.
          </p>
          <form onSubmit={saveSla} className="space-y-3">
            {slaRules.map((rule, idx) => (
              <div key={rule.severity} className="rounded-xl bg-white border border-[#245B45]/12 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-[#24332D]">{rule.severity} Priority</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      value={rule.target_hours}
                      onChange={(e) => {
                        const next = [...slaRules];
                        next[idx] = { ...rule, target_hours: Number(e.target.value) };
                        setSlaRules(next);
                      }}
                      className="w-20 rounded-lg border border-[#245B45]/20 px-2.5 py-1 text-right font-mono-tabular"
                    />
                    <span className="text-[#55665F]">hrs</span>
                  </div>
                </div>
                <input
                  type="text"
                  value={rule.escalation_target}
                  onChange={(e) => {
                    const next = [...slaRules];
                    next[idx] = { ...rule, escalation_target: e.target.value };
                    setSlaRules(next);
                  }}
                  className="w-full rounded-lg border border-[#245B45]/20 px-2.5 py-1.5"
                />
              </div>
            ))}
            <Button type="submit" variant="forest">Save Deadline Rules</Button>
          </form>
        </Card>

        <Card animate delay={0.08}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <h2 className="font-display text-base font-bold text-[#245B45]">
              Student Skill-Match Weights
            </h2>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={totalWeight === 100 ? 'valid' : 'warn'}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.16, ease: FG_EASE }}
                className={`font-mono-tabular text-xs font-bold ${
                  totalWeight === 100 ? 'text-[#245B45]' : 'text-[#9B2226]'
                }`}
              >
                Total: {totalWeight}%
              </motion.span>
            </AnimatePresence>
          </div>
          <p className="text-xs text-[#55665F] mb-4">
            Recommended total is 100%. Defaults: Skills 35% · Domain 25% · Experience 15% · Availability 15% · Location 10%.
          </p>
          <form onSubmit={saveWeights} className="space-y-3 text-xs">
            {[
              { key: 'skills', label: 'Technical Skills Match' },
              { key: 'domain', label: 'Civic Domain Interest' },
              { key: 'experience', label: 'Prior Project Experience' },
              { key: 'availability', label: 'Weekly Availability' },
              { key: 'proximity', label: 'City / Campus Proximity' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 bg-white border border-[#245B45]/12 rounded-xl p-3.5">
                <label className="font-semibold text-[#24332D]">{item.label}</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={weights[item.key]}
                    onChange={(e) => setWeights({ ...weights, [item.key]: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-[#245B45]/20 px-2.5 py-1 text-right font-mono-tabular"
                  />
                  <span className="text-[#55665F]">%</span>
                </div>
              </div>
            ))}
            <Button type="submit" variant="primary">Save Match Weights</Button>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
