import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import api from '../api';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const COLORS = ['#1e3a5f', '#0d9488', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Reports() {
  const [stats, setStats] = useState<any>(null);
  const [payStats, setPayStats] = useState<any>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [overdue, setOverdue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/loans/stats'),
      api.get('/payments/stats'),
      api.get('/loans/', { params: { limit: 200 } }),
      api.get('/emi/overdue'),
    ]).then(([s, p, l, o]) => {
      setStats(s.data);
      setPayStats(p.data);
      setLoans(l.data.items);
      setOverdue(o.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading reports...</div>;

  // Loan type distribution
  const typeMap: Record<string, number> = {};
  loans.forEach((l) => { typeMap[l.loan_type] = (typeMap[l.loan_type] || 0) + 1; });
  const typeData = Object.entries(typeMap).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  // Disbursement by type (amount)
  const disbMap: Record<string, number> = {};
  loans.filter((l) => l.status === 'active' || l.status === 'closed').forEach((l) => {
    disbMap[l.loan_type] = (disbMap[l.loan_type] || 0) + l.principal_amount;
  });
  const disbData = Object.entries(disbMap).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  // Overdue aging
  const agingBuckets = { '1-30 days': 0, '31-60 days': 0, '61-90 days': 0, '90+ days': 0 };
  overdue.forEach((e) => {
    const d = e.days_overdue || 0;
    if (d <= 30) agingBuckets['1-30 days']++;
    else if (d <= 60) agingBuckets['31-60 days']++;
    else if (d <= 90) agingBuckets['61-90 days']++;
    else agingBuckets['90+ days']++;
  });
  const agingData = Object.entries(agingBuckets).map(([name, value]) => ({ name, value }));

  // Collection efficiency (monthly collected vs total EMIs due — simplified)
  const monthlyCollection = payStats?.monthly || [];

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="font-semibold text-gray-800 mb-4">Portfolio Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            ['Total Disbursed', fmt(stats?.total_disbursed || 0), 'text-blue-700'],
            ['Outstanding', fmt(stats?.total_outstanding || 0), 'text-yellow-700'],
            ['Active Loans', stats?.active_loans || 0, 'text-green-700'],
            ['Overdue EMIs', stats?.overdue_emis || 0, 'text-red-700'],
            ['NPA Amount', fmt(stats?.npa_amount || 0), 'text-orange-700'],
          ].map(([l, v, c]) => (
            <div key={l as string} className="text-center">
              <p className="text-xs text-gray-500">{l}</p>
              <p className={`text-xl font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Disbursement by Type */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Disbursement by Loan Type</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={disbData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={11} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="value" fill="#1e3a5f" radius={[4, 4, 0, 0]} name="Amount" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Loan Type Distribution */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Loan Type Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={typeData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Collection Trend */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Collection Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyCollection}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#0d9488" strokeWidth={2} name="Collected" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Overdue Aging */}
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Overdue Aging Analysis</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="value" fill="#ef4444" radius={[4, 4, 0, 0]} name="EMIs" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
