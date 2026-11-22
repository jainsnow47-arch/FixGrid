import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ProtectedRoute } from './components/layout/ProtectedRoute.jsx';
import { DashboardShell } from './components/layout/DashboardLayout.jsx';
import { FG_EASE } from './components/ui/MotionPrimitives.jsx';

import { LandingPage } from './pages/public/LandingPage.jsx';
import { AuthPage } from './pages/public/AuthPage.jsx';
import { CommunityFeedPage } from './pages/public/CommunityFeedPage.jsx';
import { PublicChallengesPage } from './pages/public/PublicChallengesPage.jsx';

import { CitizenDashboard } from './pages/citizen/CitizenDashboard.jsx';
import { ReportIssuePage } from './pages/citizen/ReportIssuePage.jsx';
import { MyComplaintsPage } from './pages/citizen/MyComplaintsPage.jsx';

import { GovernmentDashboard } from './pages/government/GovernmentDashboard.jsx';
import { GovComplaintsPage } from './pages/government/GovComplaintsPage.jsx';
import { GovDepartmentsPage } from './pages/government/GovDepartmentsPage.jsx';
import { GovHeatmapPage } from './pages/government/GovHeatmapPage.jsx';
import { GovChallengesPage } from './pages/government/GovChallengesPage.jsx';

import { StudentDashboard } from './pages/student/StudentDashboard.jsx';
import { StudentChallengesPage } from './pages/student/StudentChallengesPage.jsx';
import { StudentTeamsPage } from './pages/student/StudentTeamsPage.jsx';
import { StudentProjectsPage } from './pages/student/StudentProjectsPage.jsx';
import { StudentPassportPage } from './pages/student/StudentPassportPage.jsx';
import { StudentProfilePage } from './pages/student/StudentProfilePage.jsx';

import { FacultyDashboard } from './pages/faculty/FacultyDashboard.jsx';
import { FacultyMentorshipPage } from './pages/faculty/FacultyMentorshipPage.jsx';
import { FacultyReviewsPage } from './pages/faculty/FacultyReviewsPage.jsx';
import { FacultyProjectsPage } from './pages/faculty/FacultyProjectsPage.jsx';

import { IndustryDashboard } from './pages/industry/IndustryDashboard.jsx';
import { IndustryChallengesPage } from './pages/industry/IndustryChallengesPage.jsx';
import { IndustryTeamsPage } from './pages/industry/IndustryTeamsPage.jsx';
import { IndustryPartnershipsPage } from './pages/industry/IndustryPartnershipsPage.jsx';

import { AdminDashboard } from './pages/admin/AdminDashboard.jsx';
import { AdminUsersPage } from './pages/admin/AdminUsersPage.jsx';
import { AdminDepartmentsPage } from './pages/admin/AdminDepartmentsPage.jsx';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage.jsx';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage.jsx';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogsPage.jsx';

const DASHBOARD_PREFIXES = ['/citizen/', '/government/', '/student/', '/faculty/', '/industry/', '/admin/'];

function getShellKey(pathname) {
  return DASHBOARD_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ? 'dashboard-shell' : pathname;
}

function getRouteRank(pathname) {
  if (pathname === '/') return 0;
  if (pathname === '/community') return 1;
  if (pathname === '/challenges') return 2;
  if (pathname === '/auth') return 3;
  if (DASHBOARD_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return 4;
  return 1;
}

const SLIDE_PAGE_VARIANTS = {
  initial: (dir) => ({
    opacity: 0,
    x: dir >= 0 ? 48 : -48,
  }),
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      x: { duration: 0.28, ease: FG_EASE },
      opacity: { duration: 0.22, ease: 'easeOut' },
    },
    transitionEnd: {
      transform: 'none',
    },
  },
  exit: (dir) => ({
    opacity: 0,
    x: dir >= 0 ? -48 : 48,
    transition: {
      x: { duration: 0.22, ease: FG_EASE },
      opacity: { duration: 0.16, ease: 'easeIn' },
    },
  }),
};

const REDUCED_PAGE_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

