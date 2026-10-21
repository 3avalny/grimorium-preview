const {test,expect}=require("@playwright/test");

// The visual WebGL field is intentionally bypassed in functional smoke tests;
// full-density rendering remains a separate real-GPU/manual performance check.
async function disableWebGL(page){
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      if(type==="webgl"||type==="experimental-webgl"||type==="webgl2")return null;
      return original.call(this,type,...args);
    };
  });
}

test("without WebGL the loader unlocks and content is usable",async({page})=>{
  await disableWebGL(page);
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("body")).not.toHaveClass(/boot-loading/);
  await expect(page.locator("#boot-particle-loader")).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"Renaissance"})).toBeAttached();
  await expect(page.locator('.disc-content-panel[data-album-id="reall"]')).toHaveClass(/current/);
});

test("JavaScript-disabled visitors can browse the complete site",async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  const page=await context.newPage();
  try{
    await page.goto("/",{waitUntil:"domcontentloaded"});
    await expect(page.locator("noscript.nojs-fallback")).toBeVisible();
    await expect(page.locator(".nojs-album")).toHaveCount(5);
    await expect(page.locator(".nojs-album li")).toHaveCount(54);
    await expect(page.locator("#nojs-biography")).toBeVisible();
    const albumUrl=await page.locator(".nojs-album a.nojs-listen").first().getAttribute("href");
    expect(albumUrl).toContain("open.spotify.com/album/");
    await expect(page.locator(".boot-particle-loader")).toBeHidden();
  }finally{
    await context.close();
  }
});

test("a missing critical image cannot trap the visitor",async({page})=>{
  await page.route("**/assets/GV_PNG_bez_fona.png*",route=>route.fulfill({status:404,body:""}));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("body")).not.toHaveClass(/boot-loading/,{timeout:13000});
  await expect(page.locator("#boot-particle-loader")).toHaveCount(0);
});

test("original zoom and selection restrictions remain",async({page})=>{
  await disableWebGL(page);
  await page.goto("/",{waitUntil:"domcontentloaded"});
  const config=await page.evaluate(()=>({
    viewport:document.querySelector('meta[name="viewport"]').content,
    selectable:getComputedStyle(document.querySelector(".bio-copy p")).userSelect
  }));
  expect(config.viewport).toContain("user-scalable=no");
  expect(config.viewport).toContain("maximum-scale=1");
  expect(config.selectable).toBe("none");
  await expect(page.locator(".skip-link")).toHaveCount(0);
});

test("one prewarmed Spotify iframe plays and switches between albums",async({page})=>{
  await disableWebGL(page);
  await page.route("https://open.spotify.com/embed/iframe-api/v1",route=>route.fulfill({
    contentType:"application/javascript",
    body:"window.__spotifyCreates=0;window.__spotifyLoads=[];window.__spotifyPlays=0;\nwindow.onSpotifyIframeApiReady({\n  createController(target,options,callback){\n    window.__spotifyCreates++;\n    const iframe=document.createElement(\"iframe\");\n    iframe.title=\"Spotify mock\";\n    target.appendChild(iframe);\n    let current=options.uri;\n    const listeners={};\n    const controller={\n      addListener(name,fn){\n        listeners[name]=fn;\n        if(name===\"ready\")setTimeout(()=>fn(),0);\n      },\n      loadEntity(uri){current=uri;window.__spotifyLoads.push(uri)},\n      play(){window.__spotifyPlays++;listeners.playback_started?.({data:{playingURI:current}});listeners.playback_update?.({data:{playingURI:current,isPaused:true,position:0,duration:90000}});setTimeout(()=>listeners.playback_update?.({data:{playingURI:current,isPaused:false,position:600,duration:90000}}),380);setTimeout(()=>listeners.playback_update?.({data:{playingURI:current,isPaused:true,position:600,duration:90000}}),520);setTimeout(()=>listeners.playback_update?.({data:{playingURI:current,isPaused:false,position:650,duration:90000}}),700)},\n      resume(){listeners.playback_started?.({data:{playingURI:current}})},\n      pause(){listeners.playback_update?.({data:{playingURI:current,isPaused:true}})}\n    };\n    callback(controller);\n  }\n});"
  }));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect.poll(()=>page.evaluate(()=>window.__spotifyCreates)).toBe(1);
  await expect(page.locator(".spotify-track-engine iframe")).toHaveCount(1);
  await page.locator('.disc-content-panel[data-album-id="reall"] .track').first().click();
  await expect.poll(()=>page.evaluate(()=>window.__spotifyPlays)).toBe(1);
  const firstRow=page.locator('.disc-content-panel[data-album-id="reall"] .track-row').first();
  await expect(firstRow).toHaveClass(/is-playing/);
  await page.waitForTimeout(250);
  await expect(firstRow).toHaveClass(/is-playing/); // pending: paused event must not flash index
  await page.waitForTimeout(400);
  await expect(firstRow).toHaveClass(/is-playing/); // brief buffered pause after progress is debounced
  expect(await page.evaluate(()=>window.__spotifyLoads.length)).toBe(0);
  await page.locator('.album-tab[data-id="revenant"]').click();
  await page.locator('.disc-content-panel[data-album-id="revenant"] .track').first().click();
  await expect.poll(()=>page.evaluate(()=>window.__spotifyLoads.length)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.__spotifyPlays)).toBe(2);
  expect(await page.evaluate(()=>window.__spotifyCreates)).toBe(1);
  await expect(page.locator(".spotify-track-engine")).not.toHaveClass(/needs-interaction/);
});

