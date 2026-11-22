import { useEffect, useState } from 'react';
import { FolderKanban } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { motion } from 'motion/react';
import { FG_EASE, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function FacultyProjectsPage() {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    apiRequest('/api/faculty/dashboard').then((d) => setProjects(d.projects || []));
  }, []);

  return (
    <DashboardLayout
      title="Student Projects"
      subtitle="View team progress, submitted files, verified milestones, and issued Passports"
    >
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No student projects assigned"
          description="Projects appear here as soon as you accept a team’s mentorship request."
        />
      ) : (
        <StaggerGrid immediate className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((proj) => {
            const totalM = proj.milestones?.length || 0;
            const verifiedM = proj.milestones?.filter((m) => m.status === 'Verified').length || 0;
            const pct = totalM > 0 ? Math.round((verifiedM / totalM) * 100) : 0;

            return (
              <StaggerItem key={proj.id}>
                <Card interactive className="h-full flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-mono-tabular text-[#F07832] font-semibold">{proj.challenge_code}</p>
                    <h3 className="font-display text-lg font-bold text-[#245B45]">{proj.title}</h3>
                    <p className="text-xs text-[#55665F]">Team: {proj.team_name}</p>
                    <p className="text-sm text-[#24332D] leading-relaxed">{proj.objectives}</p>
                  </div>
                  <div className="space-y-2.5 pt-3 border-t border-[#245B45]/10 text-xs">
                    <div className="w-full h-1.5 rounded-full bg-[#E8E4CE] overflow-hidden">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.45, ease: FG_EASE }}
                        style={{ originX: 0, width: `${pct}%` }}
                        className="h-full bg-[#245B45]"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 font-mono-tabular">
                      <div>Deliverables<br /><strong className="text-[#24332D]">{proj.deliverables?.length || 0}</strong></div>
                      <div>Milestones<br /><strong className="text-[#245B45]">{verifiedM}/{totalM}</strong></div>
                      <div>Passports<br /><strong className="text-[#F07832]">{proj.contributions?.length || 0}</strong></div>
                    </div>
                  </div>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      )}
    </DashboardLayout>
  );
}
