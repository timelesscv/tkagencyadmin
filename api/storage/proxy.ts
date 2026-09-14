import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    console.error("Storage proxy error on Vercel:", err);
    return res.status(500).json({ error: err.message || "Failed to proxy image asset" });
  }
}
