import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Crosshair,
  Link2,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ISSUE_CATEGORIES } from '../../utils/formatters.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { CivicMap } from '../../components/maps/CivicMap.jsx';
import { ComplaintDetailModal } from '../../components/complaints/ComplaintDetailModal.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { SeverityTag } from '../../components/ui/StatusTag.jsx';
import { FG_EASE, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function ReportIssuePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Pothole');
  const [position, setPosition] = useState({ lat: 27.4924, lng: 77.6737 });
  const [address, setAddress] = useState('Krishna Nagar Area, Mathura (Click map or capture GPS)');
  const [ward, setWard] = useState('Ward 14 (Krishna Nagar)');
  const [locationSource, setLocationSource] = useState('map-pin');
  const [files, setFiles] = useState([]);
  const [previewUrl, setPreviewUrl] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [inspectDupId, setInspectDupId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const step1Done = title.trim().length >= 5 && description.trim().length >= 15;
  const step2Done = Boolean(address.trim());
  const step3Done = Boolean(aiResult);

  const reverseGeocode = async (lat, lng, sourceLabel) => {
    setPosition({ lat, lng });
    setLocationSource(sourceLabel);
    try {
      const res = await apiRequest(`/api/public/reverse-geocode?lat=${lat}&lng=${lng}`);
      setAddress(res.address);
      if (res.ward) setWard(res.ward);
    } catch {
      setAddress(`Coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)} (Manual pin)`);
    }
  };

  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      showToast('Location services unavailable; click directly on the map instead.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        reverseGeocode(pos.coords.latitude, pos.coords.longitude, 'gps-verified');
        showToast('Your current GPS location has been pinned.', 'success');
      },
      () => {
        showToast('Location permission declined; tap any spot on the map to place your pin.', 'info');
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files || []);
    setFiles(picked);
    const img = picked.find((f) => f.type.startsWith('image/'));
    if (img) {
      setPreviewUrl(URL.createObjectURL(img));
    } else {
      setPreviewUrl('');
    }
  };

  const handleAnalyzeDraft = async () => {
    if (description.trim().length < 10) {
      showToast('Please write a short description (at least 10 characters) before running AI check.', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('category', category);
      fd.append('address', address);
      fd.append('latitude', String(position.lat));
      fd.append('longitude', String(position.lng));
      if (files[0]) fd.append('media', files[0]);

      const data = await apiRequest('/api/complaints/analyze-draft', {
        method: 'POST',
        body: fd,
        isFormData: true,
      });

      setAiResult(data.analysis);
      setDuplicates(data.duplicates || []);
      if (data.analysis?.predictedCategory && ISSUE_CATEGORIES.includes(data.analysis.predictedCategory)) {
        setCategory(data.analysis.predictedCategory);
      }
      showToast('AI check finished. Review the suggestions on the right.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!step1Done) {
      showToast('Please enter a short title (min 5 chars) and description (min 15 chars).', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('category', category);
      fd.append('latitude', String(position.lat));
      fd.append('longitude', String(position.lng));
      fd.append('address', address);
      fd.append('ward', ward);
      fd.append('locationSource', locationSource);
      files.forEach((f) => fd.append('media', f));

      const res = await apiRequest('/api/complaints', {
        method: 'POST',
        body: fd,
        isFormData: true,
      });

      showToast(`Report ${res.trackingCode} submitted and sent for review!`, 'success');
      navigate('/citizen/my-complaints');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="Report a Neighborhood Issue"
      subtitle="Three quick steps: describe the problem, pin its location, and preview AI sorting"
    >
      <div className="space-y-6">
        {/* Clean 3-Step Visual Progress Guide */}
        <StaggerGrid immediate className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { num: '01', label: 'Describe & Add Photo', done: step1Done },
            { num: '02', label: 'Pin Location on Map', done: step2Done },
            { num: '03', label: 'Preview AI Check & Submit', done: step3Done },
          ].map((s) => (
            <StaggerItem key={s.num}>
              <div
                className={`rounded-xl border px-4 py-3 flex items-center justify-between text-xs transition-colors ${
                  s.done
                    ? 'bg-[#D5EBDD]/60 border-[#245B45]/25 text-[#1A4332]'
                    : 'bg-[#FAF8EE] border-[#245B45]/12 text-[#55665F]'
                }`}
              >
                <span className="font-semibold">
                  <span className="font-mono-tabular mr-2 text-[#F07832]">{s.num}</span>
                  {s.label}
                </span>
                {s.done && <CheckCircle2 className="w-4 h-4 text-[#245B45] shrink-0" />}
              </div>
            </StaggerItem>
          ))}
        </StaggerGrid>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form Column */}
          <div className="lg:col-span-7 space-y-5">
            <Card animate className="space-y-4">
              <div>
                <h2 className="font-display text-base font-bold text-[#245B45]">01. What is the problem?</h2>
                <p className="text-xs text-[#55665F] mt-0.5">Give a clear headline and a few details so crews know what to bring.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#24332D] mb-1">Short Headline</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Deep pothole near Krishna Nagar Market turn"
                  className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#24332D] mb-1">Details & Nearby Landmark</label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened, safety risk for pedestrians or traffic, and any helpful landmarks..."
                  className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#24332D] mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                  >
                    {ISSUE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#24332D] mb-1">
                    Add Photo or Video (Optional, max 15MB)
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-dashed border-[#245B45]/35 bg-white px-3 py-2 text-xs text-[#55665F] cursor-pointer hover:border-[#F07832] transition-colors">
                    <Camera className="w-4 h-4 text-[#F07832] shrink-0" />
                    <span className="truncate">
                      {files.length > 0 ? `${files.length} file(s) attached` : 'Choose photo or short video'}
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {previewUrl && (
                <div className="relative rounded-xl overflow-hidden border border-[#245B45]/15">
                  <img
                    src={previewUrl}
                    alt="Uploaded issue preview"
                    className="h-48 w-full object-cover"
                  />
                </div>
              )}

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#245B45]/10">
                <Button type="button" variant="secondary" onClick={handleAnalyzeDraft} disabled={analyzing}>
                  <Sparkles className="w-4 h-4" />
                  <span>{analyzing ? 'Checking with AI...' : 'Preview AI Triage & Duplicates'}</span>
                </Button>
                <span className="text-xs text-[#55665F]">
                  Optional preview · Officials verify all routing.
                </span>
              </div>
            </Card>

            <Card animate delay={0.06} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-[#245B45]">02. Where is it located?</h2>
                  <p className="text-xs text-[#55665F]">Tap anywhere on the map or use your device GPS.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={handleCaptureGPS}>
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Use My GPS</span>
                </Button>
              </div>

              <CivicMap
                pickLocationMode
                selectedPosition={position}
                onPickPosition={(pos) => reverseGeocode(pos.lat, pos.lng, 'map-pin')}
                height="270px"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#24332D] mb-1">Street / Landmark</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setLocationSource('user-supplied');
                    }}
                    className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#24332D] mb-1">Ward / Locality</label>
                  <input
                    type="text"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <p className="text-xs text-[#55665F] font-mono-tabular flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#F07832]" />
                <span>
                  {position.lat.toFixed(5)}, {position.lng.toFixed(5)} · {locationSource}
                </span>
              </p>
            </Card>
          </div>

          {/* Right AI Preview & Submit Column */}
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-24">
            <Card animate delay={0.08} className="space-y-3 bg-[#FAF8EE]">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-[#245B45] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F07832]" />
                  <span>03. AI Check Preview</span>
                </h2>
              </div>

              <AnimatePresence mode="wait">
                {!aiResult ? (
                  <motion.div
                    key="empty-ai"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-[#55665F] leading-relaxed space-y-2"
                  >
                    <p>
                      Click <strong>Preview AI Triage & Duplicates</strong> to see which department and priority level FixGrid AI recommends, plus any similar nearby reports.
                    </p>
                    <p className="text-[11px]">
                      You can also submit right away—AI triage runs automatically upon submission.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="ai-result"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between py-1.5 border-b border-[#245B45]/10">
                      <span className="text-[#55665F]">Analysis Engine</span>
                      <span className="font-semibold text-[#245B45]">
                        {aiResult.isFallback ? 'Smart Rule-Based Check' : `Gemini (${aiResult.provider})`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-[#245B45]/10">
                      <span className="text-[#55665F]">Suggested Category</span>
                      <span className="font-semibold text-[#24332D]">{aiResult.predictedCategory}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-[#245B45]/10">
                      <span className="text-[#55665F]">Urgency Level</span>
                      <SeverityTag severity={aiResult.recommendedSeverity} />
                    </div>
                    <div className="py-1.5 border-b border-[#245B45]/10">
                      <span className="text-[#55665F] block mb-0.5">Recommended Department</span>
                      <span className="font-semibold text-[#245B45]">{aiResult.suggestedDepartmentName}</span>
                    </div>
                    <div>
                      <span className="text-[#55665F] block mb-0.5">Summary</span>
                      <p className="text-[#24332D] leading-snug">{aiResult.summary}</p>
                    </div>
                    <div className="rounded-lg bg-[#DCEBF3]/60 p-3">
                      <span className="font-semibold text-[#245B45] block mb-1">Reasoning</span>
                      <p className="text-[#24332D] leading-relaxed">{aiResult.explanation}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            <AnimatePresence>
              {duplicates.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: FG_EASE }}
                >
                  <Card className="bg-[#FBF0D9]/70 border-[#C4841D]/35 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-[#8C520A]">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Similar Reports Found Nearby</span>
                    </div>
                    <p className="text-xs text-[#24332D] leading-relaxed">
                      You can still submit your report. FixGrid AI keeps every submission and links related reports for city officers.
                    </p>
                    <div className="space-y-2">
                      {duplicates.map((d) => (
                        <div key={d.complaintId} className="rounded-lg bg-white/85 border border-[#C4841D]/25 p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono-tabular font-bold text-[#245B45]">{d.trackingCode}</span>
                            <span className="font-semibold text-[#8C520A]">
                              {Math.round(d.similarityScore * 100)}% match · {d.distanceMeters}m away
                            </span>
                          </div>
                          <p className="font-semibold text-[#24332D]">{d.title}</p>
                          <p className="text-[#55665F]">{d.reason}</p>
                          <button
                            type="button"
                            onClick={() => setInspectDupId(d.complaintId)}
                            className="inline-flex items-center gap-1 text-[#F07832] font-semibold hover:underline cursor-pointer pt-1"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Inspect Existing Report</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            <Card animate delay={0.12} className="space-y-3">
              <div className="flex items-start gap-2 text-xs text-[#55665F]">
                <CheckCircle2 className="w-4 h-4 text-[#245B45] shrink-0 mt-0.5" />
                <span>
                  Once submitted, you’ll receive an instant tracking ID and a deadline clock so you can watch progress live.
                </span>
              </div>
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting}>
                {submitting ? 'Submitting Report...' : 'Submit Issue Report'}
              </Button>
            </Card>
          </div>
        </form>
      </div>

      <ComplaintDetailModal
        complaintId={inspectDupId}
        open={Boolean(inspectDupId)}
        onClose={() => setInspectDupId(null)}
      />
    </DashboardLayout>
  );
}
