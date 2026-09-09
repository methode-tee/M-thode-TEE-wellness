#!/usr/bin/env node
'use strict';
const fs=require('fs'),assert=require('assert'),path=require('path');
const js=fs.readFileSync(path.join(__dirname,'..','scripts','tee-next.js'),'utf8');
const sql=fs.readFileSync(path.join(__dirname,'..','supabase','V48921_ROTATION_CULTURE_FORMATS_CIQUAL_RENFORCE.sql'),'utf8');
assert.equal((js.match(/function stableHash32\(/g)||[]).length,1);
for(const n of ['ciqualAssemblyQuality','isEligibleCiqualAssembly','_assemblyQuality:quality'])assert(js.includes(n),n);
for(const n of ["format_max_age_days',365","price_max_age_days',120","stale_package_price_used',false","ciqual_universe_v1","ciqual_price_batch_v1"])assert(sql.includes(n),n);
console.log(JSON.stringify({status:'ok_static_v48921'},null,2));
