import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ISSUE_CATEGORIES } from '../../utils/formatters.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { AnimatePresence, motion } from 'motion/react';
import { FG_EASE } from '../../components/ui/MotionPrimitives.jsx';

export function StudentProfilePage() {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    university: '',
    degree: '',
    yearOfStudy: '',
    skillsText: '',
    interests: [],
    experienceSummary: '',
    availabilityHours: 12,
    city: 'Mathura',
    consentIndustryShare: false,
  });

  useEffect(() => {
    apiRequest('/api/student/profile').then((d) => {
      const p = d.profile;
      setForm({
        university: p.university || '',
        degree: p.degree || '',
        yearOfStudy: p.year_of_study || '',
        skillsText: (p.skills || []).join(', '),
        interests: p.interests || [],
        experienceSummary: p.experience_summary || '',
        availabilityHours: p.availability_hours || 12,
        city: p.city || 'Mathura',
        consentIndustryShare: Boolean(p.consentIndustryShare),
      });
    });
  }, []);

  const toggleInterest = (cat) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(cat)
        ? prev.interests.filter((i) => i !== cat)
        : [...prev.interests, cat],
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/student/profile', {
        method: 'PUT',
        body: {
          university: form.university,
          degree: form.degree,
          yearOfStudy: form.yearOfStudy,
          skills: form.skillsText.split(',').map((s) => s.trim()).filter(Boolean),
          interests: form.interests,
          experienceSummary: form.experienceSummary,
          availabilityHours: form.availabilityHours,
          city: form.city,
          consentIndustryShare: form.consentIndustryShare,
        },
      });
      showToast('Profile saved. Challenge match scores updated!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <DashboardLayout
      title="Skills & Privacy"
      subtitle="Update your skills to improve challenge matching and control what Industry partners can see"
    >
      <form onSubmit={handleSave} className="max-w-3xl space-y-5">
        <Card animate className="space-y-4">
          <h2 className="font-display text-base font-bold text-[#245B45]">Academic & Technical Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">University / College</label>
              <input
                type="text"
                value={form.university}
                onChange={(e) => setForm({ ...form, university: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Degree & Branch</label>
              <input
                type="text"
                value={form.degree}
                onChange={(e) => setForm({ ...form, degree: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Year of Study</label>
              <input
                type="text"
                value={form.yearOfStudy}
                onChange={(e) => setForm({ ...form, yearOfStudy: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Weekly Availability (Hours)</label>
              <input
                type="number"
                min={1}
                max={40}
                value={form.availabilityHours}
                onChange={(e) => setForm({ ...form, availabilityHours: Number(e.target.value) })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Your Skills (separated by commas)</label>
            <input
              type="text"
              value={form.skillsText}
              onChange={(e) => setForm({ ...form, skillsText: e.target.value })}
              placeholder="e.g., IoT Sensors, React, GIS Mapping, Python"
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2">Civic Areas You Care About</label>
            <div className="flex flex-wrap gap-2">
              {ISSUE_CATEGORIES.map((cat) => {
                const active = form.interests.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleInterest(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#245B45] text-white border-[#245B45]'
                        : 'bg-white text-[#24332D] border-[#245B45]/20 hover:border-[#245B45]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Past Projects & Experience</label>
            <textarea
              rows={3}
              value={form.experienceSummary}
              onChange={(e) => setForm({ ...form, experienceSummary: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
        </Card>

        <Card animate delay={0.08} className="bg-[#DCEBF3]/55 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#245B45]">
              <Shield className="w-4 h-4 text-[#F07832]" />
              <span>Partner Visibility Consent</span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={form.consentIndustryShare ? 'shared' : 'private'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: FG_EASE }}
                className="text-xs font-semibold text-[#245B45]"
              >
                {form.consentIndustryShare ? 'Sharing Enabled' : 'Private Mode'}
              </motion.span>
            </AnimatePresence>
          </div>
          <label className="flex items-start gap-3 text-xs text-[#24332D] cursor-pointer leading-relaxed">
            <input
              type="checkbox"
              checked={form.consentIndustryShare}
              onChange={(e) => setForm({ ...form, consentIndustryShare: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              Allow verified Industry & CSR partners to view my university, skills, and project role for mentorship or hardware grants. When unchecked, my personal details stay hidden from partner views.
            </span>
          </label>
        </Card>

        <Button type="submit" variant="forest" size="lg">
          Save Profile & Privacy
        </Button>
      </form>
    </DashboardLayout>
  );
}
