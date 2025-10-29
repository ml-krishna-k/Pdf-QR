// server.js - Node.js + Express Backend
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
let createCanvas, loadImage;
let canvasAvailable = true;
try {
  const canvasMod = require('canvas');
  createCanvas = canvasMod.createCanvas;
  loadImage = canvasMod.loadImage;
} catch (err) {
  console.warn('Optional dependency `canvas` not available. QR with embedded logo will fall back to plain QR (no logo overlay).', err.message);
  canvasAvailable = false;
}
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
// Serve static files for local development (root files & uploads directory)
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/', express.static(__dirname));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const finalName = Date.now() + '_' + safeName;
    cb(null, finalName);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    res.json({ success: true, url: fileUrl, filename: req.file.filename });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, error: 'Failed to upload file' });
  }
});

// ============================================
// GENERATE QR CODE WITH EMBEDDED LOGO
// ============================================
app.post('/api/generate-qr', async (req, res) => {
  try {
    const { url, logoUrl } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Default logo if none provided
    // CUSTOMIZATION POINT: Replace this with your company logo URL
    const defaultLogo = 'https://via.placeholder.com/150/4F46E5/ffffff?text=LOGO';
    const logo = logoUrl || defaultLogo;

    // QR Code generation options
    // CUSTOMIZATION POINT: Adjust QR code appearance
    const qrOptions = {
      errorCorrectionLevel: 'H', // High error correction for logo overlay
      type: 'image/png',
      quality: 1,
      margin: 2,
      width: 400,
      color: {
        dark: '#1F2937',  // CUSTOMIZATION POINT: QR code dark modules color
        light: '#FFFFFF'  // CUSTOMIZATION POINT: QR code background color
      }
    };

    // If canvas is not available (native build issues), fall back to simple QR without logo overlay
    if (!canvasAvailable) {
      const fallbackOptions = Object.assign({}, qrOptions);
      // qrcode.toDataURL expects different option names; pass a minimal set
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: fallbackOptions.errorCorrectionLevel || 'H',
        margin: fallbackOptions.margin || 2,
        color: fallbackOptions.color || { dark: '#000000', light: '#FFFFFF' }
      });

      return res.json({ success: true, qrCode: dataUrl, note: 'canvas not available, returned plain QR without embedded logo' });
    }

    // Generate QR code to canvas
    const canvas = createCanvas(qrOptions.width, qrOptions.width);
    await QRCode.toCanvas(canvas, url, qrOptions);
    const ctx = canvas.getContext('2d');

    // Load and draw logo in center
    try {
      // Fetch logo image
      const logoImage = await loadImage(logo);
      
      // Calculate logo size and position
      // CUSTOMIZATION POINT: Adjust logo size (currently 20% of QR code)
      const logoSize = canvas.width * 0.2;
      const logoPosition = (canvas.width - logoSize) / 2;

      // Draw white background circle for logo
      const bgSize = logoSize * 1.2;
      const bgPosition = (canvas.width - bgSize) / 2;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(
        canvas.width / 2,
        canvas.height / 2,
        bgSize / 2,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Draw colored border around logo
      // CUSTOMIZATION POINT: Change border color to match your brand
      ctx.strokeStyle = '#4F46E5';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        canvas.width / 2,
        canvas.height / 2,
        bgSize / 2,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      // Draw logo with rounded corners
      const radius = 8;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(logoPosition + radius, logoPosition);
      ctx.lineTo(logoPosition + logoSize - radius, logoPosition);
      ctx.quadraticCurveTo(logoPosition + logoSize, logoPosition, logoPosition + logoSize, logoPosition + radius);
      ctx.lineTo(logoPosition + logoSize, logoPosition + logoSize - radius);
      ctx.quadraticCurveTo(logoPosition + logoSize, logoPosition + logoSize, logoPosition + logoSize - radius, logoPosition + logoSize);
      ctx.lineTo(logoPosition + radius, logoPosition + logoSize);
      ctx.quadraticCurveTo(logoPosition, logoPosition + logoSize, logoPosition, logoPosition + logoSize - radius);
      ctx.lineTo(logoPosition, logoPosition + radius);
      ctx.quadraticCurveTo(logoPosition, logoPosition, logoPosition + radius, logoPosition);
      ctx.closePath();
      ctx.clip();
      
      ctx.drawImage(logoImage, logoPosition, logoPosition, logoSize, logoSize);
      ctx.restore();

    } catch (logoError) {
      console.warn('Logo loading failed, continuing without logo:', logoError.message);
      // QR code will be returned without logo if logo fails to load
    }

    // Convert canvas to base64
    const base64 = canvas.toDataURL('image/png');

    res.json({
      success: true,
      qrCode: base64
    });

  } catch (error) {
    console.error('QR Generation Error:', error);
    res.status(500).json({
      error: 'Failed to generate QR code',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Serve index.html for the root in local dev
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   Company QR Generator Server Running     ║
║   Port: ${PORT}                              ║
║   Environment: ${process.env.NODE_ENV || 'development'}               ║
╚════════════════════════════════════════════╝
  `);
});