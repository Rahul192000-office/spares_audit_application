import React, { useState } from 'react';
import { User as UserIcon, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { User } from '../types';

interface ProfileViewProps {
  user: User;
  onUpdate: (updatedUser: User) => void;
}

export default function ProfileView({ user, onUpdate }: ProfileViewProps) {
  const [formData, setFormData] = useState({
    username: user.username,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setMsg({ text: 'New passwords do not match', isError: true });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.newPassword || undefined,
          role: user.role,
          branch_id: user.branch_id
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMsg({ text: 'Profile updated successfully!', isError: false });
        onUpdate({ ...user, username: formData.username });
        setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      } else {
        setMsg({ text: data.error || 'Failed to update profile', isError: true });
      }
    } catch (err) {
      setMsg({ text: 'Network error', isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 overflow-y-auto h-full space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">My Profile</h2>
        <p className="text-neutral-500 text-sm mt-1">Manage your account credentials.</p>
      </div>

      <div className="max-w-xl bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
            <UserIcon className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900">{user.username}</h3>
            <p className="text-neutral-500 text-sm capitalize">{user.role} Account</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {msg && (
            <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 border ${msg.isError ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
              {msg.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {msg.text}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-400 uppercase ml-1">Username</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input 
                  required
                  type="text" 
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-100 space-y-4">
              <h4 className="text-sm font-semibold text-neutral-900">Change Password</h4>
              <p className="text-xs text-neutral-500">Leave blank if you don't want to change your password.</p>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase ml-1">New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input 
                    type="password" 
                    placeholder="Enter new password"
                    value={formData.newPassword}
                    onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase ml-1">Confirm New Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input 
                    type="password" 
                    placeholder="Confirm new password"
                    value={formData.confirmPassword}
                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-neutral-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200 disabled:opacity-50"
          >
            {isSubmitting ? 'Updating...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
