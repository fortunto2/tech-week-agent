// Screencast v2: short, visual. days → search → renders (players autoplay muted) → rules. ~100 s.
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: "docs/screens/video", size: { width: 1280, height: 800 } } });
  const p = await ctx.newPage();
  const say = async (text, waitFor, ms) => {
    const box = p.getByRole("textbox", { name: "Message input" });
    await box.fill(text);
    await p.waitForTimeout(500);
    await box.press("Enter");
    if (waitFor) await p.getByText(waitFor).first().waitFor({ state: "visible", timeout: ms ?? 90000 }).catch(() => {});
    await p.waitForTimeout(2000);
  };
  const playAll = async (secs) => {
    await p.evaluate(() => { document.querySelectorAll("video").forEach((v, i) => { v.muted = true; v.currentTime = 6; if (i === 0) v.play().catch(() => {}); }); });
    await p.waitForTimeout(secs * 1000);
  };
  await p.goto("http://localhost:3100/");
  await p.waitForTimeout(1200);
  await say("Какие дни со съёмкой у тебя есть?", "clips", 90000);
  await p.waitForTimeout(2500);
  await say("Найди моменты, где дочка говорит про дом, и закат у океана", "what the camera saw", 90000);
  await p.waitForTimeout(4000);
  await say("Покажи, что ты уже смонтировал", "standing", 90000);
  await playAll(22);
  await p.evaluate(() => { const vs = document.querySelectorAll("video"); vs.forEach((v) => v.pause()); const v = vs[1]; if (v) { v.muted = true; v.currentTime = 20; v.scrollIntoView({ block: "center" }); v.play().catch(() => {}); } });
  await p.waitForTimeout(14000);
  await say("Какие правила монтажа ты выучил?", "standing rules", 90000);
  await p.waitForTimeout(5000);
  const path = await p.video().path();
  await ctx.close();
  return path;
}
