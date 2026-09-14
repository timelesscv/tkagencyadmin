import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdminClient, defaultOfficesList, getSystemSecret } from "../_lib/helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { officeName } = req.body || {};
    if (!officeName) {
      return res.status(400).json({ error: "Missing officeName in request body" });
    }

    const supabase = getSupabaseAdminClient();
    const normOffice = officeName.trim().toLowerCase();
    const officeKey = normOffice.replace(/[^a-z0-9]/g, "");

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
          allocatedNumber = typeof target.next_number === "number" ? target.next_number : 1;
          const updatedNext = allocatedNumber + 1;

          await supabase
            .from("office_ref_counters")
            .update({ next_number: updatedNext, updated_at: new Date().toISOString() })
            .eq("id", target.id);

          allCounters = tableRows.map(r => ({
            id: r.id,
            name: r.office_name,
            country: r.country,
            nextNumber: r.id === target.id ? updatedNext : (typeof r.next_number === "number" ? r.next_number : 1),
            color: r.color || "border-blue-500"
          }));

          // Keep system_secrets updated as well
          const jsonStr = JSON.stringify(allCounters);
          await supabase.from("system_secrets").upsert({
            id: "OFFICE_REF_COUNTERS",
            description: "Office Reference Number Counters configuration and current values",
            secret_value: jsonStr,
            updated_at: new Date().toISOString()
          });
        }
      }
    } catch {
      tableSuccess = false;
    }

    // Fallback if table not ready
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
          allocatedNumber = typeof item.nextNumber === "number" ? item.nextNumber : 1;
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
          country: "Jordan",
          nextNumber: 2,
          color: "border-blue-500"
        });
      }

      const jsonStr = JSON.stringify(allCounters);
      await supabase.from("system_secrets").upsert({
        id: "OFFICE_REF_COUNTERS",
        description: "Office Reference Number Counters configuration and current values",
        secret_value: jsonStr,
        updated_at: new Date().toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      officeName,
      allocatedNumber,
      counters: allCounters
    });
  } catch (err: any) {
    console.error("Vercel increment error:", err);
    return res.status(500).json({ error: err.message || "Failed to increment counter on Vercel" });
  }
}
