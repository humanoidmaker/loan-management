import { useState, useEffect } from 'react';
import api from '../api';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  unpaid: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
};

export default function EMISchedule() {
  const [loans, setLoans] = useState<any[]>([]);
  const [selectedLoan, setSelectedLoan] = useState('');
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/loans/', { params: { status: 'active', limit: 100 } }).then(({ data }) => setLoans(data.items));
  }, []);

  useEffect(() => {
    if (!selectedLoan) return;
    setLoading(true);
    api.get(`/emi/loan/${selectedLoan}`).then(({ data }) => setSchedule(data)).finally(() => setLoading(false));
  }, [selectedLoan]);

  const paidCount = schedule.filter((e) => e.status === 'paid').length;
  const overdueCount = schedule.filter((e) => e.status === 'overdue').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <select
          value={selectedLoan}
          onChange={(e) => setSelectedLoan(e.target.value)}
          className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent-500 outline-none min-w-[300px]"
        >
          <option value="">Select a loan...</option>
          {loans.map((l) => (
            <option key={l._id} value={l._id}>
              {l.loan_number} - {l.borrower_name} ({fmt(l.principal_amount)})
            </option>
          ))}
        </select>
        {selectedLoan && (
          <div className="flex gap-3 text-sm">
            <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full">Paid: {paidCount}</span>
            <span className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full">Unpaid: {schedule.length - paidCount - overdueCount}</span>
            <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full">Overdue: {overdueCount}</span>
          </div>
        )}
      </div>

      {selectedLoan && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Principal</th>
                <th className="px-4 py-3 font-medium">Interest</th>
                <th className="px-4 py-3 font-medium">EMI Amount</th>
                <th className="px-4 py-3 font-medium">Balance After</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Paid On</th>
                <th className="px-4 py-3 font-medium">Penalty</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((emi) => (
                <tr
                  key={emi.installment_number}
                  className={`border-b ${
                    emi.status === 'overdue' ? 'bg-red-50' :
                    emi.status === 'paid' ? 'bg-green-50/40' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium">{emi.installment_number}</td>
                  <td className="px-4 py-3">{new Date(emi.due_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">{fmt(emi.principal_component)}</td>
                  <td className="px-4 py-3">{fmt(emi.interest_component)}</td>
                  <td className="px-4 py-3 font-medium">{fmt(emi.emi_amount)}</td>
                  <td className="px-4 py-3">{fmt(emi.balance_after)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[emi.status] || ''}`}>
                      {emi.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {emi.payment_date ? new Date(emi.payment_date).toLocaleDateString('en-IN') : '-'}
                  </td>
                  <td className="px-4 py-3 text-red-600">
                    {emi.penalty_amount > 0 ? fmt(emi.penalty_amount) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <p className="text-center text-gray-400 py-8">Loading...</p>}
        </div>
      )}

      {!selectedLoan && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">
          Select a loan to view its EMI schedule
        </div>
      )}
    </div>
  );
}
