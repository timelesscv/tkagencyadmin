import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSystemSecret } from "../_lib/helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const r2PublicUrl = (await getSystemSecret("CLOUDFLARE_R2_PUBLIC_URL")) || process.env.VITE_CLOUDFLARE_R2_PUBLIC_URL || "https://pub-7001b923b73d49ab9ef20403dc734dbc.r2.dev";
    return res.status(200).json({
      r2PublicUrl: r2PublicUrl.replace(/\/+$/, "")
    });
  } catch {
    return res.status(200).json({
      r2PublicUrl: "https://pub-7001b923b73d49ab9ef20403dc734dbc.r2.dev"
    });
  }
}
