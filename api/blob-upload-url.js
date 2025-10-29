// Serverless function to mint a signed upload URL for Vercel Blob
// Requires env var: VERCEL_BLOB_READ_WRITE_TOKEN

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  if (!token) {
    // Graceful fallback: signal client to use local upload endpoint
    res.status(200).json({ uploadUrl: null, note: 'No blob token configured' });
    return;
  }

  try {
    const apiUrl = 'https://api.vercel.com/v2/blobs';
    // We are creating an empty blob with clientUpload enabled which returns a signed upload URL
    const createResp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientUpload: true,
        token: token,
        // Optional: tag for organization
        metadata: { app: 'company-qr-generator' }
      })
    });

    if (!createResp.ok) {
      const text = await createResp.text();
      res.status(500).json({ error: 'Failed to prepare blob upload', details: text });
      return;
    }

    const data = await createResp.json();
    // data.uploadUrl is the signed URL; the client will PUT the file there
    res.status(200).json({ uploadUrl: data.uploadUrl });
  } catch (e) {
    res.status(500).json({ error: 'Blob upload URL error', details: e.message });
  }
};


