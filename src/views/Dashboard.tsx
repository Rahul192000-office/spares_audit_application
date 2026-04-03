import React, { useState, useEffect } from 'react';
import { LayoutDashboard, PackageSearch, ArrowUpFromLine, ClipboardCheck, AlertTriangle, AlertCircle } from 'lucide-react';
import { useBranch } from '../context/BranchContext';
import { DashboardMetrics } from '../types';
import { StatCard } from '../components/UI';

export default function DashboardView() {
  const { selectedBranch } = useBranch();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = `/api/dashboard${selectedBranch !== 'all' ? `?branch_id=${selectedBranch}` : ''}`;
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('Failed to fetch dashboard'); return r.json(); })
      .then(data => setMetrics(data))
      .catch(err => {
        console.error(err);
        setError(err.message);
      });
  }, [selectedBranch]);

  if (error) return <div className="p-4 text-red-600 bg-red-50 rounded-xl border border-red-200">Error loading dashboard: {error}</div>;
  if (!metrics) return <div className="p-8 text-center text-neutral-500">Loading dashboard data...</div>;

  return (
    <div className="p-6 md:p-8 overflow-y-auto h-full space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard Overview</h2>
        <p className="text-neutral-500 text-sm mt-1">Real-time inventory statistics.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Items Count" 
          value={metrics.totalSpares.toLocaleString()} 
          icon={<PackageSearch className="w-5 h-5 text-blue-500" />} 
        />
        <StatCard 
          title="Total Quantity" 
          value={metrics.totalQuantity.toLocaleString()} 
          icon={<ArrowUpFromLine className="w-5 h-5 text-green-500" />} 
        />
        <StatCard 
          title="Total Bins" 
          value={metrics.totalBins.toLocaleString()} 
          icon={<LayoutDashboard className="w-5 h-5 text-purple-500" />} 
        />
        <StatCard 
          title="Total Stock Value" 
          value={`₹${metrics.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
          icon={<ClipboardCheck className="w-5 h-5 text-orange-500" />} 
        />
        <StatCard 
          title="Overall Shortage" 
          value={metrics.overallShortage.toLocaleString()} 
          icon={<AlertTriangle className="w-5 h-5 text-red-500" />} 
        />
        <StatCard 
          title="Overall Excess" 
          value={metrics.overallExcess.toLocaleString()} 
          icon={<AlertCircle className="w-5 h-5 text-orange-500" />} 
        />
        <StatCard 
          title="Total Missing Count" 
          value={metrics.totalMissingCount.toLocaleString()} 
          icon={<AlertCircle className="w-5 h-5 text-red-500" />} 
        />
      </div>
    </div>
  );
}
