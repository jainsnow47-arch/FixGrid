import { useEffect, useState } from 'react';
import { Bookmark, CheckCircle2, Compass, Send } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { AnimatePresence, motion } from 'motion/react';
import { FG_EASE, SegmentedTabs, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function StudentChallengesPage() {
  const { showToast } = useToast();
  const [challenges, setChallenges] = useState([]);
  const [teams, setTeams] = useState([]);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'saved' | 'top'
  const [applyTarget, setApplyTarget] = useState(null);
  const [teamId, setTeamId] = useState('');
  const [proposal, setProposal] = useState('');

  const load = () => {
    apiRequest('/api/student/challenges').then((d) => setChallenges(d.challenges || []));
    apiRequest('/api/teams').then((d) => setTeams(d.myTeams || [])).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const visibleChallenges = challenges.filter((ch) => {
    if (filterTab === 'saved') return ch.saved;
    if (filterTab === 'top') return (ch.match?.overallScore || 0) >= 70;
    return true;
  });

  const handleToggleSave = async (id) => {
    try {
      const res = await apiRequest(`/api/student/challenges/${id}/save`, { method: 'POST' });
      setChallenges((prev) => prev.map((c) => (c.id === id ? { ...c, saved: res.saved } : c)));
      showToast(res.saved ? 'Saved to your shortlist.' : 'Removed from saved.', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest(`/api/student/challenges/${applyTarget.id}/apply`, {
        method: 'POST',
        body: { teamId: teamId ? Number(teamId) : null, proposalSummary: proposal },
      });
      showToast(`${res.message} (Match Score: ${res.matchScore}%)`, 'success');
      setApplyTarget(null);
      setProposal('');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <DashboardLayout
      title="Find Civic Challenges"
      subtitle="See exactly why each challenge matches your skills, interests, availability, and location"
    >
      <div className="space-y-5">
        <SegmentedTabs
          layoutId="student-challenge-filter"
          value={filterTab}
          onChange={setFilterTab}
          options={[
            { value: 'all', label: `All Challenges (${challenges.length})` },
            { value: 'top', label: 'Strong Matches (70%+)' },
            { value: 'saved', label: 'Saved' },
          ]}
        />

        <AnimatePresence mode="wait">
          {visibleChallenges.length === 0 ? (
            <motion.div
              key={`empty-${filterTab}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: FG_EASE }}
            >
              <EmptyState
                icon={Compass}
                title="No challenges match this filter"
                description="Try viewing All Challenges or updating your skills in Skills & Privacy to unlock stronger matches."
                actionLabel="Show All Challenges"
                onAction={() => setFilterTab('all')}
              />
            </motion.div>
          ) : (
            <StaggerGrid key={`list-${filterTab}`} immediate className="space-y-5">
              {visibleChallenges.map((ch) => (
                <StaggerItem key={ch.id}>
                  <Card interactive className="space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#55665F]">
                          <span className="font-mono-tabular font-semibold text-[#245B45]">{ch.challenge_code}</span>
                          <span>·</span>
                          <span>{ch.category}</span>
                          <span>·</span>
                          <span>{ch.difficulty}</span>
                          <span>·</span>
                          <span>Due {ch.deadline}</span>
                        </div>
                        <h2 className="font-display text-lg font-bold text-[#24332D]">{ch.title}</h2>
                        <p className="text-sm text-[#55665F] leading-relaxed">{ch.description}</p>
                        <p className="text-xs text-[#24332D] pt-1">
                          <strong>Expected Outcome:</strong> {ch.expected_outcome}
                        </p>
                      </div>

                      {/* Clear 5-Factor Match Breakdown */}
                      <div className="lg:w-80 shrink-0 rounded-xl bg-[#D5EBDD]/55 border border-[#245B45]/18 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#245B45]">Skill Match Score</span>
                          <span className="font-mono-tabular text-2xl font-bold text-[#F07832]">
                            {ch.match.overallScore}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-white/85 overflow-hidden">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.45, ease: FG_EASE }}
                            style={{ originX: 0, width: `${ch.match.overallScore}%` }}
                            className="h-full bg-[#245B45]"
                          />
                        </div>
                        <div className="grid grid-cols-5 gap-1 text-[10px] text-center font-mono-tabular text-[#24332D]">
                          <div className="rounded bg-white/70 py-1">Skills<br /><strong>{ch.match.breakdown.skills}/{ch.match.weights.skills}</strong></div>
                          <div className="rounded bg-white/70 py-1">Domain<br /><strong>{ch.match.breakdown.domain}/{ch.match.weights.domain}</strong></div>
                          <div className="rounded bg-white/70 py-1">Exp<br /><strong>{ch.match.breakdown.experience}/{ch.match.weights.experience}</strong></div>
                          <div className="rounded bg-white/70 py-1">Hours<br /><strong>{ch.match.breakdown.availability}/{ch.match.weights.availability}</strong></div>
                          <div className="rounded bg-white/70 py-1">City<br /><strong>{ch.match.breakdown.proximity}/{ch.match.weights.proximity}</strong></div>
                        </div>
                        <p className="text-[11px] text-[#24332D] leading-snug">{ch.match.explanation}</p>
                        {ch.match.missingSkills?.length > 0 && (
                          <p className="text-[11px] text-[#8C520A]">
                            Tip — helpful to team up on: {ch.match.missingSkills.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#245B45]/10 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-[#55665F]">
                        Deliverables: {(ch.deliverables || []).join(' · ')}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleToggleSave(ch.id)}>
                          <Bookmark className={`w-3.5 h-3.5 ${ch.saved ? 'fill-[#F07832] text-[#F07832]' : ''}`} />
                          <span>{ch.saved ? 'Saved' : 'Save'}</span>
                        </Button>
                        {ch.applicationStatus ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#245B45] px-3 py-1.5 bg-[#D5EBDD] rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Applied ({ch.applicationStatus})</span>
                          </span>
                        ) : (
                          <Button size="sm" variant="primary" onClick={() => setApplyTarget(ch)}>
                            <Send className="w-3.5 h-3.5" />
                            <span>Apply with Proposal</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerGrid>
          )}
        </AnimatePresence>
      </div>

      <Modal
        open={Boolean(applyTarget)}
        onClose={() => setApplyTarget(null)}
        title={`Apply to ${applyTarget?.challenge_code}`}
        subtitle={applyTarget?.title}
      >
        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Apply Individually or With a Team</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            >
              <option value="">Individual Application</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>Team: {t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Your Approach & Prototype Plan</label>
            <textarea
              rows={4}
              required
              minLength={20}
              value={proposal}
              onChange={(e) => setProposal(e.target.value)}
              placeholder="Explain what your team plans to build, tools or sensors you’ll use, and how you will test it..."
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" variant="primary" className="w-full">
            Submit Proposal
          </Button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
