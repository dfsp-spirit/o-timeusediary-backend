const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 1600, height: 900 } });

async function waitForActivitiesLoaded(page) {
  await expect
    .poll(async () => page.locator('.activity-button').count(), {
      timeout: 30000,
      message: 'Waiting for activities to load from backend',
    })
    .toBeGreaterThan(0);

}

async function ensureSleepingActivityAvailable(page) {
  await waitForActivitiesLoaded(page);

  let sleepingCount = await page.locator('.activity-button[data-code="1101"]').count();
  if (sleepingCount > 0) {
    return;
  }

  const mainActivityTimeline = page
    .locator('.past-initialized-timelines-wrapper .timeline-container')
    .filter({ hasText: 'Main Activity' })
    .first();

  if (await mainActivityTimeline.count()) {
    await mainActivityTimeline.click();
  }

  await expect
    .poll(async () => page.locator('.activity-button[data-code="1101"]').count(), {
      timeout: 15000,
      message: 'Waiting for Sleeping activity button (code 1101) after timeline switch',
    })
    .toBeGreaterThan(0);
}

async function clickHourMarkerClosestTo50Percent(page) {
  const activeTimelineContainer = page.locator('.timeline-container[data-active="true"]');
  await expect(activeTimelineContainer).toBeVisible();

  const markerLocator = activeTimelineContainer.locator('.timeline .hour-marker');
  await expect(markerLocator.first()).toBeVisible();

  const markerCount = await markerLocator.count();
  expect(markerCount).toBeGreaterThan(0);

  const closestIndex = await markerLocator.evaluateAll((markers) => {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    markers.forEach((marker, index) => {
      const styleAttr = marker.getAttribute('style') || '';
      const leftMatch = styleAttr.match(/left\s*:\s*([\d.]+)%/i);
      const leftPercent = leftMatch ? parseFloat(leftMatch[1]) : NaN;
      if (!Number.isNaN(leftPercent)) {
        const distance = Math.abs(leftPercent - 50);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }
    });

    return bestIndex;
  });

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

async function selectSleepingActivity(page) {
  await ensureSleepingActivityAvailable(page);
  const sleepingByCode = page.locator('#activitiesContainer .activity-button[data-code="1101"]');

  if (await sleepingByCode.count()) {
    await expect(sleepingByCode.first()).toBeVisible();
    await sleepingByCode.first().click();
    return;
  }

  const sleepingByText = page
    .locator('#activitiesContainer .activity-button')
    .filter({ hasText: 'Sleeping' })
    .first();
  await expect(sleepingByText).toBeVisible();
  await sleepingByText.click();
}

async function placeSleepingOnActiveTimeline(page) {
  await selectSleepingActivity(page);
  await clickHourMarkerClosestTo50Percent(page);
}

async function placeAnyActivityOnActiveTimeline(page) {
  await waitForActivitiesLoaded(page);

  const firstVisibleActivity = page
    .locator('#activitiesContainer .activity-button:visible')
    .first();
  await expect(firstVisibleActivity).toBeVisible();
  await firstVisibleActivity.click();

  await clickHourMarkerClosestTo50Percent(page);
}

test('instructions -> add Sleeping at ~50% -> next timeline/day shows Tuesday', async ({ page }) => {
  await page.goto('index.html?study_name=default&lang=en', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/pages\/instructions\.html/);
  await expect(page.locator('#continueBtn')).toBeVisible();
  await page.locator('#continueBtn').click();

  await expect(page).toHaveURL(/index\.html/);

  const currentDayDisplay = page.locator('#currentDayDisplay');
  await expect(currentDayDisplay).toBeVisible();
  await expect(currentDayDisplay).toHaveAttribute('title', /Monday/);

  await placeSleepingOnActiveTimeline(page);

  const nextBtn = page.locator('#nextBtn');
  await expect(nextBtn).toBeVisible();
  await expect(nextBtn).toBeEnabled();
  await nextBtn.click();

  const dayTitleAfterFirstNext = (await currentDayDisplay.getAttribute('title')) || '';

  if (!dayTitleAfterFirstNext.includes('Tuesday')) {
    await placeAnyActivityOnActiveTimeline(page);
    await expect(nextBtn).toBeEnabled();
    await page.waitForTimeout(700);

    const confirmationModal = page.locator('#confirmationModal');
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await nextBtn.click();

      if (await confirmationModal.isVisible()) {
        await page.locator('#confirmOk').click();
        break;
      }

      const maybeUpdatedTitle = (await currentDayDisplay.getAttribute('title')) || '';
      if (maybeUpdatedTitle.includes('Tuesday')) {
        break;
      }

      await page.waitForTimeout(700);
    }
  }

  await expect(currentDayDisplay).toHaveAttribute('title', /Tuesday/, { timeout: 30000 });
});
