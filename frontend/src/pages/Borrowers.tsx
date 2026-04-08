import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Search, X, Edit2 } from 'lucide-react';
import api from '../api';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function Borrowers() {
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '', id_type: 'aadhaar',
    id_number: '', occupation: '', monthly_income: '', credit_score: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadBorrowers(); }, [search]);

  const loadBorrowers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/borrowers/', { params: { q: search || undefined } });
      setBorrowers(data.items);
    } catch { /* empty */ } finally { setLoading(false); }
  };

  const loadDetail = async (b: any) => {
    setDetail(b);
    const { data } = await api.get(`/borrowers/${b._id}/loans`);
    setLoans(data);
  };

  const openEdit = (b: any) => {
    setEditing(b);
    setForm({
      name: b.name, phone: b.phone, email: b.email || '', address: b.address || '',
      id_type: b.id_type, id_number: b.id_number || '', occupation: b.occupation || '',
      monthly_income: String(b.monthly_income || ''), credit_score: String(b.credit_score || ''),
    });
    setShowForm(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', phone: '', email: '', address: '', id_type: 'aadhaar', id_number: '', occupation: '', monthly_income: '', credit_score: '' });
    setShowForm(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      monthly_income: parseFloat(form.monthly_income) || 0,
      credit_score: parseInt(form.credit_score) || 0,
    };
    try {
      if (editing) {
        await api.put(`/borrowers/${editing._id}`, payload);
        toast.success('Borrower updated');
      } else {
        await api.post('/borrowers/', payload);
        toast.success('Borrower added');
      }
      setShowForm(false);
      loadBorrowers();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone..."
            className="pl-9 pr-3 py-2 border rounded-lg text-sm w-64 focus:ring-2 focus:ring-accent-500 outline-none"
          />
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700">
          <Plus className="w-4 h-4" /> Add Borrower
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Occupation</th>
                <th className="px-4 py-3 font-medium">Income</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {borrowers.map((b) => (
                <tr key={b._id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => loadDetail(b)}>
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3">{b.phone}</td>
                  <td className="px-4 py-3 text-gray-500">{b.occupation || '-'}</td>
                  <td className="px-4 py-3">{fmt(b.monthly_income || 0)}</td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${(b.credit_score || 0) >= 750 ? 'text-green-600' : (b.credit_score || 0) >= 650 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {b.credit_score || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(b); }} className="p-1 hover:bg-gray-100 rounded">
                      <Edit2 className="w-4 h-4 text-gray-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {borrowers.length === 0 && !loading && <p className="text-center text-gray-400 py-8">No borrowers found</p>}
        </div>

        {/* Detail panel */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          {detail ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg text-gray-800">{detail.name}</h3>
              <div className="space-y-2 text-sm">
                {[
                  ['Phone', detail.phone],
                  ['Email', detail.email || '-'],
                  ['Address', detail.address || '-'],
                  ['ID', `${detail.id_type?.toUpperCase()}: ${detail.id_number || '-'}`],
                  ['Occupation', detail.occupation || '-'],
                  ['Monthly Income', fmt(detail.monthly_income || 0)],
                  ['Credit Score', detail.credit_score || '-'],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between">
                    <span className="text-gray-500">{l}</span>
                    <span className="font-medium text-gray-700">{v}</span>
                  </div>
                ))}
              </div>
              <h4 className="font-medium text-gray-700 pt-2">Loans ({loans.length})</h4>
              {loans.map((l) => (
                <div key={l._id} className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-mono text-xs">{l.loan_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      l.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>{l.status}</span>
                  </div>
                  <p className="text-gray-500 mt-1">{fmt(l.principal_amount)} - {l.tenure_months}m @ {l.interest_rate_annual}%</p>
                </div>
              ))}
              {loans.length === 0 && <p className="text-gray-400 text-sm">No loans</p>}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Select a borrower to view details</p>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">{editing ? 'Edit' : 'Add'} Borrower</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={submitForm} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'name', label: 'Full Name', type: 'text', required: true },
                  { key: 'phone', label: 'Phone', type: 'text', required: true },
                  { key: 'email', label: 'Email', type: 'email', required: false },
                  { key: 'occupation', label: 'Occupation', type: 'text', required: false },
                  { key: 'monthly_income', label: 'Monthly Income', type: 'number', required: false },
                  { key: 'credit_score', label: 'Credit Score', type: 'number', required: false },
                  { key: 'id_number', label: 'ID Number', type: 'text', required: false },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      value={(form as any)[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                      required={f.required}
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">ID Type</label>
                  <select
                    value={form.id_type}
                    onChange={(e) => setForm({ ...form, id_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                  >
                    <option value="aadhaar">Aadhaar</option>
                    <option value="pan">PAN</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
                  {editing ? 'Update' : 'Add'} Borrower
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
