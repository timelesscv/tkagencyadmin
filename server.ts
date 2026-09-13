import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Native .env file loading in Node 20+
try {
  process.loadEnvFile?.();
} catch {
  // Ignore when .env doesn't exist
}

const secretsCache = new Map<string, string>();

async function getSystemSecret(key: string): Promise<string | null> {
  if (secretsCache.has(key)) {
    return secretsCache.get(key)!;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://urifbfgwxfhhkicoizwp.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaWZiZmd3eGZoaGtpY29pendwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTEyNjIyMywiZXhwIjoyMTA0NzAyMjIzfQ.7QcDXWIuNrq-sz_A6kXBXb2bL37kr6xE5aWAoRvLJk4';

  if (supabaseUrl && serviceKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data, error } = await supabase
        .from('system_secrets')
        .select('secret_value')
        .eq('id', key)
        .single();

      if (!error && data?.secret_value && data.secret_value !== 'YOUR_GEMINI_API_KEY_HERE') {
        const val = data.secret_value.trim();
        secretsCache.set(key, val);
        return val;
      }
    } catch (err) {
      console.warn(`Could not load secret ${key} from Supabase:`, err);
    }
  }

  return null;
}

async function resolveGeminiApiKey(): Promise<string | null> {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  return await getSystemSecret('GEMINI_API_KEY');
}

let s3ClientInstance: S3Client | null = null;
let lastS3ConfigHash: string = "";

