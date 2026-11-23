import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  Filter,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { PublicNavbar } from '../../components/layout/PublicNavbar.jsx';
import {
  D3CategoryProgressChart,
  D3CivicTrendChart,
  D3DailyActivityChart,
} from '../../components/charts/D3TrendCharts.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import {
  FG_EASE,
  MetricTile,
  SegmentedTabs,
  StaggerGrid,
  StaggerItem,
} from '../../components/ui/MotionPrimitives.jsx';

export function CivicAnalyticsPage({ insideDashboard = false }) {
  const { showToast } = useToast();

  const [granularity, setGranularity] = useState('day');
  const [trendMode, setTrendMode] = useState('volume');
  const [category, setCategory] = useState('');
  const [ward, setWard] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    params.set('granularity', granularity);
    if (category) params.set('category', category);
    if (ward) params.set('ward', ward);

    apiRequest(`/api/public/analytics?${params.toString()}`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) showToast(err.message || 'Could not load analytics.', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [granularity, category, ward]);

  const summary = data?.summary || {
    totalSubmitted: 0,
    resolvedCount: 0,
    inProgressCount: 0,
    escalatedCount: 0,
    resolutionRatePct: 0,
    slaCompliancePct: 100,
    avgResolutionHours: null,
  };

  const timeline = data?.timeline || [];
  const categoryBreakdown = data?.categoryBreakdown || [];
  const wardBreakdown = data?.wardBreakdown || [];
  const availableCategories = data?.filters?.categories || [];
  const availableWards = data?.filters?.wards || [];

  const hasFilters = Boolean(category || ward || granularity !== 'day');

  const content = (
    <div className="space-y-6">
      {/* Filter & Time Granularity Bar */}
      <Card animate className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#245B45]">
            <Filter className="w-3.5 h-3.5 text-[#F07832]" />
            <span>Filters:</span>
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by issue category"
            className="rounded-lg border border-[#245B45]/20 bg-white px-3 py-1.5 text-xs text-[#24332D]"
          >
            <option value="">All Categories</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            aria-label="Filter by ward"
            className="rounded-lg border border-[#245B45]/20 bg-white px-3 py-1.5 text-xs text-[#24332D]"
          >
            <option value="">All Wards</option>
            {availableWards.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          {hasFilters && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setCategory('');
                setWard('');
                setGranularity('day');
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs
            layoutId="fg-analytics-granularity"
            value={granularity}
            onChange={setGranularity}
            options={[
              { value: 'day', label: 'Daily Trend' },
              { value: 'hour', label: '4-Hour Window' },
            ]}
          />
        </div>
      </Card>

      {/* Summary KPI Tiles */}
      <StaggerGrid immediate className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StaggerItem>
          <MetricTile
            label="Total Submitted"
            value={summary.totalSubmitted}
            icon={BarChart3}
            accent="forest"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricTile
            label="Resolved Issues"
            value={summary.resolvedCount}
            icon={CheckCircle2}
            accent="sage"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricTile
            label="Resolution Rate"
            textValue={`${summary.resolutionRatePct}%`}
            hint={`${summary.inProgressCount} currently in progress`}
            icon={TrendingUp}
            accent="orange"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricTile
            label="Avg. Resolution Time"
            textValue={summary.avgResolutionHours !== null ? `${summary.avgResolutionHours} hrs` : 'Pending fixes'}
            hint="Submission to verified resolution"
            icon={Clock}
            accent="forest"
          />
        </StaggerItem>
        <StaggerItem>
          <MetricTile
            label="On-Time SLA Rate"
            textValue={`${summary.slaCompliancePct}%`}
            hint={`${summary.escalatedCount} escalated`}
            icon={ShieldCheck}
            accent={summary.escalatedCount > 0 ? 'danger' : 'sage'}
          />
        </StaggerItem>
      </StaggerGrid>

      {/* Primary D3 Multi-Series Civic Improvement Trend Chart */}
      <Card animate delay={0.05} className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-[#245B45] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#F07832]" />
              <span>Civic Improvement Trajectory Over Time</span>
            </h2>
            <p className="text-xs text-[#55665F] mt-0.5">
              {trendMode === 'volume'
                ? 'Cumulative submitted reports compared with active repairs and verified resolutions (hover chart to inspect snapshots).'
                : 'Cumulative percentage of submitted neighborhood issues successfully resolved over time.'}
            </p>
          </div>

          <SegmentedTabs
            layoutId="fg-analytics-trend-mode"
            value={trendMode}
            onChange={setTrendMode}
            options={[
              { value: 'volume', label: 'Issue Volume' },
              { value: 'rate', label: 'Resolution Rate %' },
            ]}
          />
        </div>

        {/* Clean Chart Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-[#55665F]">
          {trendMode === 'volume' ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-[#55665F]" />
                <span>Cumulative Submitted</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#F07832]" />
                <span>Active Repairs</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#245B45]" />
                <span>Resolved Issues</span>
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#245B45]" />
              <span>Cumulative Resolution Rate (%)</span>
            </span>
          )}
        </div>

        {loading && !data ? (
          <div className="h-[290px] rounded-xl bg-[#E8E4CE]/40 animate-pulse" />
        ) : (
          <D3CivicTrendChart data={timeline} mode={trendMode} />
        )}
      </Card>

      {/* Secondary D3 Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <Card animate delay={0.08} className="lg:col-span-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#245B45] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#F07832]" />
                <span>Submitted vs. Resolved Activity</span>
              </h2>
              <p className="text-xs text-[#55665F]">New complaints filed versus completed repairs per interval</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#55665F]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#F07832]" />
                <span>Submitted</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#245B45]" />
                <span>Resolved</span>
              </span>
            </div>
          </div>

          <D3DailyActivityChart data={timeline} />
        </Card>

        <Card animate delay={0.1} className="lg:col-span-6 space-y-3">
          <div>
            <h2 className="font-display text-base font-bold text-[#245B45]">
              Category Resolution Progress
            </h2>
            <p className="text-xs text-[#55665F]">
              Stacked breakdown showing resolved, active, pending, and escalated tickets per category
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#55665F]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#245B45]" />
              <span>Resolved</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#7DBE9E]" />
              <span>In Progress</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#C4841D]" />
              <span>Awaiting Review</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#9B2226]" />
              <span>Escalated</span>
            </span>
          </div>

          <D3CategoryProgressChart data={categoryBreakdown} />
        </Card>
      </div>

      {/* Ward Improvement Breakdown Table */}
      <Card animate delay={0.12} className="space-y-4">
        <div>
          <h2 className="font-display text-base font-bold text-[#245B45]">Ward Improvement Breakdown</h2>
          <p className="text-xs text-[#55665F]">Track issue closure rates and open workloads across city wards</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#245B45]/12 text-[#55665F]">
                <th className="py-2.5 pr-4 font-semibold">Ward / Locality</th>
                <th className="py-2.5 px-3 font-semibold text-right">Submitted</th>
                <th className="py-2.5 px-3 font-semibold text-right">Resolved</th>
                <th className="py-2.5 px-3 font-semibold text-right">Open</th>
                <th className="py-2.5 pl-4 font-semibold w-48">Improvement Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#245B45]/10">
              {wardBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#55665F]">
                    No ward records match the current filter.
                  </td>
                </tr>
              ) : (
                wardBreakdown.map((w) => (
                  <tr key={w.ward} className="hover:bg-[#F5F1DC]/45 transition-colors">
                    <td className="py-2.5 pr-4 font-semibold text-[#24332D]">{w.ward}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">{w.total}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[#245B45]">
                      {w.resolved}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-[#D96522]">{w.open}</td>
                    <td className="py-2.5 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-[#E8E4CE] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${w.resolutionRatePct}%` }}
                            transition={{ duration: 0.45, ease: FG_EASE }}
                            className="h-full rounded-full bg-[#245B45]"
                          />
                        </div>
                        <span className="font-mono-tabular font-semibold text-[#245B45] w-9 text-right">
                          {w.resolutionRatePct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  if (insideDashboard) {
    return (
      <DashboardLayout
        title="Civic Improvement Trends"
        subtitle="Interactive D3.js analytics tracking issue submissions, repair velocity, and ward progress"
      >
        {content}
      </DashboardLayout>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F1DC] text-[#24332D]">
      <PublicNavbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#F07832]">FixGrid AI · Citywide Civic Trends</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#245B45]">
            Civic Improvement Analytics
          </h1>
          <p className="text-sm text-[#55665F] max-w-2xl">
            Explore real submission volume, repair velocity, category closure progress, and ward-level improvement trends powered by D3.js.
          </p>
        </div>
        {content}
      </main>
    </div>
  );
}
