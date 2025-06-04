const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { auditPlan } = require('../auditEngine');
const { uploadBlob } = require('../services/blobService');

const router = express.Router();

// Multer config: Accept only .json files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.json')) {
      return cb(new Error('Invalid file type. Only JSON files are allowed.'), false);
    }
    cb(null, true);
  },
});

// Ensure /tmp directory exists
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

    // Save file locally and upload to blob storage
    const [planBlobUrl] = await Promise.all([
      uploadBlob(planBlobName, buffer),
      fsp.writeFile(tempPath, buffer),
    ]);

    // Run compliance audit
    const auditResult = await auditPlan(tempPath);

    // Calculate score
    const MAX_SCORE = 100;
    const calculateScore = (violations) => {
      const weights = { high: 10, medium: 5, low: 2, unknown: 1 };
      let deduction = 0;
      for (const v of violations) {
        const sev = (v.severity || 'unknown').toLowerCase();
        deduction += weights[sev] || 1;
      }
      return Math.max(0, MAX_SCORE - deduction);
    };
    const score = calculateScore(auditResult.violations);

    // Determine who triggered the pipeline
    const triggeredBy = req.headers['x-user'] || req.body.user || 'unknown';

    // Construct final report
    const reportWithMeta = {
      report_id: `report-${timestamp}`,
      generated_at: new Date().toISOString(),
      source_file: originalname,
      score,
      status: "Completed",
      summary: {
        ...auditResult.summary,
        owner: "Unassigned",
        duration: null,
        tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : [],
        notes: null
      },
      findings: auditResult.violations,
      remediation_steps: [],
      metadata: {
        triggered_by: triggeredBy,
        created_by: triggeredBy,
        last_updated: new Date().toISOString(),
        audit_id: `report-${timestamp}`,
        plan_blob_url: planBlobName,
        report_blob_url: reportBlobName,
        audited_by: 'PFS-AuditEngine',
        iso_scope: 'ISO/IEC 27001 Annex A',
        rgpd_scope: 'Articles 25, 32'
      }
    };

    // Upload report to Blob Storage
    const reportBuffer = Buffer.from(JSON.stringify(reportWithMeta, null, 2));
    const reportBlobUrl = await uploadBlob(reportBlobName, reportBuffer);

    res.status(200).json({
      message: 'Audit successful',
      planBlobUrl,
      reportBlobUrl,
      report: reportWithMeta
    });

  } catch (err) {
    console.error('Audit processing error:', err);
    res.status(500).json({
      error: 'Audit processing failed',
      details: err.message
    });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      fsp.unlink(tempPath).catch(err => console.error('Temp file cleanup error:', err));
    }
  }
});

module.exports = router;
