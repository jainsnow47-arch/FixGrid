import { useEffect, useState } from 'react';
import { Lock, Shield, Users } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function IndustryTeamsPage() {
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    apiRequest('/api/industry/dashboard').then((d) => setTeams(d.teams || []));
  }, []);

  return (
    <DashboardLayout
      title="Student Teams"
      subtitle="View student innovation squads—personal details only appear when students opt in"
    >
      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No student teams listed yet"
          description="Active student teams building solutions for civic challenges will appear here."
        />
      ) : (
        <StaggerGrid immediate className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {teams.map((t) => (
            <StaggerItem key={t.id}>
              <Card interactive className="h-full space-y-3">
                <div className="flex items-center justify-between text-xs text-[#55665F]">
                  <span className="font-mono-tabular font-semibold text-[#F07832]">{t.challenge_code || 'Open Squad'}</span>
                  <span>{t.pilot_approved ? 'Gov Pilot Approved' : 'Prototype Phase'}</span>
                </div>
                <h3 className="font-display text-lg font-bold text-[#245B45]">{t.name}</h3>
                <p className="text-xs text-[#55665F] leading-relaxed">{t.description}</p>
                <div className="space-y-2 pt-2 border-t border-[#245B45]/10">
                  {t.members.map((m, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-3 text-xs ${
                        m.consented
                          ? 'bg-white border-[#245B45]/12'
                          : 'bg-[#F5F1DC]/60 border-[#245B45]/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#24332D] flex items-center gap-1.5">
                          {m.consented ? (
                            <Shield className="w-3.5 h-3.5 text-[#245B45]" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-[#55665F]" />
                          )}
                          <span>{m.name}</span>
                        </span>
                        <span className="text-[#245B45] font-semibold">{m.project_role}</span>
                      </div>
                      <p className="text-[#55665F] mt-1">
                        {m.consented
                          ? `${m.university} · ${(m.skills || []).join(', ')}`
                          : 'Private profile — student has not enabled partner sharing'}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </DashboardLayout>
  );
}
