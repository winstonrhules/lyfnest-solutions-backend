const axios = require('axios');

const getZoomAccessToken = async () => {
  const credentials = `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`;
  const encoded = Buffer.from(credentials).toString('base64');

  const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`;

  const res = await axios.post(url, {}, {
    headers: { Authorization: `Basic ${encoded}` }
  });

  return res.data.access_token;
};

module.exports = { getZoomAccessToken };