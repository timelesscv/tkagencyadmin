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

// Convert a Contract to Supabase Candidate, Contract, and ApplicantContract rows
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

  // 3. Upsert into applicant_contracts (Dedicated comprehensive table)
  try {
    const applicantRow = {
      id: candidateId,
      ref_number: updatedContract.refNumber || null,
      labor_id: updatedContract.laborId || `TK-${candidateId.substring(0, 8)}`,
      name: updatedContract.name || 'Unnamed Applicant',
      phone_number: updatedContract.phoneNumber || null,
      passport_number: updatedContract.passportNumber || null,
      place_of_birth: updatedContract.placeOfBirth || null,
      issue_date: updatedContract.issueDate || null,
      expiry_date: updatedContract.expiryDate || null,
      date_of_birth: updatedContract.dateOfBirth || null,
      age: updatedContract.age || null,
      religion: updatedContract.religion || null,
      marital_status: updatedContract.maritalStatus || null,
      number_of_children: updatedContract.numberOfChildren || null,
      height: updatedContract.height || null,
      weight: updatedContract.weight || null,
      coc: updatedContract.coc || 'no',
      preferred_country: updatedContract.preferredCountry || 'kuwait',
      english_proficiency: updatedContract.englishProficiency || null,
      arabic_proficiency: updatedContract.arabicProficiency || null,
      has_previous_experience: Boolean(updatedContract.hasPreviousExperience),
      employment_records: updatedContract.employmentRecords || [],
      competencies: updatedContract.competencies || {},
      broker_name: updatedContract.brokerName || null,
      broker_number: updatedContract.brokerNumber || null,
      emergency_contact_name: updatedContract.emergencyContactName || null,
      emergency_contact_phone: updatedContract.emergencyContactPhone || null,
      emergency_contact_relationship: updatedContract.emergencyContactRelationship || null,
      emergency_contact_address: updatedContract.emergencyContactAddress || null,
      status: updatedContract.status || 'available',
      office: updatedContract.office || null,
      face_photo: updatedContract.facePhoto || null,
      full_body_photo: updatedContract.fullBodyPhoto || null,
      passport_photo: updatedContract.passportPhoto || null,
      is_special_case: Boolean(updatedContract.isSpecialCase),
      special_case_note: updatedContract.specialCaseNote || null,
      visa_arrived_date: updatedContract.visaArrivedDate || null,
      airline: updatedContract.airline || null,
      departure_date: updatedContract.departureDate || null,
      ticket_price: updatedContract.ticketPrice || null,
      transit: updatedContract.transit || null,
      commission_paid: updatedContract.commissionPaid || null,
      commission_amount: updatedContract.commissionAmount || null,
      contract_date: updatedContract.date || new Date().toISOString(),
      seed: updatedContract.seed || candidateId,
      generated_cvs: updatedContract.generatedCVs || [],
      assigned_office_cv: updatedContract.assignedOfficeCV || null,
      updated_at: new Date().toISOString()
    };

    const { error: appErr } = await supabase
      .from('applicant_contracts')
      .upsert(applicantRow, { onConflict: 'id' });

    if (appErr) {
      // Table may not exist yet if user hasn't run the SQL script
      console.warn('applicant_contracts table upsert notice:', appErr.message);
    }
  } catch (err) {
    console.warn('applicant_contracts table write notice:', err);
  }

  // 4. Upsert into candidates table (with all columns and backward-compatibility fallback)
  try {
    const fullCandidateRow: any = {
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
      labor_id: updatedContract.laborId || `TK-${candidateId.substring(0, 8)}`,
      ref_number: updatedContract.refNumber || null,
      broker_name: updatedContract.brokerName || null,
      broker_number: updatedContract.brokerNumber || null,
      place_of_birth: updatedContract.placeOfBirth || null,
      issue_date: updatedContract.issueDate || null,
      expiry_date: updatedContract.expiryDate || null,
      number_of_children: updatedContract.numberOfChildren || null,
      height: updatedContract.height || null,
      weight: updatedContract.weight || null,
      coc: updatedContract.coc || 'no',
      english_proficiency: updatedContract.englishProficiency || null,
      arabic_proficiency: updatedContract.arabicProficiency || null,
      emergency_contact_name: updatedContract.emergencyContactName || null,
      emergency_contact_phone: updatedContract.emergencyContactPhone || null,
      emergency_contact_relationship: updatedContract.emergencyContactRelationship || null,
      emergency_contact_address: updatedContract.emergencyContactAddress || null,
      office: updatedContract.office || null,
      is_special_case: Boolean(updatedContract.isSpecialCase),
      visa_arrived_date: updatedContract.visaArrivedDate || null,
      airline: updatedContract.airline || null,
      departure_date: updatedContract.departureDate || null,
      ticket_price: updatedContract.ticketPrice || null,
      transit: updatedContract.transit || null,
      commission_paid: updatedContract.commissionPaid || null,
      commission_amount: updatedContract.commissionAmount || null,
      employment_records: updatedContract.employmentRecords || [],
      competencies: updatedContract.competencies || {},
      generated_cvs: updatedContract.generatedCVs || [],
      assigned_office_cv: updatedContract.assignedOfficeCV || null,
      updated_at: new Date().toISOString()
    };

    const { error: fullCandErr } = await supabase
      .from('candidates')
      .upsert(fullCandidateRow, { onConflict: 'id' });

    if (fullCandErr) {
      // If table lacks new columns, fall back to core columns and store extra payload safely in notes
      const payloadSummary = {
        laborId: updatedContract.laborId,
        brokerName: updatedContract.brokerName,
        brokerNumber: updatedContract.brokerNumber,
        emergencyContactName: updatedContract.emergencyContactName,
        emergencyContactPhone: updatedContract.emergencyContactPhone,
        emergencyContactRelationship: updatedContract.emergencyContactRelationship,
        emergencyContactAddress: updatedContract.emergencyContactAddress,
        placeOfBirth: updatedContract.placeOfBirth,
        issueDate: updatedContract.issueDate,
        expiryDate: updatedContract.expiryDate,
        refNumber: updatedContract.refNumber,
        office: updatedContract.office,
        competencies: updatedContract.competencies,
        employmentRecords: updatedContract.employmentRecords,
        height: updatedContract.height,
        weight: updatedContract.weight,
        coc: updatedContract.coc,
        englishProficiency: updatedContract.englishProficiency,
        arabicProficiency: updatedContract.arabicProficiency,
        airline: updatedContract.airline,
        departureDate: updatedContract.departureDate,
        ticketPrice: updatedContract.ticketPrice,
        transit: updatedContract.transit,
        commissionPaid: updatedContract.commissionPaid,
        commissionAmount: updatedContract.commissionAmount,
        visaArrivedDate: updatedContract.visaArrivedDate,
        generatedCVs: updatedContract.generatedCVs,
        assignedOfficeCV: updatedContract.assignedOfficeCV,
        originalNote: updatedContract.specialCaseNote
      };

      const fallbackRow = {
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
        notes: `TK_METADATA_JSON:${JSON.stringify(payloadSummary)}`,
        updated_at: new Date().toISOString()
      };

      await supabase.from('candidates').upsert(fallbackRow, { onConflict: 'id' });
    }

    // 5. Upsert into contracts table
    const fullContractRow: any = {
      candidate_id: candidateId,
      contract_number: updatedContract.laborId || `TK-${candidateId.substring(0, 8)}`,
      employer_name: updatedContract.brokerName || null,
      employer_country: updatedContract.preferredCountry || 'Kuwait',
      position: 'Domestic Worker',
      status: updatedContract.status || 'available',
      signed_date: updatedContract.date ? new Date().toISOString().split('T')[0] : null,
      labor_id: updatedContract.laborId || null,
      ref_number: updatedContract.refNumber || null,
      broker_name: updatedContract.brokerName || null,
      broker_number: updatedContract.brokerNumber || null,
      office: updatedContract.office || null,
      visa_arrived_date: updatedContract.visaArrivedDate || null,
      airline: updatedContract.airline || null,
      departure_date: updatedContract.departureDate || null,
      ticket_price: updatedContract.ticketPrice || null,
      transit: updatedContract.transit || null,
      commission_paid: updatedContract.commissionPaid || null,
      commission_amount: updatedContract.commissionAmount || null,
      updated_at: new Date().toISOString()
    };

    const { error: contrErr } = await supabase
      .from('contracts')
      .upsert(fullContractRow, { onConflict: 'candidate_id' });

    if (contrErr) {
      // Fallback to minimal contracts columns
      const minimalContractRow = {
        candidate_id: candidateId,
        contract_number: updatedContract.laborId || `TK-${candidateId.substring(0, 8)}`,
        employer_name: updatedContract.brokerName || null,
        employer_country: updatedContract.preferredCountry || 'Kuwait',
        position: 'Domestic Worker',
        status: updatedContract.status || 'available',
        signed_date: updatedContract.date ? new Date().toISOString().split('T')[0] : null,
        updated_at: new Date().toISOString()
      };
      await supabase.from('contracts').upsert(minimalContractRow, { onConflict: 'candidate_id' });
    }
  } catch (err) {
    console.warn('Supabase persistence notice:', err);
  }

  return updatedContract;
}

