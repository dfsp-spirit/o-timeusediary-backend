const { test, expect } = require('@playwright/test');

test.use({ viewport: { width: 1600, height: 900 } });

async function waitForActivitiesLoaded(page) {
  await expect
    .poll(async () => page.locator('#activitiesContainer .activity-button').count(), {
      timeout: 30000,
      message: 'Waiting for activities to load',
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

async function selectActivity(page, options) {
  await waitForActivitiesLoaded(page);

  if (options.code) {
    const byCode = page.locator(`#activitiesContainer .activity-button[data-code="${options.code}"]`);
    if (await byCode.count()) {
      await byCode.first().click();
      return;
    }
  }

  const byText = page
    .locator('#activitiesContainer .activity-button')
    .filter({ hasText: options.text })
    .first();

  await expect(byText).toBeVisible();
  await byText.click();
}

async function addActivityAt50(page, options) {
  await selectActivity(page, options);
  await clickHourMarkerClosestTo50Percent(page);
}

async function goToSecondaryTimeline(page) {
  const nextBtn = page.locator('#nextBtn');
  await expect(nextBtn).toBeVisible();
  await expect(nextBtn).toBeEnabled();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await nextBtn.click();
    await page.waitForTimeout(700);

    if (await page.locator('.timeline-title').isVisible()) {
      const titleText = await page.locator('.timeline-title').textContent();
      if (titleText.includes('Secondary Activity')) {
        return;
      }
    }
  }

  await expect(page.locator('.timeline-title')).toContainText('Secondary Activity');
}

async function submitCurrentDay(page, expectedNextDayName) {
  const nextBtn = page.locator('#nextBtn');
  const confirmationModal = page.locator('#confirmationModal');
  const currentDayDisplay = page.locator('#currentDayDisplay');

  await expect(nextBtn).toBeVisible();
  await expect(nextBtn).toBeEnabled();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await nextBtn.click();

    if (await confirmationModal.isVisible()) {
      await page.locator('#confirmOk').click();
      break;
    }

    const maybeUpdatedTitle = (await currentDayDisplay.getAttribute('title')) || '';
    if (maybeUpdatedTitle.includes(expectedNextDayName)) {
      break;
    }

    await page.waitForTimeout(700);
  }

  await expect(currentDayDisplay).toHaveAttribute('title', new RegExp(expectedNextDayName), {
    timeout: 30000,
  });
}

async function expectTwoTimelinesAndTemplateActivities(page) {
  await expect
    .poll(async () => page.locator('.timeline-container').count(), {
      timeout: 30000,
      message: 'Waiting for both timelines to be present',
    })
    .toBe(2);

  await expect(page.locator('.activity-block').filter({ hasText: 'Sleeping' }).first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.activity-block').filter({ hasText: 'Listening to Audio' }).first()).toBeVisible({ timeout: 30000 });
}

test('templates keep both timelines and activities on Tuesday and Wednesday', async ({ page }) => {
  await page.goto('index.html?study_name=default&lang=en', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/pages\/instructions\.html/);
  await expect(page.locator('#continueBtn')).toBeVisible();
  await page.locator('#continueBtn').click();

  await expect(page).toHaveURL(/index\.html/);
  await expect(page.locator('#currentDayDisplay')).toHaveAttribute('title', /Monday/);

  await addActivityAt50(page, { code: 1101, text: 'Sleeping' });

  await goToSecondaryTimeline(page);
  await addActivityAt50(page, { text: 'Listening to Audio' });

  await submitCurrentDay(page, 'Tuesday');
  await expectTwoTimelinesAndTemplateActivities(page);

  await goToSecondaryTimeline(page);
  await submitCurrentDay(page, 'Wednesday');

  await expect(page.locator('#currentDayDisplay')).toHaveAttribute('title', /Wednesday/, {
    timeout: 30000,
  });
  await expectTwoTimelinesAndTemplateActivities(page);
});
