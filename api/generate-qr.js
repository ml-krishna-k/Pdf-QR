// Vercel serverless function: Generate QR code (no heavy canvas dependency)
const QRCode = require('qrcode');

async function parseJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { url } = await parseJson(req);
    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    // Generate a simple QR as Data URL
    const dataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      color: { dark: '#1F2937', light: '#FFFFFF' }
    });

    res.status(200).json({ success: true, qrCode: dataUrl });
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate QR code', details: e.message });
  }
};


