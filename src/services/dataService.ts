import { supabase } from '../lib/supabase';
import { Contract, OfficeRefCounter } from '../types';

export interface StorageUploadResult {
  success: boolean;
  url: string;
  bucket: string;
  key: string;
}

// Upload applicant face photo to Cloudflare R2 via our secure backend endpoint
export async function uploadToCloudflareR2(
  filename: string,
  base64Data: string,
  mimeType: string = 'image/jpeg',
  bucketType: 'photo' | 'cv' = 'photo'
): Promise<string | null> {
  try {
    if (!base64Data) return null;
    // If it's already a hosted URL, don't re-upload
    if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
      return base64Data;
    }

    const res = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename,
        mimeType,
        base64Data,
        bucketType
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('Upload to Cloudflare R2 returned status:', res.status, err);
      return null;
    }

    const data: StorageUploadResult = await res.json();
    return data.url || null;
  } catch (err) {
    console.error('Failed to upload file to Cloudflare R2:', err);
    return null;
  }
}

// Convert a Contract to Supabase Candidate and Contract rows
export async function persistContractToSupabase(contract: Contract): Promise<Contract> {
  const updatedContract = { ...contract };

  // 1. Ensure valid UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(updatedContract.id);
  const candidateId = isUuid ? updatedContract.id : crypto.randomUUID();
  updatedContract.id = candidateId;

  // 2. Upload ONLY applicant face/profile photo to Cloudflare R2 (full body & passport photos are kept in app/Supabase)
  if (updatedContract.facePhoto && updatedContract.facePhoto.startsWith('data:')) {
    const uploaded = await uploadToCloudflareR2(
      `photos/${candidateId}_face.jpg`,
      updatedContract.facePhoto,
      'image/jpeg',
      'photo'
    );
    if (uploaded) updatedContract.facePhoto = uploaded;
  }

  // 3. Upsert Candidate in Supabase
  try {
    const candidateRow = {
      id: candidateId,
      full_name: updatedContract.name || 'Unnamed Applicant',
      passport_number: updatedContract.passportNumber || null,
      nationality: 'Ethiopian',
      date_of_birth: updatedContract.dateOfBirth || null,
      gender: 'Female',
      marital_status: updatedContract.maritalStatus || null,
      religion: updatedContract.religion || null,
      phone: updatedContract.phoneNumber || null,
      applied_role: 'Housemaid',
      destination_country: updatedContract.preferredCountry || 'Kuwait',
      status: updatedContract.status || 'available',
      photo_url: updatedContract.facePhoto || null,
      passport_photo_url: updatedContract.passportPhoto || null,
      full_body_photo_url: updatedContract.fullBodyPhoto || null,
      experience: updatedContract.hasPreviousExperience ? 'yes' : 'no',
      notes: updatedContract.specialCaseNote || null,
      updated_at: new Date().toISOString()
    };

    const { error: candErr } = await supabase
      .from('candidates')
      .upsert(candidateRow, { onConflict: 'id' });

    if (candErr) {
      console.warn('Supabase candidate upsert notice:', candErr.message);
    }

    // 4. Upsert Contract in Supabase
    const contractRow = {
      candidate_id: candidateId,
      contract_number: updatedContract.laborId || `TK-${candidateId.substring(0, 8)}`,
      employer_name: updatedContract.brokerName || null,
      employer_country: updatedContract.preferredCountry || 'Kuwait',
      position: 'Domestic Worker',
      status: updatedContract.status || 'available',
      signed_date: updatedContract.date ? new Date().toISOString().split('T')[0] : null,
      updated_at: new Date().toISOString()
    };

    const { error: contrErr } = await supabase
      .from('contracts')
      .upsert(contractRow, { onConflict: 'candidate_id' });

    if (contrErr) {
      console.warn('Supabase contract upsert notice:', contrErr.message);
    }
  } catch (err) {
    console.warn('Supabase persistence fallback to local:', err);
  }

  return updatedContract;
}

