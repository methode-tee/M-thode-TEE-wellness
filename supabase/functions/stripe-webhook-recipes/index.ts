import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";
import { getAdminClient } from "../_shared/auth.ts";
import { queuePurchaseReport, queueRefundReport } from "../_shared/apple-external-reporting.ts";
const stripe=new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!,{apiVersion:"2024-06-20",httpClient:Stripe.createFetchHttpClient()});
Deno.serve(async(req)=>{
  try{
    if(req.method!=="POST")return new Response("METHOD_NOT_ALLOWED",{status:405});
    const signature=req.headers.get("stripe-signature"); if(!signature)return new Response("MISSING_STRIPE_SIGNATURE",{status:400});
    const secret=Deno.env.get("STRIPE_WEBHOOK_RECIPES_SECRET")||Deno.env.get("STRIPE_WEBHOOK_SECRET"); if(!secret)return new Response("MISSING_WEBHOOK_SECRET",{status:500});
    const event=await stripe.webhooks.constructEventAsync(await req.text(),signature,secret);
    if(event.type==="charge.refunded"){
      try{await queueRefundReport(event.id,event.data.object);}catch(e){console.error("APPLE_RECIPE_REFUND_QUEUE_ERROR",e);}
      return new Response(JSON.stringify({received:true}),{headers:{"Content-Type":"application/json"}});
    }
    if(event.type!=="checkout.session.completed")return new Response(JSON.stringify({received:true,ignored:true}),{headers:{"Content-Type":"application/json"}});
    const session=event.data.object as Stripe.Checkout.Session; const metadata=session.metadata||{};
    if(metadata.purchase_type!=="recipe")return new Response(JSON.stringify({received:true,ignored:true}),{headers:{"Content-Type":"application/json"}});
    const userId=metadata.user_id, recipeId=metadata.recipe_id, userEmail=metadata.user_email||session.customer_email||"";
    if(!userId||!recipeId)return new Response(JSON.stringify({error:"MISSING_RECIPE_METADATA",metadata}),{status:400,headers:{"Content-Type":"application/json"}});
    const supabase=getAdminClient();
    const {error}=await supabase.from("recipe_purchases").insert({user_id:userId,user_email:userEmail,recipe_id:recipeId,stripe_session_id:session.id,amount_total:session.amount_total||0,currency:session.currency||"eur",status:"active",purchased_at:new Date().toISOString()});
    if(error && !String(error.message).toLowerCase().includes("duplicate"))return new Response(JSON.stringify({error:"RECIPE_PURCHASE_INSERT_FAILED",details:error.message}),{status:400,headers:{"Content-Type":"application/json"}});
    try{await queuePurchaseReport(event.id,session);}catch(e){console.error("APPLE_RECIPE_REPORT_QUEUE_ERROR",e);}
    return new Response(JSON.stringify({received:true,unlocked:true,recipe_id:recipeId,user_id:userId}),{headers:{"Content-Type":"application/json"}});
  }catch(err){return new Response(JSON.stringify({error:err instanceof Error?err.message:"UNKNOWN_ERROR"}),{status:400,headers:{"Content-Type":"application/json"}});}
});
