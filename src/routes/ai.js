const express = require('express');
const fs = require('fs');
const path = require('path');
const { generateRemediation } = require('../services/remediationService');

const router = express.Router();

router.post('/remediate', async (req, res) => {
  const reportId = req.body.reportId;

  if (!reportId) {
    return res.status(400).json({ error: 'Missing reportId in request body' });
  }

  const reportPath = path.resolve(`./output/${reportId}.json`);
  if (!fs.existsSync(reportPath)) {
    return res.status(404).json({ error: 'Report not found' });
  }

  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const remediations = await generateRemediation(report.violations || []);
    res.json({ remediations });
  } catch (err) {
    console.error(`AI error for report ${reportId}:`, err.stack || err);
    res.status(500).json({ error: 'Failed to generate remediations.' });
  }
});

module.exports = router;
