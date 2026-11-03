const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: { timeout: 8000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry"
  },
  webServer: {
    command: "python3 tools/serve.py 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 20000
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 900 }, hasTouch: false } },
    {
      name: "tablet",
      use: {
        browserName: "chromium",
        viewport: { width: 1138, height: 712 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 1
      }
    },
    {
      name: "tablet-portrait",
      use: {
        browserName: "chromium",
        viewport: { width: 712, height: 1138 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 1
      }
    }
  ]
});
