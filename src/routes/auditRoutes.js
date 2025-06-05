const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { auditPlan } = require('../auditEngine');
const { uploadBlob } = require('../services/blobService');
const mailSender = require('../services/mailSender');

const router = express.Router();

// Multer config: Accept only .json files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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
    const safeName = path.basename(originalname).replace(/\s+/g, '_');
    const planBlobName = `plans/${timestamp}-${safeName}`;
    const reportBlobName = `reports/report-${timestamp}.json`;
    tempPath = path.join(tmpDir, `${timestamp}-${safeName}`);

    // Optionally validate the JSON before saving
    try {
      const parsed = JSON.parse(buffer.toString('utf-8'));
      if (!parsed.resource_changes) {
        return res.status(400).json({ error: 'Invalid Terraform plan: missing resource_changes' });
      }
    } catch (parseErr) {
      return res.status(400).json({ error: 'Invalid JSON format' });
    }

    // Save file locally and upload to blob
    const [planBlobUrl] = await Promise.all([
      uploadBlob(planBlobName, buffer),
      fsp.writeFile(tempPath, buffer),
    ]);

    // Run audit
    const auditResult = await auditPlan(tempPath);

    const MAX_SCORE = 100;
    const calculateScore = (violations = []) => {
      const weights = { high: 10, medium: 5, low: 2, unknown: 1 };
      return Math.max(0, MAX_SCORE - violations.reduce((acc, v) => {
        const sev = (v.severity || 'unknown').toLowerCase();
        return acc + (weights[sev] || 1);
      }, 0));
    };

    const score = calculateScore(auditResult.violations || []);
    const triggeredBy = req.headers['x-user'] || req.body.user || 'unknown';

    const reportWithMeta = {
      report_id: `report-${timestamp}`,
      generated_at: new Date().toISOString(),
      source_file: safeName,
      score,
      status: "Completed",
      summary: {
        ...(auditResult.summary || {}),
        owner: "Unassigned",
        duration: null,
        tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : [],
        notes: null
      },
      findings: auditResult.violations || [],
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

    const reportBuffer = Buffer.from(JSON.stringify(reportWithMeta, null, 2));
    const reportBlobUrl = await uploadBlob(reportBlobName, reportBuffer);

    // Optional email notification
    const isEmailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (req.body.email && isEmailValid(req.body.email)) {
      const subject = 'Your Cloud Audit Report is Ready';
      const html = `
        <p>Hello,</p>
        <p>Your audit for <strong>${safeName}</strong> is complete.</p>
        <p><strong>Score:</strong> ${score}<br/>
        <strong>Report ID:</strong> ${reportWithMeta.report_id}</p>
        <p>You can view the report <a href="${reportBlobUrl}">here</a>.</p>
        <p>Regards,<br/>PFS Audit System</p>
      `;
      try {
        await mailSender.sendEmail(req.body.email, subject, html);
      } catch (emailErr) {
        console.warn('Email sending failed:', emailErr.message);
      }
    }

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
