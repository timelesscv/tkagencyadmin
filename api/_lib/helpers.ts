import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Cache for system secrets
const secretsCache = new Map<string, string>();

const DEFAULT_SUPABASE_URL = "https://urifbfgwxfhhkicoizwp.supabase.co";
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaWZiZmd3eGZoaGtpY29pendwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTEyNjIyMywiZXhwIjoyMTA0NzAyMjIzfQ.7QcDXWIuNrq-sz_A6kXBXb2bL37kr6xE5aWAoRvLJk4";

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
  return createClient(supabaseUrl, serviceKey);
}

export async function getSystemSecret(key: string): Promise<string | null> {
  if (secretsCache.has(key)) {
    return secretsCache.get(key)!;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("system_secrets")
      .select("secret_value")
      .eq("id", key)
      .single();

    if (!error && data?.secret_value && data.secret_value !== "YOUR_GEMINI_API_KEY_HERE") {
      const val = data.secret_value.trim();
      secretsCache.set(key, val);
      return val;
    }
  } catch (err) {
    console.warn(`Could not load secret ${key} from Supabase:`, err);
  }

  return null;
}

export async function resolveGeminiApiKey(): Promise<string | null> {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  return await getSystemSecret("GEMINI_API_KEY");
}

let s3ClientInstance: S3Client | null = null;
let lastS3ConfigHash = "";

export async function getR2S3Client(): Promise<{ s3: S3Client; publicUrl: string; bucketCv: string; bucketPhotos: string } | null> {
  const accountId = (await getSystemSecret("CLOUDFLARE_R2_ACCOUNT_ID")) || process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = (await getSystemSecret("CLOUDFLARE_R2_ACCESS_KEY_ID")) || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = (await getSystemSecret("CLOUDFLARE_R2_SECRET_ACCESS_KEY")) || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const publicUrl = ((await getSystemSecret("CLOUDFLARE_R2_PUBLIC_URL")) || process.env.VITE_CLOUDFLARE_R2_PUBLIC_URL || "https://pub-7001b923b73d49ab9ef20403dc734dbc.r2.dev").replace(/\/+$/, "");
  const bucketCv = (await getSystemSecret("CLOUDFLARE_R2_BUCKET_CV")) || "cv-storage";
  const bucketPhotos = (await getSystemSecret("CLOUDFLARE_R2_BUCKET_PHOTOS")) || "profile-photos";

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const configHash = `${accountId}_${accessKeyId}`;
  if (!s3ClientInstance || lastS3ConfigHash !== configHash) {
    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
    lastS3ConfigHash = configHash;
  }

  return { s3: s3ClientInstance, publicUrl, bucketCv, bucketPhotos };
}

export function parseEthiopianMRZName(raw: string): string {
  if (!raw || raw.length < 10) return "";
  const content = raw.trim().toUpperCase().substring(5).split("<<<<")[0];
  const parts = content.split("<<");
  if (parts.length >= 2) {
    const surname = parts[0].replace(/</g, " ").trim();
    const given = parts[1].replace(/</g, " ").trim();
    return `${given} ${surname}`.trim().toUpperCase();
  }
  return content.replace(/</g, " ").trim().toUpperCase();
}

export function isEFormattedPassport(passportNumber: string): boolean {
  const cleanNum = (passportNumber || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^E\d/.test(cleanNum) || (cleanNum.startsWith("E") && !cleanNum.startsWith("EP") && !cleanNum.startsWith("EQ") && !cleanNum.startsWith("ER"));
}

export function calculatePassportIssueDate(expiryDate: string, passportNumber: string): { issueDate: string; validityYears: number } {
  const isE = isEFormattedPassport(passportNumber);

  if (!expiryDate || !expiryDate.includes("-")) {
    return { issueDate: "", validityYears: 5 };
  }

  const parts = expiryDate.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return { issueDate: "", validityYears: 5 };
  }

  const now = new Date();
  const currentY = now.getFullYear();
  const currentM = String(now.getMonth() + 1).padStart(2, "0");
  const currentD = String(now.getDate()).padStart(2, "0");
  const currentDateStr = `${currentY}-${currentM}-${currentD}`;

  // 1. Subtract 5 years + 1 day
  const target5y = new Date(Date.UTC(year - 5, month - 1, day + 1));
  const y5 = target5y.getUTCFullYear();
  const m5 = String(target5y.getUTCMonth() + 1).padStart(2, "0");
  const d5 = String(target5y.getUTCDate()).padStart(2, "0");
  const issueDate5y = `${y5}-${m5}-${d5}`;

  // In E-formatted passports: if issueDate is future, subtract 5 more years
  if (isE && issueDate5y > currentDateStr) {
    const target10y = new Date(Date.UTC(year - 10, month - 1, day + 1));
    const y10 = target10y.getUTCFullYear();
    const m10 = String(target10y.getUTCMonth() + 1).padStart(2, "0");
    const d10 = String(target10y.getUTCDate()).padStart(2, "0");
    const issueDate10y = `${y10}-${m10}-${d10}`;

    return {
      issueDate: issueDate10y,
      validityYears: 10
    };
  }

  return {
    issueDate: issueDate5y,
    validityYears: 5
  };
}

export const defaultOfficesList = [
  { id: "injaz", name: "Injaz", country: "Jordan", nextNumber: 1, color: "border-red-500" },
  { id: "options", name: "Options", country: "Jordan", nextNumber: 1, color: "border-red-500" },
  { id: "ewan", name: "Ewan", country: "Jordan", nextNumber: 1, color: "border-red-500" },
  { id: "aldhahran", name: "Aldhahran", country: "Saudi", nextNumber: 1, color: "border-green-500" },
  { id: "fahad", name: "Fahad", country: "Kuwait", nextNumber: 1, color: "border-blue-500" },
  { id: "alnoor", name: "Alnoor", country: "Kuwait", nextNumber: 1, color: "border-blue-500" }
];
