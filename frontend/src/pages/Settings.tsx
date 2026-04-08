import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await api.get('/settings/');
      setSettings(data);
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    try {
      await api.put(`/settings/${key}`, { value });
      toast.success('Setting updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      await api.post('/auth/change-password', {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      toast.success('Password changed');
      setPasswords({ current_password: '', new_password: '', confirm: '' });
    } catch {
      toast.error('Failed to change password');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="max-w-3xl space-y-8">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Company Settings</h2>
        <div className="space-y-4">
          {[
            { key: 'company_name', label: 'Company Name' },
            { key: 'default_interest_rate', label: 'Default Interest Rate (%)' },
            { key: 'late_payment_penalty_percent', label: 'Late Payment Penalty (%)' },
            { key: 'processing_fee_percent', label: 'Processing Fee (%)' },
          ].map((item) => (
            <div key={item.key} className="flex items-center gap-4">
              <label className="w-56 text-sm font-medium text-gray-600">{item.label}</label>
              <input
                type="text"
                value={settings[item.key] || ''}
                onChange={(e) => setSettings({ ...settings, [item.key]: e.target.value })}
                onBlur={() => updateSetting(item.key, settings[item.key] || '')}
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent-500 outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-4 max-w-md">
          <input
            type="password"
            placeholder="Current Password"
            value={passwords.current_password}
            onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent-500 outline-none"
            required
          />
          <input
            type="password"
            placeholder="New Password"
            value={passwords.new_password}
            onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent-500 outline-none"
            required
          />
          <input
            type="password"
            placeholder="Confirm New Password"
            value={passwords.confirm}
            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-accent-500 outline-none"
            required
          />
          <button
            type="submit"
            className="px-6 py-2 bg-primary-800 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            Change Password
          </button>
        </form>
      </div>
    </div>
  );
}
