import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLE_HOME } from '../../utils/formatters.js';
import { Button } from '../ui/Button.jsx';
import { CivicBrandMark } from '../ui/CivicIllustrations.jsx';

export function PublicNavbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const portalPath = user ? ROLE_HOME[user.role] || '/citizen/dashboard' : '/auth';

  const navLinkClass = (path) =>
    `relative py-1 transition-colors whitespace-nowrap shrink-0 hover:text-[#F07832] ${
      location.pathname === path ? 'text-[#245B45] font-semibold' : 'text-[#24332D]'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-[#F5F1DC]/95 backdrop-blur-md border-b border-[#245B45]/12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Clean single-line Brand Wordmark */}
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-[#245B45] whitespace-nowrap shrink-0"
        >
          <CivicBrandMark className="w-7 h-7 shrink-0" />
          <span>FixGrid AI</span>
        </Link>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <Link to="/community" className={navLinkClass('/community')}>
            Community Feed
          </Link>
          <Link to="/challenges" className={navLinkClass('/challenges')}>
            Challenges
          </Link>
          <a href="/#how-it-works" className="py-1 text-[#24332D] hover:text-[#F07832] transition-colors whitespace-nowrap shrink-0">
            How It Works
          </a>
          <Link to={portalPath} className={navLinkClass(portalPath)}>
            {user ? 'Open Dashboard' : 'Sign In'}
          </Link>
        </nav>

        {/* Zone 3: Single primary CTA */}
        <div className="hidden md:flex items-center shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(user ? '/citizen/report' : '/auth?next=/citizen/report')}
          >
            Report an Issue
          </Button>
        </div>

        <button
          type="button"
          className="md:hidden p-2 rounded-lg text-[#24332D] hover:bg-[#245B45]/10 cursor-pointer"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="md:hidden overflow-hidden border-t border-[#245B45]/12 bg-[#FAF8EE]"
          >
            <div className="px-4 py-3 space-y-2">
              <Link to="/community" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-[#24332D]">
                Community Feed
              </Link>
              <Link to="/challenges" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-[#24332D]">
                Challenges
              </Link>
              <a href="/#how-it-works" onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-[#24332D]">
                How It Works
              </a>
              <Link to={portalPath} onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-medium text-[#24332D]">
                {user ? 'Open Dashboard' : 'Sign In'}
              </Link>
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  setMobileOpen(false);
                  navigate(user ? '/citizen/report' : '/auth?next=/citizen/report');
                }}
              >
                Report an Issue
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
