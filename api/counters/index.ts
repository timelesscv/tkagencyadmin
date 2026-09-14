import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdminClient, defaultOfficesList, getSystemSecret } from "../_lib/helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const supabase = getSupabaseAdminClient();

  if (req.method === "GET") {
    try {
      // 1. Try dedicated office_ref_counters table
      const { data: tableData, error: tableErr } = await supabase
        .from("office_ref_counters")
        .select("*");

      if (!tableErr && tableData && tableData.length > 0) {
        const filteredRows = tableData.filter(r => (r.office_name || "").trim().toLowerCase() !== "option" && r.id !== "option");
        const mapped = filteredRows.map(row => ({
          id: row.id,
          name: row.office_name,
          country: row.country,
          nextNumber: typeof row.next_number === "number" ? row.next_number : 1,
          color: row.color || "border-blue-500"
        }));
        return res.status(200).json({ counters: mapped, source: "office_ref_counters" });
      }

      // 2. Fallback to system_secrets
      const countersJson = await getSystemSecret("OFFICE_REF_COUNTERS");
      if (countersJson) {
        try {
          const parsed = JSON.parse(countersJson);
          if (Array.isArray(parsed)) {
            const sanitized = parsed.filter((item: any) => item && (item.name || "").trim().toLowerCase() !== "option");
            return res.status(200).json({ counters: sanitized, source: "system_secrets" });
          }
        } catch {
          // ignore
        }
      }

      return res.status(200).json({ counters: defaultOfficesList, source: "default" });
    } catch (err: any) {
      console.warn("Vercel counters GET error:", err);
      return res.status(200).json({ counters: defaultOfficesList, source: "default" });
    }
  }

  if (req.method === "POST") {
    try {
      const { counters } = req.body || {};
      if (!counters || !Array.isArray(counters)) {
        return res.status(400).json({ error: "Invalid counters payload" });
      }

      const cleanCounters = counters.filter(item => (item.name || "").trim().toLowerCase() !== "option");

      try {
        const { error: testErr } = await supabase.from("office_ref_counters").select("id").limit(1);
        if (!testErr) {
          await supabase.from("office_ref_counters").delete().in("id", ["option", "Option"]);
          await supabase.from("office_ref_counters").delete().eq("office_name", "Option");

          for (const item of cleanCounters) {
            const id = (item.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            await supabase.from("office_ref_counters").upsert({
              id,
              office_name: item.name,
              country: item.country || "Jordan",
              next_number: typeof item.nextNumber === "number" ? item.nextNumber : 1,
              color: item.color || "border-blue-500",
              updated_at: new Date().toISOString()
            });
          }
        }
      } catch {
        // ignore
      }

      // Also persist to system_secrets
      const jsonStr = JSON.stringify(cleanCounters);
      await supabase.from("system_secrets").upsert({
        id: "OFFICE_REF_COUNTERS",
        description: "Office Reference Number Counters configuration and current values",
        secret_value: jsonStr,
        updated_at: new Date().toISOString()
      });

      return res.status(200).json({ success: true, counters: cleanCounters });
    } catch (err: any) {
      console.error("Vercel counters POST error:", err);
      return res.status(500).json({ error: err.message || "Failed to update counters" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