function RouteLayer({ layerKey }) {
  const liveLocation = useLocation();
  const [capturedLocation] = useState(() => liveLocation);
  const liveKey = getShellKey(liveLocation.pathname);
  const activeLocation = liveKey === layerKey ? liveLocation : capturedLocation;

  return (
    <Routes location={activeLocation}>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/community" element={<CommunityFeedPage />} />
      <Route path="/challenges" element={<PublicChallengesPage />} />

      {/* Persistent Animated Dashboard Shell */}
      <Route element={<DashboardShell />}>
        {/* Citizen Routes */}
        <Route path="/citizen/dashboard" element={<ProtectedRoute allowedRoles={['citizen']}><CitizenDashboard /></ProtectedRoute>} />
        <Route path="/citizen/report" element={<ProtectedRoute allowedRoles={['citizen']}><ReportIssuePage /></ProtectedRoute>} />
        <Route path="/citizen/my-complaints" element={<ProtectedRoute allowedRoles={['citizen']}><MyComplaintsPage /></ProtectedRoute>} />
        <Route path="/citizen/community" element={<ProtectedRoute allowedRoles={['citizen']}><CommunityFeedPage insideDashboard /></ProtectedRoute>} />

        {/* Government Official Routes */}
        <Route path="/government/dashboard" element={<ProtectedRoute allowedRoles={['government']}><GovernmentDashboard /></ProtectedRoute>} />
        <Route path="/government/complaints" element={<ProtectedRoute allowedRoles={['government']}><GovComplaintsPage /></ProtectedRoute>} />
        <Route path="/government/departments" element={<ProtectedRoute allowedRoles={['government']}><GovDepartmentsPage /></ProtectedRoute>} />
        <Route path="/government/heatmap" element={<ProtectedRoute allowedRoles={['government']}><GovHeatmapPage /></ProtectedRoute>} />
        <Route path="/government/challenges" element={<ProtectedRoute allowedRoles={['government']}><GovChallengesPage /></ProtectedRoute>} />

        {/* Student Innovator Routes */}
        <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/challenges" element={<ProtectedRoute allowedRoles={['student']}><StudentChallengesPage /></ProtectedRoute>} />
        <Route path="/student/teams" element={<ProtectedRoute allowedRoles={['student']}><StudentTeamsPage /></ProtectedRoute>} />
        <Route path="/student/projects" element={<ProtectedRoute allowedRoles={['student']}><StudentProjectsPage /></ProtectedRoute>} />
        <Route path="/student/passport" element={<ProtectedRoute allowedRoles={['student']}><StudentPassportPage /></ProtectedRoute>} />
        <Route path="/student/profile" element={<ProtectedRoute allowedRoles={['student']}><StudentProfilePage /></ProtectedRoute>} />

        {/* Faculty Mentor Routes */}
        <Route path="/faculty/dashboard" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
        <Route path="/faculty/mentorship" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyMentorshipPage /></ProtectedRoute>} />
        <Route path="/faculty/reviews" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyReviewsPage /></ProtectedRoute>} />
        <Route path="/faculty/projects" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyProjectsPage /></ProtectedRoute>} />

        {/* Industry / CSR Partner Routes */}
        <Route path="/industry/dashboard" element={<ProtectedRoute allowedRoles={['industry']}><IndustryDashboard /></ProtectedRoute>} />
        <Route path="/industry/challenges" element={<ProtectedRoute allowedRoles={['industry']}><IndustryChallengesPage /></ProtectedRoute>} />
        <Route path="/industry/teams" element={<ProtectedRoute allowedRoles={['industry']}><IndustryTeamsPage /></ProtectedRoute>} />
        <Route path="/industry/partnerships" element={<ProtectedRoute allowedRoles={['industry']}><IndustryPartnershipsPage /></ProtectedRoute>} />

        {/* Platform Administrator Routes */}
        <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUsersPage /></ProtectedRoute>} />
        <Route path="/admin/departments" element={<ProtectedRoute allowedRoles={['admin']}><AdminDepartmentsPage /></ProtectedRoute>} />
        <Route path="/admin/categories" element={<ProtectedRoute allowedRoles={['admin']}><AdminCategoriesPage /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><AdminSettingsPage /></ProtectedRoute>} />
        <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AdminAuditLogsPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AnimatedAppRoutes() {
  const location = useLocation();
  const reduced = useReducedMotion();
  const shellKey = getShellKey(location.pathname);
  const nextRank = getRouteRank(location.pathname);
  const navTrackerRef = useRef({ key: shellKey, rank: nextRank, direction: 1 });

  if (navTrackerRef.current.key !== shellKey) {
    const direction = nextRank >= navTrackerRef.current.rank ? 1 : -1;
    navTrackerRef.current = { key: shellKey, rank: nextRank, direction };
  }

  const direction = navTrackerRef.current.direction;

  useEffect(() => {
    if (shellKey !== 'dashboard-shell') {
      window.scrollTo(0, 0);
    }
  }, [shellKey]);

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F5F1DC]">
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={shellKey}
          custom={direction}
          variants={reduced ? REDUCED_PAGE_VARIANTS : SLIDE_PAGE_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          className="min-h-screen"
        >
          <RouteLayer layerKey={shellKey} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AnimatedAppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
