import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeftRight,
  Award,
  Bell,
  Building2,
  ClipboardCheck,
  Compass,
  FolderKanban,
  Flame,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MapPin,
  Menu,
  MessageSquareHeart,
  PlusCircle,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLE_LABELS, formatDateTime } from '../../utils/formatters.js';
import { CivicBrandMark } from '../ui/CivicIllustrations.jsx';
import { FG_EASE } from '../ui/MotionPrimitives.jsx';

const DashboardShellContext = createContext(null);

const ROLE_NAV = {
  citizen: [
    { to: '/citizen/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/citizen/report', label: 'Report an Issue', icon: PlusCircle },
    { to: '/citizen/my-complaints', label: 'My Reports', icon: ClipboardCheck },
    { to: '/citizen/community', label: 'Neighborhood Feed', icon: MessageSquareHeart },
  ],
  government: [
    { to: '/government/dashboard', label: 'Command Center', icon: LayoutDashboard },
    { to: '/government/complaints', label: 'Review Issues', icon: ShieldCheck },
    { to: '/government/departments', label: 'Departments & SLA', icon: Building2 },
    { to: '/government/heatmap', label: 'Live Map & Heatmap', icon: Flame },
    { to: '/government/challenges', label: 'Challenges & Pilots', icon: Lightbulb },
  ],
  student: [
    { to: '/student/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/student/challenges', label: 'Find Challenges', icon: Compass },
    { to: '/student/teams', label: 'My Teams', icon: Users },
    { to: '/student/projects', label: 'Project Board', icon: FolderKanban },
    { to: '/student/passport', label: 'My Passport', icon: Award },
    { to: '/student/profile', label: 'Skills & Privacy', icon: UserCircle },
  ],
  faculty: [
    { to: '/faculty/dashboard', label: 'Mentor Overview', icon: LayoutDashboard },
    { to: '/faculty/mentorship', label: 'Team Requests', icon: Users },
    { to: '/faculty/reviews', label: 'Verify Work', icon: Award },
    { to: '/faculty/projects', label: 'Student Projects', icon: FolderKanban },
  ],
  industry: [
    { to: '/industry/dashboard', label: 'Partner Overview', icon: LayoutDashboard },
    { to: '/industry/challenges', label: 'Civic Challenges', icon: Lightbulb },
    { to: '/industry/teams', label: 'Student Teams', icon: Users },
    { to: '/industry/partnerships', label: 'Support Offers', icon: Building2 },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'System Overview', icon: LayoutDashboard },
    { to: '/admin/users', label: 'Users & Roles', icon: Users },
    { to: '/admin/departments', label: 'Departments', icon: Building2 },
    { to: '/admin/categories', label: 'Issue Categories', icon: SlidersHorizontal },
    { to: '/admin/settings', label: 'SLA & Match Rules', icon: Settings },
    { to: '/admin/audit-logs', label: 'Audit & Moderation', icon: ScrollText },
  ],
};

function FrozenOutlet({ pathname }) {
  const currentOutlet = useOutlet();
  const { pathname: livePathname } = useLocation();
  const [captured] = useState(() => currentOutlet);
  return livePathname === pathname ? currentOutlet : captured;
}

const DASHBOARD_SLIDE_VARIANTS = {
  initial: (dir) => ({
    opacity: 0,
    x: dir >= 0 ? 28 : -28,
  }),
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      x: { duration: 0.24, ease: FG_EASE },
      opacity: { duration: 0.18, ease: 'easeOut' },
    },
    transitionEnd: {
      transform: 'none',
    },
  },
  exit: (dir) => ({
    opacity: 0,
    x: dir >= 0 ? -28 : 28,
    transition: {
      x: { duration: 0.18, ease: FG_EASE },
      opacity: { duration: 0.14, ease: 'easeIn' },
    },
  }),
};

const DASHBOARD_REDUCED_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

