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

async function clickHourMarkerClosestToPercent(page, targetPercent) {
  const activeTimelineContainer = page.locator('.timeline-container[data-active="true"]');
  await expect(activeTimelineContainer).toBeVisible();

  const markerLocator = activeTimelineContainer.locator('.timeline .hour-marker');
  await expect(markerLocator.first()).toBeVisible();

  const closestIndex = await markerLocator.evaluateAll((markers, percent) => {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    markers.forEach((marker, index) => {
      const styleAttr = marker.getAttribute('style') || '';
      const leftMatch = styleAttr.match(/left\s*:\s*([\d.]+)%/i);
      const topMatch = styleAttr.match(/top\s*:\s*([\d.]+)%/i);
      const markerPercent = leftMatch ? parseFloat(leftMatch[1]) : topMatch ? parseFloat(topMatch[1]) : NaN;

      if (!Number.isNaN(markerPercent)) {
        const distance = Math.abs(markerPercent - percent);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }
    });

    return bestIndex;
  }, targetPercent);

  await markerLocator.nth(closestIndex).evaluate((marker) => {
    marker.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
  });
}

async function selectActivityByCodeOrFirst(page, code) {
  await waitForActivitiesLoaded(page);

  if (code) {
    const byCode = page.locator(`#activitiesContainer .activity-button[data-code="${code}"]`);
    if (await byCode.count()) {
      await byCode.first().click();
      return;
    }
  }

  await page.locator('#activitiesContainer .activity-button:visible').first().click();
}

async function addActivityAtPercent(page, { code, percent }) {
  await selectActivityByCodeOrFirst(page, code);
  await clickHourMarkerClosestToPercent(page, percent);
}

async function goToSecondaryTimeline(page) {
  const nextBtn = page.locator('#nextBtn');
  await expect(nextBtn).toBeVisible();
  await expect(nextBtn).toBeEnabled();
  await nextBtn.click();

  await expect
    .poll(async () => page.evaluate(() => window.timelineManager.keys[window.timelineManager.currentIndex]), {
      timeout: 10000,
      message: 'Waiting to switch to secondary timeline',
    })
    .toBe('secondary');
}

async function openSubmitConfirmation(page) {
  const nextBtn = page.locator('#nextBtn');
  const confirmationModal = page.locator('#confirmationModal');

  await expect(nextBtn).toBeVisible();
  await expect(nextBtn).toBeEnabled();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await nextBtn.click();

    if (await confirmationModal.isVisible()) {
      return;
    }

    await page.waitForTimeout(700);
  }

  await expect(confirmationModal).toBeVisible();
}

test('failed submit keeps last timeline submittable for immediate retry', async ({ page }) => {
  let submitAttempts = 0;

  await page.route('**/studies/**/participants/**/day_labels/**/activities', async (route) => {
    submitAttempts += 1;

    if (submitAttempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'temporary submit failure' }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto('index.html?study_name=default&lang=en', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/pages\/instructions\.html/);
  await expect(page.locator('#continueBtn')).toBeVisible();
  await page.locator('#continueBtn').click();
  await expect(page).toHaveURL(/index\.html/);

  await addActivityAtPercent(page, { code: 1101, percent: 70 });
  await goToSecondaryTimeline(page);
  await addActivityAtPercent(page, { code: null, percent: 10 });

  const nextBtn = page.locator('#nextBtn');
  const navSubmitBtn = page.locator('#navSubmitBtn');
  const confirmationModal = page.locator('#confirmationModal');
  const loadingModal = page.locator('#loadingModal');
  const currentDayDisplay = page.locator('#currentDayDisplay');

  await expect(nextBtn).toBeEnabled();
  await expect(navSubmitBtn).toBeEnabled();

  await openSubmitConfirmation(page);
  await page.locator('#confirmOk').click();

  await expect
    .poll(async () => submitAttempts, {
      timeout: 10000,
      message: 'Waiting for the first submit attempt',
    })
    .toBe(1);

  await expect(loadingModal).toBeHidden({ timeout: 10000 });
  await expect(page.locator('.toast.error')).toContainText(/Error submitting diary/i);
  await expect(nextBtn).toBeEnabled();
  await expect(navSubmitBtn).toBeEnabled();

  await expect
    .poll(async () => page.evaluate(() => window.timelineManager.keys[window.timelineManager.currentIndex]), {
      timeout: 10000,
      message: 'Current timeline should remain the last timeline after failed submit',
    })
    .toBe('secondary');

  await openSubmitConfirmation(page);
  await page.locator('#confirmOk').click();

  await expect
    .poll(async () => submitAttempts, {
      timeout: 10000,
      message: 'Waiting for the retry submit attempt',
    })
    .toBe(2);

  await expect(currentDayDisplay).toHaveAttribute('title', /Tuesday/, {
    timeout: 30000,
  });
});
