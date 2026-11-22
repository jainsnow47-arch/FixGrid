import { useEffect, useState } from 'react';
import { Award, CheckCircle2, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { formatDate } from '../../utils/formatters.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { PassportEmblemSvg } from '../../components/ui/CivicIllustrations.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function StudentPassportPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiRequest('/api/student/passport').then(setData);
  }, []);

  return (
    <DashboardLayout
      title="My Contribution Passport"
      subtitle="Verified record of your project roles, completed deliverables, and faculty reviews"
    >
      <div className="space-y-6">
        <Card animate className="bg-[#1A4332] text-white border-none p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <PassportEmblemSvg className="w-14 h-14 shrink-0" />
              <div>
                <p className="text-xs text-[#7DBE9E] font-semibold">Platform-Verified Portfolio</p>
                <h2 className="font-display text-2xl font-bold mt-0.5">{data?.student?.name}</h2>
                <p className="text-sm text-[#D5EBDD] mt-0.5">
                  {data?.student?.degree} · {data?.student?.yearOfStudy} · {data?.student?.institution}
                </p>
                <p className="text-xs text-[#D5EBDD]/85 mt-2">
                  Skills: {(data?.student?.skills || []).join(' · ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-5 py-3.5 shrink-0">
              <Award className="w-7 h-7 text-[#F07832]" />
              <div>
                <p className="text-2xl font-bold font-mono-tabular">{data?.records?.length || 0}</p>
                <p className="text-[11px] text-[#D5EBDD]">Verified Records</p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-[#D5EBDD]/75 mt-5 pt-3 border-t border-white/15">
            {data?.disclaimer || 'FixGrid AI Contribution Passport is a verified platform portfolio record, not a government-issued certificate.'}
          </p>
        </Card>

        {(data?.records || []).length === 0 ? (
          <EmptyState
            icon={Award}
            title="No verified contributions yet"
            description="Complete milestones in your Project Board and ask your Faculty Mentor to verify your work."
          />
        ) : (
          <StaggerGrid immediate className="space-y-4">
            {data.records.map((rec) => (
              <StaggerItem key={rec.id}>
                <Card interactive className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono-tabular text-[#F07832] font-semibold">{rec.challenge_code}</p>
                      <h3 className="font-display text-lg font-bold text-[#245B45]">{rec.project_title}</h3>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1A4332] bg-[#D5EBDD] px-3 py-1 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verified {formatDate(rec.verified_at)}</span>
                    </span>
                  </div>

                  <p className="text-xs text-[#24332D]">
                    <strong>Role:</strong> {rec.role_held} · <strong>Tasks Completed:</strong> {rec.tasks_completed}
                  </p>
                  <p className="text-sm text-[#55665F] leading-relaxed">{rec.responsibilities}</p>
                  <p className="text-xs text-[#24332D]">
                    <strong>Deliverables:</strong> {rec.deliverables_summary}
                  </p>
                  <p className="text-xs text-[#55665F]">
                    <strong>Skills Demonstrated:</strong> {(rec.skillsDemonstrated || []).join(' · ')}
                  </p>

                  <div className="rounded-xl bg-[#D5EBDD]/35 border border-[#245B45]/15 p-3.5 text-xs flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#245B45] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#245B45]">
                        Verified by {rec.verifier_name} ({rec.verifier_institution || 'Faculty Mentor'})
                      </p>
                      <p className="text-[#55665F] mt-0.5">{rec.verification_note}</p>
                    </div>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGrid>
        )}
      </div>
    </DashboardLayout>
  );
}
