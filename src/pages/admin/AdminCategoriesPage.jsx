import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { DashboardLayout } from '../../components/layout/DashboardLayout.jsx';
import { Card } from '../../components/ui/Card.jsx';

export function AdminCategoriesPage() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);

  const load = () => {
    apiRequest('/api/admin/overview').then((d) => {
      setCategories(d.categories || []);
      setDepartments(d.departments || []);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const updateCat = async (id, patch) => {
    try {
      await apiRequest(`/api/admin/categories/${id}`, { method: 'PATCH', body: patch });
      showToast('Routing rule updated.', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <DashboardLayout
      title="Issue Categories"
      subtitle="Set which department handles each issue type and its default urgency level"
    >
      <Card animate padding="p-0" className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#E8E4CE] text-[#245B45] font-semibold">
            <tr>
              <th className="px-4 py-3">Issue Type</th>
              <th className="px-4 py-3">Default Department</th>
              <th className="px-4 py-3">Default Urgency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#245B45]/10">
            {categories.map((cat) => (
              <tr key={cat.id} className="hover:bg-white/60 transition-colors">
                <td className="px-4 py-3 font-bold text-[#24332D]">{cat.name}</td>
                <td className="px-4 py-3">
                  <select
                    value={cat.default_department_id || ''}
                    onChange={(e) => updateCat(cat.id, { defaultDepartmentId: Number(e.target.value) })}
                    className="rounded-lg border border-[#245B45]/20 bg-white px-2.5 py-1.5 text-xs"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={cat.default_severity}
                    onChange={(e) => updateCat(cat.id, { defaultSeverity: e.target.value })}
                    className="rounded-lg border border-[#245B45]/20 bg-white px-2.5 py-1.5 text-xs"
                  >
                    {['Critical', 'High', 'Medium', 'Low'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </DashboardLayout>
  );
}
