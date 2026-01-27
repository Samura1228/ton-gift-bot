# Google Sheets Integration Plan

We will add a feature to log **ALL** user interactions (successes and errors) to a Google Sheet.

## 1. Architecture

*   **Library**: `google-spreadsheet` (Standard Node.js library for Sheets).
*   **Auth**: Google Service Account (JSON Key).
*   **Data Structure**:
    *   `Timestamp`: Date & Time
    *   `User ID`: Telegram ID
    *   `Username`: Telegram Username
    *   `First Name`: User's First Name
    *   `Gift Link`: The link they sent
    *   `Status`: "SUCCESS" or "ERROR"
    *   `Collection`: Gift Collection Name (if available)
    *   `Price Estimate`: Fast/Market/Max (if success)
    *   `Details/Error`: Full details or error message

## 2. Implementation Steps

1.  **Install Dependencies**:
    ```bash
    npm install google-spreadsheet google-auth-library
    ```

2.  **Create Service (`services/googleSheets.js`)**:
    *   Handles authentication.
    *   Buffers rows (optional) or writes immediately.
    *   Handles connection errors gracefully (so bot doesn't crash if Sheets is down).

3.  **Update Bot (`ton-gift-bot.js`)**:
    *   Import the service.
    *   Log when a user sends a link.
    *   Log the result (Success with price OR Error with reason).

## 3. Setup Required from You (Google Cloud)

You will need to:
1.  Go to [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a **New Project**.
3.  Enable **Google Sheets API**.
4.  Create a **Service Account**.
5.  Create a **JSON Key** for that account.
6.  **Create a Google Sheet** and **Share** it with the Service Account's email address (editor access).
7.  Add the Key and Sheet ID to **Railway Variables**.

## 4. Environment Variables

We will add these to Railway:
*   `GOOGLE_SERVICE_ACCOUNT_EMAIL`
*   `GOOGLE_PRIVATE_KEY`
*   `GOOGLE_SHEET_ID`