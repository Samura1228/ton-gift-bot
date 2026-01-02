const axios = require('axios');

const client = axios.create({
  timeout: 10000,
  headers: {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9'
  }
});

module.exports = client;