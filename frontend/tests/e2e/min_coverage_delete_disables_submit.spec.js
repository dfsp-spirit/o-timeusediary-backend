const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 1600, height: 900 } });

async function waitForActivitiesLoaded(page) {
  await expect
    .poll(async () => page.locator('#activitiesContainer .activity-button').count(), {
      timeout: 30000,
      message: 'Waiting for activity buttons to load',
    })
    .toBeGreaterThan(0);
}

async function clickTimelineAtPercent(page, targetPercent) {
  const timeline = page.locator('.timeline-container[data-active="true"] .timeline').first();
  await expect(timeline).toBeVisible();

  const box = await timeline.boundingBox();
  expect(box).not.toBeNull();

  const x = box.x + (box.width * targetPercent) / 100;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
}

async function placeSingleActivity(page) {
  await waitForActivitiesLoaded(page);
  const firstActivity = page.locator(
    '#activitiesContainer .activity-button:visible:not(.has-child-items):not(.custom-input)'
  ).first();

  await firstActivity.click();
  await clickTimelineAtPercent(page, 25);

  await expect(page.locator('.timeline-container[data-active="true"] .activity-block')).toHaveCount(1);
}

test('deleting primary activity while on secondary disables submit when primary min coverage is no longer met', async ({ page }) => {
  await page.goto('index.html?study_name=default&lang=en', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/pages\/instructions\.html/);
  await page.locator('#continueBtn').click();
  await expect(page).toHaveURL(/index\.html/);

  const nextBtn = page.locator('#nextBtn');
  const navSubmitBtn = page.locator('#navSubmitBtn');

  await expect(nextBtn).toBeDisabled();
  await expect(navSubmitBtn).toBeDisabled();

  await placeSingleActivity(page);

  await expect(nextBtn).toBeEnabled();
  await expect(navSubmitBtn).toBeEnabled();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await nextBtn.click();
    await page.waitForTimeout(700);

    const currentKey = await page.evaluate(() => window.timelineManager.keys[window.timelineManager.currentIndex]);
    if (currentKey === 'secondary') {
      break;
    }
  }

  await expect
    .poll(async () => page.evaluate(() => window.timelineManager.keys[window.timelineManager.currentIndex]))
    .toBe('secondary');

  await expect(nextBtn).toBeEnabled();
  await expect(navSubmitBtn).toBeEnabled();

  const primaryBlockWhileSecondaryActive = page.locator('.timeline-container:has(#primary) .activity-block').first();
  await expect(primaryBlockWhileSecondaryActive).toBeVisible();

  await primaryBlockWhileSecondaryActive.hover();
  await page.keyboard.press('Delete');

  await expect(page.locator('.timeline-container:has(#primary) .activity-block')).toHaveCount(0);

  await expect(nextBtn).toBeDisabled();
  await expect(navSubmitBtn).toBeDisabled();
});
