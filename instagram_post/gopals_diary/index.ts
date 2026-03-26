// supabase/functions/publish-post/index.ts (supabase edge function)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { postId } = body;
    let posts = [];

    if (postId) {
      const { data } = await supabaseClient.from("instagram_posts").select("*").eq("id", postId).maybeSingle();
      if (data) posts = [data];
    } else {
      // অটোমেটিক লজিক: অতীত বা বর্তমানের পেন্ডিং পোস্টগুলো খুঁজে বের করা
      const { data } = await supabaseClient
        .from("instagram_posts")
        .select("*")
        .eq("status", "pending")
        .lte("schedule_at", new Date().toISOString())
        .order("schedule_at", { ascending: true })
        .limit(2); // প্রতি ১৫ মিনিটে সর্বোচ্চ ২ টি পোস্ট পাবলিশ হবে
      posts = data || [];
    }

    if (posts.length === 0) {
      console.log("No pending posts found at this time: " + new Date().toISOString());
      return new Response(JSON.stringify({ message: "No pending posts" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results = [];
    const IG_USER_ID = Deno.env.get("IG_USER_ID");
    const TOKEN = Deno.env.get("FB_GRAPH_TOKEN");

    for (const post of posts) {
      // 🚨 ডুপ্লিকেট বন্ধ করার মেইন লজিক (Locking):
      // পোস্ট প্রোসেস করার আগে স্ট্যাটাস 'publishing' এ পরিবর্তন করার চেষ্টা করা
      const { data: locked } = await supabaseClient
        .from("instagram_posts")
        .update({ status: "publishing" })
        .eq("id", post.id)
        .eq("status", "pending") // শুধুমাত্র যদি এখনও পেন্ডিং থাকে তবেই আপডেট হবে
        .select();

      // যদি সে অলরেডি পেন্ডিং না থাকে (অন্য কোনো ফাংশন অলরেডি ধরছে), তবে স্কিপ করবে
      if (!locked || locked.length === 0) {
        console.log(`Skipping post ${post.id}: Already being processed.`);
        continue;
      }

      console.log(`Processing post: ${post.id}`);
      try {
        // Step 1: Media Container
        const res1 = await fetch(`https://graph.facebook.com/v22.0/${IG_USER_ID}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: post.image_url, caption: post.caption || "", access_token: TOKEN })
        });
        const data1 = await res1.json();
        if (!data1.id) throw new Error(data1.error?.message || "Container failed");

        // Step 2: Publish
        const res2 = await fetch(`https://graph.facebook.com/v22.0/${IG_USER_ID}/media_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: data1.id, access_token: TOKEN })
        });
        const data2 = await res2.json();
        if (!data2.id) throw new Error(data2.id || "Publish failed");

        await supabaseClient.from("instagram_posts").update({ status: "published", published_at: new Date().toISOString() }).eq("id", post.id);
        results.push({ id: post.id, status: "success" });
      } catch (e) {
        // ফেইল করলে স্ট্যাটাস 'failed' করে লজিক সেভ করা
        await supabaseClient.from("instagram_posts").update({ status: "failed", error_log: e.message }).eq("id", post.id);
        results.push({ id: post.id, error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
