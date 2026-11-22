import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Cpu, ScrollText, Settings, SlidersHorizontal, Users } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { MetricTile, RevealSection, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    apiRequest('/api/admin/overview').then(setData);
  }, []);

  return (
    <DashboardLayout
      title="System Overview"
      subtitle="Manage user permissions, city departments, deadline rules, and audit history"
      primaryAction={
        <Button variant="primary" size="sm" onClick={() => navigate('/admin/settings')}>
          <Settings className="w-4 h-4" />
          <span>SLA & Match Rules</span>
        </Button>
      }
    >
      <div className="space-y-6">
        <RevealSection immediate>
          <div className="rounded-2xl bg-[#1A4332] text-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#7DBE9E]">Platform Administration</p>
              <h2 className="font-display text-xl sm:text-2xl font-bold">
                Full control over routing, SLAs, and permissions
              </h2>
              <p className="text-xs sm:text-sm text-[#D5EBDD] max-w-xl leading-relaxed">
                Keep municipal routing accurate, verify academic or industry accounts, tune matching weights, and audit every status change from one console.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <Button variant="primary" onClick={() => navigate('/admin/users')}>
                <span>Manage Users</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="secondary" onClick={() => navigate('/admin/audit-logs')}>
                <span>View Audit Trail</span>
              </Button>
            </div>
          </div>
        </RevealSection>

        <StaggerGrid immediate className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <MetricTile
              label="Total Accounts"
              value={data?.users?.length || 0}
              icon={Users}
              accent="forest"
              onClick={() => navigate('/admin/users')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="City Departments"
              value={data?.departments?.length || 0}
              icon={Building2}
              accent="sage"
              onClick={() => navigate('/admin/departments')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Audit Events"
              value={data?.auditLogs?.length || 0}
              icon={ScrollText}
              accent="orange"
              onClick={() => navigate('/admin/audit-logs')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="AI Triage Status"
              textValue={data?.aiStatus?.geminiConfigured ? 'Gemini Connected' : 'Fallback Active'}
              hint="Honest rule-based backup ready"
              icon={Cpu}
              accent="forest"
            />
          </StaggerItem>
        </StaggerGrid>

        <StaggerGrid immediate className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StaggerItem>
            <Card interactive className="h-full space-y-2">
              <p className="font-bold text-sm text-[#24332D] flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#F07832]" />
                <span>AI Civic Intelligence</span>
              </p>
              <p className="text-xs text-[#55665F] leading-relaxed">
                {data?.aiStatus?.modeLabel || 'Checking active AI integration...'}
              </p>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card interactive className="h-full space-y-2">
              <p className="font-bold text-sm text-[#24332D] flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#245B45]" />
                <span>OpenStreetMap + Leaflet</span>
              </p>
              <p className="text-xs text-[#55665F] leading-relaxed">
                Interactive map layers, cluster views, severity heatmaps, and reverse address lookup are active.
              </p>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card interactive className="h-full space-y-2">
              <p className="font-bold text-sm text-[#24332D] flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-[#245B45]" />
                <span>Notifications & Audit Trail</span>
              </p>
              <p className="text-xs text-[#55665F] leading-relaxed">
                Real-time alerts and immutable action logging enabled across all six user workspaces.
              </p>
            </Card>
          </StaggerItem>
        </StaggerGrid>
      </div>
    </DashboardLayout>
  );
}
