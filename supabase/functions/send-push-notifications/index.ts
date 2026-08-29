// MÉTHODE TEE V414 — Web Push + vraie notification iOS APNs.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { sendApns, shouldDisableNativeToken } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@methodetee.app";
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return new Response(JSON.stringify({ok:false,error:"METHOD_NOT_ALLOWED"}),{status:405,headers:corsHeaders});
    const body = await req.json().catch(() => ({}));
    const title = String(body.title || "Méthode Tee");
    const message = String(body.body || "Un nouveau contenu t’attend ✨");
    const url = String(body.url || "/index.html");

    const [{data:webSubs,error:webError},{data:nativeTokens,error:nativeError}] = await Promise.all([
      admin.from("push_subscriptions").select("id,subscription").eq("enabled",true),
      admin.from("native_push_tokens").select("id,token").eq("enabled",true).eq("platform","ios"),
    ]);
    if (webError && webError.code !== "42P01") throw webError;
    if (nativeError && nativeError.code !== "42P01") throw nativeError;

    let webSent=0, webFailed=0, nativeSent=0, nativeFailed=0;
    for (const row of webSubs || []) {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify({title,body:message,url,icon:"/assets/app-icon-192.png",badge:"/assets/app-icon-192.png",tag:"methode-tee-post"}));
        webSent++;
      } catch (err) { webFailed++; console.error("Web push failed",row.id,err); }
    }
    for (const row of nativeTokens || []) {
      try {
        const result=await sendApns(row.token,{title,body:message,url,collapseId:"methode-tee-content"});
        if(result.ok){nativeSent++;continue;}
        nativeFailed++;
        console.error("APNs failed",row.id,result.status,result.reason);
        if(shouldDisableNativeToken(result.status,result.reason)) await admin.from("native_push_tokens").update({enabled:false,updated_at:new Date().toISOString()}).eq("id",row.id);
      } catch (err) { nativeFailed++; console.error("APNs exception",row.id,err); }
    }
    return new Response(JSON.stringify({ok:true,web:{sent:webSent,failed:webFailed},native:{sent:nativeSent,failed:nativeFailed},sent:webSent+nativeSent,failed:webFailed+nativeFailed}),{headers:corsHeaders});
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ok:false,error:String(err?.message||err)}),{status:500,headers:corsHeaders});
  }
});