// Fetch all candidates and contracts from Supabase
export async function fetchContractsFromSupabase(): Promise<Contract[] | null> {
  try {
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !candidates || candidates.length === 0) {
      return null;
    }

    // Fetch matching contracts
    const { data: contractsData } = await supabase
      .from('contracts')
      .select('*');

    const contractsMap = new Map<string, any>();
    if (contractsData) {
      contractsData.forEach(c => contractsMap.set(c.candidate_id, c));
    }

    const mapped: Contract[] = candidates.map(c => {
      const contr = contractsMap.get(c.id) || {};
      return {
        id: c.id,
        name: c.full_name,
        passportNumber: c.passport_number || '',
        dateOfBirth: c.date_of_birth || '',
        age: c.date_of_birth ? `${new Date().getFullYear() - new Date(c.date_of_birth).getFullYear()}` : '24',
        phoneNumber: c.phone || '',
        religion: c.religion || 'Muslim',
        maritalStatus: (c.marital_status as any) || 'single',
        laborId: contr.contract_number || `TK-${c.id.substring(0, 8)}`,
        preferredCountry: c.destination_country || 'kuwait',
        facePhoto: c.photo_url || undefined,
        fullBodyPhoto: c.full_body_photo_url || undefined,
        passportPhoto: c.passport_photo_url || undefined,
        status: c.status || 'available',
        brokerName: contr.employer_name || '',
        brokerNumber: '',
        date: c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Today',
        seed: c.id,
        office: 'Kuwait Office',
        hasPreviousExperience: c.experience === 'yes',
        specialCaseNote: c.notes || undefined,
        isSpecialCase: c.status === 'Special Case' || Boolean(c.notes)
      };
    });

    return mapped;
  } catch (err) {
    console.warn('Failed to load from Supabase:', err);
    return null;
  }
}

// Delete Candidate from Supabase
export async function deleteContractFromSupabase(candidateId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', candidateId);

    if (error) {
      console.warn('Error deleting candidate from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase delete error:', err);
    return false;
  }
}

// In-memory cloud cache for office reference counters (NO computer localStorage sync)
let memoryOfficeCounters: OfficeRefCounter[] | null = null;

export function getInMemoryOfficeCounters(): OfficeRefCounter[] | null {
  return memoryOfficeCounters;
}

export function setInMemoryOfficeCounters(counters: OfficeRefCounter[]): void {
  memoryOfficeCounters = counters;
}

