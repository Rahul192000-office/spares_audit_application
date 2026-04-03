import React, { useState } from 'react';
import { ClipboardCheck, AlertCircle } from 'lucide-react';

interface LoginViewProps {
  onLogin: (user: { id: string; username: string; role: string; branch_id: string | null }) => void;
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok) {
          onLogin({ id: data.id, username: data.username, role: data.role, branch_id: data.branch_id });
        } else {
          setError(data.error || 'Login failed');
        }
      } else {
        setError(`Server error: ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      setError('Network error or server unavailable');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-xl max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200">
            <ClipboardCheck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Stock Management System</h1>
          <p className="text-neutral-500">Inventory Audit & Control</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4"/> {error}</div>}
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-500 uppercase ml-1">Username</label>
              <input 
                required 
                type="text" 
                placeholder="Enter your username" 
                className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-500 uppercase ml-1">Password</label>
              <input 
                required 
                type="password" 
                placeholder="Enter your password" 
                className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-[0.98]">
            Sign In
          </button>
        </form>
        
        <div className="text-center">
          <p className="text-xs text-neutral-400">© 2026 Spare Audit System. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