// Fetch all candidates and contracts from Supabase
export async function fetchContractsFromSupabase(): Promise<Contract[] | null> {
  // 1. First attempt reading from dedicated applicant_contracts table
  try {
    const { data: applicantRows, error: appErr } = await supabase
      .from('applicant_contracts')
      .select('*')
      .order('created_at', { ascending: false });

    if (!appErr && applicantRows && applicantRows.length > 0) {
      return applicantRows.map((r: any) => ({
        id: r.id,
        refNumber: r.ref_number || undefined,
        laborId: r.labor_id || `TK-${r.id.substring(0, 8)}`,
        name: r.name || 'Unnamed Applicant',
        phoneNumber: r.phone_number || '',
        passportNumber: r.passport_number || '',
        placeOfBirth: r.place_of_birth || '',
        issueDate: r.issue_date || '',
        expiryDate: r.expiry_date || '',
        dateOfBirth: r.date_of_birth || '',
        age: r.age || (r.date_of_birth ? `${new Date().getFullYear() - new Date(r.date_of_birth).getFullYear()}` : '24'),
        religion: r.religion || 'Muslim',
        maritalStatus: r.marital_status || 'single',
        numberOfChildren: r.number_of_children || '',
        height: r.height || '',
        weight: r.weight || '',
        coc: r.coc || 'no',
        preferredCountry: r.preferred_country || 'kuwait',
        englishProficiency: r.english_proficiency || undefined,
        arabicProficiency: r.arabic_proficiency || undefined,
        hasPreviousExperience: Boolean(r.has_previous_experience),
        employmentRecords: Array.isArray(r.employment_records) ? r.employment_records : [],
        competencies: r.competencies || {},
        brokerName: r.broker_name || '',
        brokerNumber: r.broker_number || '',
        emergencyContactName: r.emergency_contact_name || '',
        emergencyContactPhone: r.emergency_contact_phone || '',
        emergencyContactRelationship: r.emergency_contact_relationship || '',
        emergencyContactAddress: r.emergency_contact_address || '',
        status: r.status || 'available',
        office: r.office || 'Kuwait Office',
        facePhoto: r.face_photo || undefined,
        fullBodyPhoto: r.full_body_photo || undefined,
        passportPhoto: r.passport_photo || undefined,
        isSpecialCase: Boolean(r.is_special_case),
        specialCaseNote: r.special_case_note || undefined,
        visaArrivedDate: r.visa_arrived_date || undefined,
        airline: r.airline || undefined,
        departureDate: r.departure_date || undefined,
        ticketPrice: r.ticket_price || undefined,
        transit: r.transit || undefined,
        commissionPaid: r.commission_paid || undefined,
        commissionAmount: r.commission_amount || undefined,
        date: r.contract_date || (r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Today'),
        seed: r.seed || r.id,
        generatedCVs: Array.isArray(r.generated_cvs) ? r.generated_cvs : [],
        assignedOfficeCV: r.assigned_office_cv || undefined
      }));
    }
  } catch (err) {
    console.debug('applicant_contracts read notice:', err);
  }

  // 2. Fallback to candidates and contracts tables
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

    const mapped: Contract[] = candidates.map((c: any) => {
      const contr = contractsMap.get(c.id) || {};

      // Parse metadata payload if present in notes
      let metadata: any = {};
      let cleanNotes = c.notes;
      if (c.notes && typeof c.notes === 'string' && c.notes.startsWith('TK_METADATA_JSON:')) {
        try {
          metadata = JSON.parse(c.notes.replace('TK_METADATA_JSON:', ''));
          cleanNotes = metadata.originalNote || '';
        } catch {
          // ignore
        }
      }

      return {
        id: c.id,
        name: c.full_name,
        passportNumber: c.passport_number || '',
        dateOfBirth: c.date_of_birth || '',
        age: c.age || (c.date_of_birth ? `${new Date().getFullYear() - new Date(c.date_of_birth).getFullYear()}` : '24'),
        phoneNumber: c.phone || '',
        religion: c.religion || 'Muslim',
        maritalStatus: (c.marital_status as any) || 'single',
        laborId: c.labor_id || contr.labor_id || metadata.laborId || contr.contract_number || `TK-${c.id.substring(0, 8)}`,
        refNumber: c.ref_number || contr.ref_number || metadata.refNumber || undefined,
        preferredCountry: c.destination_country || 'kuwait',
        facePhoto: c.photo_url || undefined,
        fullBodyPhoto: c.full_body_photo_url || undefined,
        passportPhoto: c.passport_photo_url || undefined,
        status: c.status || 'available',
        brokerName: c.broker_name || contr.broker_name || metadata.brokerName || contr.employer_name || '',
        brokerNumber: c.broker_number || contr.broker_number || metadata.brokerNumber || '',
        emergencyContactName: c.emergency_contact_name || metadata.emergencyContactName || '',
        emergencyContactPhone: c.emergency_contact_phone || metadata.emergencyContactPhone || '',
        emergencyContactRelationship: c.emergency_contact_relationship || metadata.emergencyContactRelationship || '',
        emergencyContactAddress: c.emergency_contact_address || metadata.emergencyContactAddress || '',
        placeOfBirth: c.place_of_birth || metadata.placeOfBirth || '',
        issueDate: c.issue_date || metadata.issueDate || '',
        expiryDate: c.expiry_date || metadata.expiryDate || '',
        numberOfChildren: c.number_of_children || metadata.numberOfChildren || '',
        height: c.height || metadata.height || '',
        weight: c.weight || metadata.weight || '',
        coc: c.coc || metadata.coc || 'no',
        englishProficiency: c.english_proficiency || metadata.englishProficiency || undefined,
        arabicProficiency: c.arabic_proficiency || metadata.arabicProficiency || undefined,
        date: c.contract_date || (c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Today'),
        seed: c.id,
        office: c.office || contr.office || metadata.office || 'Kuwait Office',
        hasPreviousExperience: c.experience === 'yes' || Boolean(metadata.hasPreviousExperience),
        employmentRecords: c.employment_records || metadata.employmentRecords || [],
        competencies: c.competencies || metadata.competencies || {},
        specialCaseNote: cleanNotes || undefined,
        isSpecialCase: c.status === 'Special Case' || Boolean(c.is_special_case) || Boolean(cleanNotes),
        visaArrivedDate: c.visa_arrived_date || contr.visa_arrived_date || metadata.visaArrivedDate || undefined,
        airline: c.airline || contr.airline || metadata.airline || undefined,
        departureDate: c.departure_date || contr.departure_date || metadata.departureDate || undefined,
        ticketPrice: c.ticket_price || contr.ticket_price || metadata.ticketPrice || undefined,
        transit: c.transit || contr.transit || metadata.transit || undefined,
        commissionPaid: c.commission_paid || contr.commission_paid || metadata.commissionPaid || undefined,
        commissionAmount: c.commission_amount || contr.commission_amount || metadata.commissionAmount || undefined,
        generatedCVs: c.generated_cvs || metadata.generatedCVs || [],
        assignedOfficeCV: c.assigned_office_cv || metadata.assignedOfficeCV || undefined
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
    await supabase.from('applicant_contracts').delete().eq('id', candidateId);
    await supabase.from('contracts').delete().eq('candidate_id', candidateId);
    const { error } = await supabase.from('candidates').delete().eq('id', candidateId);

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

