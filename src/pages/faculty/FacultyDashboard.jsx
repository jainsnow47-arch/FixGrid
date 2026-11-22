import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Award, CheckCircle2, FolderKanban, GraduationCap } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { MetricTile, RevealSection, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function FacultyDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [profileForm, setProfileForm] = useState({ institution: '', department: '', specialization: '', bio: '' });

  useEffect(() => {
    apiRequest('/api/faculty/dashboard').then((d) => {
      setData(d);
      if (d.profile) {
        setProfileForm({
          institution: d.profile.institution || '',
          department: d.profile.department || '',
          specialization: d.profile.specialization || '',
          bio: d.profile.bio || '',
        });
      }
    });
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/faculty/profile', { method: 'PUT', body: profileForm });
      showToast('Mentor profile updated.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const pendingReq = (data?.requests || []).filter((r) => r.status === 'Requested').length;
  const acceptedReq = (data?.requests || []).filter((r) => r.status === 'Accepted').length;
  const passportCount = (data?.projects || []).reduce((a, p) => a + (p.contributions?.length || 0), 0);

  return (
    <DashboardLayout
      title="Mentor Overview"
      subtitle="Guide student teams, review project milestones, and verify Contribution Passports"
      primaryAction={
        <Button variant="primary" size="sm" onClick={() => navigate('/faculty/reviews')}>
          <Award className="w-4 h-4" />
          <span>Verify Work</span>
        </Button>
      }
    >
      <div className="space-y-6">
        <RevealSection immediate>
          <div className="rounded-2xl bg-[#1A4332] text-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#7DBE9E]">Academic Mentorship Desk</p>
              <h2 className="font-display text-xl sm:text-2xl font-bold">
                Support real student civic engineering
              </h2>
              <p className="text-xs sm:text-sm text-[#D5EBDD] max-w-xl leading-relaxed">
                Accept mentorship requests from student squads, review their milestone submissions, and issue verified Contribution Passports for strong work.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <Button variant="primary" onClick={() => navigate('/faculty/reviews')}>
                <span>Open Review Queue</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button variant="secondary" onClick={() => navigate('/faculty/mentorship')}>
                <span>Team Requests ({pendingReq})</span>
              </Button>
            </div>
          </div>
        </RevealSection>

        <StaggerGrid immediate className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StaggerItem>
            <MetricTile
              label="Active Mentorships"
              value={acceptedReq}
              icon={GraduationCap}
              accent="forest"
              onClick={() => navigate('/faculty/projects')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Pending Requests"
              value={pendingReq}
              icon={CheckCircle2}
              accent="orange"
              onClick={() => navigate('/faculty/mentorship')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Student Projects"
              value={data?.projects?.length || 0}
              icon={FolderKanban}
              accent="sage"
              onClick={() => navigate('/faculty/projects')}
            />
          </StaggerItem>
          <StaggerItem>
            <MetricTile
              label="Verified Passports"
              value={passportCount}
              icon={Award}
              accent="forest"
              onClick={() => navigate('/faculty/reviews')}
            />
          </StaggerItem>
        </StaggerGrid>

        <Card animate delay={0.08}>
          <h2 className="font-display text-base font-bold text-[#245B45] mb-1">Your Mentor Profile</h2>
          <p className="text-xs text-[#55665F] mb-4">Students see this when choosing a faculty advisor for their project.</p>
          <form onSubmit={saveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Institution</label>
              <input
                type="text"
                value={profileForm.institution}
                onChange={(e) => setProfileForm({ ...profileForm, institution: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Department</label>
              <input
                type="text"
                value={profileForm.department}
                onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Area of Specialization</label>
              <input
                type="text"
                value={profileForm.specialization}
                onChange={(e) => setProfileForm({ ...profileForm, specialization: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1">Short Bio</label>
              <textarea
                rows={2}
                value={profileForm.bio}
                onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
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
