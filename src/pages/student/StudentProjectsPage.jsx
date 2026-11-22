import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, GraduationCap, Plus, Upload } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { AnimatePresence, motion } from 'motion/react';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { FG_EASE, StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

const COLUMNS = [
  { key: 'Todo', label: 'To Do', tone: 'bg-[#FAF8EE]' },
  { key: 'In Progress', label: 'In Progress', tone: 'bg-[#DCEBF3]/40' },
  { key: 'Review', label: 'Ready for Review', tone: 'bg-[#FBF0D9]/45' },
  { key: 'Done', label: 'Done', tone: 'bg-[#D5EBDD]/45' },
];

export function StudentProjectsPage() {
  const { showToast } = useToast();
  const [projects, setProjects] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [taskModalProj, setTaskModalProj] = useState(null);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'Medium', dueDate: '2026-12-20' });
  const [delivModalProj, setDelivModalProj] = useState(null);
  const [delivForm, setDelivForm] = useState({ title: '', description: '', file: null });
  const [mentorProj, setMentorProj] = useState(null);
  const [mentorForm, setMentorForm] = useState({ facultyId: '', message: '' });

  const load = () => {
    apiRequest('/api/projects').then((d) => {
      setProjects(d.projects || []);
      setFacultyList(d.facultyList || []);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const moveTask = async (taskId, nextStatus) => {
    try {
      await apiRequest(`/api/projects/tasks/${taskId}`, {
        method: 'PATCH',
        body: { status: nextStatus },
      });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/projects/${taskModalProj.id}/tasks`, {
        method: 'POST',
        body: taskForm,
      });
      showToast('Task added to board.', 'success');
      setTaskModalProj(null);
      setTaskForm({ title: '', description: '', priority: 'Medium', dueDate: '2026-12-20' });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const uploadDeliverable = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('title', delivForm.title);
      fd.append('description', delivForm.description);
      if (delivForm.file) fd.append('file', delivForm.file);
      await apiRequest(`/api/projects/${delivModalProj.id}/deliverables`, {
        method: 'POST',
        body: fd,
        isFormData: true,
      });
      showToast('Deliverable uploaded.', 'success');
      setDelivModalProj(null);
      setDelivForm({ title: '', description: '', file: null });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const requestMentor = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/projects/${mentorProj.id}/request-mentor`, {
        method: 'POST',
        body: mentorForm,
      });
      showToast('Mentorship request sent to faculty.', 'success');
      setMentorProj(null);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <DashboardLayout
      title="Project Board"
      subtitle="Move tasks across columns, upload project deliverables, and get faculty mentor feedback"
    >
      {projects.length === 0 ? (
        <EmptyState
          title="No active project board yet"
          description="Apply to an approved civic challenge. Once a government official approves your proposal, your Kanban project board opens here."
        />
      ) : (
        <StaggerGrid immediate className="space-y-8">
          {projects.map((proj) => {
            const doneCount = proj.tasks.filter((t) => t.status === 'Done').length;
            const pct = proj.tasks.length > 0 ? Math.round((doneCount / proj.tasks.length) * 100) : 0;

            return (
              <StaggerItem key={proj.id}>
                <Card className="space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#245B45]/12 pb-4">
                  <div className="space-y-1">
                    <p className="text-xs font-mono-tabular text-[#F07832] font-semibold">
                      {proj.challenge_code} · Team {proj.team_name} · {proj.pilot_approved ? 'Field Pilot Approved' : 'Prototype Phase'}
                    </p>
                    <h2 className="font-display text-xl font-bold text-[#245B45]">{proj.title}</h2>
                    <p className="text-xs text-[#55665F]">{proj.objectives}</p>
                    <div className="flex items-center gap-3 pt-2 max-w-sm">
                      <div className="flex-1 h-2 rounded-full bg-[#E8E4CE] overflow-hidden">
                        <div className="h-full bg-[#245B45] transition-all duration-300" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-mono-tabular font-semibold text-[#245B45]">
                        {doneCount}/{proj.tasks.length} tasks done
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" variant="forest" onClick={() => setTaskModalProj(proj)}>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Task</span>
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setDelivModalProj(proj)}>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Deliverable</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMentorProj(proj);
                        setMentorForm({ facultyId: facultyList[0]?.id || '', message: '' });
                      }}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>Ask Faculty Mentor</span>
                    </Button>
                  </div>
                </div>

                {/* Kanban Columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {COLUMNS.map((col, colIdx) => {
                    const colTasks = proj.tasks.filter((t) => t.status === col.key);
                    const prevCol = COLUMNS[colIdx - 1];
                    const nextCol = COLUMNS[colIdx + 1];
                    return (
                      <div key={col.key} className={`rounded-xl border border-[#245B45]/12 p-3 space-y-2.5 ${col.tone}`}>
                        <div className="flex items-center justify-between text-xs font-bold text-[#245B45] px-0.5">
                          <span>{col.label}</span>
                          <span className="font-mono-tabular">{colTasks.length}</span>
                        </div>

                        <AnimatePresence initial={false}>
                          {colTasks.map((t) => (
                            <motion.div
                              key={t.id}
                              layout
                              initial={{ opacity: 0, y: 8, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.96 }}
                              transition={{ duration: 0.18, ease: FG_EASE }}
                              className="rounded-lg bg-white border border-[#245B45]/12 p-3 space-y-1.5 shadow-xs"
                            >
                              <div className="flex items-center justify-between text-[11px] text-[#55665F]">
                                <span className="font-semibold text-[#F07832]">{t.priority}</span>
                                <span className="font-mono-tabular">{t.due_date || 'Flexible'}</span>
                              </div>
                              <p className="text-xs font-bold text-[#24332D]">{t.title}</p>
                              {t.description && <p className="text-[11px] text-[#55665F]">{t.description}</p>}
                              <div className="pt-1.5 border-t border-[#245B45]/8 flex items-center justify-between text-[11px] gap-2">
                                <span className="text-[#55665F] truncate">{t.assignee_name || 'Team'}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {prevCol && (
                                    <button
                                      type="button"
                                      onClick={() => moveTask(t.id, prevCol.key)}
                                      title={`Move back to ${prevCol.label}`}
                                      className="p-1 rounded hover:bg-[#E8E4CE] text-[#55665F] cursor-pointer"
                                    >
                                      <ArrowLeft className="w-3 h-3" />
                                    </button>
                                  )}
                                  {nextCol && (
                                    <button
                                      type="button"
                                      onClick={() => moveTask(t.id, nextCol.key)}
                                      className="inline-flex items-center gap-1 font-semibold text-[#245B45] hover:text-[#F07832] cursor-pointer"
                                    >
                                      <span>{nextCol.key}</span>
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                {/* Milestones & Faculty Feedback */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2 border-t border-[#245B45]/12">
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-bold text-[#245B45]">Milestones & Uploaded Files</h3>
                    {proj.milestones.map((m) => (
                      <div key={m.id} className="rounded-lg bg-white border border-[#245B45]/12 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#24332D]">{m.title}</span>
                          <span className="font-semibold text-[#245B45]">{m.status}</span>
                        </div>
                        <p className="text-[#55665F] mt-1">Due {m.due_date}</p>
                        {m.faculty_evaluation && (
                          <p className="mt-1.5 text-[#1A4332] bg-[#D5EBDD]/50 p-2 rounded">
                            Faculty review: {m.faculty_evaluation}
                          </p>
                        )}
                      </div>
                    ))}
                    {proj.deliverables.map((d) => (
                      <div key={d.id} className="rounded-lg bg-[#FAF8EE] border border-[#245B45]/15 p-3 text-xs flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-[#24332D]">{d.title}</p>
                          <p className="text-[#55665F]">Uploaded by {d.submitter_name}</p>
                        </div>
                        {d.file_url && (
                          <a href={d.file_url} target="_blank" rel="noreferrer" className="text-[#F07832] font-semibold hover:underline">
                            Open File
                          </a>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2.5">
                    <h3 className="text-sm font-bold text-[#245B45]">Faculty Mentor Notes</h3>
                    {proj.feedback.length === 0 ? (
                      <p className="text-xs text-[#55665F]">No faculty comments posted yet.</p>
                    ) : (
                      proj.feedback.map((f) => (
                        <div key={f.id} className="rounded-lg bg-[#DCEBF3]/55 border border-[#245B45]/15 p-3 text-xs">
                          <p className="font-semibold text-[#245B45]">{f.author_name}</p>
                          <p className="text-[#24332D] mt-1">{f.comment}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                </Card>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      )}

      <Modal open={Boolean(taskModalProj)} onClose={() => setTaskModalProj(null)} title="Add Task to Board" maxWidth="max-w-md">
        <form onSubmit={addTask} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Task Title</label>
            <input
              type="text"
              required
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Details</label>
            <textarea
              rows={2}
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Priority</label>
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Due Date</label>
              <input
                type="date"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
          <Button type="submit" variant="forest" className="w-full">Add Task</Button>
        </form>
      </Modal>

      <Modal open={Boolean(delivModalProj)} onClose={() => setDelivModalProj(null)} title="Upload Project Deliverable" maxWidth="max-w-md">
        <form onSubmit={uploadDeliverable} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Title</label>
            <input
              type="text"
              required
              value={delivForm.title}
              onChange={(e) => setDelivForm({ ...delivForm, title: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Summary</label>
            <textarea
              rows={2}
              value={delivForm.description}
              onChange={(e) => setDelivForm({ ...delivForm, description: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">File (PDF or Image)</label>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setDelivForm({ ...delivForm, file: e.target.files?.[0] || null })}
              className="w-full text-xs"
            />
          </div>
          <Button type="submit" variant="primary" className="w-full">Upload Deliverable</Button>
        </form>
      </Modal>

      <Modal open={Boolean(mentorProj)} onClose={() => setMentorProj(null)} title="Request Faculty Mentorship" maxWidth="max-w-md">
        <form onSubmit={requestMentor} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Select Faculty Mentor</label>
            <select
              value={mentorForm.facultyId}
              onChange={(e) => setMentorForm({ ...mentorForm, facultyId: e.target.value })}
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            >
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>{f.name} — {f.institution}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Message</label>
            <textarea
              rows={3}
              value={mentorForm.message}
              onChange={(e) => setMentorForm({ ...mentorForm, message: e.target.value })}
              placeholder="Explain what engineering or field advice your team needs..."
              className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit" variant="forest" className="w-full">Send Request</Button>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
