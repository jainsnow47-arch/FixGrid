import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Building2,
  Compass,
  GraduationCap,
  Handshake,
  KeyRound,
  Lock,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ROLE_HOME } from '../../utils/formatters.js';
import { PublicNavbar } from '../../components/layout/PublicNavbar.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { SegmentedTabs, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

const DEMO_ROLES = [
  {
    role: 'citizen',
    label: 'Resident / Citizen',
    person: 'Aarav Sharma',
    icon: Users,
    tone: 'bg-[#D5EBDD]/65 text-[#245B45]',
    desc: 'Report neighborhood issues with photos and GPS, track repairs, and support community fixes.',
  },
  {
    role: 'government',
    label: 'Government Official',
    person: 'Priya Verma',
    icon: ShieldCheck,
    tone: 'bg-[#DCEBF3]/80 text-[#245B45]',
    desc: 'Review AI recommendations, assign crews, manage repair deadlines, and publish challenges.',
  },
  {
    role: 'student',
    label: 'Student Innovator',
    person: 'Rohan Deshmukh',
    icon: Compass,
    tone: 'bg-[#FDE6D8]/85 text-[#B84A14]',
    desc: 'Find skill-matched civic challenges, form student teams, manage tasks, and earn a Passport.',
  },
  {
    role: 'faculty',
    label: 'Faculty Mentor',
    person: 'Dr. Meera Kulkarni',
    icon: GraduationCap,
    tone: 'bg-[#D5EBDD]/65 text-[#245B45]',
    desc: 'Guide student engineering teams, review project milestones, and verify Passports.',
  },
  {
    role: 'industry',
    label: 'Industry / CSR Partner',
    person: 'Kavita Nair',
    icon: Handshake,
    tone: 'bg-[#DCEBF3]/80 text-[#245B45]',
    desc: 'Browse approved challenges and consented teams to offer mentorship or hardware grants.',
  },
  {
    role: 'admin',
    label: 'Platform Admin',
    person: 'Vikramaditya Rao',
    icon: Building2,
    tone: 'bg-[#E8E4CE]/90 text-[#245B45]',
    desc: 'Manage user roles, official invites, departments, categories, SLA rules, and audit logs.',
  },
];

