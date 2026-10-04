// Playwright screencast of the demo flow (fallback for the hand-recorded video). Runs through the
// playwright MCP's browser_run_code_unsafe: a fresh context with recordVideo, the scripted messages, the
// player started, then the context closes and the .webm lands in docs/screens/video/.
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: "docs/screens/video", size: { width: 1280, height: 800 } } });
  const p = await ctx.newPage();
  const say = async (text, waitFor, ms) => {
    const box = p.getByRole("textbox", { name: "Message input" });
    await box.fill(text);
    await p.waitForTimeout(600);
    await box.press("Enter");
    if (waitFor) await p.getByText(waitFor).first().waitFor({ state: "visible", timeout: ms ?? 60000 });
    await p.waitForTimeout(2500);
  };
  await p.goto("http://localhost:3100/");
  await p.waitForTimeout(1500);
  await say("Какие дни со съёмкой у тебя есть?", "clips", 60000);
  await p.waitForTimeout(3000);
  await say("Найди моменты, где дочка говорит про дом и про Калифорнию", "what the camera saw", 60000);
  await p.waitForTimeout(4000);
  await say("Покажи, что ты уже смонтировал для бабушки", "standing", 60000).catch(() => {});
  await p.waitForTimeout(1500);
  // start the newest player and let it run
  await p.evaluate(() => { const v = document.querySelector("video"); if (v) { v.muted = false; v.currentTime = 8; v.play().catch(() => {}); } });
  await p.waitForTimeout(16000);
  await say("Какие правила монтажа ты выучил?", "standing rules", 60000);
  await p.waitForTimeout(5000);
  const path = await p.video().path();
  await ctx.close();
  return path;
}
