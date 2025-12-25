# TON Blockchain Notification Bot

A Telegram bot that monitors TON blockchain transactions and provides notifications for specific wallet addresses. The bot tracks NFT transactions, detects collections, and provides detailed information about transactions on the TON blockchain.

## Features

- **Transaction Monitoring**: Track and notify users about new transactions on specified TON addresses
- **NFT Support**: Detect and display information about NFT transactions, collections, and items
- **Subscription System**: Allow users to subscribe to specific wallet addresses for real-time notifications
- **Gift Detection**: Special feature to identify potential gift transactions on the TON blockchain
- **Rarity Analysis**: Provide rarity analysis for NFT items

## Bot Commands

- `/start` - Welcome message and command list
- `/subscribe <address>` - Subscribe to notifications for a specific TON address
- `/unsubscribe <address>` - Unsubscribe from notifications for an address
- `/transactions <address>` - Get latest transactions for an address
- `/status` - Check current subscriptions
- `/gift <address>` - Check for Telegram gifts on an address
- `/nft <address>` - Check NFT details for an address
- `/rarity <address>` - Check NFT rarity information

## Technical Implementation

### TON API Integration

- Uses TON API (tonapi.io) for blockchain data
- Implements proper error handling for API requests
- Supports multiple API endpoints for redundancy

### Data Structures

- In-memory database for user subscriptions
- Transaction timestamp tracking to avoid duplicate notifications
- Proper formatting for different transaction types

### Collection Detection

- Robust collection detection with multiple fallback methods
- Support for different collection data formats
- Proper handling of collection metadata and images

### Message Formatting

- Rich Markdown formatting for all messages
- Includes transaction links to block explorers
- Formats NFT details with images when available

### Error Handling

- Graceful error handling for all API requests
- Fallback mechanisms when primary endpoints fail
- Detailed logging for debugging purposes

## Project Structure

```
├── .env                  # Environment variables
├── ton-notification-bot.js  # Main bot code
├── restart-bot.sh        # Restart script
├── package.json          # Dependencies
└── README.md             # Documentation
```

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- Telegram Bot Token (from BotFather)
- TON API Key (from tonapi.io)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/ton-notification-bot.git
   cd ton-notification-bot
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your Telegram Bot Token and TON API Key

   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TON_API_KEY=your_tonapi_io_key
   TON_API_URL=https://tonapi.io/v2
   FALLBACK_TON_API_URL=https://toncenter.com/api/v2
   POLLING_INTERVAL=60000
   LOG_LEVEL=info
   ```

### Running the Bot

1. Start the bot:
   ```
   node ton-notification-bot.js
   ```

2. For production use with automatic restarts:
   ```
   chmod +x restart-bot.sh
   ./restart-bot.sh
   ```

3. For development with auto-reload:
   ```
   npm run dev
   ```

## Usage Examples

### Subscribing to an Address

Send the following command to the bot:
```
/subscribe EQCcJL2RCMxDXGxGYhRkDpC4iMxkKqPQQiubJP9xVYh_Jzxl
```

### Checking Transactions

Send the following command to the bot:
```
/transactions EQCcJL2RCMxDXGxGYhRkDpC4iMxkKqPQQiubJP9xVYh_Jzxl
```

### Checking NFT Details

Send the following command to the bot:
```
/nft EQCcJL2RCMxDXGxGYhRkDpC4iMxkKqPQQiubJP9xVYh_Jzxl
```

## Additional Considerations

- **Rate Limiting**: The bot implements delays between API requests to avoid hitting rate limits
- **Error Handling**: Comprehensive error handling to ensure the bot continues running even when API requests fail
- **Logging**: Detailed logging for debugging and monitoring
- **Cleanup**: Scheduled cleanup of inactive subscriptions to maintain performance

## Future Improvements

- Add support for multiple languages
- Implement a database for persistent storage
- Add analytics to track bot usage
- Support for more TON blockchain features as they become available

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.