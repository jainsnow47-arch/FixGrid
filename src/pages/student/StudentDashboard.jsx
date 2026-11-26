import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Award, Compass, FolderKanban, Users } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { motion } from 'motion/react';
import { FG_EASE, MetricTile, RevealSection, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    apiRequest('/api/student/dashboard').then(setData);
  }, []);

  return (
    <DashboardLayout
      title="Student Innovation Hub"
      subtitle="Skill-matched city challenges, team workspaces, and your verified Contribution Passport"
      primaryAction={
        <Button variant="primary" size="sm" onClick={() => navigate('/student/challenges')}>
          <Compass className="w-4 h-4" />
          <span>Find Challenges</span>
        </Button>
      }
    >
      <div className="space-y-6">
        <RevealSection immediate>
          <div className="rounded-2xl bg-[#1A4332] text-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#7DBE9E]">Student Innovator · {user?.institutionOrOrg || 'University Partner'}</p>
              <h2 className="font-display text-xl sm:text-2xl font-bold">
                Ready to build, {user?.name?.split(' ')[0] || 'Innovator'}?
              </h2>
              <p className="text-xs sm:text-sm text-[#D5EBDD] max-w-xl leading-relaxed">
                FixGrid AI matches open civic engineering challenges to your skills and weekly availability, then tracks your team’s milestones toward a faculty-verified Passport.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <Button variant="primary" onClick={() => navigate('/student/challenges')}>
                <span>Browse Matched Challenges</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="secondary" onClick={() => navigate('/student/projects')}>
                <span>Open Project Board</span>
              </Button>
            </div>
          </div>
        </RevealSection>

        <StaggerGrid immediate className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <MetricTile
              label="Active Projects"
              value={data?.activeProjects?.length || 0}
              icon={FolderKanban}
              accent="forest"
              onClick={() => navigate('/student/projects')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="My Teams"
              value={data?.myTeams?.length || 0}
              icon={Users}
              accent="sage"
              onClick={() => navigate('/student/teams')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Team Invites"
              value={data?.invitations?.length || 0}
              icon={Users}
              accent="orange"
              onClick={() => navigate('/student/teams')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Passport Entries"
              value={data?.passportCount || 0}
              icon={Award}
              accent="forest"
              onClick={() => navigate('/student/passport')}
            />
          </StaggerItem>
        </StaggerGrid>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[#245B45]">
                Top Challenges Matched to Your Skills
              </h2>
              <p className="text-xs text-[#55665F]">Scores update automatically whenever you edit your skills or availability.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/student/challenges')}>
              See All Matches
            </Button>
          </div>

          <StaggerGrid immediate className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.recommendations || []).map((ch) => (
              <StaggerItem key={ch.id}>
                <Card interactive className="h-full flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-mono-tabular font-semibold text-[#245B45]">
                        {ch.challenge_code}
                        {ch.source_complaint_code ? ` · Solves ${ch.source_complaint_code}` : ''}
                      </span>
                      <span className="font-mono-tabular font-bold text-[#F07832] shrink-0">{ch.match.overallScore}% Match</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#E8E4CE] overflow-hidden">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.45, ease: FG_EASE }}
                        style={{ originX: 0, width: `${ch.match.overallScore}%` }}
                        className="h-full bg-[#245B45]"
                      />
                    </div>
                    <h3 className="font-display text-base font-bold text-[#24332D]">{ch.title}</h3>
                    <p className="text-xs text-[#55665F] leading-relaxed">{ch.match.explanation}</p>
                  </div>
                  <div className="pt-3 border-t border-[#245B45]/10 flex items-center justify-between gap-2">
                    <span className="text-xs text-[#245B45] truncate">
                      Matched: {(ch.match.matchedSkills || []).join(', ') || 'See breakdown'}
                    </span>
                    <Button size="sm" variant="forest" onClick={() => navigate('/student/challenges')}>
                      <span>Inspect Score</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>

        {data?.activeProjects?.length > 0 && (
          <Card animate delay={0.12} className="space-y-3">
            <h2 className="font-display text-base font-bold text-[#245B45]">Your Active Project Workspaces</h2>
            <div className="space-y-2.5">
              {data.activeProjects.map((proj) => (
                <div key={proj.id} className="rounded-xl bg-white border border-[#245B45]/12 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono-tabular text-[#55665F]">{proj.challenge_code} · Team {proj.team_name}</p>
                    <p className="text-sm font-bold text-[#24332D] mt-0.5">{proj.title}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => navigate('/student/projects')}>
                    Open Task Board
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
