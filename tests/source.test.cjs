const {test}=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const vm=require("node:vm");
const site=readFileSync("index.html","utf8");

test("inline application script parses",()=>{
  const scripts=[...site.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(match=>match[1]).filter(Boolean);
  assert.ok(scripts.length>0);
  for(const script of scripts)new vm.Script(script,{filename:"index.html"});
});

test("full-resolution particle budget and DPR are preserved",()=>{
  assert.match(site,/base=240000/);
  assert.match(site,/initialGeometryQuality=1/);
  assert.match(site,/state\.dpr=Math\.min\(window\.devicePixelRatio\|\|1,2\)/);
});

test("loader has a real independent unlock fallback",()=>{
  assert.match(site,/const forceComplete=\(\)=>/);
  assert.match(site,/document\.body\.classList\.remove\("boot-loading"\)/);
  assert.match(site,/if\(!finished\)forceComplete\(\)/);
  assert.match(site,/grimoriumBootLoader\?\.forceComplete\?\.\(\)/);
});

test("Spotify controller is one-per-page, prewarmed, and Safari-safe",()=>{
  assert.equal((site.match(/spotifyIframeAPI\.createController\(/g)||[]).length,1);
  assert.match(site,/window\.setTimeout\(ensureSpotifyController,0\)/);
  assert.match(site,/if\(spotifyLoadedUri!==requested\.uri\)/);
  assert.match(site,/spotifyController\.loadEntity\(requested\.uri\)/);
  assert.match(site,/spotifyController\.play\(\)/);
  assert.match(site,/function showSpotifyFallback\(\)/);
  assert.match(site,/shell\.classList\.add\("needs-interaction"\)/);
  assert.match(site,/spotifyFallbackLink\.href=spotifyTrackLink\(uri\)/);
  assert.doesNotMatch(site,/<script src="https:\/\/open\.spotify\.com\/embed\/iframe-api\/v1"/);
  assert.doesNotMatch(site,/ensureSpotifyAlbumControllers\(/);
});

test("original zoom and text-selection restrictions stay unchanged",()=>{
  assert.match(site,/maximum-scale=1,user-scalable=no/);
  assert.match(site,/user-select:none!important/);
  assert.match(site,/Hard-disable page zoom everywhere/);
  assert.match(site,/gesturestart/);
  assert.doesNotMatch(site,/class="skip-link"/);
});

test("site always uses the animated scene and does not branch on Reduce Motion",()=>{
  assert.doesNotMatch(site,/prefers-reduced-motion|reducedMotionQuery|reducedMotion/i);
  assert.match(site,/createParticleField\(\)/);
  assert.match(site,/const birthWindow=Math\.min\(14,dt\*\.9\)/);
});

test("JavaScript-off page is standalone, linked, and contains every album",()=>{
  assert.match(site,/<noscript class="nojs-fallback">/);
  assert.match(site,/body\.boot-loading\{overflow:auto!important\}/);
  const start=site.indexOf('<noscript class="nojs-fallback">');
  const end=site.indexOf('</noscript>',start);
  const fallback=site.slice(start,end);
  assert.equal((fallback.match(/<article class="nojs-album">/g)||[]).length,5);
  assert.equal((fallback.match(/<li>/g)||[]).length,54);
  assert.match(fallback,/id="nojs-biography"/);
  assert.match(fallback,/mailto:contact@grimorium-verum\.ru/);
  assert.match(fallback,/https:\/\/open\.spotify\.com\/album\//);
});
