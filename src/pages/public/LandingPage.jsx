import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BrainCircuit,
  Building2,
  Camera,
  CheckCircle2,
  Compass,
  GitBranch,
  GraduationCap,
  Handshake,
  Layers,
  MapPin,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { PublicNavbar } from '../../components/layout/PublicNavbar.jsx';
import { CivicMap } from '../../components/maps/CivicMap.jsx';
import { AnimatedCounter } from '../../components/ui/AnimatedCounter.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import {
  CivicBrandMark,
  InnovationEcosystemIllustration,
  MunicipalOpsIllustration,
} from '../../components/ui/CivicIllustrations.jsx';
import {
  RevealSection,
  SegmentedTabs,
  StaggerGrid,
  StaggerItem,
} from '../../components/ui/MotionPrimitives.jsx';

const HOW_STEPS = [
  {
    id: '01',
    shortLabel: '01. Report',
    title: 'Take a photo & pin the exact spot',
    summary:
      'Any resident can report a pothole, broken streetlight, water leak, or waste pile in under a minute using GPS or a simple map click.',
    highlights: [
      'Automatic ward & street address lookup',
      'Instant tracking ID (e.g. FG-MTR-1001) to follow progress',
      'No confusing government forms or office visits needed',
    ],
    previewLabel: 'Citizen Submission',
    previewTitle: 'Broken streetlamp near Krishna Nagar Crossing',
    previewMeta: 'Ward 14 · Photo attached · Pin verified',
  },
  {
    id: '02',
    shortLabel: '02. AI Check',
    title: 'Smart sorting & duplicate detection',
    summary:
      'FixGrid AI reads the report and photo to suggest the right department and urgency level, while linking nearby similar reports safely.',
    highlights: [
      'Never deletes or hides a resident’s original complaint',
      'Shows clear reasons behind every severity & routing suggestion',
      'Matches issues to road, water, sanitation, or lighting teams',
    ],
    previewLabel: 'AI Triage Assistant',
    previewTitle: 'Suggested: Public Works Electrical · High Priority',
    previewMeta: '84% match with nearby FG-MTR-1002 (120m away)',
  },
  {
    id: '03',
    shortLabel: '03. Official Fix',
    title: 'Human review & deadline accountability',
    summary:
      'Authorised municipal officers confirm or adjust the AI suggestion, assign field crews, and resolve repairs before automatic SLA escalation alerts trigger.',
    highlights: [
      'Officials keep 100% decision authority over every ticket',
      'Overdue tasks automatically notify senior officers',
      'Citizens rate completed repairs or request reopening',
    ],
    previewLabel: 'Municipal Action',
    previewTitle: 'Crew dispatched · Deadline clock active (24h window)',
    previewMeta: 'Verified by Nodal Officer · Live timeline updated',
  },
  {
    id: '04',
    shortLabel: '04. Student Build',
    title: 'Turn recurring problems into student innovation',
    summary:
      'Officers can publish stubborn city problems as open challenges. Matched student teams build solutions with faculty mentors and CSR support.',
    highlights: [
      'Explainable 5-factor skill matching for student teams',
      'Built-in Kanban task board & milestone verification',
      'Faculty-verified Contribution Passports for student portfolios',
    ],
    previewLabel: 'Community Innovation',
    previewTitle: 'Challenge CH-2026-01: Smart Solar Fault Telemetry',
    previewMeta: '92% skill match · Team JalDrishti active',
  },
];

