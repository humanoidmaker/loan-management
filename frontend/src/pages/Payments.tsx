import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import api from '../api';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function Payments() {
  const [loans, setLoans] = useState<any[]>([]);
  const [selectedLoan, setSelectedLoan] = useState('');
  const [payments, setPayments] = useState<any[]>([]);
  const [showRecord, setShowRecord] = useState(false);
  const [nextEmi, setNextEmi] = useState<any>(null);
  const [form, setForm] = useState({ loan_id: '', amount: '', payment_method: 'cash', transaction_ref: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/loans/', { params: { status: 'active', limit: 100 } }).then(({ data }) => setLoans(data.items));
  }, []);

  useEffect(() => {
    if (!selectedLoan) return;
    setLoading(true);
    api.get(`/payments/loan/${selectedLoan}`).then(({ data }) => setPayments(data)).finally(() => setLoading(false));
  }, [selectedLoan]);

  const openRecord = async (loanId?: string) => {
    const lid = loanId || selectedLoan;
    if (!lid) { toast.error('Select a loan first'); return; }
    setForm({ loan_id: lid, amount: '', payment_method: 'cash', transaction_ref: '' });

    // Get next unpaid EMI
    try {
      const { data } = await api.get(`/emi/loan/${lid}`);
      const next = data.find((e: any) => e.status === 'unpaid' || e.status === 'overdue');
      setNextEmi(next || null);
      if (next) setForm((f) => ({ ...f, amount: String(next.emi_amount) }));
    } catch { /* empty */ }
    setShowRecord(true);
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/payments/', {
        loan_id: form.loan_id,
        amount: parseFloat(form.amount),
        payment_method: form.payment_method,
        transaction_ref: form.transaction_ref,
      });
      toast.success(`Payment recorded. Receipt: ${data.receipt_number}`);
      setShowRecord(false);
      if (selectedLoan) {
        api.get(`/payments/loan/${selectedLoan}`).then(({ data }) => setPayments(data));
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Payment failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <select
          value={selectedLoan}
          onChange={(e) => setSelectedLoan(e.target.value)}
          className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent-500 outline-none min-w-[300px]"
        >
          <option value="">Select a loan...</option>
          {loans.map((l) => (
            <option key={l._id} value={l._id}>
              {l.loan_number} - {l.borrower_name}
            </option>
          ))}
        </select>
        <button onClick={() => openRecord()} className="flex items-center gap-1.5 px-4 py-2 bg-accent-600 text-white rounded-lg text-sm font-medium hover:bg-accent-700">
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="px-4 py-3 font-medium">Receipt #</th>
              <th className="px-4 py-3 font-medium">Loan</th>
              <th className="px-4 py-3 font-medium">Borrower</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Penalty</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">EMIs Covered</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p._id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{p.receipt_number}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.loan_number}</td>
                <td className="px-4 py-3">{p.borrower_name}</td>
                <td className="px-4 py-3">{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                <td className="px-4 py-3 font-medium text-green-700">{fmt(p.amount)}</td>
                <td className="px-4 py-3 text-red-600">{p.penalty_amount > 0 ? fmt(p.penalty_amount) : '-'}</td>
                <td className="px-4 py-3 capitalize">{p.payment_method}</td>
                <td className="px-4 py-3">
                  {p.emis_paid?.map((e: any) => `#${e.installment_number}`).join(', ') || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && !loading && (
          <p className="text-center text-gray-400 py-8">
            {selectedLoan ? 'No payments for this loan' : 'Select a loan to view payments'}
          </p>
        )}
      </div>

      {/* Record Payment Modal */}
      {showRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Record Payment</h2>
              <button onClick={() => setShowRecord(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {nextEmi && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
                <p className="font-medium text-blue-800">Next Due EMI: #{nextEmi.installment_number}</p>
                <p className="text-blue-600">
                  Due: {new Date(nextEmi.due_date).toLocaleDateString('en-IN')} | Amount: {fmt(nextEmi.emi_amount)}
                  {nextEmi.status === 'overdue' && <span className="text-red-600 ml-2">(OVERDUE - penalty may apply)</span>}
                </p>
              </div>
            )}

            <form onSubmit={recordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan</label>
                <select
                  value={form.loan_id}
                  onChange={(e) => setForm({ ...form, loan_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                  required
                >
                  <option value="">Select loan...</option>
                  {loans.map((l) => (
                    <option key={l._id} value={l._id}>{l.loan_number} - {l.borrower_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={form.payment_method}
                  onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Reference</label>
                <input
                  value={form.transaction_ref}
                  onChange={(e) => setForm({ ...form, transaction_ref: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent-500"
                  placeholder="Optional"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowRecord(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
