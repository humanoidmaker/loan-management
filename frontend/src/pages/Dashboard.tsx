import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { IndianRupee, FileText, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import api from '../api';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [paymentStats, setPaymentStats] = useState<any>(null);
  const [overdueList, setOverdueList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/loans/stats'),
      api.get('/payments/stats'),
      api.get('/loans/overdue'),
    ]).then(([s, p, o]) => {
      setStats(s.data);
      setPaymentStats(p.data);
      setOverdueList(o.data.slice(0, 10));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;

  const statCards = [
    { label: 'Total Disbursed', value: fmt(stats?.total_disbursed || 0), icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
    { label: 'Outstanding', value: fmt(stats?.total_outstanding || 0), icon: IndianRupee, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Active Loans', value: stats?.active_loans || 0, icon: FileText, color: 'bg-green-50 text-green-600' },
    { label: 'Overdue EMIs', value: stats?.overdue_emis || 0, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
    { label: 'NPA Amount', value: fmt(stats?.npa_amount || 0), icon: TrendingDown, color: 'bg-orange-50 text-orange-600' },
  ];

  const portfolioData = [
    { name: 'Regular', value: Math.max((stats?.active_loans || 0) - (stats?.overdue_emis > 0 ? 1 : 0) - (stats?.defaulted_loans || 0), 0) },
    { name: 'Overdue', value: stats?.overdue_emis > 0 ? Math.min(stats.overdue_emis, stats.active_loans || 1) : 0 },
    { name: 'NPA', value: stats?.defaulted_loans || 0 },
  ];
  const PIE_COLORS = ['#0d9488', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${c.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-lg font-bold text-gray-800">{c.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Collection Chart */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Monthly Collections</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={paymentStats?.monthly || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="total" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Portfolio Quality Pie */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Portfolio Quality</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={portfolioData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {portfolioData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Overdue Alerts */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Overdue EMI Alerts</h3>
          <Link to="/emi-schedule" className="text-sm text-accent-600 hover:underline">View all</Link>
        </div>
        {overdueList.length === 0 ? (
          <p className="text-gray-400 text-sm">No overdue EMIs</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Loan #</th>
                  <th className="pb-2 font-medium">Borrower</th>
                  <th className="pb-2 font-medium">EMI #</th>
                  <th className="pb-2 font-medium">Due Date</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {overdueList.map((item, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{item.loan_number}</td>
                    <td className="py-2">{item.borrower_name}</td>
                    <td className="py-2">#{item.installment_number}</td>
                    <td className="py-2">{new Date(item.due_date).toLocaleDateString('en-IN')}</td>
                    <td className="py-2 font-medium">{fmt(item.emi_amount)}</td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        {item.days_overdue} days
                      </span>
                    </td>
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
