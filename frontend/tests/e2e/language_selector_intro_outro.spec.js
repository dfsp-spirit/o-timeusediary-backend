const { test, expect } = require('@playwright/test');

test('language selector lists supported languages and applies study intro/outro text', async ({ page }) => {
  await page.goto('index.html?study_name=9yearolds&lang=sv', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(/pages\/instructions\.html/);

  const languageSelect = page.locator('#languageSelect');
  await expect(languageSelect).toBeVisible();
  await expect(languageSelect).toHaveValue('sv');

  const options = await languageSelect.locator('option').allTextContents();
  expect(options).toEqual(expect.arrayContaining(['EN', 'SV']));

  await expect(page.locator('#study-custom-message-intro')).toContainText('Vänligen fyll i denna studie för ditt barn');

  await page.locator('#continueBtn').click();
  await expect(page).toHaveURL(/index\.html/);

  await page.locator('#skipReportingBtn').click();
  await expect(page.locator('#skipConfirmationModal')).toBeVisible();
  await page.locator('#confirmSkipOk').click();

  await expect(page).toHaveURL(/pages\/thank-you\.html/);
  await expect(page).toHaveURL(/completion_status=skipped/);
  await expect(page.locator('#study-custom-message-end')).toContainText('Du har hoppat över att fylla i tidsanvändningsdelen av studien');
});
