import { corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/auth.ts";
import { logSecurityEvent } from "../_shared/security.ts";
import { queuePurchaseReport, queueRefundReport } from "../_shared/apple-external-reporting.ts";

function hexToBytes(hex: string) { const b = new Uint8Array(hex.length/2); for(let i=0;i<b.length;i++) b[i]=parseInt(hex.slice(i*2,i*2+2),16); return b; }
function timingSafeEqual(a: Uint8Array,b: Uint8Array){ if(a.length!==b.length)return false; let out=0; for(let i=0;i<a.length;i++)out|=a[i]^b[i]; return out===0; }
async function verifyStripeSignature(body:string, header:string, secret:string){
  const parts=header.split(",").map(x=>x.trim()); const timestamp=parts.find(x=>x.startsWith("t="))?.slice(2); const signatures=parts.filter(x=>x.startsWith("v1=")).map(x=>x.slice(3));
  if(!timestamp||!signatures.length)return false; if(Math.abs(Date.now()/1000-Number(timestamp))>300)return false;
  const enc=new TextEncoder(); const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(`${timestamp}.${body}`)));
  return signatures.some(sig=>timingSafeEqual(digest,hexToBytes(sig)));
}
function response(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}})}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  try{
    if(req.method!=="POST")return response({error:"METHOD_NOT_ALLOWED"},405);
    const signature=req.headers.get("stripe-signature"); const secret=Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if(!signature||!secret)return response({error:"MISSING_SIGNATURE_OR_SECRET"},400);
    const body=await req.text(); if(!await verifyStripeSignature(body,signature,secret))return response({error:"INVALID_STRIPE_SIGNATURE"},400);
    const event=JSON.parse(body); const supabase=getAdminClient();

    if(event.type==="checkout.session.completed"){
      const session=event.data?.object; const metadata=session?.metadata||{}; const userId=metadata.user_id||null; const purchaseType=metadata.purchase_type||null; const protocolId=metadata.protocol_id||null;
      const userEmail=session.customer_email||session.customer_details?.email||metadata.user_email||null;
      if(purchaseType==="app_access"){
        if(!userId)throw new Error("MISSING_USER_ID_METADATA");
        const {error}=await supabase.from("profiles").update({has_app_access:true}).eq("id",userId); if(error)throw error;
        await logSecurityEvent(userId,"app_access_granted",{sessionId:session.id});
      }
      if(purchaseType==="protocol"||protocolId){
        if(!protocolId)throw new Error("MISSING_PROTOCOL_ID_METADATA"); if(!userId)throw new Error("MISSING_USER_ID_METADATA"); if(!userEmail)throw new Error("MISSING_USER_EMAIL");
        const accessPayload={user_id:userId,user_email:userEmail,protocol_id:protocolId,status:"active",unlocked:true,purchased_at:new Date().toISOString()};
        let {error}=await supabase.from("user_protocols").upsert(accessPayload,{onConflict:"user_id,protocol_id"});
        await supabase.from("user_protocols").update(accessPayload).eq("protocol_id",protocolId).ilike("user_email",userEmail);
        if(error){ const {error:updateError}=await supabase.from("user_protocols").update(accessPayload).eq("user_id",userId).eq("protocol_id",protocolId); if(updateError){const {error:insertError}=await supabase.from("user_protocols").insert(accessPayload);if(insertError)throw insertError;} }
        await logSecurityEvent(userId,"protocol_access_granted",{sessionId:session.id,protocolId,userEmail});
      }
      await supabase.from("payments").upsert({stripe_session_id:session.id,user_id:userId,user_email:userEmail,purchase_type:purchaseType,protocol_id:protocolId,amount_total:session.amount_total,currency:session.currency,status:session.payment_status,raw:session},{onConflict:"stripe_session_id"});
      try{await queuePurchaseReport(event.id,session);}catch(e){console.error("APPLE_REPORT_QUEUE_ERROR",e);}
    } else if(event.type==="charge.refunded") {
      try{await queueRefundReport(event.id,event.data?.object);}catch(e){console.error("APPLE_REFUND_QUEUE_ERROR",e);}
    }
    return response({received:true});
  }catch(err){const message=err instanceof Error?err.message:"WEBHOOK_ERROR";console.error("STRIPE_WEBHOOK_ERROR",message);return response({error:message},400);}
});
