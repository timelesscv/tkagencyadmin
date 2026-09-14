import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseAdminClient } from "../_lib/helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("office_ref_counters").select("*").limit(1);
    const tableExists = !error;

    return res.status(200).json({
      tableExists,
      message: tableExists
        ? "Dedicated Supabase table 'office_ref_counters' is active."
        : "Dedicated table not yet created."
    });
  } catch (err: any) {
    return res.status(200).json({ tableExists: false, error: err.message });
  }
}
