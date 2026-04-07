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
  const activeTimeline = page.locator('.timeline[data-active="true"]');
  await expect(activeTimeline).toBeVisible();

  const clampedPercent = Math.max(0, Math.min(targetPercent, 99));
  const box = await activeTimeline.boundingBox();
  if (!box) {
    throw new Error('Active timeline bounding box is not available');
  }

  await activeTimeline.click({
    position: {
      x: Math.max(1, Math.min(box.width - 1, (box.width * clampedPercent) / 100)),
      y: Math.max(1, Math.min(box.height - 1, box.height / 2)),
    },
    force: true,
  });
}

async function clickActivityButtonByText(page, textPattern) {
  await waitForActivitiesLoaded(page);
  const activityButton = page
    .locator('#activitiesContainer .activity-button')
    .filter({ hasText: textPattern })
    .first();
  await expect(activityButton).toBeVisible();
  await activityButton.click();
}

async function selectDirectSimple(page) {
  const byCode = page.locator('#activitiesContainer .activity-button[data-code="1101"]');
  if (await byCode.count()) {
    await byCode.first().click();
    return;
  }

  await clickActivityButtonByText(page, /Sleeping/i);
}

async function selectDirectCustom(page, customText) {
  await clickActivityButtonByText(page, /Other Activity.*specify/i);

  const customModal = page.locator('#customActivityModal');
  await expect(customModal).toBeVisible();
  await page.locator('#customActivityInput').fill(customText);
  await page.locator('#confirmCustomActivity').click();
  await expect(customModal).toBeHidden();
}

async function selectFromSubmenuSimple(page) {
  await clickActivityButtonByText(page, /^Travelling$/i);

  const childItemsModal = page.locator('#childItemsModal');
  await expect(childItemsModal).toBeVisible();

  const walkingOption = page
    .locator('#childItemsContainer .child-item-button')
    .filter({ hasText: /Travelling:\s*walking/i })
    .first();
  await expect(walkingOption).toBeVisible();
  await walkingOption.click();
  await expect(childItemsModal).toBeHidden();
}

async function selectFromSubmenuCustom(page, customText) {
  await clickActivityButtonByText(page, /^Gaming$/i);

  const childItemsModal = page.locator('#childItemsModal');
  await expect(childItemsModal).toBeVisible();

  const customConsoleOption = page
    .locator('#childItemsContainer .child-item-button')
    .filter({ hasText: /Console,\s*alone\s*\(please specify game\)/i })
    .first();
  await expect(customConsoleOption).toBeVisible();
  await customConsoleOption.click();

  const customModal = page.locator('#customActivityModal');
  await expect(customModal).toBeVisible();
  await page.locator('#customActivityInput').fill(customText);
  await page.locator('#confirmCustomActivity').click();
  await expect(customModal).toBeHidden();
}

async function addSelectedActivityAtPercent(page, percent) {
  const countBefore = await page.evaluate(() => (window.timelineManager?.activities?.primary || []).length);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await clickHourMarkerClosestToPercent(page, percent + attempt);

    const placed = await page
      .waitForFunction(
        (previousCount) => (window.timelineManager?.activities?.primary || []).length > previousCount,
        countBefore,
        { timeout: 2500 }
      )
      .then(() => true)
      .catch(() => false);

    if (placed) {
      return;
    }
  }

  throw new Error(`Failed to place selected activity at around ${percent}%`);
}

async function expectSelectedActivity(page, expectedTextPattern) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const selected = window.selectedActivity;
          if (!selected || !selected.name) {
            return '';
          }
          return String(selected.name);
        }),
      {
        timeout: 10000,
        message: 'Waiting for selected activity to be set',
      }
    )
    .toMatch(expectedTextPattern);
}

async function expectPrimaryTimelineDataContains(page, expectedActivities) {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const activities = window.timelineManager?.activities?.primary || [];
          return activities.map((activity) => String(activity.activity || ''));
        }),
      {
        timeout: 30000,
        message: 'Waiting for expected activities in primary timeline data',
      }
    )
    .toEqual(expect.arrayContaining(expectedActivities));
}

