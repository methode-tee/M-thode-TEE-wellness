#!/usr/bin/env node
'use strict';
global.window=global;
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
for(const f of ['food-ciqual-index.js','food-inspiration-kb.js','food-inspiration-affinities.js','food-cultural-index.js','food-universal-engine.js']) require(path.join(ROOT,'scripts',f));
const E=global.MTFoodUniversalEngine;
const CI=global.MT_CIQUAL_INDEX||[];
const INTENTS=['equilibre','digestion','energie','construire','legerete','gourmandise'];
const CURATED_VARIANTS=process.env.QA_FULL==='1'?4:1;
const PAIR_MOD=process.env.QA_FULL==='1'?2:8;
const curated=[
 ['pâtes','lardons','haricots'],['fraise','menthe','eau'],['banane plantain','riz cantonais','saumon'],
 ['lait de coco','framboise','myrtille'],['yaourt grec','fraise','framboise'],['laitue','riz','steak haché'],
 ['manioc','dorade','gombo'],['blancs de poulet','citron jaune','moutarde'],['pâtes','morceaux de poulet','feuilles de salade'],
 ['attiéké','poulet','salade'],['dorade','tomates','oignon'],['lait d’avoine','vanille','miel'],['riz','curry','thon'],
 ['farine de blé noir','œufs','lait'],['boules de glace vanille','café','amaretto'],['petits pains précuits','St Môret','blanc de poulet'],
 ['farine','sucre en poudre','cacao non sucré'],['pâte feuilletée','crème fraîche','lardons'],['burrata','avocat','tomates cerises'],
 ['coquillettes','vin blanc sec','fromage de chèvre'],['oignons','ail','aubergines'],['bœuf haché','pommes de terre','oignon'],
 ['pommes de terre grenailles','huile d’olive','beurre'],['pommes de terre','salade iceberg','tomates'],['ailes de poulet','pâtes','huile de tournesol'],
 ['pâte sablée','chocolat pâtissier','crème liquide'],['pommes de terre','crème fraîche','lait'],['courgettes','pommes de terre','ail'],
 ['riz basmati','œufs','oignon'],['thon','citron vert','crème fraîche'],['bœuf','oignon','poivron'],['pavés de saumon','carottes','brocolis'],
 ['amandes en poudre','beurre','farine'],['courgettes','ricotta','lardons'],['chou','tomates','oignon'],['pinsa','Saint Môret','crème fraîche'],
 ['concombre','maïs','oignon rouge'],['sirop de fraise','Sprite','citron vert'],['pâte à pizza','huile de tournesol','oignon'],
 ['cœur de saumon','citron vert','vinaigre'],['bœuf haché','échalotes','ciboulette'],['poulet','olives vertes','tomates pelées'],
 ['poulet entier','moutarde','tomate concentrée'],['pain bruschetta','béchamel','jambon'],['pavés de saumon','huile d’olive','beurre'],
 ['pilons de poulet','sweet chili','sauce soja sucrée'],['tomates','concombre','poivron vert'],['fruits de mer','quenelle','beurre'],
 ['escalopes de poulet','biscottes','farine'],['pain panini','crème fraîche','parmesan'],['mini pains','huile d’olive','oignon'],
 ['ailes de poulet','moutarde','huile de tournesol'],['rôti de bœuf','pommes de terre grenailles','huile d’olive'],
 ['chocolat noir','œufs','sucre en poudre'],['œufs','lait','sucre'],['sucre','farine','levure'],['salade sucrine','concombre','tomate'],
 ['eau pétillante','citron','menthe'],['plantain','poulet','poivron','oignon'],['mozzarella','tomate','basilic'],
 ['chikwangue','poisson','feuilles de manioc'],['ndolè','plantain','crevettes'],['jollof','poulet','salade'],['waakye','œuf','avocat'],
 ['biryani','poulet','raita'],['pho','bœuf','herbes'],['nasi goreng','crevettes','concombre'],['couscous','merguez','courgettes'],
 ['taboulé','saumon','avocat'],['ratatouille','œufs','pain'],['risotto','champignons','parmesan'],['salade grecque','pain pita','poulet']
];
const failures=[],warnings=[];
let generated=0;
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function checkProposal(ingredients,intent,v,p,ctx){
 generated++;
 if(!p||!p.title||!p.preparation||!Array.isArray(p.missing)){failures.push({type:'empty',ingredients,intent,v,ctx});return;}
 const val=p.validation||E.validateProposal({ingredients,proposal:p});
 if(!val.valid||val.score<72) failures.push({type:'invalid',ingredients,intent,v,title:p.title,score:val.score,reasons:val.reasons,ctx});
 const s=norm(p.title+' '+p.preparation);
 const a=E.analyze(ingredients);
 const bsub=(p.diagnostics||{}).beverageSubtype;
 if(bsub==='water_fruit' && /latte|boisson chaude|cafe au lait|chai|matcha latte/.test(s)) failures.push({type:'water_hot_latte',ingredients,intent,v,title:p.title,ctx});
 if((a.items||[]).some(x=>x.preparedProfile)){
   const labels=(a.items||[]).filter(x=>x.preparedProfile).map(x=>norm(x.preparedProfile.label||x.name));
   if(labels.length&&!labels.some(l=>norm(p.title).includes(l.split(' ')[0]))) warnings.push({type:'prepared_identity_title',ingredients,intent,v,title:p.title,labels,ctx});
 }
}
// Curated regression: five variants per intent.
for(const ingredients of curated){
 for(const intent of INTENTS){
  const titles=[];
  for(let v=0;v<CURATED_VARIANTS;v++){
   let p; try{p=E.suggest({ingredients,intent,variant:v,history:[]});}catch(err){failures.push({type:'throw',ingredients,intent,v,error:String(err)});continue;}
   checkProposal(ingredients,intent,v,p,'curated');
   if(p?.title) titles.push(norm(p.title));
  }
  if(new Set(titles.slice(0,3)).size<Math.min(3,titles.length)) warnings.push({type:'title_collision',ingredients,intent,titles:titles.slice(0,3),ctx:'curated'});
 }
}
// All CIQUAL labels must classify and not throw.
let ciqualClassified=0, ciqualUnclassified=[];
for(const [name,cat] of CI){
 try{
   const a=E.analyze([name]);
   const it=a?.items?.[0];
   if(it&&(it.category||it.roles?.length||it.traits?.length)){ciqualClassified++;}
   else if(ciqualUnclassified.length<30) ciqualUnclassified.push([name,cat]);
 }catch(err){if(ciqualUnclassified.length<30)ciqualUnclassified.push([name,cat,String(err)]);}
}
if(ciqualClassified<CI.length) warnings.push({type:'ciqual_unclassified',count:CI.length-ciqualClassified,samples:ciqualUnclassified});
// One representative per CIQUAL category. The exhaustive pair matrix is
// opt-in because it is intentionally expensive; the default regression suite
// focuses on all CIQUAL labels plus curated high-risk combinations.
const reps=new Map();for(const row of CI){if(!reps.has(row[1]))reps.set(row[1],row[0]);}
const repRows=[...reps.entries()];
let pairGenerated=0;
if(process.env.QA_FULL==='1'){
 for(let x=0;x<repRows.length;x++) for(let y=x;y<repRows.length;y++){
  if(((x*31+y)%PAIR_MOD)!==0) continue;
  const ingredients=[repRows[x][1],repRows[y][1]];
  const intent='equilibre';
  let p;try{p=E.suggest({ingredients,intent,variant:(x+y)%4,history:[]});}catch(err){failures.push({type:'pair_throw',ingredients,intent,error:String(err)});continue;}
  pairGenerated++;checkProposal(ingredients,intent,0,p,'ciqual_category_pair');
 }
}
// Strong invariants for the three user-reported regressions.
for(const intent of INTENTS){
 for(let v=0;v<6;v++){
  const a=E.suggest({ingredients:['pâtes','lardons','haricots'],intent,variant:v,history:[]});
  if(!/p[aâ]tes/.test(norm(a.title))||!/lardon/.test(norm(a.title))||!/haricot/.test(norm(a.title))) failures.push({type:'target_pasta_identity',intent,v,title:a.title});
  const b=E.suggest({ingredients:['fraise','menthe','eau'],intent,variant:v,history:[]});
  if(!/fraise/.test(norm(b.title))||!/menthe/.test(norm(b.title))||/latte|boisson chaude/.test(norm(b.title))) failures.push({type:'target_water_identity',intent,v,title:b.title});
  const c=E.suggest({ingredients:['banane plantain','riz cantonais','saumon'],intent,variant:v,history:[]});
  const nt=norm(c.title);if(!/plantain/.test(nt)||!/riz cantonais/.test(nt)||!/saumon/.test(nt)) failures.push({type:'target_prepared_identity',intent,v,title:c.title});
 }
}
const summary={engine:E.version,ciqualEntries:CI.length,ciqualClassified,categories:repRows.length,curatedCases:curated.length,intents:INTENTS.length,generated,pairGenerated,failures:failures.length,warnings:warnings.length};
console.log(JSON.stringify(summary,null,2));
if(failures.length){console.log('FAILURES',JSON.stringify(failures.slice(0,40),null,2));}
if(warnings.length){console.log('WARNINGS',JSON.stringify(warnings.slice(0,30),null,2));}
process.exit(failures.length?1:0);