const ROLE_CARDS = [
  {
    role: 'citizen',
    title: 'Resident / Citizen',
    icon: Users,
    tone: 'bg-[#D5EBDD]/55 text-[#245B45]',
    summary: 'Report local issues with photos and GPS, track repairs step-by-step, and upvote neighborhood priorities.',
    action: 'Open Citizen Portal',
  },
  {
    role: 'government',
    title: 'Government Official',
    icon: ShieldCheck,
    tone: 'bg-[#DCEBF3]/75 text-[#245B45]',
    summary: 'Review AI sorting, assign departments, monitor deadline clocks, and launch student innovation challenges.',
    action: 'Open Official Desk',
  },
  {
    role: 'student',
    title: 'Student Innovator',
    icon: Compass,
    tone: 'bg-[#FDE6D8]/80 text-[#B84A14]',
    summary: 'Discover challenges matched to your skills, build multidisciplinary teams, manage tasks, and earn a Passport.',
    action: 'Open Student Hub',
  },
  {
    role: 'faculty',
    title: 'Faculty Mentor',
    icon: GraduationCap,
    tone: 'bg-[#D5EBDD]/55 text-[#245B45]',
    summary: 'Guide student engineering teams, review project deliverables, and verify student Contribution Passports.',
    action: 'Open Mentor Desk',
  },
  {
    role: 'industry',
    title: 'Industry / CSR Partner',
    icon: Handshake,
    tone: 'bg-[#DCEBF3]/75 text-[#245B45]',
    summary: 'Support approved civic challenges with hardware grants, mentorship, or cloud tools with strict privacy controls.',
    action: 'Open Partner View',
  },
  {
    role: 'admin',
    title: 'Platform Admin',
    icon: Building2,
    tone: 'bg-[#E8E4CE]/85 text-[#245B45]',
    summary: 'Manage user roles, city departments, issue categories, deadline targets, and full system audit logs.',
    action: 'Open Admin Console',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [stats, setStats] = useState(null);
  const [mapIssues, setMapIssues] = useState([]);
  const [heroMode, setHeroMode] = useState('visual'); // 'visual' | 'map'
  const [activeStepIdx, setActiveStepIdx] = useState(0);

  useEffect(() => {
    apiRequest('/api/public/stats').then(setStats).catch(() => {});
    apiRequest('/api/public/feed').then((d) => setMapIssues(d.items || [])).catch(() => {});
  }, []);

  const metrics = stats?.metrics || {
    totalComplaints: 6,
    resolvedComplaints: 1,
    escalatedCount: 1,
    approvedChallenges: 3,
    activeProjects: 1,
    verifiedContributions: 1,
  };

  const floatingCards = mapIssues.slice(0, 2);
  const currentStep = HOW_STEPS[activeStepIdx];

  return (
    <div className="min-h-screen bg-[#F5F1DC] text-[#24332D]">
      <PublicNavbar />

      {/* 1. Animated Civic-Tech Hero Section */}
      <section className="relative overflow-hidden fg-civic-grid border-b border-[#245B45]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-14 lg:pt-14 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            {/* Left Copy Column */}
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 flex flex-col justify-between space-y-7 py-2"
            >
              <div className="space-y-5">
                <p className="text-xs font-semibold tracking-wide text-[#245B45]">
                  FixGrid AI · Mathura Civic Network
                </p>
                <h1
                  className="font-display font-bold text-[#1A4332] leading-[1.06] tracking-tight"
                  style={{ fontSize: 'clamp(2.35rem, 4.2vw, 3.8rem)', textWrap: 'balance' }}
                >
                  Report local issues. Track real fixes. Build civic solutions.
                </h1>
                <p className="text-base sm:text-lg text-[#24332D] leading-relaxed max-w-xl">
                  One clear platform connecting residents, city departments, and university innovators—so neighborhood repairs happen on time and recurring problems inspire lasting solutions.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button variant="primary" size="lg" onClick={() => navigate('/citizen/report')}>
                    <span>Report an Issue</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => navigate('/auth')}>
                    <span>Explore 6 Role Portals</span>
                  </Button>
                </div>
              </div>

              {/* Plain-English Value Highlights (No pill boxes) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 border-t border-[#245B45]/12 text-xs">
                <div className="flex items-start gap-2">
                  <Camera className="w-4 h-4 text-[#F07832] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#24332D]">1-Minute Reporting</p>
                    <p className="text-[#55665F] mt-0.5">Snap a photo and drop a pin on the map.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#245B45] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#24332D]">Official Oversight</p>
                    <p className="text-[#55665F] mt-0.5">Officers verify AI sorting and repair timelines.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <GraduationCap className="w-4 h-4 text-[#245B45] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#24332D]">Student Innovation</p>
                    <p className="text-[#55665F] mt-0.5">Teams build prototypes for city challenges.</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Interactive Civic Visual + Floating Live Cards */}
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 flex flex-col justify-between gap-4"
            >
              <div className="rounded-2xl bg-[#FAF8EE] border border-[#245B45]/18 p-3 sm:p-4 shadow-sm flex flex-col gap-3">
                {/* Top Preview Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <span className="text-xs font-semibold text-[#245B45] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#F07832]" />
                    <span>Mathura Civic Operations Preview</span>
                  </span>
                  <SegmentedTabs
                    layoutId="hero-preview-mode"
                    value={heroMode}
                    onChange={setHeroMode}
                    options={[
                      { value: 'visual', label: 'City Overview' },
                      { value: 'map', label: 'Live Issue Map' },
                    ]}
                  />
                </div>

                {heroMode === 'visual' ? (
                  <div className="relative rounded-xl overflow-hidden border border-[#245B45]/15 h-[330px] sm:h-[360px]">
                    <img
                      src="/src/assets/images/hero_civic_mathura_1795357360477.jpg"
                      alt="Mathura urban civic corridor with solar lighting and pedestrian pathways"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1A4332]/85 via-[#1A4332]/20 to-transparent" />

                    {/* Animated Civic Map Markers on Visual */}
                    <div className="hidden sm:block absolute top-10 left-10">
                      <div className="relative flex items-center justify-center">
                        <span className="fg-pulse-ring absolute w-8 h-8 rounded-full bg-[#F07832]/45" />
                        <span className="w-3.5 h-3.5 rounded-full bg-[#F07832] border-2 border-white shadow" />
                      </div>
                    </div>
                    <div className="hidden sm:block absolute top-20 right-14">
                      <div className="relative flex items-center justify-center">
                        <span className="fg-pulse-ring absolute w-7 h-7 rounded-full bg-[#7DBE9E]/55" />
                        <span className="w-3 h-3 rounded-full bg-[#245B45] border-2 border-white shadow" />
                      </div>
                    </div>

                    {/* Floating Live Civic Complaint Cards */}
                    <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <motion.button
                        type="button"
                        onClick={() => navigate('/community')}
                        animate={reducedMotion ? undefined : { y: [0, -4, 0] }}
                        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="text-left rounded-xl bg-[#FAF8EE]/95 backdrop-blur-md border border-[#245B45]/18 p-3 shadow-lg hover:border-[#F07832] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-[11px] text-[#55665F]">
                          <span className="font-mono-tabular font-bold text-[#245B45]">
                            {floatingCards[0]?.tracking_code || 'FG-MTR-1001'}
                          </span>
                          <span className="font-semibold text-[#B84A14]">
                            {floatingCards[0]?.severity || 'High'} Priority
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#24332D] mt-1 line-clamp-1">
                          {floatingCards[0]?.title || 'Waterlogged intersection near Krishna Nagar'}
                        </p>
                        <p className="text-[11px] text-[#55665F] mt-0.5 line-clamp-1">
                          {floatingCards[0]?.status || 'Assigned'} · Tap to view on map
                        </p>
                      </motion.button>

                      <motion.button
                        type="button"
                        onClick={() => navigate('/challenges')}
                        animate={reducedMotion ? undefined : { y: [0, 4, 0] }}
                        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                        className="text-left rounded-xl bg-[#1A4332]/95 backdrop-blur-md border border-white/15 p-3 shadow-lg hover:border-[#F07832] transition-colors cursor-pointer text-white"
                      >
                        <div className="flex items-center justify-between text-[11px] text-[#D5EBDD]">
                          <span className="font-mono-tabular font-semibold">Student Innovation</span>
                          <span className="text-[#F07832] font-semibold">Active Pilot</span>
                        </div>
                        <p className="text-xs font-bold mt-1 line-clamp-1">
                          JalDrishti Smart Drain Telemetry
                        </p>
                        <p className="text-[11px] text-[#D5EBDD]/80 mt-0.5 line-clamp-1">
                          Faculty verified · 3 open challenges
                        </p>
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden border border-[#245B45]/15">
                    <CivicMap complaints={mapIssues} mode="markers" height="360px" onSelectComplaint={() => navigate('/community')} />
                  </div>
                )}

                <div className="flex items-center justify-between px-1 text-xs text-[#55665F]">
                  <span>Sample Mathura city dataset · Live interactive map</span>
                  <Link to="/community" className="font-semibold text-[#F07832] hover:underline">
                    Open Full Feed →
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Live Platform Metrics Strip */}
          <RevealSection delay={0.1} className="mt-10 rounded-2xl bg-[#FAF8EE] border border-[#245B45]/15 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#245B45]/10">
              <h2 className="text-sm font-semibold text-[#245B45]">
                Live Platform Activity — Mathura Demonstration Dataset
              </h2>
              <span className="text-xs text-[#55665F]">
                {stats?.aiStatus?.modeLabel || 'AI Triage Ready'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5 pt-4">
              <div>
                <p className="text-2xl font-bold text-[#245B45]"><AnimatedCounter value={metrics.totalComplaints} /></p>
                <p className="text-xs text-[#55665F] mt-0.5">Issues Reported</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#245B45]"><AnimatedCounter value={metrics.resolvedComplaints} /></p>
                <p className="text-xs text-[#55665F] mt-0.5">Repairs Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#D96522]"><AnimatedCounter value={metrics.escalatedCount} /></p>
                <p className="text-xs text-[#55665F] mt-0.5">Escalated Alerts</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#245B45]"><AnimatedCounter value={metrics.approvedChallenges} /></p>
                <p className="text-xs text-[#55665F] mt-0.5">Open Challenges</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#245B45]"><AnimatedCounter value={metrics.activeProjects} /></p>
                <p className="text-xs text-[#55665F] mt-0.5">Student Projects</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#245B45]"><AnimatedCounter value={metrics.verifiedContributions} /></p>
                <p className="text-xs text-[#55665F] mt-0.5">Verified Passports</p>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* 2. Interactive "How FixGrid AI Works" Walkthrough */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <RevealSection className="max-w-2xl mb-8">
          <p className="text-xs font-semibold text-[#F07832]">Simple Step-by-Step Flow</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#245B45] mt-1">
            How FixGrid AI turns a report into real action
          </h2>
          <p className="text-sm text-[#55665F] mt-2 leading-relaxed">
            Click any stage below to see how residents, municipal officers, and student teams stay aligned from first photo to verified result.
          </p>
        </RevealSection>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-5 space-y-2.5">
            {HOW_STEPS.map((step, idx) => {
              const active = idx === activeStepIdx;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStepIdx(idx)}
                  className={`w-full text-left rounded-xl border p-4 transition-all cursor-pointer ${
                    active
                      ? 'bg-[#245B45] text-white border-[#245B45] shadow-sm'
                      : 'bg-[#FAF8EE] text-[#24332D] border-[#245B45]/14 hover:border-[#245B45]/35'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-mono-tabular text-xs font-semibold ${active ? 'text-[#7DBE9E]' : 'text-[#F07832]'}`}>
                      {step.shortLabel}
                    </span>
                    <ArrowRight className={`w-3.5 h-3.5 transition-transform ${active ? 'translate-x-0.5 text-white' : 'text-[#55665F]'}`} />
                  </div>
                  <p className="font-display text-base font-bold mt-1">{step.title}</p>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.id}
                initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-2xl bg-[#FAF8EE] border border-[#245B45]/16 p-6 sm:p-8 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-[#55665F]">
                    <span className="font-mono-tabular font-semibold text-[#F07832]">
                      Step {currentStep.id} of 04
                    </span>
                    <span>{currentStep.previewLabel}</span>
                  </div>
                  <h3 className="font-display text-2xl font-bold text-[#1A4332]">
                    {currentStep.title}
                  </h3>
                  <p className="text-sm sm:text-base text-[#55665F] leading-relaxed">
                    {currentStep.summary}
                  </p>

                  <ul className="space-y-2.5 pt-2">
                    {currentStep.highlights.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-[#24332D]">
                        <CheckCircle2 className="w-4 h-4 text-[#245B45] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Clean Example Snapshot Footer */}
                <div className="rounded-xl bg-[#D5EBDD]/45 border border-[#245B45]/14 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-[#245B45]">{currentStep.previewLabel} Example</p>
                    <p className="text-sm font-bold text-[#24332D] mt-0.5">{currentStep.previewTitle}</p>
                    <p className="text-xs text-[#55665F] mt-0.5">{currentStep.previewMeta}</p>
                  </div>
                  <Button variant="forest" size="sm" onClick={() => navigate('/auth')}>
                    Try Live Demo
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* 3. Two Connected Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 border-t border-[#245B45]/10">
        <RevealSection className="max-w-2xl mb-8">
          <p className="text-xs font-semibold text-[#F07832]">Clear Governance Boundaries</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#245B45] mt-1">
            Two connected pillars that never blur responsibility
          </h2>
          <p className="text-sm text-[#55665F] mt-2">
            City departments stay accountable for every street repair, while student innovators tackle long-term engineering upgrades alongside them.
          </p>
        </RevealSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RevealSection>
            <Card className="h-full bg-[#FAF8EE] space-y-4">
              <MunicipalOpsIllustration className="w-full h-36" />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#245B45]">01. City Repair Operations</p>
                <h3 className="font-display text-xl font-bold text-[#24332D]">
                  Fast, Transparent Municipal Resolution
                </h3>
                <p className="text-sm text-[#55665F] leading-relaxed">
                  Every citizen complaint receives a tracking ID, AI-assisted routing recommendation, and a clear repair deadline. Authorised officials verify every decision and confirm repairs before closing tickets.
                </p>
              </div>
            </Card>
          </RevealSection>

          <RevealSection delay={0.08}>
            <Card className="h-full bg-[#D5EBDD]/45 space-y-4">
              <InnovationEcosystemIllustration className="w-full h-36" />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#245B45]">02. Student Innovation Ecosystem</p>
                <h3 className="font-display text-xl font-bold text-[#24332D]">
                  Real Challenges, Mentored Prototypes & Passports
                </h3>
                <p className="text-sm text-[#55665F] leading-relaxed">
                  Officials turn recurring infrastructure problems into open challenges. Student teams match by skills, build prototypes on Kanban boards with faculty guidance, and earn verified Contribution Passports.
                </p>
              </div>
            </Card>
          </RevealSection>
        </div>
      </section>

      {/* 4. Four Core Platform Capabilities (Asymmetric Bento Grid) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 border-t border-[#245B45]/10">
        <RevealSection className="max-w-2xl mb-8">
          <p className="text-xs font-semibold text-[#F07832]">Built for Clarity & Trust</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#245B45] mt-1">
            Practical tools behind every civic workflow
          </h2>
        </RevealSection>

        <StaggerGrid className="grid grid-cols-1 md:grid-cols-12 gap-5">
          <StaggerItem className="md:col-span-7">
            <Card interactive className="h-full flex items-start gap-4 bg-[#FAF8EE]">
              <div className="w-11 h-11 rounded-xl bg-[#D5EBDD] text-[#245B45] flex items-center justify-center shrink-0">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-[#24332D]">
                  Explainable AI Triage & Routing
                </h3>
                <p className="text-sm text-[#55665F] mt-1.5 leading-relaxed">
                  Analyzes complaint text and uploaded photos to recommend the right category, urgency level, and department—always showing plain-English reasoning so officials can approve or override in one click.
                </p>
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem className="md:col-span-5">
            <Card interactive className="h-full flex items-start gap-4 bg-[#FAF8EE]">
              <div className="w-11 h-11 rounded-xl bg-[#FDE6D8] text-[#B84A14] flex items-center justify-center shrink-0">
                <GitBranch className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-[#24332D]">
                  Safe Duplicate Linking
                </h3>
                <p className="text-sm text-[#55665F] mt-1.5 leading-relaxed">
                  Finds nearby similar complaints using text similarity and distance without ever deleting anyone’s original submission.
                </p>
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem className="md:col-span-5">
            <Card interactive className="h-full flex items-start gap-4 bg-[#FAF8EE]">
              <div className="w-11 h-11 rounded-xl bg-[#DCEBF3] text-[#245B45] flex items-center justify-center shrink-0">
                <Timer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-[#24332D]">
                  Automatic SLA Deadline Alerts
                </h3>
                <p className="text-sm text-[#55665F] mt-1.5 leading-relaxed">
                  Every severity level carries a clear deadline clock that alerts supervisors automatically if repairs fall behind schedule.
                </p>
              </div>
            </Card>
          </StaggerItem>

          <StaggerItem className="md:col-span-7">
            <Card interactive className="h-full flex items-start gap-4 bg-[#FAF8EE]">
              <div className="w-11 h-11 rounded-xl bg-[#D5EBDD] text-[#245B45] flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-[#24332D]">
                  Interactive City Maps & Hotspot Heatmaps
                </h3>
                <p className="text-sm text-[#55665F] mt-1.5 leading-relaxed">
                  Switch smoothly between individual issue pins, neighborhood clusters, and severity heatmaps on OpenStreetMap to spot infrastructure hotspots across wards.
                </p>
              </div>
            </Card>
          </StaggerItem>
        </StaggerGrid>
      </section>

      {/* 5. Six Role-Dedicated Workspaces */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 border-t border-[#245B45]/10">
        <RevealSection className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-semibold text-[#F07832]">Explore Every Perspective</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#245B45] mt-1">
              Six dedicated workspaces built for each role
            </h2>
            <p className="text-sm text-[#55665F] mt-1">
              Select any role below to preview its live dashboard right away.
            </p>
          </div>
          <Button variant="forest" size="sm" onClick={() => navigate('/auth')}>
            Open Role Switcher
          </Button>
        </RevealSection>

        <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ROLE_CARDS.map((item) => {
            const Icon = item.icon;
            return (
              <StaggerItem key={item.role}>
                <button
                  type="button"
                  onClick={() => navigate(`/auth?role=${item.role}`)}
                  className="w-full h-full text-left rounded-xl bg-[#FAF8EE] border border-[#245B45]/14 hover:border-[#F07832] p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm cursor-pointer flex flex-col justify-between gap-4 group"
                >
                  <div className="space-y-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.tone}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-[#245B45] group-hover:text-[#F07832] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#55665F] leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#245B45]/10 flex items-center justify-between text-xs font-semibold text-[#245B45] group-hover:text-[#F07832]">
                    <span>{item.action}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      </section>

      {/* 6. Final CTA & Quiet Footer */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-14">
        <RevealSection>
          <div className="rounded-2xl bg-[#1A4332] text-white p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl font-bold">
                Try the complete FixGrid AI workflow
              </h2>
              <p className="text-sm text-[#D5EBDD] max-w-xl leading-relaxed">
                Report a sample civic issue, inspect AI sorting and duplicate detection, review it as a city official, and follow a student team from task board to Contribution Passport.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Button variant="primary" size="lg" onClick={() => navigate('/auth')}>
                <span>Open Interactive Demo</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </RevealSection>
      </section>

      <footer className="border-t border-[#245B45]/12 bg-[#FAF8EE] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#55665F]">
          <div className="flex items-center gap-2.5">
            <CivicBrandMark className="w-5 h-5 shrink-0" />
            <span className="font-display font-bold text-sm text-[#245B45]">FixGrid AI</span>
            <span aria-hidden="true">·</span>
            <span>Report. Resolve. Innovate.</span>
          </div>
          <div className="flex flex-wrap gap-5">
            <Link to="/community" className="hover:text-[#245B45]">Community Feed</Link>
            <Link to="/challenges" className="hover:text-[#245B45]">Challenges</Link>
            <Link to="/auth" className="hover:text-[#245B45]">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
