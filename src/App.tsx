import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, PackageSearch, ClipboardCheck, History, 
  Plus, AlertTriangle, LogOut, Settings, Users, User as UserIcon
} from 'lucide-react';
import { BranchProvider, useBranch } from './context/BranchContext';
import { User, Audit } from './types';
import { NavItem, MobileNavItem } from './components/UI';

// Views
import LoginView from './views/Login';
import DashboardView from './views/Dashboard';
import InventoryView from './views/Inventory';
import { PerformAuditView, AuditLogsView } from './views/Audit';
import { UsersView, BranchesView } from './views/Admin';
import TransactionsView from './views/Transactions';
import ProfileView from './views/Profile';

function AppContent({ dbStatus, onReconnect }: { dbStatus: any, onReconnect: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'audit' | 'logs' | 'users' | 'branches' | 'transactions' | 'profile'>('dashboard');
  const [recountAudit, setRecountAudit] = useState<Audit | null>(null);
  const { selectedBranch, setSelectedBranch, branches } = useBranch();

  useEffect(() => {
    if (user && user.role !== 'admin' && user.branch_id) {
      setSelectedBranch(user.branch_id);
    }
  }, [user]);

  if (dbStatus.status !== 'connected') {
    const isWhitelistError = dbStatus.error?.isWhitelistError;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-xl max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-amber-50">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-neutral-900">Database Connection</h1>
            <p className="text-neutral-500 text-sm">
              {dbStatus.status === 'loading' ? 'Checking connection...' : 
               !dbStatus.hasUri ? 'MONGODB_URI is missing in Secrets.' : 
               isWhitelistError ? 'IP Address not whitelisted in MongoDB Atlas.' :
               'Unable to connect to MongoDB.'}
            </p>
            {dbStatus.error?.message && (
              <p className="text-xs text-red-500 font-mono bg-red-50 p-2 rounded border border-red-100 overflow-auto max-h-24 text-left">
                {dbStatus.error.message}
              </p>
            )}
          </div>
          <button 
            onClick={onReconnect}
            className="w-full bg-neutral-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-neutral-800 transition-all"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={(u) => {
      setUser(u);
      setActiveTab(u.role === 'admin' ? 'dashboard' : 'audit');
    }} />;
  }

  const handleRecount = (audit: Audit) => {
    setRecountAudit(audit);
    setActiveTab('audit');
  };

  return (
    <div className="h-screen bg-slate-50 font-sans text-slate-900 flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar Navigation - Desktop Only */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-300 flex-col shadow-xl z-30 flex-none overflow-y-auto">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            Spares Audit
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {user.role === 'admin' && (
            <>
              <NavItem icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              <NavItem icon={<PackageSearch className="w-5 h-5" />} label="Inventory" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
            </>
          )}
          <NavItem icon={<ClipboardCheck className="w-5 h-5" />} label="Perform Audit" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} />
          <NavItem icon={<History className="w-5 h-5" />} label="Audit Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          {user.role === 'admin' && (
            <>
              <NavItem icon={<Settings className="w-5 h-5" />} label="Branches" active={activeTab === 'branches'} onClick={() => setActiveTab('branches')} />
              <NavItem icon={<Users className="w-5 h-5" />} label="Users" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
            </>
          )}
          <div className="mt-auto pt-4 border-t border-slate-800">
            <NavItem icon={<UserIcon className="w-5 h-5" />} label="My Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
          </div>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between px-4 py-2">
            <div className="text-sm font-medium truncate max-w-[120px]">{user.username}</div>
            <button onClick={() => setUser(null)} className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Top Header with Branch Selector */}
        <header className="bg-white border-b border-neutral-200 px-4 md:px-6 py-3 md:py-4 flex justify-between items-center flex-none z-20">
          <div className="flex items-center gap-2 md:hidden">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <ClipboardCheck className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">Audit</span>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <span className="hidden sm:inline text-xs md:text-sm font-medium text-neutral-500">Branch:</span>
            <select 
              value={selectedBranch} 
              onChange={e => setSelectedBranch(e.target.value)}
              disabled={user.role !== 'admin'}
              className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs md:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 max-w-[120px] md:max-w-none"
            >
              {user.role === 'admin' && <option value="all">All Branches</option>}
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <button onClick={() => setUser(null)} className="md:hidden text-neutral-500 hover:text-red-600 p-2"><LogOut className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden pb-16 md:pb-0">
          {activeTab === 'dashboard' && user.role === 'admin' && <DashboardView />}
          {activeTab === 'inventory' && user.role === 'admin' && <InventoryView />}
          {activeTab === 'audit' && (
            <PerformAuditView user={user} onNavigate={() => setActiveTab('logs')} recountAudit={recountAudit} clearRecount={() => setRecountAudit(null)} />
          )}
          {activeTab === 'logs' && <AuditLogsView user={user} onRecount={handleRecount} />}
          {activeTab === 'users' && user.role === 'admin' && <UsersView />}
          {activeTab === 'branches' && user.role === 'admin' && <BranchesView />}
          {activeTab === 'profile' && <ProfileView user={user} onUpdate={setUser} />}
        </div>

        {/* Bottom Navigation - Mobile Only */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 flex justify-around items-center h-16 px-2 z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          {user.role === 'admin' && (
            <MobileNavItem icon={<LayoutDashboard className="w-5 h-5" />} label="Dash" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          )}
          {user.role === 'admin' && (
            <MobileNavItem icon={<PackageSearch className="w-5 h-5" />} label="Inv" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          )}
          <MobileNavItem icon={<ClipboardCheck className="w-5 h-5" />} label="Audit" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} />
          <MobileNavItem icon={<History className="w-5 h-5" />} label="Logs" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
          <MobileNavItem icon={<UserIcon className="w-5 h-5" />} label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
          {user.role === 'admin' && (
            <MobileNavItem icon={<Plus className="w-5 h-5" />} label="More" active={['users', 'branches'].includes(activeTab)} onClick={() => setActiveTab(activeTab === 'users' ? 'branches' : 'users')} />
          )}
        </nav>
      </main>
    </div>
  );
}

export default function App() {
  const [dbStatus, setDbStatus] = useState<{status: string, hasUri: boolean, error?: { message: string, isWhitelistError: boolean }}>({status: 'loading', hasUri: true});

  const checkHealth = () => {
    fetch('/api/health')
      .then(r => r.json())
      .then(setDbStatus)
      .catch(() => setDbStatus({status: 'disconnected', hasUri: false}));
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleReconnect = async () => {
    setDbStatus(prev => ({ ...prev, status: 'loading' }));
    try {
      await fetch('/api/reconnect', { method: 'POST' });
      setTimeout(checkHealth, 2000);
    } catch (err) {
      checkHealth();
    }
  };

  return (
    <BranchProvider dbConnected={dbStatus.status === 'connected'}>
      <AppContent dbStatus={dbStatus} onReconnect={handleReconnect} />
    </BranchProvider>
  );
}
