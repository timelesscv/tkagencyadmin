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

// Office Ref Counters synchronization with Supabase
export async function fetchOfficeCountersFromSupabase(): Promise<OfficeRefCounter[] | null> {
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
        return data.counters;
      }
    }
    return null;
  } catch (err) {
    console.warn('Failed to fetch office counters from backend/Supabase:', err);
    return null;
  }
}

export async function persistOfficeCountersToSupabase(counters: OfficeRefCounter[]): Promise<boolean> {
  try {
    const res = await fetch('/api/counters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counters })
    });
    if (res.ok) {
      try {
        localStorage.setItem('tk_office_counters', JSON.stringify(counters));
        window.dispatchEvent(new CustomEvent('tk_office_counters_updated', { detail: counters }));
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('tk_counters_channel');
          channel.postMessage({ type: 'counters_updated', counters });
          channel.close();
        }
      } catch {
        // ignore
      }
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Failed to persist office counters to Supabase:', err);
    return false;
  }
}

// Atomically increment counter on Supabase backend (guarantees no collisions across devices)
export async function incrementOfficeCounterOnSupabase(officeName: string): Promise<{ allocatedNumber: number; counters: OfficeRefCounter[] } | null> {
  try {
    const res = await fetch('/api/counters/increment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officeName })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        if (data.counters && Array.isArray(data.counters)) {
          try {
            localStorage.setItem('tk_office_counters', JSON.stringify(data.counters));
            window.dispatchEvent(new CustomEvent('tk_office_counters_updated', { detail: data.counters }));
            if (typeof BroadcastChannel !== 'undefined') {
              const channel = new BroadcastChannel('tk_counters_channel');
              channel.postMessage({ type: 'counters_updated', counters: data.counters });
              channel.close();
            }
          } catch {
            // ignore
          }
        }
        return {
          allocatedNumber: data.allocatedNumber,
          counters: data.counters
        };
      }
    }
    return null;
  } catch (err) {
    console.warn('Failed to atomically increment counter on Supabase:', err);
    return null;
  }
}

// Check if dedicated table exists on Supabase
export async function fetchCountersSchemaStatus(): Promise<{ tableExists: boolean; sqlToCreate: string; message: string } | null> {
  try {
    const res = await fetch('/api/counters/schema-status');
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch (err) {
    console.warn('Failed to check counters schema status:', err);
    return null;
  }
}

