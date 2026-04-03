import React, { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { Branch } from '../types';

interface BranchContextType {
  selectedBranch: string;
  setSelectedBranch: (id: string) => void;
  branches: Branch[];
  refreshBranches: () => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children, dbConnected }: { children: ReactNode, dbConnected: boolean }) {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [branches, setBranches] = useState<Branch[]>([]);

  const refreshBranches = () => {
    fetch('/api/branches')
      .then(r => {
        if (!r.ok) return r.json().then(err => { throw new Error(err.error || 'Failed to fetch branches'); });
        return r.json();
      })
      .then(setBranches)
      .catch(err => {
        console.error(err);
      });
  };

  useEffect(() => {
    if (dbConnected) {
      refreshBranches();
    }
  }, [dbConnected]);

  return (
    <BranchContext.Provider value={{ selectedBranch, setSelectedBranch, branches, refreshBranches }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}
