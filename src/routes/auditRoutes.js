// src/routes/auditRoutes.js

const express = require('express');
const path = require('path');
const { auditPlan } = require('../auditEngine');
const router = express.Router();

// POST /api/audit
//    Body: { planFile: "./path/to/plan.json" }
router.post('/audit', async (req, res) => {
  const { planFile } = req.body;
  if (!planFile) {
    return res.status(400).json({ error: 'planFile parameter is required' });
  }

  const fullPlanPath = path.resolve(planFile);
  try {
    const report = await auditPlan(fullPlanPath);
    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/health
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'Audit Engine is running' });
});

module.exports = router;
