const {defineConfig,devices}=require("@playwright/test");
module.exports=defineConfig({
  testDir:"./tests",
  testMatch:"**/*.spec.cjs",
  timeout:25000,
  expect:{timeout:12000},
  retries:process.env.CI?1:0,
  workers:process.env.CI?2:undefined,
  use:{baseURL:"http://127.0.0.1:4173",trace:"retain-on-failure",...devices["Desktop Chrome"]},
  webServer:{
    command:"python3 -m http.server 4173 --bind 127.0.0.1",
    url:"http://127.0.0.1:4173",
    reuseExistingServer:!process.env.CI,
    timeout:30000
  }
});
