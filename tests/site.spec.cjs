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

test("reduced-motion users bypass animation and reach content",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("body")).not.toHaveClass(/boot-loading/);
  await expect(page.locator("#music")).toBeAttached();
});

test("a missing critical image cannot trap the visitor",async({page})=>{
  await page.route("**/assets/GV_PNG_bez_fona.png*",route=>route.fulfill({status:404,body:""}));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  await expect(page.locator("body")).not.toHaveClass(/boot-loading/,{timeout:13000});
  await expect(page.locator("#boot-particle-loader")).toHaveCount(0);
});

test("zoom and selection are enabled, and skip navigation focuses content",async({page})=>{
  await disableWebGL(page);
  await page.goto("/",{waitUntil:"domcontentloaded"});
  const config=await page.evaluate(()=>({
    viewport:document.querySelector('meta[name="viewport"]').content,
    selectable:getComputedStyle(document.querySelector(".bio-copy p")).userSelect
  }));
  expect(config.viewport).not.toMatch(/user-scalable=no|maximum-scale=1/);
  expect(config.selectable).not.toBe("none");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link").first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#music")).toBeFocused();
});

test("Spotify is created on demand once and switches albums using the same iframe",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.route("https://open.spotify.com/embed/iframe-api/v1",route=>route.fulfill({
    contentType:"application/javascript",
    body:`window.__spotifyCreates=0;window.__spotifyLoads=[];
window.onSpotifyIframeApiReady({
  createController(target,options,callback){
    window.__spotifyCreates++;
    const iframe=document.createElement("iframe");
    iframe.title="Spotify mock";
    target.appendChild(iframe);
    let current=options.uri;
    const listeners={};
    const controller={
      addListener(name,fn){
        listeners[name]=fn;
        if(name==="ready")setTimeout(()=>fn(),0);
      },
      loadEntity(uri){current=uri;window.__spotifyLoads.push(uri)},
      play(){listeners.playback_started?.({data:{playingURI:current}})},
      resume(){listeners.playback_started?.({data:{playingURI:current}})},
      pause(){listeners.playback_update?.({data:{playingURI:current,isPaused:true}})}
    };
    callback(controller);
  }
});`
  }));
  await page.goto("/",{waitUntil:"domcontentloaded"});
  expect(await page.locator(".spotify-track-engine").count()).toBe(0);
  expect(await page.locator('script[src*="iframe-api"]').count()).toBe(0);
  await page.locator('.disc-content-panel[data-album-id="reall"] .track').first().click();
  await expect.poll(()=>page.evaluate(()=>window.__spotifyCreates)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.__spotifyLoads.length)).toBe(1);
  await page.locator('.album-tab[data-id="revenant"]').click();
  await page.locator('.disc-content-panel[data-album-id="revenant"] .track').first().click();
  await expect.poll(()=>page.evaluate(()=>window.__spotifyLoads.length)).toBe(2);
  expect(await page.evaluate(()=>window.__spotifyCreates)).toBe(1);
  expect(await page.locator(".spotify-track-engine iframe").count()).toBe(1);
});
