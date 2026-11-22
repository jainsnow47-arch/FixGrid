import { useCallback, useEffect, useState } from 'react';
import { Search, Map as MapIcon, List, ThumbsUp, MessageSquare, MapPin } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { COMPLAINT_STATUSES, ISSUE_CATEGORIES, formatDate } from '../../utils/formatters.js';
import { PublicNavbar } from '../../components/layout/PublicNavbar.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { CivicMap } from '../../components/maps/CivicMap.jsx';
import { ComplaintDetailModal } from '../../components/complaints/ComplaintDetailModal.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { SeverityTag, StatusTag } from '../../components/ui/StatusTag.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { AnimatePresence, motion } from 'motion/react';
import { FG_EASE, SegmentedTabs, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function CommunityFeedPage({ insideDashboard = false }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [mapLayer, setMapLayer] = useState('markers');
  const [filters, setFilters] = useState({ search: '', category: '', status: '', location: '' });
  const [selectedId, setSelectedId] = useState(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.category) params.set('category', filters.category);
      if (filters.status) params.set('status', filters.status);
      if (filters.location) params.set('location', filters.location);
      const res = await apiRequest(`/api/public/feed?${params.toString()}`);
      setItems(res.items || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, showToast]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleVote = async (complaintId) => {
    if (!user) {
      showToast('Sign in to support community civic reports.', 'info');
      return;
    }
    try {
      const res = await apiRequest(`/api/complaints/${complaintId}/vote`, { method: 'POST' });
      setItems((prev) =>
        prev.map((item) =>
          item.id === complaintId ? { ...item, vote_count: res.voteCount, userHasVoted: res.voted } : item
        )
      );
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Search, Filter & View Switcher Bar */}
      <Card animate padding="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-[#55665F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search by tracking ID, title, or street..."
              className="w-full rounded-lg border border-[#245B45]/20 bg-white pl-9 pr-3 py-2 text-sm"
            />
          </div>

          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className="rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
          >
            <option value="">All Categories</option>
            {ISSUE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            {COMPLAINT_STATUSES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          <input
            type="text"
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            placeholder="Ward or neighborhood..."
            className="rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-[#245B45]/10">
          <p className="text-xs text-[#55665F]">
            Showing <strong className="text-[#24332D] tabular-nums">{items.length}</strong> neighborhood reports
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {viewMode === 'map' && (
              <SegmentedTabs
                layoutId="feed-map-layer"
                value={mapLayer}
                onChange={setMapLayer}
                options={[
                  { value: 'markers', label: 'Pins' },
                  { value: 'clusters', label: 'Clusters' },
                  { value: 'heatmap', label: 'Heatmap' },
                ]}
              />
            )}

            <SegmentedTabs
              layoutId="feed-view-mode"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'list', label: 'Cards', icon: List },
                { value: 'map', label: 'Live Map', icon: MapIcon },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <Skeleton className="h-44 w-full mb-3" />
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </Card>
            ))}
          </motion.div>
        ) : items.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: FG_EASE }}
          >
            <EmptyState
              icon={MapPin}
              title="No civic reports match those filters"
              description="Try clearing the search query or switching category and status filters."
              actionLabel="Reset All Filters"
              onAction={() => setFilters({ search: '', category: '', status: '', location: '' })}
            />
          </motion.div>
        ) : viewMode === 'map' ? (
          <motion.div
            key="map-view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: FG_EASE }}
          >
            <Card padding="p-3">
              <CivicMap
                complaints={items}
                mode={mapLayer}
                height="520px"
                onSelectComplaint={(c) => setSelectedId(c.id)}
              />
            </Card>
          </motion.div>
        ) : (
          <StaggerGrid key="list-view" immediate className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <StaggerItem key={item.id}>
              <Card interactive padding="p-0" className="h-full overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="h-44 bg-[#D5EBDD]/40 overflow-hidden relative">
                    {item.primary_image ? (
                      <img
                        src={item.primary_image}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-xs text-[#55665F] fg-dot-grid">
                        <MapPin className="w-5 h-5 text-[#245B45] mb-1" />
                        <span>{item.category}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 sm:p-5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#55665F]">
                      <span className="font-mono-tabular font-semibold text-[#245B45]">{item.tracking_code}</span>
                      <span>{formatDate(item.created_at)}</span>
                    </div>

                    <h3 className="font-display text-base font-bold text-[#24332D] leading-snug">
                      {item.title}
                    </h3>

                    <p className="text-xs text-[#55665F]">
                      {item.category} · {item.ward || item.address}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <StatusTag status={item.status} />
                      <SeverityTag severity={item.severity} />
                    </div>
                  </div>
                </div>

                <div className="px-4 sm:px-5 py-3 border-t border-[#245B45]/10 flex items-center justify-between gap-2 bg-[#F5F1DC]/45">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleVote(item.id)}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        item.userHasVoted
                          ? 'bg-[#245B45] text-white'
                          : 'bg-[#D5EBDD]/70 text-[#245B45] hover:bg-[#D5EBDD]'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{item.vote_count || 0}</span>
                    </button>
                    <span className="inline-flex items-center gap-1 text-xs text-[#55665F] tabular-nums">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{item.comment_count || 0}</span>
                    </span>
                  </div>

                  <Button size="sm" variant="outline" onClick={() => setSelectedId(item.id)}>
                    Inspect
                  </Button>
                </div>
              </Card>
            </StaggerItem>
          ))}
          </StaggerGrid>
        )}
      </AnimatePresence>

      <ComplaintDetailModal
        complaintId={selectedId}
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        onUpdated={loadFeed}
      />
    </div>
  );

  if (insideDashboard) {
    return (
      <DashboardLayout
        title="Neighborhood Issue Feed"
        subtitle="Browse, support, and discuss local reports in your area"
      >
        {content}
      </DashboardLayout>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F1DC] text-[#24332D]">
      <PublicNavbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <p className="text-xs font-semibold text-[#F07832]">Public Transparency Feed</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#245B45] mt-1">
            Neighborhood Issue Feed & Live Map
          </h1>
          <p className="text-sm text-[#55665F] mt-1">
            Follow active Mathura demonstration reports and community-submitted issues with full privacy protection.
          </p>
        </div>
        {content}
      </main>
    </div>
  );
}
