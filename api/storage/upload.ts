import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2S3Client } from "../_lib/helpers.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb"
    }
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { filename, mimeType = "image/jpeg", base64Data } = req.body || {};
    if (!filename || !base64Data) {
      return res.status(400).json({ error: "Missing filename or base64Data in request body" });
    }

    const r2 = await getR2S3Client();
    if (!r2) {
      return res.status(500).json({ error: "Cloudflare R2 credentials not configured in Supabase system_secrets table" });
    }

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

    const publicFileUrl = `${r2.publicUrl}/${key}`;

    return res.status(200).json({
      success: true,
      url: publicFileUrl,
      bucket,
      key
    });
  } catch (err: any) {
    console.error("Vercel R2 upload error:", err);
    return res.status(500).json({ error: err.message || "Failed to upload file to Cloudflare R2" });
  }
}
