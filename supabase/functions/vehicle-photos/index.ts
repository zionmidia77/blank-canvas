import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BUCKET = "veiculos";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status: 200, // always 200 so client reads body
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // ── GET: list photos ──
    if (req.method === "GET") {
      const vehicleId = url.searchParams.get("vehicle_id");
      const day = url.searchParams.get("day");
      if (!vehicleId || !day) return json({ ok: false, error: "vehicle_id and day required" });

      const folder = `${vehicleId}/local_${day}`;
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(folder);
      if (error) throw error;

      const files = (data || [])
        .filter((f) => f.name && !f.name.startsWith("."))
        .map((f) => ({
          name: f.name,
          url: supabaseAdmin.storage.from(BUCKET).getPublicUrl(`${folder}/${f.name}`).data.publicUrl,
        }));

      return json({ ok: true, files });
    }

    // ── POST: upload photo ──
    if (req.method === "POST") {
      const formData = await req.formData();
      const vehicleId = formData.get("vehicle_id") as string;
      const day = formData.get("day") as string;
      const file = formData.get("file") as File;

      if (!vehicleId || !day || !file) return json({ ok: false, error: "vehicle_id, day, and file required" });

      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const path = `${vehicleId}/local_${day}/${fileName}`;

      const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
      });
      if (error) throw error;

      const publicUrl = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      return json({ ok: true, name: fileName, url: publicUrl });
    }

    // ── DELETE: remove photo ──
    if (req.method === "DELETE") {
      let vehicle_id: string | null = null;
      let day: string | null = null;
      let filename: string | null = null;

      // Try JSON body first, fall back to query params
      try {
        const body = await req.json();
        vehicle_id = body.vehicle_id;
        day = body.day;
        filename = body.filename;
      } catch {
        vehicle_id = url.searchParams.get("vehicle_id");
        day = url.searchParams.get("day");
        filename = url.searchParams.get("filename");
      }

      if (!vehicle_id || !day || !filename) return json({ ok: false, error: "vehicle_id, day, and filename required" });

      const path = `${vehicle_id}/local_${day}/${filename}`;
      const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
      if (error) throw error;

      return json({ ok: true });
    }

    return json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    console.error("vehicle-photos error:", e);
    return json({ ok: false, error: (e as Error).message });
  }
});
