import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";
import {
  resolveGeminiApiKey,
  parseEthiopianMRZName,
  calculatePassportIssueDate
} from "../_lib/helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
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
    const { imageBase64, mimeType = "image/jpeg" } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 in request body" });
    }

    const cleanBase64 = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const apiKey = await resolveGeminiApiKey();
    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API key is not configured in environment or Supabase system_secrets."
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build-vercel"
        }
      }
    });

    const candidateModels = [
      "gemini-3.5-flash-lite",
      "gemini-3.6-flash",
      "gemini-3.8-flash"
    ];

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
                text: "Extract passport details from MRZ lines and printed fields. Return JSON with: mrzLine1, passportNumber, nationality, dob (YYYY-MM-DD), sex, expiryDate (YYYY-MM-DD), pob, placeOfIssue."
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
        console.warn(`Model ${modelName} attempt notice:`, err?.message || err);
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
    } catch {
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

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Vercel MRZ scan error:", error);
    return res.status(500).json({
      error: error.message || "Failed to scan passport image on Vercel"
    });
  }
}
