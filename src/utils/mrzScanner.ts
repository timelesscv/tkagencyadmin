export interface MRZData {
  fullName: string;
  passportNumber: string;
  dob: string;
  expiryDate: string;
  issueDate?: string;
  validityYears?: number;
  nationality: string;
  sex: string;
  pob: string;
  placeOfIssue: string;
}

export const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const scanPassportMRZ = async (file: File): Promise<MRZData> => {
  const dataUrl = await fileToBase64(file);

  const response = await fetch('/api/mrz/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: dataUrl,
      mimeType: file.type || 'image/jpeg'
    })
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error || `Scanner error (${response.status})`);
  }

  const data: MRZData = await response.json();
  return data;
};