async function moveToSecondaryTimeline(page) {
  const nextBtn = page.locator('#nextBtn');
  await expect(nextBtn).toBeVisible();
  await expect(nextBtn).toBeEnabled();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await nextBtn.click();
    await page.waitForTimeout(700);

    const currentKey = await page.evaluate(() => window.timelineManager.keys[window.timelineManager.currentIndex]);
    if (currentKey === 'secondary') {
      return;
    }
  }

  await expect
    .poll(async () => page.evaluate(() => window.timelineManager.keys[window.timelineManager.currentIndex]), {
      timeout: 10000,
      message: 'Waiting to switch to secondary timeline',
    })
    .toBe('secondary');
}

async function submitCurrentDay(page, expectedNextDayName) {
  const nextBtn = page.locator('#nextBtn');
  const confirmationModal = page.locator('#confirmationModal');
  const currentDayDisplay = page.locator('#currentDayDisplay');

  await expect(nextBtn).toBeVisible();
  await expect(nextBtn).toBeEnabled();

  for (let attempt = 0; attempt < 4; attempt += 1) {
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

test('primary timeline supports direct/custom/submenu activities and templates to next day', async ({ page }) => {
  const pid = `e2e-activity-types-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const directCustomText = 'Other custom activity';
  const submenuCustomText = 'Mario Kart';
  const expectedDay1AndDay2Activities = [
    'Sleeping',
    directCustomText,
    'Travelling: walking',
    submenuCustomText,
  ];

  await page.goto(`index.html?study_name=default&lang=en&pid=${pid}`, {
    waitUntil: 'domcontentloaded',
  });

  await expect(page).toHaveURL(/pages\/instructions\.html/);
  await expect(page.locator('#continueBtn')).toBeVisible();
  await page.locator('#continueBtn').click();

  await expect(page).toHaveURL(/index\.html/);
  await expect(page.locator('#currentDayDisplay')).toHaveAttribute('title', /Monday/);

  await waitForActivitiesLoaded(page);

  await selectDirectSimple(page);
  await expectSelectedActivity(page, /Sleeping/i);
  await addSelectedActivityAtPercent(page, 10);

  await selectDirectCustom(page, directCustomText);
  await expectSelectedActivity(page, new RegExp(directCustomText, 'i'));
  await addSelectedActivityAtPercent(page, 30);

  await selectFromSubmenuSimple(page);
  await expectSelectedActivity(page, /Travelling:\s*walking/i);
  await addSelectedActivityAtPercent(page, 50);

  await selectFromSubmenuCustom(page, submenuCustomText);
  await expectSelectedActivity(page, new RegExp(submenuCustomText, 'i'));
  await addSelectedActivityAtPercent(page, 70);

  await expectPrimaryTimelineDataContains(page, expectedDay1AndDay2Activities);
  const primaryActivitiesContainer = page.locator('#primary .activities');
  await expect(primaryActivitiesContainer).toContainText('Sleeping');
  await expect(primaryActivitiesContainer).toContainText(directCustomText);
  await expect(primaryActivitiesContainer).toContainText(/Travelling|Travelling:\s*walking/);
  await expect(primaryActivitiesContainer).toContainText(/Gaming|Mario Kart/);

  await moveToSecondaryTimeline(page);
  await submitCurrentDay(page, 'Tuesday');

  await expectPrimaryTimelineDataContains(page, expectedDay1AndDay2Activities);
  const day2PrimaryActivitiesContainer = page.locator('#primary .activities');
  await expect(day2PrimaryActivitiesContainer).toContainText('Sleeping');
  await expect(day2PrimaryActivitiesContainer).toContainText(directCustomText);
  await expect(day2PrimaryActivitiesContainer).toContainText(/Travelling|Travelling:\s*walking/);
  await expect(day2PrimaryActivitiesContainer).toContainText(/Gaming|Mario Kart/);
});
