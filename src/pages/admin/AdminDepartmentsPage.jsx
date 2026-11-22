import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { StaggerGrid, StaggerItem } from '../../components/ui/MotionPrimitives.jsx';

export function AdminDepartmentsPage() {
  const { showToast } = useToast();
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ name: '', code: '', jurisdiction: 'Mathura Urban Zone (Demo)', description: '' });

  const load = () => {
    apiRequest('/api/admin/overview').then((d) => setDepartments(d.departments || []));
  };

  useEffect(() => {
    load();
  }, []);

  const addDepartment = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/departments', { method: 'POST', body: form });
      showToast('Department added.', 'success');
      setForm({ name: '', code: '', jurisdiction: 'Mathura Urban Zone (Demo)', description: '' });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <DashboardLayout
      title="Departments"
      subtitle="Add city departments and configure service jurisdictions"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card animate className="lg:col-span-4 h-fit">
          <h2 className="font-display text-base font-bold text-[#245B45] mb-3">Add New Department</h2>
          <form onSubmit={addDepartment} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Department Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Parks & Urban Forestry"
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Short Code</label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g., PARK"
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Service Area</label>
              <input
                type="text"
                value={form.jurisdiction}
                onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Responsibilities</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-[#245B45]/20 bg-white px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit" variant="forest" className="w-full">Add Department</Button>
          </form>
        </Card>

        <StaggerGrid immediate className="lg:col-span-8 space-y-3">
          {departments.map((d) => (
            <StaggerItem key={d.id}>
              <Card interactive>
                <div className="flex items-center justify-between text-xs text-[#55665F]">
                  <span className="font-mono-tabular font-bold text-[#F07832]">{d.code}</span>
                  <span>{d.jurisdiction}</span>
                </div>
                <h3 className="font-display text-base font-bold text-[#245B45] mt-1 flex items-center gap-2">
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span>{d.name}</span>
                </h3>
                <p className="text-xs text-[#55665F] mt-1 leading-relaxed">{d.description}</p>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </div>
    </DashboardLayout>
  );
}