test("blocked Spotify autoplay gives a native iframe and track link",async({page})=>{
  await disableWebGL(page);
  await page.route("https://open.spotify.com/embed/iframe-api/v1",route=>route.fulfill({
    contentType:"application/javascript",
    body:"window.onSpotifyIframeApiReady({\n  createController(target,options,callback){\n    const iframe=document.createElement(\"iframe\");target.appendChild(iframe);\n    const listeners={};\n    callback({\n      addListener(name,fn){\n        listeners[name]=fn;\n        if(name===\"ready\")setTimeout(fn,0);\n      },\n      play(){},resume(){},loadEntity(){},pause(){}\n    });\n  }\n});"
  }));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".spotify-track-engine iframe")).toHaveCount(1);
  await page.locator('.disc-content-panel[data-album-id="reall"] .track').first().click();
  await expect(page.locator(".spotify-track-engine")).toHaveClass(/needs-interaction/,{timeout:5000});
  await expect(page.locator(".spotify-fallback-hint a")).toHaveAttribute("href",/open.spotify.com\/track\//);
  await expect(page.locator(".spotify-fallback-dismiss")).toBeVisible();
  await page.locator(".spotify-fallback-dismiss").click();
  await expect(page.locator(".spotify-track-engine")).not.toHaveClass(/needs-interaction/);
});

test("real logo assembles in one permanent WebGL layer without bitmap handoff",async({page})=>{
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("canvas#particle-field")).toHaveCount(1);
  await expect(page.locator("canvas#boot-particle-loader")).toHaveCount(0);
  await expect(page.locator(".hero-light,.hero-rocks")).toHaveCount(0);
  const hasWebGL=await page.evaluate(()=>document.createElement("canvas").getContext("webgl")!==null);
  if(!hasWebGL){test.skip(true,"WebGL unavailable in this browser");return}
  await expect(page.locator("html")).toHaveClass(/particle-field-ready/,{timeout:20000});
  await expect(page.locator("html")).toHaveClass(/particle-assembly-complete/,{timeout:25000});
  await expect(page.locator("html")).not.toHaveClass(/particle-static-fallback/);
  await expect(page.locator("body")).not.toHaveClass(/boot-loading/);
  const opacity=await page.locator(".brand img").evaluate(el=>getComputedStyle(el).opacity);
  expect(opacity).toBe("0");
});


