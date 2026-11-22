import { useEffect, useState } from 'react';
import { Check, Users, X } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { AnimatePresence } from 'motion/react';
import { StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function FacultyMentorshipPage() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState([]);

  const load = () => {
    apiRequest('/api/faculty/dashboard').then((d) => setRequests(d.requests || []));
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id, status) => {
    try {
      const res = await apiRequest(`/api/faculty/mentorship/${id}`, {
        method: 'PATCH',
        body: { status },
      });
      showToast(res.message, 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <DashboardLayout
      title="Team Requests"
      subtitle="Accept or decline mentorship requests from student project teams"
    >
      <AnimatePresence mode="wait">
        {requests.length === 0 ? (
          <EmptyState
            key="empty"
            icon={Users}
            title="No mentorship requests yet"
            description="When student teams select you as their project mentor, their requests will appear here."
          />
        ) : (
          <StaggerGrid key="list" immediate className="space-y-4">
            {requests.map((r) => (
              <StaggerItem key={r.id}>
                <Card interactive className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-mono-tabular text-[#55665F]">
                      {r.challenge_code} · Status: <strong className="text-[#245B45]">{r.status}</strong>
                    </p>
                    <h3 className="font-display text-base font-bold text-[#24332D]">{r.project_title}</h3>
                    <p className="text-xs text-[#55665F]">Team: {r.team_name}</p>
                    {r.message && <p className="text-xs text-[#24332D] pt-1 leading-relaxed">{r.message}</p>}
                  </div>
                  {r.status === 'Requested' && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="forest" onClick={() => decide(r.id, 'Accepted')}>
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept Team</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => decide(r.id, 'Declined')}>
                        <X className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </Button>
                    </div>
                  )}
                </Card>
              </StaggerItem>
            ))}
          </StaggerGrid>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
