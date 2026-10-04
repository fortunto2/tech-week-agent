// The core use case on screen: upload two clips → live analysis → "cut me a 30 s reel" → script → render → player.
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: "docs/screens/video", size: { width: 1280, height: 800 } } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3100/");
  await p.waitForTimeout(1200);
  await p.setInputFiles('input[type="file"]', "/Users/rustam/Movies/!usa/cali_1week/DJI_20261001211449_0505_D.MP4");
  await p.getByText("ingested").first().waitFor({ state: "visible", timeout: 240000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.setInputFiles('input[type="file"]', "/Users/rustam/Movies/!usa/cali_1week/DJI_20261002184546_0542_D.MP4");
  await p.getByText("ingested").first().waitFor({ state: "visible", timeout: 240000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const box = p.getByRole("textbox", { name: "Message input" });
  await box.fill("Смонтируй 30-секундный ролик из клипов, которые я только что загрузил, и запусти рендер.");
  await p.waitForTimeout(500);
  await box.press("Enter");
  await p.getByText("Rendering on the Mac").first().waitFor({ state: "visible", timeout: 240000 }).catch(() => {});
  await p.locator("video").first().waitFor({ state: "visible", timeout: 300000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const v = document.querySelector("video"); if (v) { v.muted = true; v.play().catch(() => {}); } });
  await p.waitForTimeout(14000);
  const path = await p.video().path();
  await ctx.close();
  return path;
}
