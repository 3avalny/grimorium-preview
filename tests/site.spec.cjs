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
    body:"window.__spotifyCreates=0;window.__spotifyLoads=[];window.__spotifyPlays=0;\nwindow.onSpotifyIframeApiReady({\n  createController(target,options,callback){\n    window.__spotifyCreates++;\n    const iframe=document.createElement(\"iframe\");\n    iframe.title=\"Spotify mock\";\n    target.appendChild(iframe);\n    let current=options.uri;\n    const listeners={};\n    const controller={\n      addListener(name,fn){\n        listeners[name]=fn;\n        if(name===\"ready\")setTimeout(()=>fn(),0);\n      },\n      loadEntity(uri){current=uri;window.__spotifyLoads.push(uri)},\n      play(){window.__spotifyPlays++;listeners.playback_started?.({data:{playingURI:current}})},\n      resume(){listeners.playback_started?.({data:{playingURI:current}})},\n      pause(){listeners.playback_update?.({data:{playingURI:current,isPaused:true}})}\n    };\n    callback(controller);\n  }\n});"
  }));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect.poll(()=>page.evaluate(()=>window.__spotifyCreates)).toBe(1);
  await expect(page.locator(".spotify-track-engine iframe")).toHaveCount(1);
  await page.locator('.disc-content-panel[data-album-id="reall"] .track').first().click();
  await expect.poll(()=>page.evaluate(()=>window.__spotifyPlays)).toBe(1);
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
