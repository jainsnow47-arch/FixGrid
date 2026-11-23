import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Crosshair,
  Image as ImageIcon,
  Link2,
  Loader2,
  MapPin,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ISSUE_CATEGORIES } from '../../utils/formatters.js';
import { extractMediaMetadata } from '../../utils/imageMetadata.js';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { CivicMap } from '../../components/maps/CivicMap.jsx';
import { ComplaintDetailModal } from '../../components/complaints/ComplaintDetailModal.jsx';
import { VoiceIssueRecorder } from '../../components/complaints/VoiceIssueRecorder.jsx';
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
  const [categoryLocked, setCategoryLocked] = useState(false);
  const [autoApplyAi, setAutoApplyAi] = useState(true);

  const [position, setPosition] = useState({ lat: 27.4924, lng: 77.6737 });
  const [address, setAddress] = useState('Krishna Nagar Area, Mathura (Click map or capture GPS)');
  const [ward, setWard] = useState('Ward 14 (Krishna Nagar)');
  const [locationSource, setLocationSource] = useState('map-pin');

  const [files, setFiles] = useState([]);
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageMetadata, setImageMetadata] = useState(null);
  const [extractingMeta, setExtractingMeta] = useState(false);

  const [livePredicting, setLivePredicting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [inspectDupId, setInspectDupId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [voiceSnapshot, setVoiceSnapshot] = useState(null);
  const [voiceTranscriptUsed, setVoiceTranscriptUsed] = useState('');

  const abortRef = useRef(null);

  const step1Done = title.trim().length >= 5 && description.trim().length >= 15;
  const step2Done = Boolean(address.trim());
  const step3Done = Boolean(aiResult);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Real-time AI Suggestion Engine: triggers automatically as user types or attaches image metadata
  useEffect(() => {
    const combinedText = `${title} ${description}`.trim();
    if (combinedText.length < 4 && !imageMetadata) {
      setLivePredicting(false);
      return;
    }

    const timer = setTimeout(async () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setLivePredicting(true);

      try {
        const data = await apiRequest('/api/complaints/live-suggest', {
          method: 'POST',
          signal: controller.signal,
          body: {
            title,
            description,
            category: categoryLocked ? category : '',
            address,
            latitude: position.lat,
            longitude: position.lng,
            imageMetadata,
          },
        });

        if (controller.signal.aborted) return;

        setAiResult(data.analysis);
        setDuplicates(data.duplicates || []);

        if (
          autoApplyAi &&
          !categoryLocked &&
          data.analysis?.predictedCategory &&
          ISSUE_CATEGORIES.includes(data.analysis.predictedCategory)
        ) {
          setCategory(data.analysis.predictedCategory);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Keep previous prediction intact on transient errors
        }
      } finally {
        if (!controller.signal.aborted) {
          setLivePredicting(false);
        }
      }
    }, 420);

    return () => {
      clearTimeout(timer);
    };
  }, [title, description, address, position.lat, position.lng, imageMetadata, autoApplyAi, categoryLocked, category]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

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

  const handleFileChange = async (e) => {
    const picked = Array.from(e.target.files || []);
    setFiles(picked);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const img = picked.find((f) => f.type.startsWith('image/'));
    if (img) {
      setPreviewUrl(URL.createObjectURL(img));
    } else {
      setPreviewUrl('');
    }

    const primaryFile = img || picked[0];
    if (!primaryFile) {
      setImageMetadata(null);
      return;
    }

    setExtractingMeta(true);
    try {
      const meta = await extractMediaMetadata(primaryFile);
      setImageMetadata(meta);
    } finally {
      setExtractingMeta(false);
    }
  };

  const handleApplyPhotoGps = () => {
    if (!imageMetadata?.exifGps) return;
    reverseGeocode(imageMetadata.exifGps.lat, imageMetadata.exifGps.lng, 'photo-exif-gps');
    showToast('Map pin updated to match the photo’s GPS metadata.', 'success');
  };

  const handleVoiceExtracted = (result) => {
    if (!result?.extracted) return;
    setVoiceSnapshot({ title, description, category, categoryLocked, address, ward, locationSource });

    const { extracted, analysis, duplicates: voiceDups } = result;
    if (extracted.title) setTitle(extracted.title);
    if (extracted.description) setDescription(extracted.description);
    if (extracted.category && ISSUE_CATEGORIES.includes(extracted.category)) {
      setCategory(extracted.category);
      setCategoryLocked(false);
    }
    if (extracted.address) {
      setAddress(extracted.address);
      setLocationSource('voice-extracted');
    }
    if (extracted.ward) {
      setWard(extracted.ward);
    }
    if (analysis) setAiResult(analysis);
    if (Array.isArray(voiceDups)) setDuplicates(voiceDups);
    setVoiceTranscriptUsed(extracted.transcript || '');
  };

  const handleUndoVoiceFill = () => {
    if (!voiceSnapshot) return;
    setTitle(voiceSnapshot.title);
    setDescription(voiceSnapshot.description);
    setCategory(voiceSnapshot.category);
    setCategoryLocked(voiceSnapshot.categoryLocked);
    setAddress(voiceSnapshot.address);
    setWard(voiceSnapshot.ward);
    setLocationSource(voiceSnapshot.locationSource);
    setVoiceSnapshot(null);
    setVoiceTranscriptUsed('');
    showToast('Reverted voice-filled fields.', 'info');
  };

  const handleAnalyzeDraft = async () => {
    if (description.trim().length < 5 && !files[0] && !imageMetadata) {
      showToast('Enter a short description or attach a photo before running a full scan.', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append('title', title);
      fd.append('description', description);
      fd.append('category', categoryLocked ? category : '');
      fd.append('address', address);
      fd.append('latitude', String(position.lat));
      fd.append('longitude', String(position.lng));
      if (imageMetadata) fd.append('imageMetadata', JSON.stringify(imageMetadata));
      if (files[0]) fd.append('media', files[0]);

      const data = await apiRequest('/api/complaints/analyze-draft', {
        method: 'POST',
        body: fd,
        isFormData: true,
      });

      setAiResult(data.analysis);
      setDuplicates(data.duplicates || []);
      if (
        !categoryLocked &&
        data.analysis?.predictedCategory &&
        ISSUE_CATEGORIES.includes(data.analysis.predictedCategory)
      ) {
        setCategory(data.analysis.predictedCategory);
      }
      showToast('Full photo & duplicate scan complete.', 'success');
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
      if (imageMetadata) fd.append('imageMetadata', JSON.stringify(imageMetadata));
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

  const confidencePct = aiResult?.confidence ? Math.round(aiResult.confidence * 100) : 0;
  const categoryDiffersFromAi = Boolean(aiResult?.predictedCategory && aiResult.predictedCategory !== category);

  return (
    <DashboardLayout
      title="Report a Neighborhood Issue"
      subtitle="Live AI predicts category and priority as you type or attach a photo"
    >
      <div className="space-y-6">
        {/* Clean 3-Step Visual Progress Guide */}
        <StaggerGrid immediate className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { num: '01', label: 'Describe & Add Photo', done: step1Done },
            { num: '02', label: 'Pin Location on Map', done: step2Done },
            { num: '03', label: 'Live AI Suggestion & Submit', done: step3Done },
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
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-[#245B45]">01. What is the problem?</h2>
                  <p className="text-xs text-[#55665F] mt-0.5">
                    Describe the issue by voice or typing — FixGrid AI predicts category and priority in real time.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs font-medium text-[#245B45] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoApplyAi}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setAutoApplyAi(next);
                      if (next) setCategoryLocked(false);
                    }}
                    className="rounded border-[#245B45]/30 text-[#245B45] focus:ring-[#245B45]"
                  />
                  <span>Auto-apply AI category</span>
                </label>
              </div>

              <VoiceIssueRecorder
                address={address}
                ward={ward}
                position={position}
                onExtracted={handleVoiceExtracted}
              />

              <AnimatePresence>
                {voiceTranscriptUsed && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg bg-[#D5EBDD]/45 border border-[#245B45]/20 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-[#1A4332]">
                      <strong>Auto-filled from voice:</strong> “{voiceTranscriptUsed}”
                    </span>
                    {voiceSnapshot && (
                      <button
                        type="button"
                        onClick={handleUndoVoiceFill}
                        className="inline-flex items-center gap-1 font-semibold text-[#F07832] hover:underline cursor-pointer shrink-0"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Undo</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

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
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-xs font-semibold text-[#24332D]">Category</label>
                    {categoryDiffersFromAi && (
                      <button
                        type="button"
                        onClick={() => {
                          setCategory(aiResult.predictedCategory);
                          setCategoryLocked(false);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F07832] hover:underline cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Use AI: {aiResult.predictedCategory}</span>
                      </button>
                    )}
                  </div>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setCategoryLocked(true);
                    }}
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

              {/* Photo Preview & Extracted Image Metadata */}
              <AnimatePresence>
                {(previewUrl || imageMetadata || extractingMeta) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: FG_EASE }}
                    className="rounded-xl border border-[#245B45]/15 bg-[#FAF8EE] overflow-hidden"
                  >
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Uploaded issue preview"
                        className="h-48 w-full object-cover border-b border-[#245B45]/10"
                      />
                    )}
                    {imageMetadata && (
                      <div className="p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-[#245B45] inline-flex items-center gap-1.5 min-w-0">
                            <ImageIcon className="w-3.5 h-3.5 text-[#F07832] shrink-0" />
                            <span className="truncate">{imageMetadata.fileName}</span>
                          </span>
                          <span className="text-[11px] font-mono-tabular text-[#55665F]">
                            {[
                              imageMetadata.resolutionLabel,
                              imageMetadata.sizeLabel,
                              imageMetadata.recencyLabel,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#55665F]">
                          <span>
                            {imageMetadata.cameraLabel ? `Device: ${imageMetadata.cameraLabel}` : `Format: ${imageMetadata.mimeType}`}
                            {imageMetadata.filenameHints?.length > 0 && (
                              <> · Clues: <strong className="text-[#24332D]">{imageMetadata.filenameHints.slice(0, 4).join(', ')}</strong></>
                            )}
                          </span>

                          {imageMetadata.hasExifGps && (
                            <button
                              type="button"
                              onClick={handleApplyPhotoGps}
                              className="inline-flex items-center gap-1 font-semibold text-[#245B45] hover:text-[#F07832] cursor-pointer"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>Apply Photo GPS Pin</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Inline Real-Time Prediction Strip */}
              <AnimatePresence>
                {(livePredicting || aiResult) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: FG_EASE }}
                    className="rounded-xl bg-[#D5EBDD]/40 border border-[#245B45]/18 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {livePredicting ? (
                        <Loader2 className="w-4 h-4 text-[#F07832] animate-spin shrink-0" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-[#F07832] shrink-0" />
                      )}
                      <span className="text-[#24332D]">
                        {livePredicting ? (
                          'Updating category & priority prediction...'
                        ) : (
                          <>
                            Live Prediction: <strong className="text-[#245B45]">{aiResult?.predictedCategory}</strong>
                            {confidencePct > 0 && <span className="text-[#55665F]"> ({confidencePct}% confidence)</span>}
                          </>
                        )}
                      </span>
                    </div>
                    {aiResult?.recommendedSeverity && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-[#55665F]">Priority:</span>
                        <SeverityTag severity={aiResult.recommendedSeverity} />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#245B45]/10">
                <Button type="button" variant="secondary" onClick={handleAnalyzeDraft} disabled={analyzing}>
                  <Sparkles className="w-4 h-4" />
                  <span>{analyzing ? 'Scanning Photo & Duplicates...' : 'Run Full Photo & Duplicate Scan'}</span>
                </Button>
                <span className="text-xs text-[#55665F]">
                  Live predictions update automatically · Officials confirm final routing.
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

          {/* Right Live AI Prediction & Submit Column */}
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-24">
            <Card animate delay={0.08} className="space-y-3 bg-[#FAF8EE]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-[#245B45] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F07832]" />
                  <span>03. Live AI Suggestion</span>
                </h2>
                {livePredicting && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#F07832]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Updating...</span>
                  </span>
                )}
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
                      Start typing your headline or details, or attach an image. FixGrid AI immediately predicts the best issue category, priority level, and municipal department.
                    </p>
                    <p className="text-[11px]">
                      Image resolution, capture time, EXIF GPS, and filename details are evaluated locally before submission.
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
                      <span className="text-[#55665F]">Predicted Category</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#24332D]">{aiResult.predictedCategory}</span>
                        {categoryDiffersFromAi && (
                          <button
                            type="button"
                            onClick={() => {
                              setCategory(aiResult.predictedCategory);
                              setCategoryLocked(false);
                            }}
                            className="text-[11px] font-semibold text-[#F07832] hover:underline cursor-pointer"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-[#245B45]/10">
                      <span className="text-[#55665F]">Predicted Priority</span>
                      <SeverityTag severity={aiResult.recommendedSeverity} />
                    </div>

                    <div className="py-1.5 border-b border-[#245B45]/10 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[#55665F]">Prediction Confidence</span>
                        <span className="font-mono-tabular font-semibold text-[#245B45]">{confidencePct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#E8E4CE] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${confidencePct}%` }}
                          transition={{ duration: 0.45, ease: FG_EASE }}
                          className="h-full rounded-full bg-[#245B45]"
                        />
                      </div>
                    </div>

                    <div className="py-1.5 border-b border-[#245B45]/10">
                      <span className="text-[#55665F] block mb-0.5">Suggested Department</span>
                      <span className="font-semibold text-[#245B45]">{aiResult.suggestedDepartmentName}</span>
                    </div>

                    {Array.isArray(aiResult.signals) && aiResult.signals.length > 0 && (
                      <div className="py-1.5 border-b border-[#245B45]/10">
                        <span className="text-[#55665F] block mb-1">Signals Used</span>
                        <p className="text-[#24332D] leading-snug">{aiResult.signals.join(' · ')}</p>
                      </div>
                    )}

                    {aiResult.priorityReason && (
                      <div>
                        <span className="text-[#55665F] block mb-0.5">Priority Rationale</span>
                        <p className="text-[#24332D] leading-snug">{aiResult.priorityReason}</p>
                      </div>
                    )}

                    <div className="rounded-lg bg-[#DCEBF3]/60 p-3">
                      <span className="font-semibold text-[#245B45] block mb-1">Why AI suggested this</span>
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
