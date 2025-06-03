const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auditPlan } = require('../auditEngine');
const { uploadBlob } = require('../services/blobService');

const router = express.Router();

// Multer config for .json only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.json')) {
      return cb(new Error('Invalid file type'), false);
    }
    cb(null, true);
  },
});

// Ensure tmp directory exists
const tmpDir = path.join(__dirname, '../../tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

router.post('/audit', upload.single('plan'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Missing plan file upload',
      details: 'Please upload a .json file with the field name "plan"',
    });
  }

  let tempPath;
  try {
    const { originalname, buffer } = req.file;
    const timestamp = Date.now();
    const planBlobName = `plans/${timestamp}-${originalname}`;
    const reportBlobName = `reports/report-${timestamp}.json`;
    tempPath = path.join(tmpDir, `${timestamp}-${originalname}`);

    // Upload original plan file + save to temp
    const [planBlobUrl] = await Promise.all([
      uploadBlob(planBlobName, buffer),
      fs.promises.writeFile(tempPath, buffer),
    ]);

    // Run audit
    const auditResult = await auditPlan(tempPath);

    // Prepare metadata-wrapped report
    const reportWithMeta = {
      report_id: `report-${timestamp}`,
      generated_at: new Date().toISOString(),
      source_file: originalname,
      summary: { violations: auditResult?.violations?.length || 0 },
      ...auditResult,
    };

    const reportBuffer = Buffer.from(JSON.stringify(reportWithMeta, null, 2));
    const reportBlobUrl = await uploadBlob(reportBlobName, reportBuffer);

    res.status(200).json({
      message: 'Audit successful',
      planBlobUrl,
      reportBlobUrl,
      report: reportWithMeta,
    });
  } catch (err) {
    console.error('Audit processing error:', err);
    res.status(500).json({
      error: 'Audit processing failed',
      details: err.message,
    });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlink(tempPath, (err) => {
        if (err) console.error('Temp file cleanup error:', err);
      });
    }
  }
});

module.exports = router;