async function getR2S3Client(): Promise<{ s3: S3Client; publicUrl: string; bucketCv: string; bucketPhotos: string } | null> {
  const accountId = await getSystemSecret("CLOUDFLARE_R2_ACCOUNT_ID") || process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = await getSystemSecret("CLOUDFLARE_R2_ACCESS_KEY_ID") || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = await getSystemSecret("CLOUDFLARE_R2_SECRET_ACCESS_KEY") || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const publicUrl = (await getSystemSecret("CLOUDFLARE_R2_PUBLIC_URL") || process.env.VITE_CLOUDFLARE_R2_PUBLIC_URL || "https://pub-7001b923b73d49ab9ef20403dc734dbc.r2.dev").replace(/\/+$/, "");
  const bucketCv = await getSystemSecret("CLOUDFLARE_R2_BUCKET_CV") || "cv-storage";
  const bucketPhotos = await getSystemSecret("CLOUDFLARE_R2_BUCKET_PHOTOS") || "profile-photos";

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

function parseEthiopianMRZName(raw: string): string {
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

function isEFormattedPassport(passportNumber: string): boolean {
  const cleanNum = (passportNumber || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^E\d/.test(cleanNum) || (cleanNum.startsWith("E") && !cleanNum.startsWith("EP") && !cleanNum.startsWith("EQ") && !cleanNum.startsWith("ER"));
}

function calculatePassportIssueDate(expiryDate: string, passportNumber: string): { issueDate: string; validityYears: number } {
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

  // Current date string in YYYY-MM-DD
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

  // In E-formatted passports: instead of subtracting 10y, subtract 5.
  // But after subtracting 5 and the passport issue date is in future than current date, subtract 5 more.
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support up to 25MB for high-res passport photos
  app.use(express.json({ limit: "25mb" }));

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Public config endpoint (retrieves Cloudflare public URL dynamically from Supabase database)
  app.get("/api/config/public", async (_req, res) => {
    try {
      const r2PublicUrl = (await getSystemSecret("CLOUDFLARE_R2_PUBLIC_URL")) || "https://pub-7001b923b73d49ab9ef20403dc734dbc.r2.dev";
      res.json({
        r2PublicUrl: r2PublicUrl.replace(/\/+$/, "")
      });
    } catch {
      res.json({
        r2PublicUrl: "https://pub-7001b923b73d49ab9ef20403dc734dbc.r2.dev"
      });
    }
  });

  // Upload file to Cloudflare R2 using credentials fetched from Supabase
  app.post("/api/storage/upload", async (req, res) => {
    try {
      const { filename, mimeType = "image/jpeg", base64Data } = req.body;
      if (!filename || !base64Data) {
        return res.status(400).json({ error: "Missing filename or base64Data in request body" });
      }

      const r2 = await getR2S3Client();
      if (!r2) {
        return res.status(500).json({ error: "Cloudflare R2 credentials not configured in Supabase system_secrets table" });
      }

      // Always use the public bucket (cv-storage) which is mapped to the public R2 domain
      const bucket = r2.bucketCv || "cv-storage";
      const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
      const buffer = Buffer.from(cleanBase64, "base64");

      const safeFilename = filename.replace(/[^a-zA-Z0-9._/-]/g, "_");
      const key = `${safeFilename}`;

      await r2.s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }));

      // Return public URL
      const publicFileUrl = `${r2.publicUrl}/${key}`;

      return res.json({
        success: true,
        url: publicFileUrl,
        bucket,
        key
      });
    } catch (err: any) {
      console.error("R2 Upload Error:", err);
      return res.status(500).json({ error: err.message || "Failed to upload file to Cloudflare R2" });
    }
  });

  // Storage Image Proxy Endpoint (Bypasses CORS for Cloudflare R2 and remote photo assets)
  app.get("/api/storage/proxy", async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl) {
        return res.status(400).json({ error: "Missing url parameter" });
      }

      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        return res.status(400).json({ error: "Invalid URL protocol. Only HTTP and HTTPS are permitted." });
      }

      const response = await fetch(targetUrl);
      if (!response.ok) {
        return res.status(response.status).json({
          error: `Failed to fetch remote asset: ${response.status} ${response.statusText}`
        });
      }

      const contentType = response.headers.get("content-type") || "image/jpeg";
      const buffer = await response.arrayBuffer();

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error("Storage proxy error:", err);
      return res.status(500).json({ error: err.message || "Failed to proxy image asset" });
    }
  });

  // Default offices configuration
  const defaultOfficesList = [
    { id: '3', name: 'Injaz', country: 'Jordan', nextNumber: 1, color: 'border-red-500' },
    { id: '2', name: 'Options', country: 'Jordan', nextNumber: 1, color: 'border-red-500' },
    { id: '1', name: 'Ewan', country: 'Jordan', nextNumber: 1, color: 'border-red-500' },
    { id: '6', name: 'Aldhahran', country: 'Saudi', nextNumber: 1, color: 'border-green-500' },
    { id: '5', name: 'Fahad', country: 'Kuwait', nextNumber: 1, color: 'border-blue-500' },
    { id: '4', name: 'Alnoor', country: 'Kuwait', nextNumber: 1, color: 'border-blue-500' },
  ];

  // Helper to get Supabase client
  function getSupabaseClient() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://urifbfgwxfhhkicoizwp.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaWZiZmd3eGZoaGtpY29pendwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTEyNjIyMywiZXhwIjoyMTA0NzAyMjIzfQ.7QcDXWIuNrq-sz_A6kXBXb2bL37kr6xE5aWAoRvLJk4';
    return createClient(supabaseUrl, serviceKey);
  }

  // Check if dedicated office_ref_counters table exists in Supabase
  app.get("/api/counters/schema-status", async (_req, res) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from("office_ref_counters").select("*").limit(1);
      const tableExists = !error;
      const sqlToCreate = `CREATE TABLE IF NOT EXISTS office_ref_counters (
  id TEXT PRIMARY KEY,
  office_name TEXT NOT NULL,
  country TEXT NOT NULL,
  next_number INTEGER NOT NULL DEFAULT 1,
  color TEXT DEFAULT 'border-blue-500',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE office_ref_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read and update on office_ref_counters"
  ON office_ref_counters FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert initial counters
INSERT INTO office_ref_counters (id, office_name, country, next_number, color) VALUES
  ('injaz', 'Injaz', 'Jordan', 1, 'border-red-500'),
  ('options', 'Options', 'Jordan', 1, 'border-red-500'),
  ('ewan', 'Ewan', 'Jordan', 1, 'border-red-500'),
  ('aldhahran', 'Aldhahran', 'Saudi', 1, 'border-green-500'),
  ('fahad', 'Fahad', 'Kuwait', 1, 'border-blue-500'),
  ('alnoor', 'Alnoor', 'Kuwait', 1, 'border-blue-500')
ON CONFLICT (id) DO NOTHING;`;

      return res.json({
        tableExists,
        sqlToCreate,
        message: tableExists
          ? "Dedicated Supabase table 'office_ref_counters' is active."
          : "Dedicated table not yet created. Currently using atomic synchronization via Supabase system_secrets."
      });
    } catch (err: any) {
      return res.json({ tableExists: false, error: err.message });
    }
  });

  // Office Ref Counters endpoints (syncs with Supabase)
  app.get("/api/counters", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    try {
      const supabase = getSupabaseClient();

      // 1. Try dedicated office_ref_counters table first
      try {
        const { data: tableData, error: tableErr } = await supabase
          .from("office_ref_counters")
          .select("*");

        if (!tableErr && tableData && tableData.length > 0) {
          // Filter out duplicate or legacy "Option" (singular)
          const filteredRows = tableData.filter(r => (r.office_name || '').trim().toLowerCase() !== 'option' && r.id !== 'option');
          const mapped = filteredRows.map(row => ({
            id: row.id,
            name: row.office_name,
            country: row.country,
            nextNumber: typeof row.next_number === 'number' ? row.next_number : 1,
            color: row.color || 'border-blue-500'
          }));
          return res.json({ counters: mapped, source: 'office_ref_counters' });
        }
      } catch {
        // Table doesn't exist yet, proceed to system_secrets fallback
      }

      // 2. Fallback to system_secrets JSON blob
      const countersJson = await getSystemSecret("OFFICE_REF_COUNTERS");
      if (countersJson) {
        try {
          const parsed = JSON.parse(countersJson);
          if (Array.isArray(parsed)) {
            const sanitized = parsed.filter((item: any) => item && (item.name || '').trim().toLowerCase() !== 'option');
            return res.json({ counters: sanitized, source: 'system_secrets' });
          }
        } catch {
          // ignore parse error
        }
      }

      return res.json({ counters: defaultOfficesList, source: 'default' });
    } catch (err: any) {
      console.warn("Error reading counters from Supabase:", err);
      return res.json({ counters: defaultOfficesList, source: 'default' });
    }
  });

  // Save all counters
  app.post("/api/counters", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const { counters } = req.body;
      if (!counters || !Array.isArray(counters)) {
        return res.status(400).json({ error: "Invalid counters payload" });
      }

      // Filter out Option (singular), ensure Options remains
      const cleanCounters = counters.filter(item => (item.name || '').trim().toLowerCase() !== 'option');

      const supabase = getSupabaseClient();

      // 1. If dedicated office_ref_counters table exists, update it & delete legacy "Option" row
      try {
        const { error: testErr } = await supabase.from("office_ref_counters").select("id").limit(1);
        if (!testErr) {
          // Delete legacy "option" row if present
          await supabase.from("office_ref_counters").delete().in("id", ["option", "Option"]);
          await supabase.from("office_ref_counters").delete().eq("office_name", "Option");

          for (const item of cleanCounters) {
            const id = (item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            await supabase.from("office_ref_counters").upsert({
              id,
              office_name: item.name,
              country: item.country || 'Jordan',
              next_number: typeof item.nextNumber === 'number' ? item.nextNumber : 1,
              color: item.color || 'border-blue-500',
              updated_at: new Date().toISOString()
            });
          }
        }
      } catch {
        // Ignore table errors
      }

      // 2. Also persist to system_secrets for full backwards compatibility
      const jsonStr = JSON.stringify(cleanCounters);
      await supabase.from("system_secrets").upsert({
        id: "OFFICE_REF_COUNTERS",
        description: "Office Reference Number Counters configuration and current values",
        secret_value: jsonStr,
        updated_at: new Date().toISOString()
      });

      // Update cache
      secretsCache.set("OFFICE_REF_COUNTERS", jsonStr);

      return res.json({ success: true, counters: cleanCounters });
    } catch (err: any) {
      console.error("Error saving counters to Supabase:", err);
      return res.status(500).json({ error: err.message || "Failed to update counters" });
    }
  });

  // Atomic Increment Endpoint (Ensures reference numbers never repeat across devices)
  app.post("/api/counters/increment", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const { officeName } = req.body;
      if (!officeName) {
        return res.status(400).json({ error: "Missing officeName in request body" });
      }

      const supabase = getSupabaseClient();
      const normOffice = officeName.trim().toLowerCase();
      const officeKey = normOffice.replace(/[^a-z0-9]/g, '');

      // Check if dedicated table exists
      let tableSuccess = false;
      let allocatedNumber = 1;
      let allCounters: any[] = [];

      try {
        const { data: tableRows, error: checkErr } = await supabase
          .from("office_ref_counters")
          .select("*");

        if (!checkErr && tableRows && tableRows.length > 0) {
          const target = tableRows.find(
            r => r.id === officeKey || 
                 r.office_name.toLowerCase() === normOffice || 
                 normOffice.includes(r.id) ||
                 r.id.includes(officeKey)
          );

          if (target) {
            tableSuccess = true;
            allocatedNumber = typeof target.next_number === 'number' ? target.next_number : 1;
            const updatedNext = allocatedNumber + 1;

            await supabase
              .from("office_ref_counters")
              .update({ next_number: updatedNext, updated_at: new Date().toISOString() })
              .eq("id", target.id);

            allCounters = tableRows.map(r => ({
              id: r.id,
              name: r.office_name,
              country: r.country,
              nextNumber: r.id === target.id ? updatedNext : (typeof r.next_number === 'number' ? r.next_number : 1),
              color: r.color || 'border-blue-500'
            }));

            // Also keep system_secrets updated with the increment
            const jsonStr = JSON.stringify(allCounters);
            await supabase.from("system_secrets").upsert({
              id: "OFFICE_REF_COUNTERS",
              description: "Office Reference Number Counters configuration and current values",
              secret_value: jsonStr,
              updated_at: new Date().toISOString()
            });
            secretsCache.set("OFFICE_REF_COUNTERS", jsonStr);
          }
        }
      } catch {
        tableSuccess = false;
      }

      // Fallback to system_secrets atomic update if table not available
      if (!tableSuccess || allCounters.length === 0) {
        let currentList = defaultOfficesList;
        const secretVal = await getSystemSecret("OFFICE_REF_COUNTERS");
        if (secretVal) {
          try {
            currentList = JSON.parse(secretVal);
          } catch {
            currentList = defaultOfficesList;
          }
        }

        let found = false;
        allCounters = currentList.map(item => {
          if (
            item.name.toLowerCase() === normOffice ||
            normOffice.includes(item.name.toLowerCase()) ||
            item.name.toLowerCase().includes(normOffice)
          ) {
            found = true;
            allocatedNumber = typeof item.nextNumber === 'number' ? item.nextNumber : 1;
            return {
              ...item,
              nextNumber: allocatedNumber + 1
            };
          }
          return item;
        });

        if (!found) {
          allocatedNumber = 1;
          allCounters.push({
            id: officeKey,
            name: officeName,
            country: 'Jordan',
            nextNumber: 2,
            color: 'border-blue-500'
          });
        }

        const jsonStr = JSON.stringify(allCounters);
        await supabase.from("system_secrets").upsert({
          id: "OFFICE_REF_COUNTERS",
          description: "Office Reference Number Counters configuration and current values",
          secret_value: jsonStr,
          updated_at: new Date().toISOString()
        });
        secretsCache.set("OFFICE_REF_COUNTERS", jsonStr);
      }

      return res.json({
        success: true,
        officeName,
        allocatedNumber,
        counters: allCounters
      });
    } catch (err: any) {
      console.error("Counter increment error:", err);
      return res.status(500).json({ error: err.message || "Failed to increment counter" });
    }
  });

  // MRZ & Passport details extraction endpoint
  app.post("/api/mrz/scan", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 in request body" });
      }

      // Clean prefix if passed as data URL
      const cleanBase64 = imageBase64.includes(",")
        ? imageBase64.split(",")[1]
        : imageBase64;

      const apiKey = await resolveGeminiApiKey();
      if (!apiKey) {
        return res.status(500).json({
          error: "Gemini API key is not configured. Please set GEMINI_API_KEY in .env or in the Supabase 'system_secrets' table."
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      // Attempt extraction using resilient model selection with fallback
      const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.8-flash"];
      let response: any = null;
      let lastModelError: any = null;

      for (const modelName of candidateModels) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64
                  }
                },
                {
                  text: "Extract passport details from MRZ lines and the bio-data page. Focus on the bottom two lines (MRZ) and printed fields. Return JSON with: mrzLine1, passportNumber, nationality, dob (YYYY-MM-DD), sex, expiryDate (YYYY-MM-DD), pob (place of birth), placeOfIssue."
                }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  mrzLine1: { type: Type.STRING },
                  passportNumber: { type: Type.STRING },
                  nationality: { type: Type.STRING },
                  dob: { type: Type.STRING },
                  sex: { type: Type.STRING },
                  expiryDate: { type: Type.STRING },
                  pob: { type: Type.STRING },
                  placeOfIssue: { type: Type.STRING }
                },
                required: ["mrzLine1", "passportNumber", "dob", "expiryDate"]
              }
            }
          });
          if (response && response.text) {
            break;
          }
        } catch (err: any) {
          console.warn(`Model ${modelName} failed or unavailable:`, err?.message || err);
          lastModelError = err;
        }
      }

      if (!response || !response.text) {
        throw lastModelError || new Error("Failed to extract data from passport image with available AI models");
      }

      const text = response.text || "{}";
      let parsed: any = {};
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        return res.status(502).json({ error: "Failed to parse model response as JSON", raw: text });
      }

      const rawPassportNumber = (parsed.passportNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
      const rawExpiryDate = (parsed.expiryDate || "").trim();
      const { issueDate, validityYears } = calculatePassportIssueDate(rawExpiryDate, rawPassportNumber);

      const result = {
        fullName: parseEthiopianMRZName(parsed.mrzLine1 || ""),
        passportNumber: rawPassportNumber,
        dob: (parsed.dob || "").trim(),
        expiryDate: rawExpiryDate,
        issueDate,
        validityYears,
        nationality: (parsed.nationality || "ETHIOPIAN").toUpperCase(),
        sex: (parsed.sex || "").toUpperCase(),
        pob: (parsed.pob || "ADDIS ABABA").toUpperCase(),
        placeOfIssue: (parsed.placeOfIssue || "ADDIS ABABA").toUpperCase()
      };

      return res.json(result);
    } catch (error: any) {
      console.error("Error processing passport MRZ:", error);
      return res.status(500).json({
        error: error.message || "Failed to scan passport image"
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
