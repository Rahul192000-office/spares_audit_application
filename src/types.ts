export interface Spare {
  id: string;
  srl: string;
  dealer_name: string;
  root_part: string;
  part_number: string;
  description: string;
  location: string;
  stores: string;
  bin_location: string;
  category: string;
  display_stock: string;
  display_value: string;
  expected_qty: number;
  min_stock: number;
  unit_cost: number;
  last_moved: string;
  branch_id: string | null;
}

export interface Audit {
  id: string;
  spare_id: string;
  previous_qty: number;
  actual_qty: number;
  discrepancy: number;
  auditor_name: string;
  audit_date: string;
  notes: string;
  part_number: string;
  description: string;
  location: string;
  bin_location: string;
  branch_id: string | null;
}

export interface Branch {
  id: string;
  seqId?: number;
  name: string;
  location: string;
}

export interface Transaction {
  id: string;
  spare_id: string;
  part_number: string;
  description?: string;
  type: string;
  qty: number;
  reference_no: string;
  user_name: string;
  date: string;
  branch_id: string;
}

export interface DashboardMetrics {
  totalSpares: number;
  totalQuantity: number;
  totalBins: number;
  totalValue: number;
  overallShortage: number;
  overallExcess: number;
  totalMissingCount: number;
}

export interface User {
  id: string;
  seqId?: number;
  username: string;
  role: string;
  branch_id: string | null;
  branch_name?: string;
}
