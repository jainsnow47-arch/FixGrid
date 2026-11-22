import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Building2,
  Compass,
  GraduationCap,
  Handshake,
  ShieldCheck,
  Users,
} from 'lucide-react';
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
    desc: 'Manage user roles, city departments, issue categories, deadline rules, and audit logs.',
  },
];

export function AuthPage() {
  const { login, register, demoLogin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next');
  const highlightedRole = searchParams.get('role');

  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'citizen',
    institutionOrOrg: '',
    city: 'Mathura',
  });

  const redirectUser = (user) => {
    if (nextPath && nextPath.startsWith(`/${user.role}`)) {
      navigate(nextPath);
    } else {
      navigate(ROLE_HOME[user.role] || '/');
    }
  };

  const handleSubmit = async (e) => {
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

  return (
    <div className="min-h-screen bg-[#F5F1DC] text-[#24332D] fg-civic-grid">
      <PublicNavbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Standard Sign In / Register */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="lg:col-span-5"
        >
          <Card padding="p-6" className="shadow-sm">
            <div className="mb-5">
              <SegmentedTabs
                layoutId="auth-mode-tabs"
                value={mode}
                onChange={setMode}
                className="w-full grid grid-cols-2"
                options={[
                  { value: 'login', label: 'Sign In' },
                  { value: 'register', label: 'Create Account' },
                ]}
              />
            </div>

            <h1 className="font-display text-2xl font-bold text-[#245B45]">
              {mode === 'login' ? 'Welcome back' : 'Create your FixGrid account'}
            </h1>
            <p className="text-xs sm:text-sm text-[#55665F] mt-1">
              {mode === 'login'
                ? 'Sign in with your email and password, or try any role instantly on the right.'
                : 'Choose your role to report neighborhood issues or join civic challenges.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {mode === 'register' && (
                <>
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
                      <option value="citizen">Resident / Citizen</option>
                      <option value="student">Student Innovator</option>
                      <option value="faculty">Faculty Mentor</option>
                      <option value="industry">Industry / CSR Partner</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#24332D] mb-1">School / Org</label>
                      <input
                        type="text"
                        value={form.institutionOrOrg}
                        onChange={(e) => setForm({ ...form, institutionOrOrg: e.target.value })}
                        placeholder="Optional"
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
                </>
              )}

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
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
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
              Each workspace has its own permissions, tools, and sample Mathura records. Pick any role below to jump straight in.
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