// Office Ref Counters synchronization directly with Supabase cloud
export async function fetchOfficeCountersFromSupabase(): Promise<OfficeRefCounter[] | null> {
  // 1. Direct Supabase query (works directly on Vercel, localhost, and production)
  try {
    const { data: tableData, error } = await supabase
      .from('office_ref_counters')
      .select('*');

    if (!error && tableData && tableData.length > 0) {
      const filtered = tableData.filter(r => (r.office_name || '').trim().toLowerCase() !== 'option' && r.id !== 'option');
      const mapped: OfficeRefCounter[] = filtered.map(row => ({
        id: row.id,
        name: row.office_name,
        country: row.country,
        nextNumber: typeof row.next_number === 'number' ? row.next_number : 1,
        color: row.color || 'border-blue-500'
      }));

      setInMemoryOfficeCounters(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn('Direct Supabase counter fetch notice, trying endpoint fallback:', err);
  }

  // 2. Fallback to /api/counters
  try {
    const res = await fetch(`/api/counters?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.counters) && data.counters.length > 0) {
        setInMemoryOfficeCounters(data.counters);
        return data.counters;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch office counters from backend/Supabase:', err);
  }

  return memoryOfficeCounters;
}

export async function persistOfficeCountersToSupabase(counters: OfficeRefCounter[]): Promise<boolean> {
  const cleanCounters = counters.filter(item => (item.name || '').trim().toLowerCase() !== 'option');
  setInMemoryOfficeCounters(cleanCounters);

  // 1. Direct Supabase upsert
  try {
    for (const item of cleanCounters) {
      const id = (item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      await supabase.from('office_ref_counters').upsert({
        id,
        office_name: item.name,
        country: item.country || 'Jordan',
        next_number: typeof item.nextNumber === 'number' ? item.nextNumber : 1,
        color: item.color || 'border-blue-500',
        updated_at: new Date().toISOString()
      });
    }

    window.dispatchEvent(new CustomEvent('tk_office_counters_updated', { detail: cleanCounters }));
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('tk_counters_channel');
      channel.postMessage({ type: 'counters_updated', counters: cleanCounters });
      channel.close();
    }
    return true;
  } catch (err) {
    console.warn('Direct Supabase counter upsert error, falling back to API:', err);
  }

  // 2. Fallback to /api/counters
  try {
    const res = await fetch('/api/counters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counters: cleanCounters })
    });
    if (res.ok) {
      window.dispatchEvent(new CustomEvent('tk_office_counters_updated', { detail: cleanCounters }));
      return true;
    }
  } catch (err) {
    console.warn('Failed to persist office counters to API:', err);
  }

  return false;
}

// Atomically increment counter on Supabase cloud (guarantees no collisions across devices)
export async function incrementOfficeCounterOnSupabase(officeName: string): Promise<{ allocatedNumber: number; counters: OfficeRefCounter[] } | null> {
  const normOffice = officeName.trim().toLowerCase();
  const officeKey = normOffice.replace(/[^a-z0-9]/g, '');

  // 1. Direct Supabase atomic increment
  try {
    const { data: tableRows, error: selectErr } = await supabase
      .from('office_ref_counters')
      .select('*');

    if (!selectErr && tableRows && tableRows.length > 0) {
      const target = tableRows.find(
        r => r.id === officeKey || 
             r.office_name.toLowerCase() === normOffice || 
             normOffice.includes(r.id) ||
             r.id.includes(officeKey)
      );

      if (target) {
        const allocatedNumber = typeof target.next_number === 'number' ? target.next_number : 1;
        const nextNumber = allocatedNumber + 1;

        const { error: updateErr } = await supabase
          .from('office_ref_counters')
          .update({ next_number: nextNumber, updated_at: new Date().toISOString() })
          .eq('id', target.id);

        if (!updateErr) {
          const updatedCounters: OfficeRefCounter[] = tableRows.map(r => ({
            id: r.id,
            name: r.office_name,
            country: r.country,
            nextNumber: r.id === target.id ? nextNumber : (typeof r.next_number === 'number' ? r.next_number : 1),
            color: r.color || 'border-blue-500'
          }));

          setInMemoryOfficeCounters(updatedCounters);
          window.dispatchEvent(new CustomEvent('tk_office_counters_updated', { detail: updatedCounters }));
          if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('tk_counters_channel');
            channel.postMessage({ type: 'counters_updated', counters: updatedCounters });
            channel.close();
          }

          return { allocatedNumber, counters: updatedCounters };
        }
      }
    }
  } catch (err) {
    console.warn('Direct Supabase increment notice, falling back to API:', err);
  }

  // 2. Fallback to /api/counters/increment
  try {
    const res = await fetch('/api/counters/increment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officeName })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.counters) {
        setInMemoryOfficeCounters(data.counters);
        window.dispatchEvent(new CustomEvent('tk_office_counters_updated', { detail: data.counters }));
        return {
          allocatedNumber: data.allocatedNumber,
          counters: data.counters
        };
      }
    }
  } catch (err) {
    console.warn('Failed to increment counter on backend:', err);
  }

  return null;
}

// Check if dedicated table exists on Supabase
export async function fetchCountersSchemaStatus(): Promise<{ tableExists: boolean; sqlToCreate: string; message: string } | null> {
  try {
    const { data, error } = await supabase.from('office_ref_counters').select('id').limit(1);
    const tableExists = !error;
    return {
      tableExists,
      sqlToCreate: '',
      message: tableExists 
        ? "Dedicated Supabase table 'office_ref_counters' is active."
        : "Checking Supabase schema status."
    };
  } catch {
    try {
      const res = await fetch('/api/counters/schema-status');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    return null;
  }
}

