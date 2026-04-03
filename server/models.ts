import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  location: String
});

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  branch_id: { type: String, ref: 'Branch' }
});

const spareSchema = new mongoose.Schema({
  part_number: { type: String, required: true },
  description: { type: String, required: true },
  location: { type: String, required: true },
  expected_qty: { type: Number, default: 0 },
  unit_cost: { type: Number, default: 0.0 },
  branch_id: { type: String, ref: 'Branch' },
  srl: String,
  dealer_name: String,
  root_part: String,
  stores: String,
  bin_location: String,
  category: String,
  display_stock: String,
  display_value: String,
  last_moved: { type: Date, default: Date.now }
});

const auditSchema = new mongoose.Schema({
  spare_id: { type: String, ref: 'Spare', required: true },
  previous_qty: { type: Number, required: true },
  actual_qty: { type: Number, required: true },
  discrepancy: { type: Number, required: true },
  auditor_name: { type: String, required: true },
  audit_date: { type: Date, default: Date.now },
  notes: String,
  branch_id: { type: String, ref: 'Branch' }
});

const transactionSchema = new mongoose.Schema({
  spare_id: { type: String, ref: 'Spare', required: true },
  type: { type: String, required: true },
  qty: { type: Number, required: true },
  reference_no: String,
  user_name: { type: String, required: true },
  date: { type: Date, default: Date.now },
  branch_id: { type: String, ref: 'Branch' }
});

export const Branch = mongoose.model('Branch', branchSchema);
export const User = mongoose.model('User', userSchema);
export const Spare = mongoose.model('Spare', spareSchema);
export const Audit = mongoose.model('Audit', auditSchema);
export const Transaction = mongoose.model('Transaction', transactionSchema);
