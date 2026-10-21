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
  assert.match(site,/spotifyMobilePending=window\.innerWidth<=720&&!autoAdvance/);
  assert.match(site,/if\(spotifyMobilePending\)\{[\s\S]*?setSpotifyButtonState\(true\)/);
  assert.match(site,/if\(spotifyPlaybackConfirmed&&spotifyMobilePending\)clearMobileSpotifyPending\(\)/);
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


test("mobile first-screen logo, book and Renaissance no longer sit behind raster covers",()=>{
  assert.doesNotMatch(site,/background:url\("assets\/bio-background2\.webp/);
  assert.doesNotMatch(site,/class="site-parallax-bg"/);
  assert.doesNotMatch(site,/\.hero\{background:#000\}/);
  assert.match(site,/\.hero\{background:transparent\}/);
  assert.match(site,/\.record\{[\s\S]*?margin-top:0;[\s\S]*?background:transparent/);
  assert.match(site,/\.hero\{height:195svh;min-height:0;background:transparent\}/);
  assert.match(site,/class="hero-copy"/);
  assert.match(site,/<h1>Renaissance<\/h1>/);
  assert.match(site,/id="particle-field"/);
  assert.match(site,/sceneId==="logo"\|\|sceneId==="book"/);
});

test("mobile album swipe remains active outside playable song and link controls",()=>{
  assert.match(site,/mobileRecord\.addEventListener\("touchstart"/);
  assert.match(site,/mobileRecord\.addEventListener\("touchmove"/);
  assert.match(site,/\},\{passive:false\}\);/);
  assert.match(site,/mobileRecord\.addEventListener\("touchend"/);
  assert.match(site,/horizontal<46 \|\| horizontal<vertical\*1\.25/);
  assert.match(site,/selectAlbum\(ALBUMS\[nextIndex\]\.id\)/);
  assert.match(site,/e\.target\.closest\("\.track-col,\.album-credits,\.platforms,summary,a,\.track-index-control"\)/);
  assert.match(site,/\.album-tabs,\.cover-col,\.record-head\{touch-action:pan-y\}/);
});

test("mobile first tap opens Spotify control and no fake Pause before audio is confirmed",()=>{
  assert.match(site,/let spotifyMobilePending=false/);
  assert.match(site,/spotifyMobilePending=window\.innerWidth<=720&&!autoAdvance/);
  assert.match(site,/if\(spotifyMobilePending\)\{[\s\S]*?classList\.add\("is-pending"\)/);
  assert.match(site,/if\(spotifyMobilePending\)\{[\s\S]*?showSpotifyFallback\(\)/);
  assert.match(site,/if\(spotifyPlaybackConfirmed&&spotifyMobilePending\)clearMobileSpotifyPending\(\)/);
  assert.match(site,/if\(row\.classList\.contains\("is-pending"\)\)\{\s*showSpotifyFallback\(\)/);
  assert.match(site,/\.track-row\.is-pending \.track-index-control::after/);
});

test("mobile candles are real WebGL particles and are prepared before unseen albums",()=>{
  assert.match(site,/const queue=state\.width<=720/);
  assert.match(site,/\{type:"bio",id:"bio"\}/);
  assert.match(site,/prepareDiscSceneCandidates\(ref,false,"bio"\)/);
  assert.match(site,/buildDeferredBioScene\(ref,candidates,scene=>/);
  assert.match(site,/particleField\.setBiographyActive\(visible\)/);
  assert.doesNotMatch(site,/background:url\("assets\/bio-background2\.webp/);
});

test("mobile has the same four scene snap destinations and the desktop easing",()=>{
  assert.match(site,/function mobileSceneSnapTargets\(\)/);
  assert.match(site,/key:"logo",y:0/);
  assert.match(site,/key:"renaissance",y:clampY\(introRange\*\.54\)/);
  assert.match(site,/key:"discography",y:clampY\(recordTop\)/);
  assert.match(site,/key:"biography",y:clampY\(bioTop\)/);
  assert.match(site,/function animateMobileSceneSnap\(key\)/);
  assert.match(site,/html\.mobile-snapping\{scroll-behavior:auto!important\}/);
  assert.match(site,/const eased=t\*t\*t\*\(t\*\(t\*6-15\)\+10\)/);
  assert.match(site,/document\.documentElement\.classList\.add\("mobile-snapping"\)/);
  assert.match(site,/window\.scrollTo\(0,start\+distance\*eased\)/);
  assert.match(site,/mobileSnapAnimating&&mobileSnapTargetKey/);
  assert.match(site,/mobileSnapTargetKey==="biography"/);
  assert.match(site,/mobileSnapTargetKey==="discography"\|\|mobileSnapTargetKey==="biography"/);
  assert.match(site,/const shouldShowBio=state\.width>720/);
});

test("mobile snap leaves long tracklists, links, albums and natural reading usable",()=>{
  assert.match(site,/document\.addEventListener\("touchstart"/);
  assert.match(site,/document\.addEventListener\("touchmove"/);
  assert.match(site,/document\.addEventListener\("touchend"/);
  assert.match(site,/\{passive:false,capture:true\}/);
  assert.match(site,/button,a,input,textarea,select,summary,\.track-col,\.album-tabs,\.platforms,\.album-credits,\.spotify-preload-pool/);
  assert.match(site,/Math\.abs\(dy\)<Math\.abs\(dx\)\*1\.3/);
  assert.match(site,/function mobileSnapForGesture\(direction,startY\)/);
  assert.match(site,/if\(!mobileTouchCapturing\|\|!event\.changedTouches\.length\)return/);
  assert.match(site,/mobileRecord\.addEventListener\("touchend"/);
  assert.match(site,/cancelMobileSnap\(\)/);
  assert.match(site,/window\.innerWidth<=720/);
});

test("mobile snap gesture routing respects content boundaries",()=>{
  const start=site.indexOf("function mobileSnapForGesture(direction,startY){");
  const end=site.indexOf("// The global handler watches only page-level vertical swipes.",start);
  assert.ok(start>0&&end>start);
  const getSnap=new Function("window","mobileSceneSnapTargets",site.slice(start,end)+";return mobileSnapForGesture;");
  const route=getSnap({innerHeight:800},()=>[
    {key:"logo",y:0},
    {key:"renaissance",y:410},
    {key:"discography",y:1560},
    {key:"biography",y:4300}
  ]);
  assert.equal(route(1,0),"renaissance");
  assert.equal(route(1,420),"discography");
  assert.equal(route(-1,420),"logo");
  assert.equal(route(-1,1590),"renaissance");
  assert.equal(route(1,1600),null); // Native tracklist scroll
  assert.equal(route(1,2500),null); // Long discography does not become one slide
  assert.equal(route(1,3900),"biography");
  assert.equal(route(-1,4320),"discography");
  assert.equal(route(-1,5250),null); // Native biography reading
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
