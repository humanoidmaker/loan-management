import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../api';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

export default function EMICalculator() {
  const [principal, setPrincipal] = useState(1000000);
  const [rate, setRate] = useState(12);
  const [tenure, setTenure] = useState(36);
  const [result, setResult] = useState<any>(null);

  const calculate = async () => {
    try {
      const { data } = await api.post('/loans/calculate-emi', { principal, rate, tenure });
      setResult(data);
    } catch { /* empty */ }
  };

  // Auto-calculate on mount and changes
  useState(() => { calculate(); });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-primary-800">EMI Calculator</h1>
        <p className="text-gray-500 text-sm">Calculate your monthly EMI and view amortization schedule</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Loan Amount</label>
              <span className="text-sm font-bold text-primary-800">{fmt(principal)}</span>
            </div>
            <input
              type="range"
              min="50000"
              max="10000000"
              step="50000"
              value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              onMouseUp={calculate}
              onTouchEnd={calculate}
              className="w-full accent-accent-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>50K</span>
              <span>1Cr</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Interest Rate</label>
              <span className="text-sm font-bold text-primary-800">{rate}% p.a.</span>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              step="0.5"
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              onMouseUp={calculate}
              onTouchEnd={calculate}
              className="w-full accent-accent-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1%</span>
              <span>30%</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Loan Tenure</label>
              <span className="text-sm font-bold text-primary-800">{tenure} months ({(tenure / 12).toFixed(1)} yrs)</span>
            </div>
            <input
              type="range"
              min="6"
              max="360"
              step="6"
              value={tenure}
              onChange={(e) => setTenure(Number(e.target.value))}
              onMouseUp={calculate}
              onTouchEnd={calculate}
              className="w-full accent-accent-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>6m</span>
              <span>30yrs</span>
            </div>
          </div>

          <button
            onClick={calculate}
            className="w-full py-2.5 bg-accent-600 text-white rounded-lg font-medium hover:bg-accent-700 transition-colors"
          >
            Calculate EMI
          </button>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {result && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                  <p className="text-xs text-gray-500 mb-1">Monthly EMI</p>
                  <p className="text-2xl font-bold text-primary-800">{fmt(result.emi)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                  <p className="text-xs text-gray-500 mb-1">Total Interest</p>
                  <p className="text-2xl font-bold text-orange-600">{fmt(result.total_interest)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border p-5 text-center">
                  <p className="text-xs text-gray-500 mb-1">Total Payable</p>
                  <p className="text-2xl font-bold text-accent-700">{fmt(result.total_payable)}</p>
                </div>
              </div>

              {/* Amortization Chart */}
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Amortization: Principal vs Interest</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={result.amortization}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="installment"
                      fontSize={11}
                      label={{ value: 'Month', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="principal" stackId="1" fill="#0d9488" stroke="#0d9488" name="Principal" />
                    <Area type="monotone" dataKey="interest" stackId="1" fill="#f59e0b" stroke="#f59e0b" name="Interest" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Amortization Table (first 12 rows) */}
              <div className="bg-white rounded-xl shadow-sm border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">
                  Amortization Schedule (showing first 12 of {result.amortization?.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="px-3 py-2 font-medium">Month</th>
                        <th className="px-3 py-2 font-medium">Principal</th>
                        <th className="px-3 py-2 font-medium">Interest</th>
                        <th className="px-3 py-2 font-medium">EMI</th>
                        <th className="px-3 py-2 font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.amortization?.slice(0, 12).map((row: any) => (
                        <tr key={row.installment} className="border-b">
                          <td className="px-3 py-2">{row.installment}</td>
                          <td className="px-3 py-2 text-accent-700">{fmt(row.principal)}</td>
                          <td className="px-3 py-2 text-orange-600">{fmt(row.interest)}</td>
                          <td className="px-3 py-2 font-medium">{fmt(row.emi)}</td>
                          <td className="px-3 py-2">{fmt(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
