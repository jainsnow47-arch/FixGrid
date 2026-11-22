import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, Calendar, MapPin, Building2, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { PublicNavbar } from '../../components/layout/PublicNavbar.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function PublicChallengesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    apiRequest('/api/public/challenges')
      .then((d) => setChallenges(d.challenges || []))
      .finally(() => setLoading(false));
  }, []);

  const categories = ['All', ...Array.from(new Set(challenges.map((c) => c.category).filter(Boolean)))];
  const visible = selectedCategory === 'All'
    ? challenges
    : challenges.filter((c) => c.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#F5F1DC] text-[#24332D]">
      <PublicNavbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#F07832]">Community Innovation Challenges</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#245B45] mt-1">
              Open Civic Engineering Challenges
            </h1>
            <p className="text-sm text-[#55665F] mt-1 max-w-2xl">
              Real recurring infrastructure issues turned into mentored student projects. Prototypes complement official city repairs.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate(user?.role === 'student' ? '/student/challenges' : '/auth?role=student')}
          >
            <span>{user?.role === 'student' ? 'View My Skill Matches' : 'Sign In as Student to Apply'}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Category Filter Buttons */}
        {categories.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-[#245B45] text-white'
                    : 'bg-[#FAF8EE] border border-[#245B45]/18 text-[#24332D] hover:border-[#245B45]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1, 2].map((i) => (
              <Card key={i}>
                <Skeleton className="h-6 w-2/3 mb-3" />
                <Skeleton className="h-24 w-full" />
              </Card>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No challenges in this category yet"
            description="Select All to browse every open municipal innovation challenge."
            actionLabel="Show All Challenges"
            onAction={() => setSelectedCategory('All')}
          />
        ) : (
          <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {visible.map((ch) => (
              <StaggerItem key={ch.id}>
                <Card interactive className="h-full flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#55665F]">
                      <span className="font-mono-tabular font-semibold text-[#245B45]">{ch.challenge_code}</span>
                      <span>{ch.difficulty} · {ch.category}</span>
                    </div>

                    <h2 className="font-display text-lg font-bold text-[#24332D] leading-snug">
                      {ch.title}
                    </h2>

                    <p className="text-sm text-[#55665F] leading-relaxed">{ch.description}</p>

                    <div className="space-y-1.5 text-xs text-[#24332D] pt-1">
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#F07832]" />
                        <span>{ch.location}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#245B45]" />
                        <span>{ch.department_name || 'Municipal Partner Cell'}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#245B45]" />
                        <span>Target Deadline: {ch.deadline}</span>
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#245B45]/10">
                      <p className="text-xs font-semibold text-[#245B45]">Skills Needed</p>
                      <p className="text-xs text-[#55665F] mt-0.5">
                        {(ch.skillsRequired || []).join(' · ')}
                      </p>
                    </div>

                    {ch.source_complaint_code && (
                      <p className="text-xs text-[#55665F]">
                        Inspired by Report: <span className="font-mono-tabular font-semibold text-[#24332D]">{ch.source_complaint_code}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#245B45]/10">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#245B45]">
                      <Lightbulb className="w-3.5 h-3.5 text-[#F07832]" />
                      <span>Status: {ch.pilot_status}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="forest"
                      onClick={() => navigate(user?.role === 'student' ? '/student/challenges' : '/auth?role=student')}
                    >
                      Apply / Check Match
                    </Button>
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </StaggerGrid>
        )}
      </main>
    </div>
  );
}
