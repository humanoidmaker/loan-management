import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Search, X } from 'lucide-react';
import api from '../api';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
  defaulted: 'bg-red-100 text-red-700',
  rejected: 'bg-red-50 text-red-500',
};

const TYPE_COLORS: Record<string, string> = {
  personal: 'bg-blue-100 text-blue-700',
  home: 'bg-purple-100 text-purple-700',
  vehicle: 'bg-cyan-100 text-cyan-700',
  business: 'bg-orange-100 text-orange-700',
  education: 'bg-teal-100 text-teal-700',
};

export default function Loans() {
  const [loans, setLoans] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [form, setForm] = useState({
    borrower_id: '', principal_amount: '', interest_rate_annual: '12',
    tenure_months: '24', loan_type: 'personal', purpose: '', collateral_description: '',
  });
  const [emiPreview, setEmiPreview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadLoans(); }, [status, search]);

  const loadLoans = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (status) params.status = status;
      if (search) params.q = search;
      const { data } = await api.get('/loans/', { params });
      setLoans(data.items);
      setTotal(data.total);
    } catch { /* empty */ } finally { setLoading(false); }
  };

  const searchBorrowers = async (q: string) => {
    if (q.length < 2) return;
    const { data } = await api.get('/borrowers/search', { params: { q } });
    setBorrowers(data);
  };

  const previewEmi = async () => {
    if (!form.principal_amount || !form.interest_rate_annual || !form.tenure_months) return;
    try {
      const { data } = await api.post('/loans/calculate-emi', {
        principal: parseFloat(form.principal_amount),
        rate: parseFloat(form.interest_rate_annual),
        tenure: parseInt(form.tenure_months),
      });
      setEmiPreview(data);
    } catch { /* empty */ }
  };

  const createLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/loans/', {
        ...form,
        principal_amount: parseFloat(form.principal_amount),
        interest_rate_annual: parseFloat(form.interest_rate_annual),
        tenure_months: parseInt(form.tenure_months),
      });
      toast.success('Loan created');
      setShowCreate(false);
      loadLoans();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed');
    }
  };

  const tabs = ['', 'pending', 'active', 'closed', 'defaulted', 'rejected'];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setStatus(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                status === t ? 'bg-primary-800 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
              }`}
            >
              {t || 'All'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search loans..."
              className="pl-9 pr-3 py-2 border rounded-lg text-sm w-56 focus:ring-2 focus:ring-accent-500 outline-none"
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700"
          >
            <Plus className="w-4 h-4" /> New Loan
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="px-4 py-3 font-medium">Loan #</th>
              <th className="px-4 py-3 font-medium">Borrower</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Principal</th>
              <th className="px-4 py-3 font-medium">EMI</th>
              <th className="px-4 py-3 font-medium">Tenure</th>
              <th className="px-4 py-3 font-medium">Outstanding</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr
                key={loan._id}
                onClick={() => navigate(`/loans/${loan._id}`)}
                className="border-b hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-3 font-mono text-xs">{loan.loan_number}</td>
                <td className="px-4 py-3 font-medium">{loan.borrower_name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TYPE_COLORS[loan.loan_type] || ''}`}>
                    {loan.loan_type}
                  </span>
                </td>
                <td className="px-4 py-3">{fmt(loan.principal_amount)}</td>
                <td className="px-4 py-3">{fmt(loan.emi_amount)}</td>
                <td className="px-4 py-3">{loan.tenure_months}m</td>
                <td className="px-4 py-3 font-medium">{fmt(loan.outstanding_amount)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[loan.status] || ''}`}>
                    {loan.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loans.length === 0 && !loading && (
          <p className="text-center text-gray-400 py-8">No loans found</p>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Create New Loan</h2>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={createLoan} className="space-y-4">
              {/* Borrower search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Borrower</label>
                <input
                  placeholder="Search by name or phone..."
                  onChange={(e) => searchBorrowers(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                />
                {borrowers.length > 0 && !form.borrower_id && (
                  <div className="border rounded-lg mt-1 max-h-32 overflow-y-auto">
                    {borrowers.map((b) => (
                      <button
                        type="button"
                        key={b._id}
                        onClick={() => { setForm({ ...form, borrower_id: b._id }); setBorrowers([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                      >
                        {b.name} - {b.phone}
                      </button>
                    ))}
                  </div>
                )}
                {form.borrower_id && (
                  <p className="text-xs text-green-600 mt-1">Borrower selected: {form.borrower_id.slice(-6)}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Principal Amount</label>
                  <input
                    type="number"
                    value={form.principal_amount}
                    onChange={(e) => setForm({ ...form, principal_amount: e.target.value })}
                    onBlur={previewEmi}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%/yr)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.interest_rate_annual}
                    onChange={(e) => setForm({ ...form, interest_rate_annual: e.target.value })}
                    onBlur={previewEmi}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tenure (months)</label>
                  <input
                    type="number"
                    value={form.tenure_months}
                    onChange={(e) => setForm({ ...form, tenure_months: e.target.value })}
                    onBlur={previewEmi}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan Type</label>
                  <select
                    value={form.loan_type}
                    onChange={(e) => setForm({ ...form, loan_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                  >
                    {['personal', 'home', 'vehicle', 'business', 'education'].map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                <input
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Collateral Description</label>
                <input
                  value={form.collateral_description}
                  onChange={(e) => setForm({ ...form, collateral_description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                />
              </div>

              {/* EMI Preview */}
              {emiPreview && (
                <div className="bg-accent-50 border border-accent-200 rounded-lg p-4">
                  <h4 className="font-medium text-accent-800 mb-2">EMI Calculation Preview</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Monthly EMI</p>
                      <p className="font-bold text-accent-700">{fmt(emiPreview.emi)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Interest</p>
                      <p className="font-bold text-accent-700">{fmt(emiPreview.total_interest)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Payable</p>
                      <p className="font-bold text-accent-700">{fmt(emiPreview.total_payable)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg text-sm">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
                  Create Loan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
