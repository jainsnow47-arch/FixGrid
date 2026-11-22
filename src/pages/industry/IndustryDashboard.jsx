import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Handshake, Lightbulb, Shield, Users } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { MetricTile, RevealSection, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function IndustryDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [profileForm, setProfileForm] = useState({ organizationName: '', sector: '', csrFocus: '', website: '' });

  useEffect(() => {
    apiRequest('/api/industry/dashboard').then((d) => {
      setData(d);
      if (d.profile) {
        setProfileForm({
          organizationName: d.profile.organization_name || '',
          sector: d.profile.sector || '',
          csrFocus: d.profile.csr_focus || '',
          website: d.profile.website || '',
        });
      }
    });
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/industry/profile', { method: 'PUT', body: profileForm });
      showToast('Partner profile saved.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <DashboardLayout
      title="Partner Overview"
      subtitle="Back approved city challenges and consented student teams with mentorship or CSR hardware grants"
      primaryAction={
        <Button variant="primary" size="sm" onClick={() => navigate('/industry/challenges')}>
          <Lightbulb className="w-4 h-4" />
          <span>Browse Challenges</span>
        </Button>
      }
    >
      <div className="space-y-6">
        <RevealSection immediate>
          <div className="rounded-2xl bg-[#1A4332] text-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#7DBE9E]">Industry & CSR Collaboration</p>
              <h2 className="font-display text-xl sm:text-2xl font-bold">
                Turn student prototypes into civic impact
              </h2>
              <p className="text-xs sm:text-sm text-[#D5EBDD] max-w-xl leading-relaxed">
                Explore government-approved challenges, connect with student teams who consented to share their profiles, and offer mentorship, lab tools, or CSR sponsorship.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <Button variant="primary" onClick={() => navigate('/industry/challenges')}>
                <span>Explore Challenges</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="secondary" onClick={() => navigate('/industry/teams')}>
                <span>Discover Teams</span>
              </Button>
            </div>
          </div>
        </RevealSection>

        <StaggerGrid immediate className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <MetricTile
              label="Open Challenges"
              value={data?.challenges?.length || 0}
              icon={Lightbulb}
              accent="forest"
              onClick={() => navigate('/industry/challenges')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Student Teams"
              value={data?.teams?.length || 0}
              icon={Users}
              accent="sage"
              onClick={() => navigate('/industry/teams')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Offers Submitted"
              value={data?.myInterests?.length || 0}
              icon={Handshake}
              accent="orange"
              onClick={() => navigate('/industry/partnerships')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Privacy Rule"
              textValue="Consent-Gated"
              hint="Student details require explicit opt-in"
              icon={Shield}
              accent="forest"
            />
          </StaggerItem>
        </StaggerGrid>

        <Card animate delay={0.06} className="bg-[#DCEBF3]/55 text-xs text-[#24332D] leading-relaxed">
          <strong>Privacy & Governance Note:</strong> Student academic details appear only when a student enables sharing in their privacy settings. Any real-world street pilot requires formal approval from Government Officials.
        </Card>

        <Card animate delay={0.12}>
          <h2 className="font-display text-base font-bold text-[#245B45] mb-1">Organization Profile</h2>
          <p className="text-xs text-[#55665F] mb-4">Keep your organization’s CSR focus updated for city officials and student squads.</p>
          <form onSubmit={saveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Organization Name</label>
              <input
                type="text"
                value={profileForm.organizationName}
                onChange={(e) => setProfileForm({ ...profileForm, organizationName: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Industry Sector</label>
              <input
                type="text"
                value={profileForm.sector}
                onChange={(e) => setProfileForm({ ...profileForm, sector: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">CSR & Mentorship Focus</label>
              <input
                type="text"
                value={profileForm.csrFocus}
                onChange={(e) => setProfileForm({ ...profileForm, csrFocus: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Button type="submit" variant="forest" size="sm">Save Profile</Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}
