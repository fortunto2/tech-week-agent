// Screencast segment: upload a clip and watch the live analysis, then ask the director about it.
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: "docs/screens/video", size: { width: 1280, height: 800 } } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3100/");
  await p.waitForTimeout(1500);
  await p.setInputFiles('input[type="file"]', "/Users/rustam/Movies/!usa/cali_1week/DJI_20261001211449_0505_D.MP4");
  await p.getByText("ingested").first().waitFor({ state: "visible", timeout: 240000 }).catch(() => {});
  await p.waitForTimeout(3000);
  const box = p.getByRole("textbox", { name: "Message input" });
  await box.fill("Что в клипе, который я только что загрузил? Найди его по словам про нишевое мероприятие.");
  await p.waitForTimeout(500);
  await box.press("Enter");
  await p.getByText("moments").first().waitFor({ state: "visible", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(6000);
  const path = await p.video().path();
  await ctx.close();
  return path;
}
