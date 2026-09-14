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

// Resizes and optimizes passport photo before sending to API
// Keeps MRZ lines razor sharp while staying well within Vercel's 4.5MB serverless payload limit
export const optimizePassportImage = async (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ base64: e.target?.result as string, mimeType: file.type || 'image/jpeg' });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve({ base64: compressedDataUrl, mimeType: 'image/jpeg' });
      };
      img.onerror = () => {
        resolve({ base64: e.target?.result as string, mimeType: file.type || 'image/jpeg' });
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const scanPassportMRZ = async (file: File): Promise<MRZData> => {
  const { base64, mimeType } = await optimizePassportImage(file);

  const response = await fetch('/api/mrz/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: base64,
      mimeType
    })
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const message = errJson.error || `Scanner error (${response.status}: ${response.statusText})`;
    throw new Error(message);
  }

  const data: MRZData = await response.json();
  return data;
};