test("mobile discography exposes all songs, playable controls, and album switching",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await disableWebGL(page);
  await page.route("https://open.spotify.com/embed/iframe-api/v1",route=>route.fulfill({
    contentType:"application/javascript",
    body:"window.onSpotifyIframeApiReady({createController(target,options,cb){const iframe=document.createElement('iframe');target.appendChild(iframe);let uri=options.uri;const events={};cb({addListener(name,fn){events[name]=fn;if(name==='ready')setTimeout(fn,0)},loadEntity(next){uri=next},play(){events.playback_started?.({data:{playingURI:uri}})},pause(){events.playback_update?.({data:{playingURI:uri,isPaused:true}})},resume(){events.playback_started?.({data:{playingURI:uri}})}})}});"
  }));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".track-col").first()).toBeVisible();
  const panel=page.locator('.disc-content-panel[data-album-id="reall"]');
  await expect(panel.locator(".track-row")).toHaveCount(11);
  await expect(panel.locator(".mobile-track-heading")).toBeVisible();
  await panel.locator(".mobile-track-heading").click();
  await expect(panel.locator(".mobile-track-toggle")).not.toHaveAttribute("open","");
  await panel.locator(".mobile-track-heading").click();
  await expect(panel.locator(".mobile-track-toggle")).toHaveAttribute("open","");
  await panel.locator(".track-index-control").first().click();
  await expect(panel.locator(".track-row").first()).toHaveClass(/is-playing/);
  await expect(panel.locator(".track-index-control").first()).toHaveAttribute("aria-label","Pause");
  await page.locator('.album-tab[data-id="retaliation"]').click();
  const next=page.locator('.disc-content-panel[data-album-id="retaliation"]');
  await expect(next).toHaveClass(/current/);
  await expect(next.locator(".track-row")).toHaveCount(15);
  await expect(next.locator(".track-col")).toBeVisible();
  await expect(page.locator(".spotify-track-engine iframe")).toHaveCount(1);
});

test("mobile and desktop biography have matching full historical copy",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await disableWebGL(page);
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator(".bio-mobile")).toBeVisible();
  const paragraphs=await page.evaluate(()=>({
    desktop:[...document.querySelectorAll(".bio-desktop p")].map(p=>p.textContent.trim()),
    mobile:[...document.querySelectorAll(".bio-mobile p")].map(p=>p.textContent.trim())
  }));
  expect(paragraphs.desktop).toEqual(paragraphs.mobile);
  expect(paragraphs.mobile).toHaveLength(3);
  await expect(page.locator(".mobile-bio-figure")).toHaveCount(0);
});


test("mobile logo and Renaissance are not covered by raster or opaque section backgrounds",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await disableWebGL(page);
  await page.goto("/",{waitUntil:"domcontentloaded"});
  const styles=await page.evaluate(()=>({
    hero:getComputedStyle(document.querySelector(".hero")).backgroundColor,
    recordImage:getComputedStyle(document.querySelector(".record")).backgroundImage,
    recordColor:getComputedStyle(document.querySelector(".record")).backgroundColor,
    webglCanvas:!!document.querySelector("canvas#particle-field"),
    heroHeight:document.querySelector(".hero").getBoundingClientRect().height
  }));
  expect(styles.hero).toBe("rgba(0, 0, 0, 0)");
  expect(styles.recordImage).toBe("none");
  expect(styles.recordColor).toBe("rgba(0, 0, 0, 0)");
  expect(styles.webglCanvas).toBe(true);
  expect(styles.heroHeight).toBeGreaterThan(844);
  await expect(page.locator(".hero h1")).toHaveText("Renaissance");
  await expect(page.locator(".site-parallax-bg")).toHaveCount(0);
});

test("horizontal swipe on mobile album artwork changes albums while preserving layout",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await disableWebGL(page);
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator('.album-tab[data-id="reall"]')).toHaveClass(/active/);
  await page.evaluate(()=>{
    const cover=document.querySelector('.disc-content-panel[data-album-id="reall"] .cover');
    const make=(type,x,y)=>{
      const event=new Event(type,{bubbles:true,cancelable:true});
      Object.defineProperty(event,type==="touchstart"?"touches":"changedTouches",{value:[{clientX:x,clientY:y}]});
      cover.dispatchEvent(event);
    };
    make("touchstart",315,480);
    make("touchend",95,486);
  });
  await expect(page.locator('.album-tab[data-id="revenant"]')).toHaveClass(/active/);
  await expect(page.locator('.disc-content-panel[data-album-id="revenant"]')).toHaveClass(/current/);
});

