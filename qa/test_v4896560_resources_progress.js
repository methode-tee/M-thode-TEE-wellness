const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname,'..','scripts','home-smart-cards.js'),'utf8');
const checks=[
 ['favorites exact count', "select('item_id',{count:'exact',head:true})"],
 ['routines exact count', "select('id',{count:'exact',head:true})"],
 ['favorite cards clickable', 'data-mt-home-favorite-id'],
 ['routine cards clickable', 'data-mt-home-routine-id'],
 ['resource benefit copy', 'prêts à retrouver en un geste'],
 ['word safe excerpt', 'homeCleanResourceExcerpt'],
 ['progress unavailable state', 'progressAvailable=false'],
 ['no fake zero copy', 'ne sont pas remplacées par un faux 0'],
 ['version guard', '__MT_HOME_SMART_CARDS_V4896560__']
];
let ok=true;
for(const [label,needle] of checks){const hit=src.includes(needle);console.log(`${hit?'OK':'FAIL'} ${label}`);if(!hit)ok=false;}
process.exit(ok?0:1);
