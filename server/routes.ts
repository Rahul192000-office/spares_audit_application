import { Router } from 'express';
import { Branch, User, Spare, Audit, Transaction } from './models';
import mongoose from 'mongoose';

const router = Router();

// Auth
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (user) {
      res.json({ 
        success: true, 
        id: user._id, 
        username: user.username, 
        role: user.role,
        branch_id: user.branch_id 
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Branches Management
router.get('/branches', async (req, res) => {
  try {
    const branches = await Branch.find().sort({ name: 1 });
    res.json(branches.map((b, index) => ({ 
      ...b.toObject(), 
      id: b._id,
      seqId: index + 1
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/branches', async (req, res) => {
  const { name, location } = req.body;
  try {
    const branch = await Branch.create({ name, location });
    res.json({ id: branch._id, success: true });
  } catch (err: any) {
    res.status(400).json({ error: 'Branch already exists or invalid data' });
  }
});

router.post('/branches/bulk', async (req, res) => {
  const { branches } = req.body;
  if (!Array.isArray(branches)) return res.status(400).json({ error: 'Invalid data format' });

  try {
    const results = await Branch.insertMany(branches, { ordered: false });
    res.json({ success: true, count: results.length });
  } catch (err: any) {
    res.json({ success: true, count: err.result?.nInserted || 0 });
  }
});

router.delete('/branches/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await Branch.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Users Management
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().populate('branch_id').sort({ username: 1 });
    res.json(users.map((u, index) => ({ 
      ...u.toObject(), 
      id: u._id, 
      seqId: index + 1,
      branch_name: (u.branch_id as any)?.name 
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', async (req, res) => {
  const { username, password, role, branch_id } = req.body;
  try {
    const user = await User.create({ username, password, role, branch_id: branch_id || null });
    res.json({ id: user._id, success: true });
  } catch (err: any) {
    res.status(400).json({ error: 'Username already exists or invalid data' });
  }
});

router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password, role, branch_id } = req.body;
  try {
    const updateData: any = { username, role, branch_id: branch_id || null };
    if (password) updateData.password = password;
    await User.findByIdAndUpdate(id, updateData);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await User.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Dashboard Metrics
router.get('/dashboard', async (req, res) => {
  const { branch_id } = req.query;
  try {
    const filter: any = {};
    if (branch_id && branch_id !== 'all') {
      filter.branch_id = branch_id;
    }

    const totalSpares = await Spare.countDocuments(filter);
    const spares = await Spare.find(filter);
    const totalQuantity = spares.reduce((sum, s) => sum + (s.expected_qty || 0), 0);
    const totalBins = new Set(spares.map(s => s.bin_location).filter(Boolean)).size;
    const totalValue = spares.reduce((sum, s) => sum + ((s.expected_qty || 0) * (s.unit_cost || 0)), 0);

    const audits = await Audit.find(filter);
    const overallShortage = audits.filter(a => a.discrepancy < 0).length;
    const overallExcess = audits.filter(a => a.discrepancy > 0).length;
    const totalMissingCount = audits.filter(a => a.discrepancy < 0).reduce((sum, a) => sum + Math.abs(a.discrepancy), 0);

    res.json({
      totalSpares,
      totalQuantity,
      totalBins,
      totalValue,
      overallShortage,
      overallExcess,
      totalMissingCount
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get all spares
router.get('/spares', async (req, res) => {
  const { branch_id } = req.query;
  try {
    const filter: any = {};
    if (branch_id && branch_id !== 'all') {
      filter.branch_id = branch_id;
    }
    const spares = await Spare.find(filter).sort({ location: 1, part_number: 1 });
    res.json(spares.map(s => ({ ...s.toObject(), id: s._id })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new spare
router.post('/spares', async (req, res) => {
  let { part_number, description, location, expected_qty, unit_cost, srl, dealer_name, root_part, stores, bin_location, category, display_stock, display_value, branch_id } = req.body;
  
  part_number = String(part_number || '').trim();
  bin_location = String(bin_location || '').trim() || null;
  
  try {
    const existing = await Spare.findOne({
      part_number: { $regex: new RegExp(`^${part_number}$`, 'i') },
      bin_location: bin_location ? { $regex: new RegExp(`^${bin_location}$`, 'i') } : null,
      branch_id: branch_id || null
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Already exist' });
    }

    if (!srl) {
      const maxSrlSpare = await Spare.findOne().sort({ srl: -1 });
      const nextSrl = (parseInt(maxSrlSpare?.srl || '0')) + 1;
      srl = String(nextSrl);
    }

    const spare = await Spare.create({
      part_number, description, location, expected_qty, unit_cost: unit_cost || 0,
      srl, dealer_name, root_part, stores, bin_location, category, display_stock, display_value,
      branch_id: branch_id || null
    });
    res.json({ id: spare._id, success: true, srl });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk upload spares
router.post('/spares/bulk', async (req, res) => {
  const { spares, branch_id } = req.body;
  if (!Array.isArray(spares)) return res.status(400).json({ error: 'Expected array of spares' });
  
  try {
    const maxSrlSpare = await Spare.findOne().sort({ srl: -1 });
    let currentMaxSrl = parseInt(maxSrlSpare?.srl || '0');

    const existingSpares = await Spare.find({ branch_id: branch_id || null });
    const spareMap = new Map();
    existingSpares.forEach(s => {
      const key = `${String(s.part_number).toLowerCase().trim()}|${String(s.bin_location || '').toLowerCase().trim()}`;
      spareMap.set(key, s);
    });

    const operations: any[] = [];
    const now = new Date();

    for (const item of spares) {
      const pNum = String(item.part_number || '').trim();
      const bin = String(item.bin_location || '').trim() || null;
      const key = `${pNum.toLowerCase()}|${(bin || '').toLowerCase()}`;
      
      const existing = spareMap.get(key);

      if (existing) {
        operations.push({
          updateOne: {
            filter: { _id: existing._id },
            update: {
              $set: {
                description: item.description || existing.description,
                location: item.location || existing.location,
                expected_qty: parseInt(item.expected_qty) || 0,
                unit_cost: parseFloat(item.unit_cost) || 0,
                srl: item.srl || existing.srl,
                dealer_name: item.dealer_name || existing.dealer_name,
                root_part: item.root_part || existing.root_part,
                stores: item.stores || existing.stores,
                category: item.category || existing.category,
                display_stock: item.display_stock || existing.display_stock,
                display_value: item.display_value || existing.display_value,
                last_moved: now
              }
            }
          }
        });
      } else {
        let itemSrl = item.srl;
        if (!itemSrl) {
          currentMaxSrl++;
          itemSrl = String(currentMaxSrl);
        }
        operations.push({
          insertOne: {
            document: {
              part_number: pNum,
              description: item.description || '',
              location: item.location || 'UNASSIGNED',
              expected_qty: parseInt(item.expected_qty) || 0,
              unit_cost: parseFloat(item.unit_cost) || 0,
              srl: itemSrl,
              dealer_name: item.dealer_name || '',
              root_part: item.root_part || '',
              stores: item.stores || '',
              bin_location: bin,
              category: item.category || '',
              display_stock: item.display_stock || '',
              display_value: item.display_value || '',
              branch_id: branch_id || null,
              last_moved: now
            }
          }
        });
      }
    }

    if (operations.length > 0) {
      await Spare.bulkWrite(operations);
    }
    
    res.json({ success: true, count: spares.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update a spare
router.put('/spares/:id', async (req, res) => {
  const { id } = req.params;
  const { part_number, description, location, expected_qty, unit_cost, srl, dealer_name, root_part, stores, bin_location, category, display_stock, display_value } = req.body;
  try {
    await Spare.findByIdAndUpdate(id, {
      part_number, description, location, expected_qty, unit_cost, srl, dealer_name, root_part, stores, bin_location, category, display_stock, display_value
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a spare
router.delete('/spares/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await Audit.deleteMany({ spare_id: id });
    await Transaction.deleteMany({ spare_id: id });
    await Spare.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk delete spares
router.post('/spares/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'Expected array of ids' });
  
  try {
    await Audit.deleteMany({ spare_id: { $in: ids } });
    await Transaction.deleteMany({ spare_id: { $in: ids } });
    await Spare.deleteMany({ _id: { $in: ids } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Perform an audit
router.post('/audits', async (req, res) => {
  const { spare_id, actual_qty, auditor_name, notes, branch_id } = req.body;
  try {
    const spare = await Spare.findById(spare_id);
    if (!spare) return res.status(404).json({ error: 'Spare not found' });

    const previous_qty = spare.expected_qty;
    const discrepancy = actual_qty - previous_qty;

    await Audit.create({
      spare_id, previous_qty, actual_qty, discrepancy, auditor_name, notes, 
      branch_id: branch_id || null
    });
    
    await Spare.findByIdAndUpdate(spare_id, {
      expected_qty: actual_qty,
      last_moved: new Date()
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/audits/bulk', async (req, res) => {
  const { audits, branch_id: topBranchId } = req.body;
  if (!Array.isArray(audits)) return res.status(400).json({ error: 'Expected array of audits' });

  try {
    const spareIds = audits.map(a => a.spare_id);
    const spares = await Spare.find({ _id: { $in: spareIds } });
    const spareMap = new Map(spares.map(s => [s._id.toString(), s]));

    const auditDocs: any[] = [];
    const spareOps: any[] = [];
    const now = new Date();

    for (const audit of audits) {
      const spare = spareMap.get(String(audit.spare_id));
      if (!spare) continue;
      
      const previous_qty = spare.expected_qty;
      const discrepancy = audit.actual_qty - previous_qty;
      const finalBranchId = audit.branch_id !== undefined ? audit.branch_id : topBranchId;
      
      auditDocs.push({
        spare_id: audit.spare_id,
        previous_qty,
        actual_qty: audit.actual_qty,
        discrepancy,
        auditor_name: audit.auditor_name,
        notes: audit.notes || '',
        branch_id: finalBranchId || null,
        audit_date: now
      });

      spareOps.push({
        updateOne: {
          filter: { _id: spare._id },
          update: {
            $set: {
              expected_qty: audit.actual_qty,
              last_moved: now
            }
          }
        }
      });
    }

    if (auditDocs.length > 0) {
      await Audit.insertMany(auditDocs);
    }
    if (spareOps.length > 0) {
      await Spare.bulkWrite(spareOps);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update an audit (Recount)
router.put('/audits/:id', async (req, res) => {
  const { actual_qty, notes } = req.body;
  const auditId = req.params.id;

  try {
    const existingAudit = await Audit.findById(auditId);
    if (!existingAudit) return res.status(404).json({ error: 'Audit not found' });

    const previous_qty = existingAudit.previous_qty;
    const discrepancy = actual_qty - previous_qty;

    await Audit.findByIdAndUpdate(auditId, {
      actual_qty, discrepancy, notes
    });

    await Spare.findByIdAndUpdate(existingAudit.spare_id, {
      expected_qty: actual_qty,
      last_moved: new Date()
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get all audits
router.get('/audits', async (req, res) => {
  const { branch_id } = req.query;
  try {
    const filter: any = {};
    if (branch_id && branch_id !== 'all') {
      filter.branch_id = branch_id;
    }
    const audits = await Audit.find(filter).populate('spare_id').sort({ audit_date: -1 });
    res.json(audits.map(a => ({ 
      ...a.toObject(), 
      id: a._id,
      part_number: (a.spare_id as any)?.part_number,
      description: (a.spare_id as any)?.description,
      location: (a.spare_id as any)?.location,
      bin_location: (a.spare_id as any)?.bin_location
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Transactions Management
router.get('/transactions', async (req, res) => {
  const { branch_id } = req.query;
  try {
    const filter: any = {};
    if (branch_id && branch_id !== 'all') {
      filter.branch_id = branch_id;
    }
    const transactions = await Transaction.find(filter).populate('spare_id').sort({ date: -1 });
    res.json(transactions.map(t => ({ 
      ...t.toObject(), 
      id: t._id,
      part_number: (t.spare_id as any)?.part_number,
      description: (t.spare_id as any)?.description
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transactions', async (req, res) => {
  const { spare_id, type, qty, reference_no, user_name, branch_id } = req.body;
  try {
    const spare = await Spare.findById(spare_id);
    if (!spare) return res.status(404).json({ error: 'Spare not found' });

    const numQty = parseInt(qty);
    if (isNaN(numQty)) return res.status(400).json({ error: 'Invalid quantity' });

    const transaction = await Transaction.create({
      spare_id, type, qty: numQty, reference_no, user_name, 
      branch_id: branch_id || spare.branch_id || null
    });

    const newQty = type === 'GRN' ? spare.expected_qty + numQty : spare.expected_qty - numQty;
    await Spare.findByIdAndUpdate(spare_id, {
      expected_qty: newQty,
      last_moved: new Date()
    });

    res.json({ id: transaction._id, success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Reports: Dead Stock
router.get('/reports/dead-stock', async (req, res) => {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const deadStock = await Spare.find({
      expected_qty: { $gt: 0 },
      last_moved: { $lt: ninetyDaysAgo }
    }).sort({ last_moved: 1 });
    
    res.json(deadStock.map(s => ({ ...s.toObject(), id: s._id })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
