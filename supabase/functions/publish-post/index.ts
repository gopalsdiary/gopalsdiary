// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type PublishPayload = {
  jwt?: string;
  platform?: "instagram" | "facebook";
  imageUrl?: string;
  caption?: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function postToFacebook(pageId: string, graphToken: string, imageUrl: string, caption: string) {
  const body = new URLSearchParams({
    url: imageUrl,
    caption,
    access_token: graphToken,
  });

  const response = await fetch(`https://graph.facebook.com/v25.0/${pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Facebook publish failed");
  }

  return data;
}

async function postToInstagram(igUserId: string, graphToken: string, imageUrl: string, caption: string) {
  const createBody = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: graphToken,
  });

  const createRes = await fetch(`https://graph.facebook.com/v25.0/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createBody,
  });

  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(createData?.error?.message || "Instagram media creation failed");
  }

  const publishBody = new URLSearchParams({
    creation_id: createData.id,
    access_token: graphToken,
  });

  const publishRes = await fetch(`https://graph.facebook.com/v25.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishBody,
  });

  const publishData = await publishRes.json();
  if (!publishRes.ok) {
    throw new Error(publishData?.error?.message || "Instagram publish failed");
  }

  return publishData;
}

Deno.serve(async (req: Request) => {
  // Simple CORS preflight fix
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200,
      headers: corsHeaders 
    });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const graphToken = Deno.env.get("GRAPH_ACCESS_TOKEN") || "EAAURhzw90A8BQ2jExlBdH67k4Odgo2TPOBgXJF2A0XKhpZASX68Lkg9qfQ7s1x4Cx8wcNaitSnMMDUPBICtrGZBEhk0T0wU4u8EeJ63kbZCJAXly1G2BYFVwASUKGsEgEfWSCYVtaJg5O6haqD53iTchxlFnZBxtqizt8rxpZBdEo2DLZCEqVlYhMc7FoSuTZCyKbJyAWajRq5XaWD3DYNcvMVUaHEF3stAZA1L6M5uUF8CD2PPMezKIjOcfDaYVYdOov2O8DNOJExSZAFZBjnFSbchPo9";
    const fbPageId = Deno.env.get("FB_PAGE_ID") || "";
    const igUserId = Deno.env.get("IG_USER_ID") || "";

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json(500, { error: "Missing Supabase env secrets" });
    }

    if (!graphToken) {
      return json(500, { error: "Missing GRAPH_ACCESS_TOKEN secret" });
    }

    let payload: PublishPayload | null = null;
    try {
      payload = (await req.json()) as PublishPayload;
    } catch {
      payload = null;
    }

    const authHeader = req.headers.get("Authorization") || "";
    const headerJwt = authHeader.replace("Bearer ", "").trim();
    const jwt = headerJwt || payload?.jwt?.trim() || "";
    if (!jwt) {
      return json(401, { error: "Missing bearer token (header বা body.jwt দিন)" });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return json(401, { error: "Invalid user session" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!roleRow || (roleRow.role !== "admin" && roleRow.role !== "editor")) {
      return json(403, { error: "You are not allowed to publish" });
    }

    const platform = payload?.platform || "instagram";
    const imageUrl = payload?.imageUrl?.trim() || "";
    const caption = payload?.caption?.trim() || "";

    if (!imageUrl) {
      return json(400, { error: "imageUrl is required" });
    }

    let result: Record<string, unknown>;

    if (platform === "facebook") {
      if (!fbPageId) {
        return json(500, { error: "Missing FB_PAGE_ID secret" });
      }
      result = await postToFacebook(fbPageId, graphToken, imageUrl, caption);
    } else {
      if (!igUserId) {
        return json(500, { error: "Missing IG_USER_ID secret" });
      }
      result = await postToInstagram(igUserId, graphToken, imageUrl, caption);
    }

    await adminClient.from("post_logs").insert({
      platform,
      remote_post_id: String(result.id || ""),
      response: result,
      success: true,
      created_by: userData.user.id,
    });

    return json(200, {
      success: true,
      platform,
      id: result.id || null,
      response: result,
    });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unknown server error",
    });
  }
});
