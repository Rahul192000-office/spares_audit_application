import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  PackageSearch, QrCode, Upload, CheckCircle2, 
  Search, Download 
} from 'lucide-react';
import { useBranch } from '../context/BranchContext';
import { Spare, Audit, User } from '../types';
import { AlertModal } from '../components/UI';

interface PerformAuditViewProps {
  user: User;
  onNavigate: () => void;
  recountAudit?: Audit | null;
  clearRecount?: () => void;
}

export function PerformAuditView({ user, onNavigate, recountAudit, clearRecount }: PerformAuditViewProps) {
  const { selectedBranch } = useBranch();
  const [spares, setSpares] = useState<Spare[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [scannedBin, setScannedBin] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scanMode, setScanMode] = useState<'bin' | 'part' | null>(null);
  const [alertModal, setAlertModal] = useState<{isOpen: boolean, title: string, message: string}>({isOpen: false, title: '', message: ''});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudits = () => {
    const auditsUrl = `/api/audits${selectedBranch !== 'all' ? `?branch_id=${selectedBranch}` : ''}`;
    fetch(auditsUrl)
      .then(r => r.json())
      .then(setAudits)
      .catch(console.error);
  };

  useEffect(() => { 
    setIsLoading(true);
    setError(null);
    const sparesUrl = `/api/spares${selectedBranch !== 'all' ? `?branch_id=${selectedBranch}` : ''}`;
    const auditsUrl = `/api/audits${selectedBranch !== 'all' ? `?branch_id=${selectedBranch}` : ''}`;
    
    Promise.all([
      fetch(sparesUrl).then(r => { if (!r.ok) throw new Error('Failed to fetch spares'); return r.json(); }),
      fetch(auditsUrl).then(r => { if (!r.ok) throw new Error('Failed to fetch audits'); return r.json(); })
    ]).then(([sparesData, auditsData]) => {
      setSpares(sparesData);
      setAudits(auditsData);
      if (recountAudit) {
        const spare = sparesData.find((s: Spare) => s.id === recountAudit.spare_id);
        if (spare) {
          setScannedBin(spare.bin_location);
          setCounts({ [spare.id]: '' });
        }
      }
    }).catch(err => {
      console.error(err);
      setError(err.message);
    }).finally(() => {
      setIsLoading(false);
    }); 
  }, [recountAudit, selectedBranch]);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let shouldStop = false;

    if (scanMode) {
      const startScanner = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (shouldStop) return;

        const readerElement = document.getElementById('reader');
        if (!readerElement) return;

        try {
          html5QrCode = new Html5Qrcode('reader');
          const onScan = (text: string) => handleScanResult(text);
          const config = { fps: 5, qrbox: { width: 250, height: 250 } };

          try {
            await html5QrCode.start({ facingMode: "environment" }, config, onScan, () => {});
          } catch (err) {
            if (shouldStop) return;
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              await html5QrCode.start(devices[0].id, config, onScan, () => {});
            } else {
              throw new Error("No cameras found on this device.");
            }
          }
        } catch (e: any) {
          if (!shouldStop) {
            setMsg(`⚠️ Camera error: ${e.message || 'Please allow permissions'}`);
            setScanMode(null);
          }
        }
      };

      startScanner();

      return () => {
        shouldStop = true;
        if (html5QrCode) {
          try {
            html5QrCode.stop().then(() => html5QrCode?.clear()).catch(() => { try { html5QrCode?.clear(); } catch (e) {} });
          } catch (e) { try { html5QrCode?.clear(); } catch (e) {} }
        }
      };
    }
  }, [scanMode]);

  if (isLoading) return <div className="p-8 text-center text-neutral-500">Loading audit data...</div>;
  if (error) return <div className="p-4 text-red-600 bg-red-50 rounded-xl border border-red-200">Error: {error}</div>;
  
  const binSpares = scannedBin ? spares.filter(s => s.bin_location === scannedBin) : [];
  const displaySpares = recountAudit ? binSpares.filter(s => s.id === recountAudit.spare_id) : binSpares;

  const handleScanResult = (text: string) => {
    if (scanMode === 'part') {
      const partsInBin = spares.filter(s => s.bin_location === scannedBin);
      const scannedPart = partsInBin.find(s => s.part_number === text);
      if (scannedPart) {
        setCounts(prev => {
          const currentCount = parseInt(prev[scannedPart.id] || '0', 10);
          return { ...prev, [scannedPart.id]: (currentCount + 1).toString() };
        });
        setMsg(`✅ Part ${text} counted (+1)`);
      } else {
        setMsg(`⚠️ Part ${text} not found in this bin`);
      }
      setTimeout(() => setMsg(''), 3000);
      return;
    }

    const partsInBin = spares.filter(s => s.bin_location === text);
    if (partsInBin.length > 0) {
      if (!recountAudit) {
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        const isAuditedToday = partsInBin.some(part => 
          audits.some(a => {
            const auditSpareId = typeof a.spare_id === 'object' ? (a.spare_id as any)._id || (a.spare_id as any).id : a.spare_id;
            const auditDate = new Date(a.audit_date).toLocaleDateString('en-CA');
            return auditSpareId === part.id && auditDate === today;
          })
        );
        if (isAuditedToday) {
          setAlertModal({
            isOpen: true,
            title: 'Already Audited',
            message: `Bin ${text} is already audited today. You can audit it again tomorrow. If you need to modify today's audit, please use the Recount option from the Audit Logs.`
          });
          setScanMode(null);
          return;
        }
      }
      setScannedBin(text);
      setCounts({});
      setMissing({});
      setMsg(`✅ Bin ${text} selected`);
      setScanMode(null);
    } else {
      setMsg(`⚠️ Bin ${text} not found or empty`);
    }
    setTimeout(() => setMsg(''), 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const html5QrCode = new Html5Qrcode('reader-hidden');
      const text = await html5QrCode.scanFile(file, true);
      handleScanResult(text);
      html5QrCode.clear();
    } catch (err) {
      setMsg(`⚠️ Could not decode QR from image.`);
    }
    e.target.value = '';
  };

  const handleCountChange = (id: string, val: string) => {
    setCounts(prev => ({ ...prev, [id]: val }));
  };

  const toggleMissing = (id: string) => {
    setMissing(prev => {
      const isNowMissing = !prev[id];
      if (isNowMissing) {
        setCounts(c => ({ ...c, [id]: '0' }));
      } else {
        setCounts(c => ({ ...c, [id]: '' }));
      }
      return { ...prev, [id]: isNowMissing };
    });
  };

  const isSubmitEnabled = displaySpares.length > 0 && displaySpares.every(s => 
    missing[s.id] || (counts[s.id] !== undefined && counts[s.id] !== '')
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!isSubmitEnabled) {
      setMsg('⚠️ Please enter counts for all parts in the bin or mark them as missing.');
      setTimeout(() => setMsg(''), 3000);
      return;
    }

    setIsSubmitting(true);
    try {
      if (recountAudit) {
        const actual_qty = missing[recountAudit.spare_id] ? 0 : parseInt(counts[recountAudit.spare_id]);
        const notes = missing[recountAudit.spare_id] ? 'Missing' : '';
        const res = await fetch(`/api/audits/${recountAudit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actual_qty, notes })
        });
        if (res.ok) {
          setMsg('Recount recorded!');
          fetchAudits();
          if (clearRecount) clearRecount();
          setTimeout(() => { setMsg(''); onNavigate(); }, 1500);
        }
      } else {
        const auditPayloads = displaySpares.map(spare => ({
          spare_id: spare.id,
          actual_qty: missing[spare.id] ? 0 : parseInt(counts[spare.id]),
          auditor_name: user?.username || 'Unknown',
          notes: missing[spare.id] ? 'Missing' : '',
          branch_id: selectedBranch === 'all' ? null : selectedBranch
        }));

        const res = await fetch('/api/audits/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audits: auditPayloads })
        });

        if (res.ok) {
          setMsg('Bin Audit completed successfully!');
          setScannedBin(null);
          setCounts({});
          setMissing({});
          fetchAudits();
          setTimeout(() => setMsg(''), 2000);
        } else {
          const data = await res.json();
          setMsg(data.error || 'Failed to submit audit');
        }
      }
    } catch (err) {
      setMsg('Network error submitting audit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 overflow-y-auto h-full">
      <div className="max-w-5xl mx-auto space-y-6 relative">
      <AlertModal 
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal({isOpen: false, title: '', message: ''})}
      />
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Perform Physical Audit</h2>
        {recountAudit && (
          <button type="button" onClick={clearRecount} className="text-blue-800 hover:underline font-medium text-sm">Cancel Recount</button>
        )}
      </div>

      {msg && (
        <div className={`p-4 text-sm rounded-xl font-medium border ${msg.includes('Warning') || msg.includes('⚠️') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          {msg}
        </div>
      )}

      {!scannedBin ? (
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <PackageSearch className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-medium">Step 1: Select or Scan Bin</h3>
          <p className="text-neutral-500 text-sm max-w-md mx-auto">Scan a Bin QR code to view all parts located in that bin, or select one manually.</p>
          
          {scanMode === 'bin' ? (
            <div className="max-w-sm mx-auto mt-4">
              <div id="reader" className="w-full overflow-hidden rounded-xl border-2 border-blue-500"></div>
              <button onClick={() => setScanMode(null)} className="mt-4 text-neutral-500 hover:text-neutral-700 text-sm font-medium">Cancel Scan</button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
              <button onClick={() => setScanMode('bin')} className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors">
                <QrCode className="w-5 h-5" /> Scan Bin QR
              </button>
              <label className="inline-flex items-center gap-2 bg-white border border-neutral-200 text-neutral-700 px-6 py-3 rounded-xl font-medium hover:bg-neutral-50 transition-colors cursor-pointer">
                <Upload className="w-5 h-5" /> Upload Image
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
              <span className="text-neutral-400 text-sm">OR</span>
              <select 
                onChange={e => {
                  if (e.target.value) {
                    handleScanResult(e.target.value);
                  }
                }}
                className="px-4 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                value=""
              >
                <option value="" disabled>Select Bin Manually</option>
                {Array.from(new Set(spares.map(s => s.bin_location))).filter(Boolean).sort().map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-neutral-200 bg-neutral-50 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Auditing Bin: {scannedBin}</h3>
              <p className="text-neutral-500 text-sm mt-1">Please count all parts in this bin.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setScanMode(scanMode === 'part' ? null : 'part')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                <QrCode className="w-4 h-4" /> {scanMode === 'part' ? 'Close Scanner' : 'Scan Part'}
              </button>
              {!recountAudit && (
                <button onClick={() => { setScannedBin(null); setCounts({}); setMissing({}); setScanMode(null); }} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                  Change Bin
                </button>
              )}
            </div>
          </div>
          
          {scanMode === 'part' && (
            <div className="p-6 border-b border-neutral-200 bg-blue-50">
              <div className="max-w-sm mx-auto">
                <div id="reader" className="w-full overflow-hidden rounded-xl border-2 border-blue-500 bg-white"></div>
                <p className="text-center text-sm text-blue-600 mt-2 font-medium">Scanning for parts in {scannedBin}...</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-4">
              {displaySpares.map(spare => (
                <div key={spare.id} className={`p-4 rounded-xl border ${missing[spare.id] ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-white'} flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-neutral-900">{spare.part_number}</span>
                      {missing[spare.id] && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">Missing</span>}
                    </div>
                    <p className="text-sm text-neutral-500 mt-1">{spare.description}</p>
                    <p className="text-xs text-neutral-400 mt-1">System Expected: {recountAudit ? recountAudit.previous_qty : spare.expected_qty}</p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-neutral-500">Actual Count</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min="0"
                          required={!missing[spare.id]}
                          disabled={missing[spare.id]}
                          value={counts[spare.id] ?? ''}
                          onChange={(e) => handleCountChange(spare.id, e.target.value)}
                          className="w-24 px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-100 disabled:text-neutral-400"
                          placeholder="Qty"
                        />
                        <button 
                          type="button"
                          onClick={() => setScanMode(scanMode === 'part' ? null : 'part')}
                          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                          title="Scan Part to Increment"
                        >
                          <QrCode className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 pt-5">
                      <button 
                        type="button"
                        onClick={() => toggleMissing(spare.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${missing[spare.id] ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                      >
                        {missing[spare.id] ? 'Marked Missing' : 'Mark Missing'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-neutral-200">
              <button 
                type="submit" 
                disabled={!isSubmitEnabled || isSubmitting}
                className="w-full bg-blue-600 text-white p-4 rounded-xl text-base font-bold hover:bg-blue-700 transition-colors shadow-md disabled:bg-neutral-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="animate-pulse">Submitting...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    {recountAudit ? 'Submit Recount' : 'Submit Bin Audit'}
                  </>
                )}
              </button>
              {!isSubmitEnabled && !isSubmitting && (
                <p className="text-center text-sm text-neutral-500 mt-3">Please enter counts or mark as missing for all parts to submit.</p>
              )}
            </div>
          </form>
        </div>
      )}
      <div id="reader-hidden" className="hidden"></div>
    </div>
    </div>
  );
}

export function AuditLogsView({ user, onRecount }: { user: User, onRecount: (audit: Audit) => void }) {
  const { selectedBranch, branches } = useBranch();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [search, setSearch] = useState('');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  
  useEffect(() => {
    const url = `/api/audits${selectedBranch !== 'all' ? `?branch_id=${selectedBranch}` : ''}`;
    fetch(url).then(r => r.json()).then(setAudits);
  }, [selectedBranch]);

  const filteredAudits = audits.filter(a => {
    if (user.role !== 'admin' && a.auditor_name !== user.username) return false;
    if (showMissingOnly && a.notes !== 'Missing') return false;

    const term = search.toLowerCase();
    const dateStr = new Date(a.audit_date).toLocaleDateString().toLowerCase();
    const branchName = branches.find(b => b.id === a.branch_id)?.name.toLowerCase() || '';
    return (
      a.part_number.toLowerCase().includes(term) ||
      (a.bin_location && a.bin_location.toLowerCase().includes(term)) ||
      (a.location && a.location.toLowerCase().includes(term)) ||
      branchName.includes(term) ||
      dateStr.includes(term)
    );
  });

  const downloadCSV = () => {
    const headers = ['Date', 'Part Number', 'Part Description', 'Branch', 'Bin', 'Auditor', 'Expected', 'Actual', 'Variance', 'Notes'];
    const rows = filteredAudits.map(a => [
      new Date(a.audit_date).toLocaleString().replace(/,/g, ''),
      a.part_number,
      `"${a.description || ''}"`,
      branches.find(b => b.id === a.branch_id)?.name || a.location || '',
      a.bin_location || '',
      a.auditor_name,
      a.previous_qty,
      a.notes === 'Missing' ? 0 : a.actual_qty,
      (a.notes === 'Missing' ? 0 : a.actual_qty) - a.previous_qty,
      `"${a.notes || ''}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 md:p-8 flex flex-col h-full overflow-hidden space-y-6">
      <div className="flex-none flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Audit Logs</h2>
          <p className="text-neutral-500 text-sm mt-1">Review past audits and discrepancies.</p>
        </div>
        <button onClick={downloadCSV} className="inline-flex items-center gap-2 bg-white border border-neutral-200 text-neutral-700 px-4 py-2 rounded-xl font-medium hover:bg-neutral-50 transition-colors">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>
      
      <div className="flex-1 min-h-0 bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="flex-none p-4 border-b border-neutral-200 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text" 
              placeholder="Search by date, bin, or part number..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 cursor-pointer">
            <input 
              type="checkbox" 
              checked={showMissingOnly}
              onChange={(e) => setShowMissingOnly(e.target.checked)}
              className="rounded border-neutral-300 w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            Show Missing Only
          </label>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="hidden md:table w-full text-sm text-left">
            <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Part</th>
                <th className="px-6 py-3">Part Description</th>
                <th className="px-6 py-3">Branch</th>
                <th className="px-6 py-3">Bin</th>
                <th className="px-6 py-3">Auditor</th>
                <th className="px-6 py-3 text-right">Expected</th>
                <th className="px-6 py-3 text-right">Actual</th>
                <th className="px-6 py-3 text-right">Variance</th>
                <th className="px-6 py-3">Notes</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredAudits.map(audit => (
                <tr key={audit.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-3 text-neutral-500">{new Date(audit.audit_date).toLocaleString()}</td>
                  <td className="px-6 py-3 font-mono font-medium">{audit.part_number}</td>
                  <td className="px-6 py-3">{audit.description}</td>
                  <td className="px-6 py-3 text-neutral-500">{branches.find(b => b.id === audit.branch_id)?.name || audit.location}</td>
                  <td className="px-6 py-3 text-neutral-500 font-mono text-xs">{audit.bin_location}</td>
                  <td className="px-6 py-3">{audit.auditor_name}</td>
                  <td className="px-6 py-3 text-right">{audit.previous_qty}</td>
                  <td className="px-6 py-3 text-right font-medium">
                    {audit.notes === 'Missing' ? (
                      <span className="text-red-600">0</span>
                    ) : (
                      audit.actual_qty
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      audit.discrepancy > 0 ? 'bg-blue-100 text-blue-800' : 
                      audit.discrepancy < 0 ? 'bg-red-100 text-red-800' : 
                      'bg-green-100 text-green-800'
                    }`}>
                      {audit.discrepancy > 0 ? '+' : ''}{audit.discrepancy}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {audit.notes === 'Missing' ? (
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">Missing</span>
                    ) : (
                      <span className="text-neutral-500 text-xs">{audit.notes}</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button 
                      onClick={() => onRecount(audit)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Recount
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="md:hidden divide-y divide-neutral-100">
            {filteredAudits.map(audit => (
              <div key={audit.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[10px] text-neutral-400 font-medium uppercase mb-1">
                      {new Date(audit.audit_date).toLocaleString()}
                    </div>
                    <div className="font-mono font-bold text-neutral-900">{audit.part_number}</div>
                    <div className="text-xs text-neutral-500">{audit.description}</div>
                  </div>
                  <button 
                    onClick={() => onRecount(audit)}
                    className="text-blue-600 font-medium text-xs bg-blue-50 px-3 py-1.5 rounded-lg"
                  >
                    Recount
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="bg-neutral-50 p-2 rounded-lg">
                    <span className="text-neutral-400 block mb-0.5">Bin</span>
                    <span className="font-mono font-medium text-blue-600">{audit.bin_location || 'N/A'}</span>
                  </div>
                  <div className="bg-neutral-50 p-2 rounded-lg">
                    <span className="text-neutral-400 block mb-0.5">Exp / Act</span>
                    <span className="font-medium text-neutral-900">{audit.previous_qty} / {audit.notes === 'Missing' ? 0 : audit.actual_qty}</span>
                  </div>
                  <div className="bg-neutral-50 p-2 rounded-lg">
                    <span className="text-neutral-400 block mb-0.5">Variance</span>
                    <span className={`font-bold ${
                      audit.discrepancy > 0 ? 'text-blue-600' : 
                      audit.discrepancy < 0 ? 'text-red-600' : 
                      'text-green-600'
                    }`}>
                      {audit.discrepancy > 0 ? '+' : ''}{audit.discrepancy}
                    </span>
                  </div>
                </div>
                {audit.notes && (
                  <div className="text-[10px] text-neutral-500 bg-neutral-50 px-2 py-1 rounded italic">
                    Note: {audit.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
