const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null;

let doc = null;

async function initGoogleSheets() {
  if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
    console.warn('Google Sheets logging disabled: Missing environment variables.');
    return null;
  }

  try {
    const serviceAccountAuth = new JWT({
      email: CLIENT_EMAIL,
      key: PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    console.log(`Google Sheets connected: ${doc.title}`);
    return doc;
  } catch (error) {
    console.error('Failed to initialize Google Sheets:', error.message);
    return null;
  }
}

/**
 * Logs a user interaction to Google Sheets
 * @param {Object} params
 * @param {Object} params.user - Telegram user object (id, username, first_name)
 * @param {string} params.giftLink - The link sent
 * @param {string} params.status - "SUCCESS" or "ERROR"
 * @param {Object} [params.giftData] - Parsed gift data (collection, rarity, etc.)
 * @param {Object} [params.priceData] - Price estimation (fast, market, max)
 * @param {string} [params.error] - Error message if failed
 */
async function logInteraction({ user, giftLink, status, giftData, priceData, error }) {
  if (!doc) {
    // Try to init if not already done (lazy init)
    await initGoogleSheets();
    if (!doc) return; // Still failed or disabled
  }

  try {
    const sheet = doc.sheetsByIndex[0]; // Use the first sheet
    
    // Prepare row data
    const row = {
      Timestamp: new Date().toISOString(),
      UserID: user.id,
      Username: user.username || '',
      FirstName: user.first_name || '',
      GiftLink: giftLink,
      Status: status,
      Collection: giftData ? giftData.model : '',
      Rarity: giftData ? `${giftData.modelRarity || ''}` : '',
      FloorPrice: priceData ? priceData.floorPrice : '',
      FastPrice: priceData ? priceData.fast : '',
      MarketPrice: priceData ? priceData.market : '',
      MaxPrice: priceData ? priceData.max : '',
      Error: error || ''
    };

    await sheet.addRow(row);
    // console.log('Logged to Google Sheets');
  } catch (err) {
    console.error('Error logging to Google Sheets:', err.message);
  }
}

module.exports = { logInteraction };