export function AuthPage() {
  const {
    login,
    governmentLogin,
    activateGovernmentAccount,
    claimAdminAccount,
    register,
    demoLogin,
  } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next');
  const highlightedRole = searchParams.get('role');
  const portalParam = searchParams.get('portal');
  const activateParam = searchParams.get('activate');
  const emailParam = searchParams.get('email');

  const initialMode =
    portalParam === 'government' || activateParam || highlightedRole === 'government'
      ? 'gov'
      : 'login';

  const [mode, setMode] = useState(initialMode);
  const [govSubMode, setGovSubMode] = useState(activateParam ? 'activate' : 'login');
  const [showAdminClaim, setShowAdminClaim] = useState(false);
  const [canClaimAdminSetup, setCanClaimAdminSetup] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: emailParam || '',
    password: '',
    role: 'citizen',
    institutionOrOrg: '',
    city: 'Mathura',
  });

  const [govForm, setGovForm] = useState({
    email: emailParam || '',
    password: '',
    activationCode: activateParam || '',
  });

  const [adminClaimForm, setAdminClaimForm] = useState({
    name: 'Platform Administrator',
    email: '',
    password: '',
  });

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/auth/admin/status')
      .then((res) => {
        if (!cancelled) {
          setCanClaimAdminSetup(Boolean(res?.canClaimAdminSetup));
        }
      })
      .catch(() => {
        // Ignore status probe error
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const redirectUser = (user) => {
    if (nextPath && nextPath.startsWith(`/${user.role}`)) {
      navigate(nextPath);
    } else {
      navigate(ROLE_HOME[user.role] || '/');
    }
  };

  const handleStandardSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const user = await login(form.email, form.password);
        showToast(`Signed in as ${user.name}`, 'success');
        redirectUser(user);
      } else {
        const { user, note } = await register(form);
        showToast(note || `Account created for ${user.name}`, 'success');
        redirectUser(user);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGovSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (govSubMode === 'activate') {
        const { user, message } = await activateGovernmentAccount(govForm);
        showToast(message || `Official account activated for ${user.name}`, 'success');
        redirectUser(user);
      } else {
        const user = await governmentLogin(govForm.email, govForm.password);
        showToast(`Signed in to Government Portal as ${user.name}`, 'success');
        redirectUser(user);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminClaim = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user, message } = await claimAdminAccount(adminClaimForm);
      setCanClaimAdminSetup(false);
      setShowAdminClaim(false);
      showToast(message || `Platform Admin account initialized for ${user.name}`, 'success');
      redirectUser(user);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async (role) => {
    setLoading(true);
    try {
      const user = await demoLogin(role);
      showToast(`Signed in to ${user.role} workspace as ${user.name}`, 'success');
      redirectUser(user);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const requiresOrgVerification = form.role === 'faculty' || form.role === 'industry';

  return (
    <div className="min-h-screen bg-[#F5F1DC] text-[#24332D] fg-civic-grid">
      <PublicNavbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Role-Aware Sign In / Government Portal / Registration */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="lg:col-span-5"
        >
          <Card padding="p-6" className="shadow-sm space-y-5">
            <SegmentedTabs
              layoutId="auth-mode-tabs"
              value={mode}
              onChange={(val) => {
                setMode(val);
                setShowAdminClaim(false);
              }}
              className="w-full grid grid-cols-3"
              options={[
                { value: 'login', label: 'Sign In' },
                { value: 'gov', label: 'Gov Official' },
                { value: 'register', label: 'Create Account' },
              ]}
            />

            {/* Mode 1: Standard Sign In (Citizen, Student, Faculty, Industry, Admin) */}
            {mode === 'login' && (
              <div>
                <h1 className="font-display text-2xl font-bold text-[#245B45]">
                  {showAdminClaim ? 'Initialize Platform Admin' : 'Welcome back'}
                </h1>
                <p className="text-xs sm:text-sm text-[#55665F] mt-1">
                  {showAdminClaim
                    ? 'Set up the initial Platform Administrator credentials using bcrypt password hashing.'
                    : 'Sign in with your email and password, or launch an interactive preview role on the right.'}
                </p>

                {!showAdminClaim ? (
                  <form onSubmit={handleStandardSubmit} className="mt-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#24332D] mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="name@example.com"
                        className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#24332D] mb-1">Password</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="Enter your password"
                        className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                      />
                    </div>

                    <Button type="submit" variant="forest" size="lg" className="w-full" disabled={loading}>
                      Sign In
                    </Button>

                    {canClaimAdminSetup && (
                      <div className="pt-2 border-t border-[#245B45]/12 text-center">
                        <button
                          type="button"
                          onClick={() => setShowAdminClaim(true)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#245B45] hover:text-[#F07832] transition-colors cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>First-time Platform Admin credential setup</span>
                        </button>
                      </div>
                    )}
                  </form>
                ) : (
                  <form onSubmit={handleAdminClaim} className="mt-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#24332D] mb-1">Administrator Name</label>
                      <input
                        type="text"
                        required
                        value={adminClaimForm.name}
                        onChange={(e) => setAdminClaimForm({ ...adminClaimForm, name: e.target.value })}
                        className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#24332D] mb-1">Administrator Email</label>
                      <input
                        type="email"
                        required
                        value={adminClaimForm.email}
                        onChange={(e) => setAdminClaimForm({ ...adminClaimForm, email: e.target.value })}
                        placeholder="admin@organization.org"
                        className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#24332D] mb-1">Administrator Password</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={adminClaimForm.password}
                        onChange={(e) => setAdminClaimForm({ ...adminClaimForm, password: e.target.value })}
                        placeholder="At least 8 characters"
                        className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="w-1/3" onClick={() => setShowAdminClaim(false)}>
                        Back
                      </Button>
                      <Button type="submit" variant="forest" className="flex-1" disabled={loading}>
                        Initialize Admin
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Mode 2: Dedicated Government Official Portal Login & Invite Activation */}
            {mode === 'gov' && (
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#245B45] bg-[#DCEBF3]/70 border border-[#245B45]/15 rounded-lg px-3 py-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-[#245B45] shrink-0" />
                  <span>Authorized Municipal & Government Official Portal</span>
                </div>

                <h1 className="font-display text-2xl font-bold text-[#245B45]">
                  {govSubMode === 'activate' ? 'Activate Official Account' : 'Government Official Sign In'}
                </h1>
                <p className="text-xs sm:text-sm text-[#55665F] mt-1">
                  {govSubMode === 'activate'
                    ? 'Enter your authorized email and the one-time invitation code issued by the FixGrid platform administrator.'
                    : 'Sign in using the official municipal email and password provisioned by your platform administrator.'}
                </p>

                <form onSubmit={handleGovSubmit} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#24332D] mb-1">Authorized Official Email</label>
                    <input
                      type="email"
                      required
                      value={govForm.email}
                      onChange={(e) => setGovForm({ ...govForm, email: e.target.value })}
                      placeholder="officer@municipality.gov"
                      className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  {govSubMode === 'activate' && (
                    <div>
                      <label className="block text-xs font-semibold text-[#24332D] mb-1">
                        Administrator Invitation Code
                      </label>
                      <input
                        type="text"
                        required
                        value={govForm.activationCode}
                        onChange={(e) => setGovForm({ ...govForm, activationCode: e.target.value })}
                        placeholder="e.g., FG-GOV-A1B2C3D4"
                        className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm font-mono-tabular uppercase"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[#24332D] mb-1">
                      {govSubMode === 'activate' ? 'Create Your Password' : 'Password'}
                    </label>
                    <input
                      type="password"
                      required
                      minLength={govSubMode === 'activate' ? 8 : 6}
                      value={govForm.password}
                      onChange={(e) => setGovForm({ ...govForm, password: e.target.value })}
                      placeholder={govSubMode === 'activate' ? 'Minimum 8 characters' : 'Enter your official password'}
                      className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <Button type="submit" variant="forest" size="lg" className="w-full" disabled={loading}>
                    {govSubMode === 'activate' ? 'Activate & Enter Command Center' : 'Sign In to Official Portal'}
                  </Button>
                </form>

                <div className="mt-4 pt-3 border-t border-[#245B45]/12 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setGovSubMode(govSubMode === 'login' ? 'activate' : 'login')}
                    className="inline-flex items-center gap-1.5 font-semibold text-[#245B45] hover:text-[#F07832] transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>
                      {govSubMode === 'login'
                        ? 'Have an invite code? Activate account'
                        : 'Already activated? Sign in with password'}
                    </span>
                  </button>
                </div>

                <p className="mt-3 text-[11px] text-[#55665F] leading-relaxed">
                  Government and administrative accounts are created or authorized by the FixGrid platform administrator.
                </p>
              </div>
            )}

            {/* Mode 3: Public Registration (Citizen, Student, Faculty Mentor, Industry / CSR Partner) */}
            {mode === 'register' && (
              <div>
                <h1 className="font-display text-2xl font-bold text-[#245B45]">Create your FixGrid account</h1>
                <p className="text-xs sm:text-sm text-[#55665F] mt-1">
                  Choose a public or verified partner role to report issues, mentor students, or support civic pilots.
                </p>

                <form onSubmit={handleStandardSubmit} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#24332D] mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g., Ankit Chaudhary"
                      className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#24332D] mb-1">Account Role</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                    >
                      <option value="citizen">Citizen (Public Registration)</option>
                      <option value="student">Student Innovator (Public Registration)</option>
                      <option value="faculty">Faculty Mentor (Institutional Verification)</option>
                      <option value="industry">Industry / CSR Partner (Organization Verification)</option>
                    </select>
                  </div>

                  {requiresOrgVerification && (
                    <div className="rounded-lg bg-[#D5EBDD]/55 border border-[#245B45]/18 px-3 py-2 text-[11px] text-[#1A4332]">
                      {form.role === 'faculty'
                        ? 'Faculty Mentor accounts require institutional details and administrator verification.'
                        : 'Industry / CSR Partner accounts require organization details and administrator verification.'}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#24332D] mb-1">
                        {form.role === 'faculty'
                          ? 'University / Institution *'
                          : form.role === 'industry'
                            ? 'Organization / CSR Name *'
                            : 'School / Organization'}
                      </label>
                      <input
                        type="text"
                        required={requiresOrgVerification}
                        minLength={requiresOrgVerification ? 2 : undefined}
                        value={form.institutionOrOrg}
                        onChange={(e) => setForm({ ...form, institutionOrOrg: e.target.value })}
                        placeholder={requiresOrgVerification ? 'Required for verification' : 'Optional'}
                        className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#24332D] mb-1">City</label>
                      <input
                        type="text"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#24332D] mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="name@example.com"
                      className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#24332D] mb-1">Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="At least 6 characters"
                      className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <Button type="submit" variant="forest" size="lg" className="w-full" disabled={loading}>
                    Create Account
                  </Button>
                </form>

                <p className="mt-4 rounded-lg bg-[#F5F1DC] border border-[#245B45]/15 px-3 py-2.5 text-xs text-[#245B45] leading-relaxed">
                  Government and administrative accounts are created or authorized by the FixGrid platform administrator.
                </p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Right: One-Click Demo Workspace Switcher */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <p className="text-xs font-semibold text-[#F07832]">One-Click Interactive Preview</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#245B45] mt-0.5">
              Try Any Workspace Instantly
            </h2>
            <p className="text-xs sm:text-sm text-[#55665F] mt-1 leading-relaxed">
              Each of the six stakeholder roles has a dedicated, protected dashboard and sample Mathura records. Pick any role below to explore.
            </p>
          </div>

          <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {DEMO_ROLES.map((item) => {
              const Icon = item.icon;
              const isHighlighted = highlightedRole === item.role;
              return (
                <StaggerItem key={item.role}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleDemo(item.role)}
                    className={`w-full h-full text-left rounded-xl bg-[#FAF8EE] border p-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm cursor-pointer flex flex-col justify-between gap-3 group ${
                      isHighlighted
                        ? 'border-[#F07832] ring-2 ring-[#F07832]/25'
                        : 'border-[#245B45]/15 hover:border-[#F07832]'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.tone}`}>
                          <Icon className="w-4 h-4 shrink-0" />
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F07832]">
                          <span>Open</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      </div>
                      <div>
                        <p className="font-display text-base font-bold text-[#245B45] group-hover:text-[#F07832] transition-colors">
                          {item.label}
                        </p>
                        <p className="text-xs font-medium text-[#24332D]">{item.person}</p>
                      </div>
                      <p className="text-xs text-[#55665F] leading-snug">{item.desc}</p>
                    </div>
                  </button>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </div>
      </main>
    </div>
  );
}
