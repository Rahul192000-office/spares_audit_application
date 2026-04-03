import React, { useState, useEffect } from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Spare, Transaction, User } from '../types';

interface TransactionsViewProps {
  user: User;
}

export default function TransactionsView({ user }: TransactionsViewProps) {
  const [spares, setSpares] = useState<Spare[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [formData, setFormData] = useState({ spare_id: '', type: 'ISSUE', qty: '', reference_no: '' });
  const [msg, setMsg] = useState('');

  const fetchData = () => {
    fetch('/api/spares').then(r => r.json()).then(setSpares);
    fetch('/api/transactions').then(r => r.json()).then(setTransactions);
  };
  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, user_name: user.username })
      });
      const data = await res.json();
      if (res.ok) {
        setMsg('Transaction successful!');
        setFormData({ spare_id: '', type: 'ISSUE', qty: '', reference_no: '' });
        fetchData();
        setTimeout(() => setMsg(''), 3000);
      } else {
        setMsg(data.error);
      }
    } catch (err) {
      setMsg('Error processing transaction');
    }
  };

  return (
    <div className="p-6 md:p-8 overflow-y-auto h-full space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Issue & GRN (Goods Receipt Note)</h2>
        <p className="text-neutral-500 text-sm mt-1">Record parts leaving or entering the warehouse.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4 max-w-2xl">
        {msg && <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-lg">{msg}</div>}
        <div className="grid grid-cols-2 gap-4">
          <select required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="border p-2 rounded-lg text-sm">
            <option value="ISSUE">Issue (Remove Stock)</option>
            <option value="GRN">GRN (Add Stock)</option>
          </select>
          <select required value={formData.spare_id} onChange={e => setFormData({...formData, spare_id: e.target.value})} className="border p-2 rounded-lg text-sm">
            <option value="">-- Select Part --</option>
            {spares.map(s => <option key={s.id} value={s.id}>{s.part_number} (Stock: {s.expected_qty})</option>)}
          </select>
          <input required type="number" min="1" placeholder="Quantity" value={formData.qty} onChange={e => setFormData({...formData, qty: e.target.value})} className="border p-2 rounded-lg text-sm" />
          <input required type="text" placeholder="Reference / Work Order No." value={formData.reference_no} onChange={e => setFormData({...formData, reference_no: e.target.value})} className="border p-2 rounded-lg text-sm" />
        </div>
        <button type="submit" className="bg-neutral-900 text-white px-4 py-2 rounded-lg text-sm w-full">Submit Transaction</button>
      </form>

      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200"><h3 className="font-medium">Recent Transactions</h3></div>
        
        <table className="hidden md:table w-full text-sm text-left">
          <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Part</th>
              <th className="px-6 py-3">Qty</th>
              <th className="px-6 py-3">Ref No</th>
              <th className="px-6 py-3">User</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td className="px-6 py-3 text-neutral-500">{new Date(tx.date).toLocaleString()}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${tx.type === 'GRN' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                    {tx.type === 'GRN' ? <ArrowDownToLine className="w-3 h-3 inline mr-1"/> : <ArrowUpFromLine className="w-3 h-3 inline mr-1"/>}
                    {tx.type}
                  </span>
                </td>
                <td className="px-6 py-3 font-mono">{tx.part_number}</td>
                <td className="px-6 py-3 font-medium">{tx.qty}</td>
                <td className="px-6 py-3 text-neutral-500">{tx.reference_no}</td>
                <td className="px-6 py-3">{tx.user_name}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="md:hidden divide-y divide-neutral-100">
          {transactions.map(tx => (
            <div key={tx.id} className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] text-neutral-400 font-medium uppercase mb-1">
                    {new Date(tx.date).toLocaleString()}
                  </div>
                  <div className="font-mono font-bold text-neutral-900">{tx.part_number}</div>
                </div>
                <span className={`px-2 py-1 text-[10px] rounded-full font-bold ${tx.type === 'GRN' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                  {tx.type}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <div className="text-neutral-500">Qty: <span className="font-bold text-neutral-900">{tx.qty}</span></div>
                <div className="text-neutral-500">Ref: <span className="text-neutral-700">{tx.reference_no}</span></div>
              </div>
              <div className="text-[10px] text-neutral-400">By: {tx.user_name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
