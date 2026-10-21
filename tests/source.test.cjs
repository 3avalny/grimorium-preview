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

test("the only visible logo is actual permanent WebGL particles",()=>{
  assert.equal((site.match(/<canvas id="particle-field"/g)||[]).length,1);
  assert.doesNotMatch(site,/boot-particle-loader|bootLoaderCanvas|buildBootstrapParticles/);
  assert.doesNotMatch(site,/<img class="hero-light"|<img class="hero-rocks"/);
  assert.doesNotMatch(site,/id="particleAlbumDebug"/);
  assert.match(site,/const source=introBrandImg/);
  assert.match(site,/\.brand img\{opacity:0\}/);
  assert.match(site,/html\.particle-static-fallback \.brand img\{opacity:1!important\}/);
  assert.match(site,/"uniform float u_assembly;"/);
  assert.match(site,/gl\.uniform1f\(pLoc\.assembly,state\.assemblyProgress\)/);
  assert.match(site,/float assemblyOpacity=smoother\(\(assemblyPhase-/);
  assert.match(site,/v_alpha=passAlpha\*visible\*assemblyOpacity/);
});

test("loader unlocks only after actual assembly or a safe timeout",()=>{
  assert.match(site,/completeWhenAssembled\(progress\)/);
  assert.match(site,/ready&&progress>=1/);
  assert.match(site,/classList\.add\("particle-assembly-complete"\)/);
  assert.match(site,/completeWhenAssembled\?\.\(state\.assemblyProgress\)/);
  assert.match(site,/window\.setTimeout\(\(\)=>finish\(\),12000\)/);
  assert.match(site,/document\.body\.classList\.remove\("boot-loading"\)/);
  assert.match(site,/source\.addEventListener\("error"/);
  assert.match(site,/grimoriumBootLoader\?\.forceComplete\?\.\(\{fallback:true\}\)/);
});

test("native source and book are not replaced with a low resolution layer",()=>{
  assert.match(site,/sceneId==="logo"\|\|sceneId==="book"/);
  assert.match(site,/\?1\s*:\(bootLight/);
  assert.match(site,/Math\.min\(dt\|\|16,42\)\/3400/);
  assert.doesNotMatch(site,/fullHandoffRequested|fullHandoffStarted|onHandoffReady/);
  assert.match(site,/Math\.abs\(window\.innerHeight-state\.height\)<96/);
});

test("intro particles are truly invisible until independently born",()=>{
  // The original bug: the sharp reconstruction pass overwrote the alpha
  // applied only to the base pass, exposing a giant dusty halo on frame one.
  assert.match(site,/float assemblyOrder=fract\(a_seed\.x/);
  assert.match(site,/float assemblyDelay=\.028\+\.11\*assemblyOrder\+\.38\*assemblyRegion/);
  assert.match(site,/float assemblyDuration=\.19\+\.17\*a_seed\.w\+\.09\*assemblyRegion/);
  assert.match(site,/float assemblyOpacity=smoother\(\(assemblyPhase-\.31\)\/\.60\)/);
  assert.match(site,/if\(u_assembly<1\.0&&assemblyPhase<=\.31\)/);
  assert.match(site,/gl_Position=vec4\(2\.0,2\.0,0\.0,1\.0\)/);
  assert.match(site,/v_alpha=0\.0/);
  assert.match(site,/v_alpha=passAlpha\*visible\*assemblyOpacity/);
  assert.doesNotMatch(site,/v_alpha=passAlpha\*visible;/);
  assert.doesNotMatch(site,/float arrival=smoother\(\(u_assembly-/);
});

test("smoky paths re-use the interactive curl field without changing the final logo",()=>{
  assert.match(site,/vec2 assemblyFlow=curlFlow\(assemblyP/);
  assert.match(site,/assemblyEddyPhase/);
  assert.match(site,/assemblySpiralSign/);
  assert.match(site,/smokeDisplacement\+=assemblyFlow/);
  assert.match(site,/pos\+=smokeDisplacement/);
  assert.match(site,/if\(u_assembly<1\.0\)\{/);
  assert.match(site,/if\(material>\.001\)\{\s*gl\.enable\(gl\.BLEND\)/);
  // Latest possible arrival finishes before progress reaches 1.
  const maxDelay=.028+.11+.38;
  const maxDuration=.19+.17+.09;
  assert.ok(maxDelay+maxDuration<1);
  // Each particle is transparent at progress zero regardless of its seed.
  for(let i=0;i<=100;i++){
    const order=i/100;
    const delay=.028+.11*order+.38*.5;
    const duration=.19+.17*(1-order)+.09*.5;
    const start=Math.max(0,Math.min(1,(0-delay)/duration));
    const end=Math.max(0,Math.min(1,(1-delay)/duration));
    assert.equal(start,0);
    assert.equal(end,1);
  }
});

test("regional assembly is uneven but finishes before 100%",()=>{
  assert.match(site,/assemblyRegion=clamp/);
  assert.match(site,/assemblyEarly=exp/);
  assert.match(site,/assemblyLate=exp/);
  assert.match(site,/assemblyTail=exp/);
  assert.match(site,/assemblyWave=/);
  assert.match(site,/assemblyEddyPhase=/);
  const fastest=.028+.11*.5+.38*.10;
  const slowest=.028+.11*.5+.38*.85;
  assert.ok(slowest-fastest>.2);
  assert.ok(.028+.11+.38+.19+.17+.09<1);
});

test("pause icon stays stationary when hovered",()=>{
  assert.match(site,/\.track-row\.is-playing \.track-index-control:hover\{\s*transform:none/);
});

test("Spotify controller is one-per-page, prewarmed, and Safari-safe",()=>{
  assert.equal((site.match(/spotifyIframeAPI\.createController\(/g)||[]).length,1);
  assert.match(site,/grimoriumBootLoader\.onComplete\(warmSpotifyWhenIdle\)/);
  assert.doesNotMatch(site,/window\.setTimeout\(ensureSpotifyController,0\)/);
  assert.match(site,/if\(spotifyLoadedUri!==requested\.uri\)/);
  assert.match(site,/spotifyController\.loadEntity\(requested\.uri\)/);
  assert.match(site,/spotifyController\.play\(\)/);
  assert.match(site,/function showSpotifyFallback\(\)/);
  assert.match(site,/shell\.classList\.add\("needs-interaction"\)/);
  assert.match(site,/spotifyFallbackLink\.href=spotifyTrackLink\(uri\)/);
  assert.doesNotMatch(site,/<script src="https:\/\/open\.spotify\.com\/embed\/iframe-api\/v1"/);
  assert.doesNotMatch(site,/ensureSpotifyAlbumControllers\(/);
});

test("Spotify buffering never flashes track index between play events",()=>{
  assert.match(site,/spotifyPlaybackConfirmed=false/);
  assert.match(site,/setSpotifyButtonState\(false\);\s*spotifyAnnounce\("Loading Spotify playback"\)/);
  assert.match(site,/else if\(spotifyPlaybackConfirmed\)\{/);
  assert.match(site,/spotifyPauseRecheckTimer=window\.setTimeout/);
  assert.match(site,/clearSpotifyPauseRecheck\(\)/);
  assert.match(site,/spotifyVisualKey===visualKey/);
  assert.match(site,/if\(spotifyCurrent\.position>40\)spotifyPlaybackConfirmed=true/);
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
  assert.match(site,/"uniform float u_assembly;"/);
});

test("mobile has an interactive tracklist for each album",()=>{
  assert.match(site,/class="mobile-track-toggle" open/);
  assert.match(site,/class="mobile-track-heading"/);
  assert.match(site,/a\.tracks\.length\} tracks/);
  assert.match(site,/\.track-col\{\s*display:block!important/);
  assert.match(site,/\.track-row \.track-title\{\s*font-size:clamp/);
  assert.match(site,/\.track-index-control\{[\s\S]*?transform:none!important/);
  assert.match(site,/mobileRecord\.addEventListener\("touchstart"/);
  assert.match(site,/e\.target\.closest\("\.track-col,\.album-credits,\.platforms,summary,a,\.track-index-control"\)/);
});

test("mobile logo retains dense native GPU rendering and asymmetric smoke",()=>{
  assert.match(site,/base=particleMix\(36000,52000/);
  assert.match(site,/base=particleMix\(52000,58000/);
  assert.match(site,/base=particleMix\(58000,64000/);
  assert.match(site,/base=240000/);
  assert.match(site,/float assemblyRegion=clamp/);
  assert.match(site,/vec2 assemblyFlow=curlFlow/);
  assert.match(site,/const source=introBrandImg/);
  assert.doesNotMatch(site,/prefers-reduced-motion/);
});

test("mobile gets exactly the desktop biography copy and the candle scene",()=>{
  const desktop=site.slice(site.indexOf('<div class="bio-desktop">'),site.indexOf('<div class="bio-mobile">'));
  const mobile=site.slice(site.indexOf('<div class="bio-mobile">'),site.indexOf('</section>',site.indexOf('<div class="bio-mobile">')));
  const paras=block=>[...block.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(match=>match[1]);
  assert.equal(paras(desktop).length,3);
  assert.deepEqual(paras(mobile),paras(desktop));
  assert.match(site,/let mobileBiographyActive=null/);
  assert.match(site,/particleField\.setBiographyActive\(visible\)/);
  assert.match(site,/grimoriumBootLoader\?\.onComplete\?\.\(requestScenes\)/);
  assert.match(site,/\.spotify-track-engine\.needs-interaction iframe\{/);
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
