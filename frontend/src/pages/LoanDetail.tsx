import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import api from '../api';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  unpaid: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
};

export default function LoanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLoan(); }, [id]);

  const loadLoan = async () => {
    try {
      const { data } = await api.get(`/loans/${id}`);
      setLoan(data);
    } catch { toast.error('Loan not found'); navigate('/loans'); }
    finally { setLoading(false); }
  };

  const approve = async () => {
    try {
      await api.put(`/loans/${id}/approve`);
      toast.success('Loan approved');
      loadLoan();
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const reject = async () => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      await api.put(`/loans/${id}/reject?reason=${encodeURIComponent(reason)}`);
      toast.success('Loan rejected');
      loadLoan();
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!loan) return null;

  const paidCount = loan.emi_schedule?.filter((e: any) => e.status === 'paid').length || 0;
  const totalEmis = loan.emi_schedule?.length || 0;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/loans')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Loans
      </button>

      {/* Loan Info */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{loan.loan_number}</h2>
            <p className="text-gray-500">{loan.borrower_name} - {loan.loan_type.charAt(0).toUpperCase() + loan.loan_type.slice(1)} Loan</p>
          </div>
          <div className="flex items-center gap-3">
            {loan.status === 'pending' && (
              <>
                <button onClick={approve} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                <button onClick={reject} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                  <XCircle className="w-4 h-4" /> Reject
                </button>
              </>
            )}
            <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${
              loan.status === 'active' ? 'bg-green-100 text-green-700' :
              loan.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-600'
            }`}>{loan.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ['Principal', fmt(loan.principal_amount)],
            ['Interest Rate', `${loan.interest_rate_annual}% p.a.`],
            ['Tenure', `${loan.tenure_months} months`],
            ['Monthly EMI', fmt(loan.emi_amount)],
            ['Total Interest', fmt(loan.total_interest)],
            ['Total Payable', fmt(loan.total_payable)],
            ['Outstanding', fmt(loan.outstanding_amount)],
            ['Paid', fmt(loan.paid_amount)],
            ['Processing Fee', fmt(loan.processing_fee)],
            ['Purpose', loan.purpose || '-'],
            ['Disbursement', loan.disbursement_date ? new Date(loan.disbursement_date).toLocaleDateString('en-IN') : '-'],
            ['EMI Progress', `${paidCount} / ${totalEmis}`],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="font-semibold text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* EMI Schedule */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="font-semibold text-gray-800 mb-4">EMI Schedule</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Due Date</th>
                <th className="px-3 py-2 font-medium">Principal</th>
                <th className="px-3 py-2 font-medium">Interest</th>
                <th className="px-3 py-2 font-medium">EMI</th>
                <th className="px-3 py-2 font-medium">Balance</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Paid On</th>
              </tr>
            </thead>
            <tbody>
              {loan.emi_schedule?.map((emi: any) => (
                <tr key={emi.installment_number} className={`border-b ${emi.status === 'overdue' ? 'bg-red-50' : emi.status === 'paid' ? 'bg-green-50/30' : ''}`}>
                  <td className="px-3 py-2">{emi.installment_number}</td>
                  <td className="px-3 py-2">{new Date(emi.due_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-3 py-2">{fmt(emi.principal_component)}</td>
                  <td className="px-3 py-2">{fmt(emi.interest_component)}</td>
                  <td className="px-3 py-2 font-medium">{fmt(emi.emi_amount)}</td>
                  <td className="px-3 py-2">{fmt(emi.balance_after)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[emi.status] || ''}`}>
                      {emi.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {emi.payment_date ? new Date(emi.payment_date).toLocaleDateString('en-IN') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Payment History</h3>
        {loan.payments?.length === 0 ? (
          <p className="text-gray-400 text-sm">No payments recorded</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b bg-gray-50">
                  <th className="px-3 py-2 font-medium">Receipt</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Penalty</th>
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {loan.payments?.map((p: any) => (
                  <tr key={p._id} className="border-b">
                    <td className="px-3 py-2 font-mono text-xs">{p.receipt_number}</td>
                    <td className="px-3 py-2">{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                    <td className="px-3 py-2 font-medium">{fmt(p.amount)}</td>
                    <td className="px-3 py-2 text-red-600">{p.penalty_amount > 0 ? fmt(p.penalty_amount) : '-'}</td>
                    <td className="px-3 py-2 capitalize">{p.payment_method}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.transaction_ref || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