function DashboardSidebar({ user, navItems, onCloseMobile, onSwitchRole, onLogout }) {
  return (
    <div className="flex flex-col h-full bg-[#1A4332] text-[#F5F1DC]">
      <div className="px-5 h-16 flex items-center justify-between border-b border-white/10">
        <Link to="/" className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
          <CivicBrandMark className="w-7 h-7 shrink-0" />
          <span>FixGrid AI</span>
        </Link>
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded text-white/75 hover:text-white cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Signed-in Persona Card */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="rounded-xl bg-white/8 border border-white/10 px-3.5 py-3">
          <p className="text-[11px] font-semibold text-[#7DBE9E]">
            {ROLE_LABELS[user?.role] || 'Workspace'}
          </p>
          <p className="text-sm font-semibold text-white mt-0.5 truncate">{user?.name}</p>
          <p className="text-xs text-[#D5EBDD]/75 truncate mt-0.5">
            {user?.institutionOrOrg || user?.city || 'Mathura'}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 pb-1 text-[11px] font-semibold text-[#D5EBDD]/55">Workspace Menu</p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'text-white'
                    : 'text-[#D5EBDD] hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="fg-sidebar-active"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-[#F07832]"
                    />
                  )}
                  <Icon className="relative z-10 w-4 h-4 shrink-0" />
                  <span className="relative z-10 truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}

        <div className="pt-4 mt-4 border-t border-white/10 space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold text-[#D5EBDD]/55">Public Views</p>
          <Link
            to="/community"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-[#D5EBDD]/85 hover:bg-white/10 hover:text-white transition-colors"
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span>Public Issue Map</span>
          </Link>
          <Link
            to="/challenges"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-[#D5EBDD]/85 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Lightbulb className="w-4 h-4 shrink-0" />
            <span>Open Challenges</span>
          </Link>
        </div>
      </nav>

      <div className="p-3 border-t border-white/10 space-y-1">
        <button
          type="button"
          onClick={onSwitchRole}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-[#D5EBDD] hover:bg-white/10 transition-colors cursor-pointer"
        >
          <ArrowLeftRight className="w-4 h-4 shrink-0" />
          <span>Switch Workspace Role</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-[#F3D7DD] hover:bg-white/10 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

function DashboardHeaderBar({
  user,
  title,
  subtitle,
  primaryAction,
  notifications,
  unreadCount,
  markNotificationRead,
  markAllRead,
  onOpenSidebar,
}) {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 min-h-16 py-2 bg-[#F5F1DC]/95 backdrop-blur-md border-b border-[#245B45]/12 px-4 sm:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="lg:hidden p-2 rounded-lg text-[#24332D] hover:bg-[#245B45]/10 cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: FG_EASE }}
            className="min-w-0"
          >
            <div className="flex items-center gap-2 text-[11px] font-medium text-[#55665F]">
              <span>{ROLE_LABELS[user?.role] || 'Portal'}</span>
              <span aria-hidden="true">/</span>
              <span className="text-[#245B45] truncate">{title || 'Workspace'}</span>
            </div>
            <h1 className="font-display text-lg sm:text-xl font-bold text-[#245B45] truncate">
              {title}
            </h1>
            {subtitle && <p className="text-xs text-[#55665F] truncate">{subtitle}</p>}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {primaryAction}

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications"
            className="relative p-2 rounded-lg border border-[#245B45]/15 bg-[#FAF8EE] hover:bg-[#D5EBDD]/60 text-[#24332D] cursor-pointer transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F07832] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#FAF8EE] border border-[#245B45]/20 rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-[#245B45]/12 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#245B45]">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-xs font-medium text-[#F07832] hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#245B45]/10">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-[#55665F]">You are all caught up.</p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            markNotificationRead(n.id);
                            setNotifOpen(false);
                            if (n.link) navigate(n.link);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-[#D5EBDD]/40 transition-colors cursor-pointer ${
                            n.is_read ? 'opacity-70' : 'bg-[#D5EBDD]/20'
                          }`}
                        >
                          <p className="text-xs font-semibold text-[#24332D]">{n.title}</p>
                          <p className="text-xs text-[#55665F] mt-0.5 leading-snug">{n.message}</p>
                          <p className="text-[11px] text-[#55665F]/80 mt-1 font-mono-tabular">
                            {formatDateTime(n.created_at)}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

function IsolatedHeaderBar({ subscriberRef, ...props }) {
  const [header, setHeader] = useState({ title: '', subtitle: '', primaryAction: null });

  useLayoutEffect(() => {
    subscriberRef.current = setHeader;
    return () => {
      subscriberRef.current = null;
    };
  }, [subscriberRef]);

  return (
    <DashboardHeaderBar
      {...props}
      title={header.title}
      subtitle={header.subtitle}
      primaryAction={header.primaryAction}
    />
  );
}

export function DashboardShell() {
  const { user, notifications, unreadCount, logout, markNotificationRead, markAllRead } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const headerSubscriberRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const shellApi = useMemo(
    () => ({
      setHeader: (nextHeader) => {
        headerSubscriberRef.current?.(nextHeader);
      },
    }),
    []
  );

  const navItems = ROLE_NAV[user?.role] || ROLE_NAV.citizen;
  const navIndex = navItems.findIndex((item) => item.to === location.pathname);
  const currentRank = navIndex >= 0 ? navIndex : 0;
  const viewTrackerRef = useRef({ pathname: location.pathname, rank: currentRank, direction: 1 });

  if (viewTrackerRef.current.pathname !== location.pathname) {
    const direction = currentRank >= viewTrackerRef.current.rank ? 1 : -1;
    viewTrackerRef.current = { pathname: location.pathname, rank: currentRank, direction };
  }

  const slideDirection = viewTrackerRef.current.direction;

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <DashboardShellContext.Provider value={shellApi}>
      <div className="min-h-screen flex bg-[#F5F1DC] text-[#24332D]">
        <LayoutGroup id="fg-dashboard-nav">
          {/* Persistent Desktop Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
            <DashboardSidebar
              user={user}
              navItems={navItems}
              onSwitchRole={() => navigate('/auth')}
              onLogout={handleLogout}
            />
          </aside>

          {/* Mobile Sidebar Drawer */}
          <AnimatePresence>
            {sidebarOpen && (
              <div className="fixed inset-0 z-50 lg:hidden flex">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSidebarOpen(false)}
                  className="fixed inset-0 bg-black/45"
                />
                <motion.aside
                  initial={{ x: -260 }}
                  animate={{ x: 0 }}
                  exit={{ x: -260 }}
                  transition={{ duration: 0.2, ease: FG_EASE }}
                  className="relative z-10 w-64 h-full"
                >
                  <DashboardSidebar
                    user={user}
                    navItems={navItems}
                    onCloseMobile={() => setSidebarOpen(false)}
                    onSwitchRole={() => {
                      setSidebarOpen(false);
                      navigate('/auth');
                    }}
                    onLogout={handleLogout}
                  />
                </motion.aside>
              </div>
            )}
          </AnimatePresence>
        </LayoutGroup>

        {/* Main Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <IsolatedHeaderBar
            subscriberRef={headerSubscriberRef}
            user={user}
            notifications={notifications}
            unreadCount={unreadCount}
            markNotificationRead={markNotificationRead}
            markAllRead={markAllRead}
            onOpenSidebar={() => setSidebarOpen(true)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-x-clip">
            <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
              <motion.div
                key={location.pathname}
                custom={slideDirection}
                variants={reduced ? DASHBOARD_REDUCED_VARIANTS : DASHBOARD_SLIDE_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <FrozenOutlet pathname={location.pathname} />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </DashboardShellContext.Provider>
  );
}

export function DashboardLayout({ title, subtitle = '', primaryAction = null, children }) {
  const shell = useContext(DashboardShellContext);
  const { user, notifications, unreadCount, logout, markNotificationRead, markAllRead } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useLayoutEffect(() => {
    if (shell) {
      shell.setHeader({ title, subtitle, primaryAction });
    }
  });

  if (shell) {
    return <>{children}</>;
  }

  // Standalone fallback if rendered outside DashboardShell
  const navItems = ROLE_NAV[user?.role] || ROLE_NAV.citizen;
  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen flex bg-[#F5F1DC] text-[#24332D]">
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        <DashboardSidebar
          user={user}
          navItems={navItems}
          onSwitchRole={() => navigate('/auth')}
          onLogout={handleLogout}
        />
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/45"
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.2, ease: FG_EASE }}
              className="relative z-10 w-64 h-full"
            >
              <DashboardSidebar
                user={user}
                navItems={navItems}
                onCloseMobile={() => setSidebarOpen(false)}
                onSwitchRole={() => {
                  setSidebarOpen(false);
                  navigate('/auth');
                }}
                onLogout={handleLogout}
              />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-w-0 flex flex-col">
        <DashboardHeaderBar
          user={user}
          title={title}
          subtitle={subtitle}
          primaryAction={primaryAction}
          notifications={notifications}
          unreadCount={unreadCount}
          markNotificationRead={markNotificationRead}
          markAllRead={markAllRead}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: FG_EASE }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
