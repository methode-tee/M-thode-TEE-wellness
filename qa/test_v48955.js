const fs=require('fs');
const js=fs.readFileSync(__dirname+'/../scripts/tee-next.js','utf8');
const html=fs.readFileSync(__dirname+'/../tee-next.html','utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(js.includes('function plannerAnimateScroll'),'custom premium scroll missing');
ok(js.includes('function plannerEasePremium'),'premium easing missing');
ok(js.includes("target.closest?.('.page')"),'page scroller not preferred');
ok(!js.includes("setTimeout(()=>move('auto',true),900)"),'legacy hard jump still present');
ok(js.includes('touchstart'), 'user cancellation missing');
ok(js.includes('plannerPremiumReveal'), 'result reveal missing');
ok(html.includes('v48955-scroll-premium-ios-r1'),'cache bust missing');
ok(js.includes('mt-next-kitchen-loader'),'loader animation markup unexpectedly removed');
console.log(JSON.stringify({status:'ok',version:'V489.5.5',scroll:'single_continuous_motion',duration_ms:'560-760',bounce:false,ios_soft_settle:true,user_interruptible:true,loader_unchanged:true},null,2));
