import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  PackageSearch, Plus, Search, Trash2, Download, Upload, 
  AlertCircle, CheckCircle2, AlertTriangle 
} from 'lucide-react';
import { useBranch } from '../context/BranchContext';
import { Spare } from '../types';
import { ConfirmModal } from '../components/UI';

export default function InventoryView() {
  const { selectedBranch } = useBranch();
  const [spares, setSpares] = useState<Spare[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<{isOpen: boolean, id?: string, isBulk?: boolean}>({isOpen: false});
  const [notification, setNotification] = useState<{message: string, isError?: boolean} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (message: string, isError = false) => {
    setNotification({ message, isError });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchSpares = () => {
    const url = `/api/spares${selectedBranch !== 'all' ? `?branch_id=${selectedBranch}` : ''}`;
    fetch(url).then(r => r.json()).then(setSpares);
  };
  useEffect(() => { fetchSpares(); }, [selectedBranch]);

  const downloadTemplate = () => {
    const headers = ['srl.', 'Dealer Na', 'Root Part', 'Part Numb', 'Part Descr', 'Location', 'Stores', 'Bin_Locati', 'Category', 'Display Sto', 'Display Va', 'Quantity', 'Value'];
    const data = [
      ['1', 'Dealer A', 'Root-1', 'PART-001', 'Sample Part', 'Loc-1', 'Store A', 'Bin-A01', 'Cat-1', '10', '55.00', '10', '5.50']
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "inventory_template.xlsx");
  };

  const handleDeleteRequest = (id?: string) => {
    if (id) {
      setConfirmDelete({ isOpen: true, id, isBulk: false });
    } else {
      setConfirmDelete({ isOpen: true, isBulk: true });
    }
  };

  const executeDelete = async () => {
    const { id, isBulk } = confirmDelete;
    setConfirmDelete({ isOpen: false });

    if (isBulk) {
      try {
        const res = await fetch('/api/spares/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds })
        });
        if (res.ok) {
          setSelectedIds([]);
          fetchSpares();
          showNotification('Selected parts deleted successfully');
        } else {
          const data = await res.json();
          showNotification(data.error || 'Failed to delete parts', true);
        }
      } catch (err) {
        showNotification('Error deleting parts', true);
      }
    } else if (id) {
      try {
        const res = await fetch(`/api/spares/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
          fetchSpares();
          showNotification('Part deleted successfully');
        } else {
          const data = await res.json();
          showNotification(data.error || 'Failed to delete part', true);
        }
      } catch (err) {
        showNotification('Error deleting part', true);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (selectedBranch === 'all') {
      showNotification('Please select a specific branch before uploading.', true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target?.result;
        if (!dataBuffer) return;
        const wb = XLSX.read(dataBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        
        const formattedData = data.map((row: any, index: number) => {
          const normRow: any = {};
          for (const key in row) {
            normRow[key.trim()] = row[key];
          }

          let pNum = String(normRow['Part Numb'] || normRow['Part Number'] || normRow.part_number || '').trim();
          if (!pNum) {
            pNum = `UNKNOWN-${Date.now()}-${index}`;
          }

          return {
            srl: String(normRow['srl.'] || normRow.srl || '').trim(),
            dealer_name: String(normRow['Dealer Na'] || normRow.dealer_name || '').trim(),
            root_part: String(normRow['Root Part'] || normRow.root_part || '').trim(),
            part_number: pNum,
            description: String(normRow['Part Descr'] || normRow['Description'] || normRow.description || '').trim(),
            location: String(normRow['Location'] || normRow.location || 'UNASSIGNED').trim(),
            stores: String(normRow['Stores'] || normRow.stores || '').trim(),
            bin_location: String(normRow['Bin_Locati'] || normRow['Bin Location'] || normRow.bin_location || '').trim(),
            category: String(normRow['Category'] || normRow.category || '').trim(),
            display_stock: String(normRow['Display Sto'] || normRow.display_stock || '').trim(),
            display_value: String(normRow['Display Va'] || normRow.display_value || '').trim(),
            expected_qty: parseInt(normRow['Quantity'] || normRow['System Stock'] || normRow.expected_qty) || 0,
            unit_cost: parseFloat(normRow['Value'] || normRow['Unit Cost'] || normRow.unit_cost) || 0,
          };
        });

        const res = await fetch('/api/spares/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            spares: formattedData, 
            branch_id: selectedBranch === 'all' ? null : selectedBranch 
          })
        });
        
        if (res.ok) {
          const result = await res.json();
          fetchSpares();
          showNotification(`Upload successful! Processed ${result.count} records.`);
        } else {
          const data = await res.json();
          showNotification(data.error || 'Upload failed. Please check the file format.', true);
        }
      } catch (err) {
        showNotification('Error processing file.', true);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredSpares = spares.filter(s => 
    s.part_number.toLowerCase().includes(search.toLowerCase()) || 
    s.description.toLowerCase().includes(search.toLowerCase()) ||
    (s.bin_location || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSpares.length && filteredSpares.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSpares.map(s => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="p-6 md:p-8 flex flex-col h-full overflow-hidden space-y-6 relative">
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-xl shadow-lg z-50 text-sm font-medium text-white transition-all ${notification.isError ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {notification.message}
        </div>
      )}
      
      <ConfirmModal 
        isOpen={confirmDelete.isOpen}
        title={confirmDelete.isBulk ? "Delete Selected Parts" : "Delete Part"}
        message={confirmDelete.isBulk ? `Are you sure you want to delete ${selectedIds.length} selected parts? This action cannot be undone.` : "Are you sure you want to delete this part? This action cannot be undone."}
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete({isOpen: false})}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Inventory & Bin Management</h2>
          <p className="text-neutral-500 text-sm mt-1">Manage parts, locations, and system stock.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <button onClick={() => handleDeleteRequest()} className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-red-700 transition-colors">
              <Trash2 className="w-4 h-4" /> Delete Selected ({selectedIds.length})
            </button>
          )}
          <button onClick={downloadTemplate} className="inline-flex items-center justify-center gap-2 bg-white border border-neutral-200 text-neutral-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-neutral-50 transition-colors">
            <Download className="w-4 h-4" /> Template CSV
          </button>
          <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center justify-center gap-2 bg-white border border-neutral-200 text-neutral-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-neutral-50 transition-colors">
            <Upload className="w-4 h-4" /> Upload Data
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="inline-flex items-center justify-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors">
            <Plus className="w-4 h-4" /> {showAdd ? 'Cancel' : 'Add Spare Part'}
          </button>
        </div>
      </div>

      {showAdd && <div className="flex-none"><AddSpareForm onAdded={() => { setShowAdd(false); fetchSpares(); }} /></div>}

      <div className="flex-1 min-h-0 bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="flex-none p-4 border-b border-neutral-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input type="text" placeholder="Search by part, description, or bin location..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="hidden md:table w-full text-sm text-left">
            <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-200 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 font-medium w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={filteredSpares.length > 0 && selectedIds.length === filteredSpares.length} 
                    onChange={toggleSelectAll} 
                    className="rounded border-neutral-300 w-4 h-4 cursor-pointer" 
                  />
                </th>
                <th className="px-6 py-3 font-medium">srl.</th>
                <th className="px-6 py-3 font-medium">Dealer Na</th>
                <th className="px-6 py-3 font-medium">Root Part</th>
                <th className="px-6 py-3 font-medium">Part Numb</th>
                <th className="px-6 py-3 font-medium">Part Descr</th>
                <th className="px-6 py-3 font-medium">Location</th>
                <th className="px-6 py-3 font-medium">Stores</th>
                <th className="px-6 py-3 font-medium">Bin_Locati</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Display Sto</th>
                <th className="px-6 py-3 font-medium">Display Va</th>
                <th className="px-6 py-3 font-medium text-right">Quantity</th>
                <th className="px-6 py-3 font-medium text-right">Value (₹)</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filteredSpares.map(spare => (
                <tr key={spare.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(spare.id)} 
                      onChange={() => toggleSelect(spare.id)} 
                      className="rounded border-neutral-300 w-4 h-4 cursor-pointer" 
                    />
                  </td>
                  <td className="px-6 py-4">{spare.srl}</td>
                  <td className="px-6 py-4">{spare.dealer_name}</td>
                  <td className="px-6 py-4">{spare.root_part}</td>
                  <td className="px-6 py-4 font-mono font-medium">{spare.part_number}</td>
                  <td className="px-6 py-4">{spare.description}</td>
                  <td className="px-6 py-4 text-neutral-500">{spare.location}</td>
                  <td className="px-6 py-4">{spare.stores}</td>
                  <td className="px-6 py-4 text-neutral-500">{spare.bin_location}</td>
                  <td className="px-6 py-4">{spare.category}</td>
                  <td className="px-6 py-4">{spare.display_stock}</td>
                  <td className="px-6 py-4">{spare.display_value}</td>
                  <td className="px-6 py-4 text-right font-medium">{spare.expected_qty}</td>
                  <td className="px-6 py-4 text-right text-neutral-500">₹{spare.unit_cost?.toFixed(2) || '0.00'}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDeleteRequest(spare.id)} className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors" title="Delete Part">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="md:hidden divide-y divide-neutral-100">
            {filteredSpares.map(spare => (
              <div key={spare.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(spare.id)} 
                      onChange={() => toggleSelect(spare.id)} 
                      className="rounded border-neutral-300 w-4 h-4 cursor-pointer" 
                    />
                    <div>
                      <div className="font-mono font-bold text-neutral-900">{spare.part_number}</div>
                      <div className="text-xs text-neutral-500">{spare.description}</div>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteRequest(spare.id)} className="text-red-600 p-2">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-neutral-50 p-2 rounded-lg">
                    <span className="text-neutral-400 block mb-0.5">Bin Location</span>
                    <span className="font-mono font-medium text-blue-600">{spare.bin_location || 'N/A'}</span>
                  </div>
                  <div className="bg-neutral-50 p-2 rounded-lg">
                    <span className="text-neutral-400 block mb-0.5">Quantity</span>
                    <span className="font-bold text-neutral-900">{spare.expected_qty}</span>
                  </div>
                  <div className="bg-neutral-50 p-2 rounded-lg">
                    <span className="text-neutral-400 block mb-0.5">Location</span>
                    <span className="text-neutral-700 truncate block">{spare.location}</span>
                  </div>
                  <div className="bg-neutral-50 p-2 rounded-lg">
                    <span className="text-neutral-400 block mb-0.5">Value</span>
                    <span className="text-neutral-700">₹{spare.unit_cost?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddSpareForm({ onAdded }: { onAdded: () => void }) {
  const { selectedBranch } = useBranch();
  const [formData, setFormData] = useState({ 
    dealer_name: '',
    root_part: '',
    part_number: '', 
    description: '', 
    location: 'UNASSIGNED',
    stores: '',
    bin_location: '', 
    category: '',
    display_stock: '',
    display_value: '',
    expected_qty: 0, 
    min_stock: 0,
    unit_cost: 0.0 
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const payload = {
      ...formData,
      part_number: formData.part_number.trim(),
      bin_location: formData.bin_location.trim(),
      branch_id: selectedBranch === 'all' ? null : selectedBranch
    };

    if (selectedBranch === 'all') {
      setError('Please select a specific branch before adding a part.');
      return;
    }

    try {
      const res = await fetch('/api/spares', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Record added successfully!');
        setTimeout(() => {
          onAdded();
        }, 1500);
      } else {
        if (data.error && (data.error.includes('already exists') || data.error.includes('Already exist'))) {
          setError('Already exist');
        } else {
          setError(data.error || 'Failed to add part');
        }
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Add New Spare Part</h3>
        <div className="flex flex-col items-end">
          {error && <span className="text-red-600 text-sm font-medium flex items-center gap-1"><AlertCircle className="w-4 h-4"/> {error}</span>}
          {success && <span className="text-emerald-600 text-sm font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> {success}</span>}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Dealer Name</label>
          <input placeholder="Dealer Name" className="w-full border p-2 rounded-lg text-sm" value={formData.dealer_name} onChange={e => setFormData({...formData, dealer_name: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Root Part</label>
          <input placeholder="Root Part" className="w-full border p-2 rounded-lg text-sm" value={formData.root_part} onChange={e => setFormData({...formData, root_part: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Part Number *</label>
          <input required placeholder="Part Number" className="w-full border p-2 rounded-lg text-sm" value={formData.part_number} onChange={e => setFormData({...formData, part_number: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Description *</label>
          <input required placeholder="Description" className="w-full border p-2 rounded-lg text-sm" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Location</label>
          <input placeholder="Location" className="w-full border p-2 rounded-lg text-sm" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Stores</label>
          <input placeholder="Stores" className="w-full border p-2 rounded-lg text-sm" value={formData.stores} onChange={e => setFormData({...formData, stores: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Bin Location *</label>
          <input required placeholder="Bin Location" className="w-full border p-2 rounded-lg text-sm" value={formData.bin_location} onChange={e => setFormData({...formData, bin_location: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Category</label>
          <input placeholder="Category" className="w-full border p-2 rounded-lg text-sm" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Display Stock</label>
          <input placeholder="Display Stock" className="w-full border p-2 rounded-lg text-sm" value={formData.display_stock} onChange={e => setFormData({...formData, display_stock: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Display Value</label>
          <input placeholder="Display Value" className="w-full border p-2 rounded-lg text-sm" value={formData.display_value} onChange={e => setFormData({...formData, display_value: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">System Stock *</label>
          <input required type="number" placeholder="System Stock" className="w-full border p-2 rounded-lg text-sm" value={formData.expected_qty} onChange={e => setFormData({...formData, expected_qty: parseInt(e.target.value) || 0})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Min Stock</label>
          <input type="number" placeholder="Min Stock" className="w-full border p-2 rounded-lg text-sm" value={formData.min_stock} onChange={e => setFormData({...formData, min_stock: parseInt(e.target.value) || 0})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500">Unit Cost (₹) *</label>
          <input required type="number" step="0.01" placeholder="Unit Cost" className="w-full border p-2 rounded-lg text-sm" value={formData.unit_cost} onChange={e => setFormData({...formData, unit_cost: parseFloat(e.target.value) || 0})} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
          Save Spare Part
        </button>
      </div>
    </form>
  );
}
