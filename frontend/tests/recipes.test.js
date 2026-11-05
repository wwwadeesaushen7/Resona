import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRecipe} from '../src/studio.js';
const defaults={mode:'beat',duration:60,variations:2,seed:null,key_scale:'',time_signature:'',tempo:120,rights_confirmed:false,preserve_source:false,instructions:'',instrumental:true};
const recipe=settings=>JSON.stringify({app:'Resona',version:1,settings});
test('portable recipes restore musical settings and require a fresh permission confirmation',()=>{
 const r=parseRecipe(recipe({key_scale:'D minor',time_signature:'3',seed:42,preserve_source:true,rights_confirmed:true}),defaults);
 assert.equal(r.settings.key_scale,'D minor');assert.equal(r.settings.seed,42);assert.equal(r.settings.rights_confirmed,false);assert.equal(r.settings.preserve_source,true);
});
test('rejects invalid settings and unrelated files',()=>{
 for(const settings of [{seed:-1},{duration:0},{time_signature:'5'},{mode:'fake'},{tempo:'120'},{instructions:'x'.repeat(2001)}])assert.throws(()=>parseRecipe(recipe(settings),defaults));
 assert.throws(()=>parseRecipe('{}',defaults));assert.throws(()=>parseRecipe('broken',defaults));
});
test('ignores unknown fields and inherited property names',()=>{
 const r=parseRecipe('{"app":"Resona","version":1,"settings":{"__proto__":{"polluted":true},"api_key":"secret","seed":0}}',defaults);
 assert.equal(r.settings.seed,0);assert.equal(r.settings.api_key,undefined);assert.equal({}.polluted,undefined);
});