test("mobile first tap reveals native Spotify player instead of premature Pause",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await disableWebGL(page);
  await page.route("https://open.spotify.com/embed/iframe-api/v1",route=>route.fulfill({
    contentType:"application/javascript",
    body:"window.onSpotifyIframeApiReady({createController(target,options,callback){const iframe=document.createElement('iframe');target.appendChild(iframe);let uri=options.uri;const events={};window.__confirmSpotify=()=>events.playback_update?.({data:{playingURI:uri,isPaused:false,position:500,duration:90000}});callback({addListener(name,fn){events[name]=fn;if(name==='ready')setTimeout(fn,0)},loadEntity(next){uri=next},play(){events.playback_started?.({data:{playingURI:uri}})},resume(){},pause(){}})}});"
  }));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  const row=page.locator('.disc-content-panel[data-album-id="reall"] .track-row').first();
  await row.locator(".track").click();
  await expect(row).toHaveClass(/is-pending/);
  await expect(row).not.toHaveClass(/is-playing/);
  await expect(page.locator(".spotify-track-engine")).toHaveClass(/needs-interaction/);
  await expect(page.locator(".spotify-track-engine iframe")).toHaveCount(1);
  await page.evaluate(()=>window.__confirmSpotify());
  await expect(row).not.toHaveClass(/is-pending/);
  await expect(row).toHaveClass(/is-playing/);
  await expect(page.locator(".spotify-track-engine")).not.toHaveClass(/needs-interaction/);
});

test("mobile vertical swipes snap logo to Renaissance to discography and back",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await disableWebGL(page);
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("body")).not.toHaveClass(/boot-loading/);
  const swipe=async(selector,start,end)=>{
    await page.evaluate(({selector,start,end})=>{
      const target=document.querySelector(selector);
      const emit=(type,x,y)=>{
        const event=new Event(type,{bubbles:true,cancelable:true});
        Object.defineProperty(event,"touches",{value:type==="touchend"?[]:[{clientX:x,clientY:y}]});
        Object.defineProperty(event,"changedTouches",{value:[{clientX:x,clientY:y}]});
        target.dispatchEvent(event);
      };
      emit("touchstart",190,start);
      emit("touchmove",190,end);
      emit("touchend",190,end);
    },{selector,start,end});
  };

  await swipe(".hero-inner",680,420);
  await expect.poll(()=>page.evaluate(()=>Math.abs(window.scrollY-Math.round(introRange*.54)))).toBeLessThan(3);
  await expect(page.locator("html")).not.toHaveClass(/mobile-snapping/);

  await swipe(".hero-inner",670,390);
  await expect.poll(()=>page.evaluate(()=>
    Math.abs(window.scrollY-Math.round(document.querySelector(".record").getBoundingClientRect().top+window.scrollY))
  )).toBeLessThan(3);

  await swipe(".record-head",260,505);
  await expect.poll(()=>page.evaluate(()=>Math.abs(window.scrollY-Math.round(introRange*.54)))).toBeLessThan(3);
});

test("mobile page gestures ignore track controls and preserve horizontal album swipes",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await disableWebGL(page);
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await page.evaluate(()=>window.scrollTo(0,document.querySelector(".record").offsetTop+360));
  const start=await page.evaluate(()=>window.scrollY);
  await page.evaluate(()=>{
    const track=document.querySelector('.disc-content-panel[data-album-id="reall"] .track');
    const emit=(type,x,y)=>{
      const event=new Event(type,{bubbles:true,cancelable:true});
      Object.defineProperty(event,"touches",{value:type==="touchend"?[]:[{clientX:x,clientY:y}]});
      Object.defineProperty(event,"changedTouches",{value:[{clientX:x,clientY:y}]});
      track.dispatchEvent(event);
    };
    emit("touchstart",175,530);
    emit("touchmove",175,310);
    emit("touchend",175,310);
  });
  await page.waitForTimeout(80);
  expect(await page.evaluate(()=>window.scrollY)).toBe(start);
  await expect(page.locator("html")).not.toHaveClass(/mobile-snapping/);

  await page.evaluate(()=>{
    const cover=document.querySelector('.disc-content-panel[data-album-id="reall"] .cover');
    const emit=(type,x,y)=>{
      const event=new Event(type,{bubbles:true,cancelable:true});
      Object.defineProperty(event,"touches",{value:type==="touchend"?[]:[{clientX:x,clientY:y}]});
      Object.defineProperty(event,"changedTouches",{value:[{clientX:x,clientY:y}]});
      cover.dispatchEvent(event);
    };
    emit("touchstart",310,400);
    emit("touchmove",95,405);
    emit("touchend",95,405);
  });
  await expect(page.locator('.album-tab[data-id="revenant"]')).toHaveClass(/active/);
  await expect(page.locator("html")).not.toHaveClass(/mobile-snapping/);
});
