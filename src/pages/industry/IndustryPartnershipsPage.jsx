import { useEffect, useState } from 'react';
import { Handshake } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { formatDate } from '../../utils/formatters.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function IndustryPartnershipsPage() {
  const [interests, setInterests] = useState([]);

  useEffect(() => {
    apiRequest('/api/industry/dashboard').then((d) => setInterests(d.myInterests || []));
  }, []);

  return (
    <DashboardLayout
      title="Support Offers"
      subtitle="Track mentorship, hardware, and CSR proposals you’ve sent"
    >
      {interests.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No support offers sent yet"
          description="Browse Civic Challenges to offer mentorship, lab equipment, or CSR pilot support."
        />
      ) : (
        <StaggerGrid immediate className="space-y-4">
          {interests.map((item) => (
            <StaggerItem key={item.id}>
              <Card interactive className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#55665F]">
                  <span className="font-semibold text-[#F07832]">{item.support_type}</span>
                  <span className="font-mono-tabular">{formatDate(item.created_at)} · {item.status}</span>
                </div>
                <h3 className="font-display text-base font-bold text-[#245B45]">
                  {item.challenge_title || item.project_title || 'General Civic Support'}
                </h3>
                <p className="text-sm text-[#24332D] leading-relaxed">{item.message}</p>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}
    </DashboardLayout>
  );
}
