import React, { useState, useEffect, useRef } from 'react';
import { Edit, Trash2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useBranch } from '../context/BranchContext';
import { User } from '../types';
import { ConfirmModal } from '../components/UI';

export function UsersView() {
  const { branches } = useBranch();
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'auditor', branch_id: '' });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{isOpen: boolean, id?: string}>({isOpen: false});

  const fetchUsers = () => fetch('/api/users').then(r => r.json()).then(setUsers);
  useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        branch_id: formData.branch_id || null
      };
      
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setMsg(editingUser ? 'User updated successfully!' : 'User created successfully!');
        setFormData({ username: '', password: '', role: 'auditor', branch_id: '' });
        setEditingUser(null);
        fetchUsers();
        setTimeout(() => setMsg(''), 3000);
      } else {
        const data = await res.json();
        setMsg(data.error || 'Failed to save user');
      }
    } catch (err) {
      setMsg('Network error');
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '', 
      role: user.role,
      branch_id: user.branch_id ? String(user.branch_id) : ''
    });
    setMsg('');
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setFormData({ username: '', password: '', role: 'auditor', branch_id: '' });
    setMsg('');
  };

  const handleDeleteRequest = (id: string) => {
    setConfirmDelete({ isOpen: true, id });
  };

  const executeDelete = async () => {
    const { id } = confirmDelete;
    setConfirmDelete({ isOpen: false });
    if (!id) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchUsers();
    } catch (err) {}
  };

  return (
    <div className="p-6 md:p-8 overflow-y-auto h-full space-y-6 relative">
      <ConfirmModal 
        isOpen={confirmDelete.isOpen}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete({isOpen: false})}
      />
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">User Management</h2>
        <p className="text-neutral-500 text-sm mt-1">Create and manage auditor accounts.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4 max-w-2xl">
        <div className="flex justify-between items-center">
          <h3 className="font-medium">{editingUser ? 'Edit User' : 'Add New User'}</h3>
          {editingUser && (
            <button type="button" onClick={cancelEdit} className="text-xs text-blue-600 hover:underline">Cancel Edit</button>
          )}
        </div>
        {msg && <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">{msg}</div>}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase ml-1">Username</label>
            <input required placeholder="Username" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full border p-2 rounded-lg text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase ml-1">Password {editingUser && '(Leave blank to keep current)'}</label>
            <input required={!editingUser} type="password" placeholder="Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full border p-2 rounded-lg text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase ml-1">Role</label>
            <select required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full border p-2 rounded-lg text-sm">
              <option value="auditor">Auditor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase ml-1">Branch</label>
            <select value={formData.branch_id} onChange={e => setFormData({...formData, branch_id: e.target.value})} className="w-full border p-2 rounded-lg text-sm">
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="bg-neutral-900 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors">
          {editingUser ? 'Update User' : 'Create User'}
        </button>
      </form>

      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden max-w-4xl">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-6 py-3 font-medium">ID</th>
              <th className="px-6 py-3 font-medium">Username</th>
              <th className="px-6 py-3 font-medium">Role</th>
              <th className="px-6 py-3 font-medium">Branch</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-neutral-50">
                <td className="px-6 py-4 text-neutral-500">{u.seqId || u.id}</td>
                <td className="px-6 py-4 font-medium">{u.username}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-neutral-500">
                  {branches.find(b => b.id === u.branch_id)?.name || 'All Branches'}
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button onClick={() => handleEdit(u)} className="text-blue-600 hover:text-blue-800 p-1 rounded-md hover:bg-blue-50 transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  {u.username !== 'admin' && (
                    <button onClick={() => handleDeleteRequest(u.id)} className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BranchesView() {
  const { branches, refreshBranches } = useBranch();
  const [formData, setFormData] = useState({ name: '', location: '' });
  const [msg, setMsg] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setMsg('Branch created successfully!');
        setFormData({ name: '', location: '' });
        refreshBranches();
        setTimeout(() => setMsg(''), 3000);
      } else {
        const data = await res.json();
        setMsg(data.error || 'Failed to create branch');
      }
    } catch (err) {
      setMsg('Network error');
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setMsg('Processing file...');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const branchesToUpload = data.map(row => ({
          name: row.name || row.Name || row.branch_name || row.BranchName,
          location: row.location || row.Location || row.branch_location || row.BranchLocation
        })).filter(b => b.name && b.location);

        if (branchesToUpload.length === 0) {
          setMsg('No valid branch data found in file. Ensure columns are "name" and "location".');
          setIsUploading(false);
          return;
        }

        const res = await fetch('/api/branches/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(branchesToUpload)
        });

        if (res.ok) {
          const result = await res.json();
          setMsg(`Successfully uploaded ${result.count} branches!`);
          refreshBranches();
          setTimeout(() => setMsg(''), 5000);
        } else {
          const errData = await res.json();
          setMsg(errData.error || 'Failed to upload branches');
        }
      } catch (err) {
        setMsg('Error parsing file');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this branch?')) return;
    try {
      const res = await fetch(`/api/branches/${id}`, { method: 'DELETE' });
      if (res.ok) refreshBranches();
    } catch (err) {}
  };

  return (
    <div className="p-6 md:p-8 overflow-y-auto h-full space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Branch Management</h2>
          <p className="text-neutral-500 text-sm mt-1">Manage physical locations and branches.</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleBulkUpload} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 bg-white border border-neutral-200 text-neutral-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-neutral-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Bulk Upload
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4 max-w-2xl">
        <h3 className="font-medium">Add New Branch</h3>
        {msg && <div className={`p-3 text-sm rounded-lg ${msg.includes('Success') ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>{msg}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input required placeholder="Branch Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="border p-2 rounded-lg text-sm" />
          <input required placeholder="Location" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="border p-2 rounded-lg text-sm" />
        </div>
        <button type="submit" className="bg-neutral-900 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-neutral-800 transition-colors">
          Create Branch
        </button>
      </form>

      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden max-w-4xl">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-6 py-3 font-medium">ID</th>
              <th className="px-6 py-3 font-medium">Name</th>
              <th className="px-6 py-3 font-medium">Location</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {branches.map(b => (
              <tr key={b.id} className="hover:bg-neutral-50">
                <td className="px-6 py-4 text-neutral-500">{b.seqId || b.id}</td>
                <td className="px-6 py-4 font-medium">{b.name}</td>
                <td className="px-6 py-4 text-neutral-500">{b.location}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleDelete(b.id)} className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
