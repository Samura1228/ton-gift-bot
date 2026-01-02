const puppeteer = require('puppeteer');

let session = {
  userAgent: null,
  cookieHeader: null,
  expiresAt: 0
};

const SESSION_TTL = 60 * 60 * 1000; // 1 hour
const TARGET_URL = 'https://gifts2.tonnel.network/'; // Or main site if API root redirects

async function refreshSession() {
  console.log('Refreshing TONNEL session cookies...');
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Set a realistic initial UA to avoid immediate block
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Extract cookies
    const cookies = await page.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Extract actual UA used
    const userAgent = await page.evaluate(() => navigator.userAgent);

    session = {
      userAgent,
      cookieHeader,
      expiresAt: Date.now() + SESSION_TTL
    };

    console.log('TONNEL session refreshed successfully.');
  } catch (error) {
    console.error('Failed to refresh TONNEL session:', error.message);
    // Don't throw, just keep old session or null to allow retry logic to handle it
  } finally {
    if (browser) await browser.close();
  }
}

async function getSession() {
  if (!session.cookieHeader || Date.now() > session.expiresAt) {
    await refreshSession();
  }
  return session;
}

module.exports = {
  getSession,
  refresh: refreshSession
};