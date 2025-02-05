import { test, expect } from '@playwright/test';
import axios from 'axios';
import { delay, generateEmailWithTag } from '../testUtils';

import dotenv from 'dotenv';
// Load environment variables from .env file
dotenv.config();
const testEmailAppApiKey = process.env.TEST_EMAIL_APP_API_KEY;

test('login with email password less and enable MFA using password', async ({ page }) => {
  const testEmail = generateEmailWithTag() || "";
  const fixedEmail = "kelg8.m3zdcal5slf4@inbox.testmail.app";
  const tag = fixedEmail.split("@")[0].split(".")[1];
  const timestamp= Math.floor(Date.now() / 1000);
  await page.goto('http://localhost:5173/');
  await page.getByRole('textbox', { name: 'E.g. name@example.com' }).click();
  await page.getByRole('textbox', { name: 'E.g. name@example.com' }).fill(fixedEmail);
  await page.getByRole('button', { name: 'Continue with Email' }).click();

  const page1Promise = page.waitForEvent('popup');
  const page1 = await page1Promise;

  await delay(4000);
  const ENDPOINT = `https://api.testmail.app/api/json?apikey=${testEmailAppApiKey}&namespace=kelg8&tag=${tag}&livequery=true&timestamp_from=${timestamp}`;
  const res = await axios.get(`${ENDPOINT}`);
  const inbox = await res.data;
  // const verificationCodeMatch = inbox.emails[0].html.match(/<span[^>]*font-weight: 600[^>]*>(\d+)<\/span>/);
  const verificationCode = inbox.emails[0].html.match(/<span[^>]*style\s*=\s*["'][^"']*font-size\s*:\s*40px[^"']*["'][^>]*>\s*(\d+)\s*<\/span>/i)[1];
  console.log({verificationCode});

  await page1.locator('.w-12').first().click();
  for (let i = 0; i < verificationCode.length; i++) {
    await page1.locator(`input:nth-child(${i + 1})`).fill(verificationCode[i]);
  }

  await page.getByRole('button', { name: 'Sign Message' }).click();
  await expect(page.getByText('Message has been signed')).toBeVisible();
  
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Send Transaction' }).click();

});

test('MFA login with password and email-passwordless and sign message', async ({ page }) => {
  const fixedEmail = "kelg8.m3zdcal5slf4@inbox.testmail.app";
  const tag = fixedEmail.split("@")[0].split(".")[1];
  const timestamp= Math.floor(Date.now() / 1000);

  await page.goto('http://localhost:5173/');
  await page.getByRole('textbox', { name: 'E.g. name@example.com' }).click();
  await page.getByRole('textbox', { name: 'E.g. name@example.com' }).fill(fixedEmail);
  await page.getByRole('button', { name: 'Continue with Email' }).click();

  const page1Promise = page.waitForEvent('popup');
  const page1 = await page1Promise;

  // wait for mailbox to receive email
  await delay(4000);
  const ENDPOINT = `https://api.testmail.app/api/json?apikey=${testEmailAppApiKey}&namespace=kelg8&tag=${tag}&livequery=true&timestamp_from=${timestamp}`;
  const res = await axios.get(`${ENDPOINT}`);
  const inbox = await res.data;
  const verificationCode = inbox.emails[0].html.match(/<span[^>]*style\s*=\s*["'][^"']*font-size\s*:\s*40px[^"']*["'][^>]*>\s*(\d+)\s*<\/span>/i)[1];

  // fill the code received in the email
  await page1.locator('.w-12').first().click();
  for (let i = 0; i < verificationCode.length; i++) {
    await page1.locator(`input:nth-child(${i + 1})`).fill(verificationCode[i]);
  }

  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Confirm password' }).click();
  await page.getByRole('textbox', { name: 'Confirm password' }).fill('Test@1234');
  await page.getByRole('button', { name: 'Confirm' }).click();

  await page.getByRole('button', { name: 'Sign Message' }).click();
  await expect(page.getByText('Message has been signed')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.waitForTimeout(4000);
  
  await page.getByRole('button', { name: 'Criticial Reset' }).click();
});

test('login with email password-less,enable recovery phrase logout and recover using phrase and sign message', async ({ browser }) => {
  test.setTimeout(120000);
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write']
  });
  const page = await context.newPage();

  const testEmail = generateEmailWithTag() || "";
  const fixedEmail = "kelg8.m3zdcal5slf4@inbox.testmail.app";
  const tag = fixedEmail.split("@")[0].split(".")[1];
  const timestamp= Math.floor(Date.now() / 1000);

  await page.goto('http://localhost:5173/');
  await page.getByRole('textbox', { name: 'E.g. name@example.com' }).click();
  await page.getByRole('textbox', { name: 'E.g. name@example.com' }).fill(fixedEmail);
  await page.getByRole('button', { name: 'Continue with Email' }).click();

  const page1Promise = page.waitForEvent('popup');
  const page1 = await page1Promise;

  await delay(4000);
  const ENDPOINT = `https://api.testmail.app/api/json?apikey=${testEmailAppApiKey}&namespace=kelg8&tag=${tag}&livequery=true&timestamp_from=${timestamp}`;
  const res = await axios.get(`${ENDPOINT}`);
  const inbox = await res.data;
  // const verificationCodeMatch = inbox.emails[0].html.match(/<span[^>]*font-weight: 600[^>]*>(\d+)<\/span>/);
  const verificationCode = inbox.emails[0].html.match(/<span[^>]*style\s*=\s*["'][^"']*font-size\s*:\s*40px[^"']*["'][^>]*>\s*(\d+)\s*<\/span>/i)[1];
  console.log({verificationCode});

  await page1.locator('.w-12').first().click();
  for (let i = 0; i < verificationCode.length; i++) {
    await page1.locator(`input:nth-child(${i + 1})`).fill(verificationCode[i]);
  }

  await page.getByRole('button', { name: 'Sign Message' }).click();
  await expect(page.getByText('Message has been signed')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Add Recovery Phrase' }).click();
  await page.getByRole('textbox', { name: 'Enter seed phrase' }).click();
  await page.getByRole('textbox', { name: 'Enter seed phrase' }).press('ControlOrMeta+a');
  await page.getByRole('textbox', { name: 'Enter seed phrase' }).press('ControlOrMeta+c');
  await page.getByRole('textbox', { name: 'Enter seed phrase' }).press('ControlOrMeta+c');
  const copiedResult = await page.evaluate(() => navigator.clipboard.readText());
  await page.getByRole('button', { name: 'Proceed' }).click();
  await page.waitForTimeout(6000);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.waitForTimeout(3000);

  await page.getByRole('textbox', { name: 'E.g. name@example.com' }).click();
  await page.getByRole('textbox', { name: 'E.g. name@example.com' }).fill(fixedEmail);
  await page.getByRole('button', { name: 'Continue with Email' }).click();
  const page2Promise = page.waitForEvent('popup');
  const page2 = await page2Promise;
  await delay(4000);
  const res2 = await axios.get(`${ENDPOINT}`);
  const inbox2 = await res2.data;
  // const verificationCodeMatch = inbox.emails[0].html.match(/<span[^>]*font-weight: 600[^>]*>(\d+)<\/span>/);
  const verificationCode2 = inbox2.emails[0].html.match(/<span[^>]*style\s*=\s*["'][^"']*font-size\s*:\s*40px[^"']*["'][^>]*>\s*(\d+)\s*<\/span>/i)[1];
  console.log({ verificationCode2 });

  await page2.locator('.w-12').first().click();
  for (let i = 0; i < verificationCode2.length; i++) {
    await page2.locator(`input:nth-child(${i + 1})`).fill(verificationCode2[i]);
  }

  await page.getByRole('button', { name: 'Recovery Phrase' }).click();
  await page.getByRole('textbox', { name: 'Enter seed phrase' }).click();
  await page.getByRole('textbox', { name: 'Enter seed phrase' }).fill(copiedResult);
  await page.getByRole('button', { name: 'Proceed' }).click();


  await page.getByRole('button', { name: 'Sign Message' }).click();
  await expect(page.getByText('Message has been signed')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.waitForTimeout(4000);
  
  await page.getByRole('button', { name: 'Criticial Reset' }).click();
});
