import { useEffect, useState } from 'react';
import { Handshake, Lightbulb } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function IndustryChallengesPage() {
  const { showToast } = useToast();
  const [challenges, setChallenges] = useState([]);
  const [offerTarget, setOfferTarget] = useState(null);
  const [offerForm, setOfferForm] = useState({ supportType: 'Technical Mentorship', message: '' });

  useEffect(() => {
    apiRequest('/api/industry/dashboard').then((d) => setChallenges(d.challenges || []));
  }, []);

  const submitOffer = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/industry/interests', {
        method: 'POST',
        body: { challengeId: offerTarget.id, ...offerForm },
      });
      showToast(res.message, 'success');
      setOfferTarget(null);
      setOfferForm({ supportType: 'Technical Mentorship', message: '' });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <DashboardLayout
      title="Civic Challenges"
      subtitle="Offer mentorship, lab hardware, cloud credits, or CSR sponsorship to approved city challenges"
    >
      {challenges.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="No approved challenges available yet"
          description="Government-approved civic challenges will appear here once published."
        />
      ) : (
        <StaggerGrid immediate className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {challenges.map((ch) => (
            <StaggerItem key={ch.id}>
              <Card interactive className="h-full flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-mono-tabular text-[#F07832] font-semibold">
                    {ch.challenge_code} · {ch.category}
                  </p>
                  <h3 className="font-display text-lg font-bold text-[#245B45]">{ch.title}</h3>
                  <p className="text-sm text-[#55665F] leading-relaxed">{ch.description}</p>
                  <p className="text-xs text-[#24332D] pt-1">
                    <strong>Skills Needed:</strong> {(ch.skillsRequired || []).join(' · ')}
                  </p>
                </div>
                <div className="pt-3 border-t border-[#245B45]/10 flex justify-between items-center text-xs">
                  <span className="text-[#55665F]">Status: {ch.pilot_status}</span>
                  <Button size="sm" variant="primary" onClick={() => setOfferTarget(ch)}>
                    <Handshake className="w-3.5 h-3.5" />
                    <span>Offer Support</span>
                  </Button>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}

      <Modal open={Boolean(offerTarget)} onClose={() => setOfferTarget(null)} title={`Offer Support — ${offerTarget?.challenge_code}`} maxWidth="max-w-md">
        <form onSubmit={submitOffer} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">How would you like to help?</label>
            <select
              value={offerForm.supportType}
              onChange={(e) => setOfferForm({ ...offerForm, supportType: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            >
              <option value="Technical Mentorship">Technical Mentorship</option>
              <option value="Hardware & Lab Grant">Hardware & Lab Grant</option>
              <option value="Cloud / GIS Credits">Cloud / GIS Credits</option>
              <option value="Pilot Evaluation Support">Pilot Evaluation Support</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Offer Details</label>
            <textarea
              rows={3}
              required
              minLength={10}
              value={offerForm.message}
              onChange={(e) => setOfferForm({ ...offerForm, message: e.target.value })}
              placeholder="Share what sensors, lab access, funding, or engineering hours you can offer..."
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" variant="forest" className="w-full">Send Support Offer</Button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
