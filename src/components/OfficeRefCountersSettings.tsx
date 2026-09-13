import React, { useState, useEffect } from 'react';
import {
  Hash,
  Plus,
  Save,
  Building2,
  Trash2,
  RotateCcw,
  RefreshCw,
  X,
  Database,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  Info
} from 'lucide-react';
import { OfficeRefCounter, Contract } from '../types';
import { fetchCountersSchemaStatus, fetchOfficeCountersFromSupabase } from '../services/dataService';
import { toast } from 'sonner';

interface OfficeRefCountersSettingsProps {
  officeCounters: OfficeRefCounter[];
  contracts: Contract[];
  onUpdateCounters: (counters: OfficeRefCounter[]) => void;
}

// Clean helper to filter out legacy "Option" (singular) and maintain "Options"
const sanitizeCounters = (list: OfficeRefCounter[]): OfficeRefCounter[] => {
  return (list || []).filter(o => o && o.name && o.name.trim().toLowerCase() !== 'option');
};

export const OfficeRefCountersSettings: React.FC<OfficeRefCountersSettingsProps> = ({
  officeCounters,
  contracts,
  onUpdateCounters,
}) => {
  const [countersState, setCountersState] = useState<OfficeRefCounter[]>(() => sanitizeCounters(officeCounters));
  const [inputBuffers, setInputBuffers] = useState<Record<string, string>>({});
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [schemaStatus, setSchemaStatus] = useState<{ tableExists: boolean; sqlToCreate: string; message: string } | null>(null);

  // Refresh latest counters directly from Supabase
  const handleRefreshFromCloud = async () => {
    setIsRefreshing(true);
    try {
      const latest = await fetchOfficeCountersFromSupabase();
      if (latest && latest.length > 0) {
        const clean = sanitizeCounters(latest);
        setCountersState(clean);
        setInputBuffers({});
        onUpdateCounters(clean);
        toast.success('Synced latest office reference numbers from cloud!');
      } else {
        toast.info('Counters are already up to date.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to sync counters from cloud.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // New Office modal form state
  const [newOfficeName, setNewOfficeName] = useState('');
  const [newOfficeCountry, setNewOfficeCountry] = useState<'Jordan' | 'Kuwait' | 'Saudi' | string>('Jordan');
  const [newOfficeStartNum, setNewOfficeStartNum] = useState('1');

  // Keep internal state updated if prop changes (without jittering active inputs)
  useEffect(() => {
    const clean = sanitizeCounters(officeCounters);
    if (clean.length !== officeCounters.length) {
      onUpdateCounters(clean);
    }

    setCountersState(prev => {
      // If user is currently editing a field, don't overwrite it
      if (focusedId) {
        return clean.map(c => {
          if (c.id === focusedId) {
            const current = prev.find(p => p.id === focusedId);
            return current || c;
          }
          return c;
        });
      }
      return clean;
    });
  }, [officeCounters, focusedId, onUpdateCounters]);

  // Check Supabase schema status on mount
  useEffect(() => {
    fetchCountersSchemaStatus().then(status => {
      if (status) setSchemaStatus(status);
    });
  }, []);

  // Text input change handler - allows backspacing and free typing without tweaking or cursor jumping
  const handleInputChange = (id: string, text: string) => {
    const digitsOnly = text.replace(/[^0-9]/g, '');
    setInputBuffers(prev => ({ ...prev, [id]: digitsOnly }));

    if (digitsOnly !== '') {
      const parsed = parseInt(digitsOnly, 10);
      if (!isNaN(parsed) && parsed >= 1) {
        setCountersState(prev => prev.map(item => (item.id === id ? { ...item, nextNumber: parsed } : item)));
      }
    }
  };

  const handleInputFocus = (id: string, currentVal: number) => {
    setFocusedId(id);
    setInputBuffers(prev => {
      if (prev[id] === undefined) {
        return { ...prev, [id]: String(currentVal ?? 1) };
      }
      return prev;
    });
  };

  const handleInputBlur = (id: string) => {
    setFocusedId(null);
    const raw = inputBuffers[id];
    let num = parseInt(raw || '', 10);
    if (isNaN(num) || num < 1) {
      const current = countersState.find(o => o.id === id)?.nextNumber || 1;
      num = current >= 1 ? current : 1;
    }

    setInputBuffers(prev => ({ ...prev, [id]: String(num) }));
    const updated = countersState.map(item => (item.id === id ? { ...item, nextNumber: num } : item));
    setCountersState(updated);
    onUpdateCounters(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleIncrement = (id: string, delta: number) => {
    const target = countersState.find(o => o.id === id);
    const current = target?.nextNumber || 1;
    const nextVal = Math.max(1, current + delta);

    setInputBuffers(prev => ({ ...prev, [id]: String(nextVal) }));
    const updated = countersState.map(item => (item.id === id ? { ...item, nextNumber: nextVal } : item));
    setCountersState(updated);
    onUpdateCounters(updated);
  };

  const handleSaveIndividual = (office: OfficeRefCounter) => {
    const raw = inputBuffers[office.id];
    let num = parseInt(raw || '', 10);
    if (isNaN(num) || num < 1) {
      num = office.nextNumber || 1;
    }

    setInputBuffers(prev => ({ ...prev, [office.id]: String(num) }));
    const updated = countersState.map(item => (item.id === office.id ? { ...item, nextNumber: num } : item));
    setCountersState(updated);
    onUpdateCounters(updated);
    toast.success(`${office.name} reference number set to ${num}!`);
  };

  const handleSaveAll = () => {
    // Commit any input buffers to state
    const committed = countersState.map(office => {
      const raw = inputBuffers[office.id];
      if (raw !== undefined && raw !== '') {
        const num = parseInt(raw, 10);
        if (!isNaN(num) && num >= 1) {
          return { ...office, nextNumber: num };
        }
      }
      return office;
    });

    setCountersState(committed);
    setInputBuffers({});
    onUpdateCounters(committed);
    toast.success('All office reference numbers saved!');
  };

  const handleResetTo1 = (id: string, name: string) => {
    setInputBuffers(prev => ({ ...prev, [id]: '1' }));
    const updated = countersState.map(item => (item.id === id ? { ...item, nextNumber: 1 } : item));
    setCountersState(updated);
    onUpdateCounters(updated);
    toast.info(`${name} reference counter set to 1`);
  };

  const handleAddNewOffice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfficeName.trim()) {
      toast.error('Please enter an office name');
      return;
    }

    const startNum = Math.max(1, parseInt(newOfficeStartNum, 10) || 1);

    const newOffice: OfficeRefCounter = {
      id: `custom-${Date.now()}`,
      name: newOfficeName.trim(),
      country: newOfficeCountry,
      nextNumber: startNum,
      color: newOfficeCountry === 'Jordan' ? 'border-red-500' : newOfficeCountry === 'Kuwait' ? 'border-blue-500' : 'border-green-500',
    };

    const updated = [...countersState, newOffice];
    setCountersState(updated);
    onUpdateCounters(updated);
    toast.success(`Office "${newOffice.name}" added with starting reference number ${startNum}!`);

    // Reset form
    setNewOfficeName('');
    setNewOfficeStartNum('1');
    setIsAddModalOpen(false);
  };

  const handleDeleteOffice = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove the counter for "${name}"?`)) {
      const updated = countersState.filter(o => o.id !== id);
      setCountersState(updated);
      onUpdateCounters(updated);
      toast.success(`Office "${name}" removed`);
    }
  };

  return (
    <div className="bg-[#12102c] rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3 text-pink-500">
            <div className="w-9 h-9 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center">
              <Hash size={20} />
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">
              Office Reference Number Counters
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold tracking-wide">
              <Database size={11} /> Supabase Synced
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Reference numbers are simple natural numbers (1, 2, 3...) per office. When a candidate CV or contract is made for an office, its reference number automatically increments by 1.
          </p>
        </div>

          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleRefreshFromCloud}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold uppercase tracking-wider transition disabled:opacity-50"
              title="Sync latest counters from cloud"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-pink-400' : 'text-slate-400'} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSqlModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider transition"
              title="View Supabase Table Schema & SQL"
            >
              <Code2 size={15} />
              <span>Supabase SQL</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 hover:border-white/20 text-xs font-bold uppercase tracking-wider transition"
            >
              <Plus size={15} />
              <span>Add Office</span>
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition shadow-lg shadow-pink-500/25"
            >
              <Save size={15} />
              <span>Save All</span>
            </button>
          </div>
        </div>

        {/* Supabase Status Banner */}
        <div className="p-4 rounded-2xl bg-[#0a0824] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full ${schemaStatus?.tableExists ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <div>
              <span className="font-bold text-slate-200">
                {schemaStatus?.tableExists
                  ? 'Dedicated Supabase Table (office_ref_counters) Active'
                  : 'Multi-Device Atomic Sync Active (via Supabase system_secrets)'}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Every device generates sequential numbers without repetition. Reference numbers count up by 1 each time a CV is created.
              </p>
            </div>
          </div>
          {!schemaStatus?.tableExists && (
            <button
              type="button"
              onClick={() => setIsSqlModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/20 text-[11px] font-bold transition shrink-0"
            >
              <Info size={13} />
              <span>Setup Dedicated Table in Supabase</span>
            </button>
          )}
        </div>

      {/* Office Counters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {countersState.map(office => {
          const assignedCount = contracts.filter(
            c => c.office && c.office.toLowerCase() === office.name.toLowerCase()
          ).length;

          const isCustom = office.id.startsWith('custom-');

          return (
            <div
              key={office.id}
              className="bg-[#09081f] rounded-2xl p-5 border border-white/5 space-y-4 hover:border-white/10 transition flex flex-col justify-between"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-pink-400">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-wide">{office.name}</h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {office.country}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-slate-300 border border-white/10">
                    {assignedCount} CVs
                  </span>
                  {isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDeleteOffice(office.id, office.name)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition"
                      title="Remove office"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Natural Number Counter Box */}
              <div className="bg-[#050414] rounded-xl p-4 border border-white/10 space-y-3 min-w-0">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Next Ref Number</span>
                  <button
                    type="button"
                    onClick={() => handleResetTo1(office.id, office.name)}
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition"
                    title="Reset to 1"
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                </div>

                <div className="flex items-center gap-2 min-w-0 w-full">
                  <button
                    type="button"
                    onClick={() => handleIncrement(office.id, -1)}
                    className="w-10 h-10 shrink-0 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-base flex items-center justify-center transition border border-white/10 active:scale-95"
                    title="Decrement by 1"
                  >
                    -
                  </button>
                  <input
                    id={`counter-input-${office.id}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={inputBuffers[office.id] !== undefined ? inputBuffers[office.id] : String(office.nextNumber ?? 1)}
                    onFocus={() => handleInputFocus(office.id, office.nextNumber)}
                    onChange={e => handleInputChange(office.id, e.target.value)}
                    onBlur={() => handleInputBlur(office.id)}
                    onKeyDown={e => handleKeyDown(e, office.id)}
                    className="w-full min-w-0 flex-1 bg-[#09081f] border border-white/10 rounded-xl py-2 px-3 text-center text-xl font-mono font-bold text-white focus:ring-2 focus:ring-pink-500 outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleIncrement(office.id, 1)}
                    className="w-10 h-10 shrink-0 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-base flex items-center justify-center transition border border-white/10 active:scale-95"
                    title="Increment by 1"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Card Footer Action */}
              <button
                type="button"
                onClick={() => handleSaveIndividual(office)}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5"
              >
                <Save size={13} />
                <span>Save ({inputBuffers[office.id] !== undefined && inputBuffers[office.id] !== '' ? inputBuffers[office.id] : office.nextNumber})</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Office Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#12102c] w-full max-w-md rounded-3xl overflow-hidden border border-white/10 shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 text-pink-500">
                <Building2 size={20} />
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  Add Agency Office
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddNewOffice} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Office Name
                </label>
                <input
                  type="text"
                  required
                  value={newOfficeName}
                  onChange={e => setNewOfficeName(e.target.value)}
                  placeholder="e.g. Al-Rawabi or Amman Office"
                  className="w-full bg-[#070617] border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:ring-2 focus:ring-pink-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Destination Country
                </label>
                <select
                  value={newOfficeCountry}
                  onChange={e => setNewOfficeCountry(e.target.value)}
                  className="w-full bg-[#070617] border border-white/10 rounded-xl py-3 px-4 text-xs text-white focus:ring-2 focus:ring-pink-500 outline-none"
                >
                  <option value="Jordan">Jordan</option>
                  <option value="Kuwait">Kuwait</option>
                  <option value="Saudi">Saudi Arabia</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Starting Reference Number (Natural Number)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={newOfficeStartNum}
                  onChange={e => setNewOfficeStartNum(e.target.value)}
                  className="w-full bg-[#070617] border border-white/10 rounded-xl py-3 px-4 text-xs font-mono font-bold text-white focus:ring-2 focus:ring-pink-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-xs font-bold uppercase tracking-wider hover:bg-white/5 transition text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-pink-500/25"
                >
                  Add Office
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supabase SQL Schema Modal */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-[#12102c] w-full max-w-2xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <Code2 size={22} />
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider">
                    Supabase Reference Counters Table Setup
                  </h3>
                  <p className="text-xs text-slate-400">
                    Run this SQL in your Supabase project SQL Editor to enable a dedicated atomic counter table.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-[#050414] rounded-2xl p-4 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                <span>SQL Query (office_ref_counters)</span>
                <button
                  type="button"
                  onClick={() => {
                    const sql = schemaStatus?.sqlToCreate || `CREATE TABLE IF NOT EXISTS public.office_ref_counters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  next_number INTEGER NOT NULL DEFAULT 1,
  color TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`;
                    navigator.clipboard.writeText(sql);
                    toast.success('SQL copied to clipboard! Paste it into Supabase SQL Editor.');
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition"
                >
                  <Copy size={13} />
                  <span>Copy SQL</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-black/50 text-emerald-300 font-mono text-xs overflow-x-auto border border-emerald-500/20 leading-relaxed select-all">
                {schemaStatus?.sqlToCreate || `CREATE TABLE IF NOT EXISTS public.office_ref_counters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  next_number INTEGER NOT NULL DEFAULT 1,
  color TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`}
              </pre>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <CheckCircle2 size={16} />
                <span>How this prevents duplicate reference numbers:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
                <li>Every time a candidate CV or contract is generated, the server runs an atomic update: <code className="bg-black/30 px-1 py-0.5 rounded text-pink-300">UPDATE office_ref_counters SET next_number = next_number + 1 WHERE name = office</code>.</li>
                <li>Even if multiple devices or users generate CVs simultaneously, PostgreSQL locks the row and increments sequentially (1, 2, 3...) so numbers never clash or duplicate.</li>
                <li>If the dedicated table is not yet run, the system automatically uses the atomic row lock on Supabase's <code className="bg-black/30 px-1 py-0.5 rounded text-pink-300">system_secrets</code> table as an active fallback.</li>
              </ul>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
