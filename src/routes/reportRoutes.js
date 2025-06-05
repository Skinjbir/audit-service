const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const { listPolicyBlobs, downloadBlob } = require('../services/blobService');

const router = express.Router();

// 🔧 Normalize the report structure
const ensureReportShape = (json, blobName = '') => {
  const now = new Date().toISOString();

  console.log(`🔍 [${blobName}] Raw report input:`); 
  console.log(JSON.stringify(json, null, 2));

  // Attempt to extract findings or fallback to violations
  let findings = [];
  if (Array.isArray(json.findings) && json.findings.length > 0) {
    findings = json.findings;
    console.log(`✅ [${blobName}] Found ${findings.length} findings`);
  } else if (Array.isArray(json.violations) && json.violations.length > 0) {
    findings = json.violations;
    console.log(`⚠️ [${blobName}] Using fallback from violations (${findings.length})`);
  } else {
    console.log(`❌ [${blobName}] No findings or violations present`);
  }

  const normalized = {
    ...json,
    findings,
    remediation_steps: json.remediation_steps || [],
    score: json.score ?? 100,
    status: json.status || "Completed",
    metadata: {
      triggered_by: json.metadata?.triggered_by || "unknown",
      created_by: json.metadata?.created_by || "unknown",
      last_updated: json.metadata?.last_updated || now,
      audit_id: json.metadata?.audit_id || json.report_id || "unknown",
      plan_blob_url: json.metadata?.plan_blob_url || "",
      report_blob_url: json.metadata?.report_blob_url || ""
    },
    summary: {
      ...json.summary,
      owner: json.summary?.owner || "Unassigned",
      duration: json.summary?.duration || null,
      tags: json.summary?.tags || [],
      notes: json.summary?.notes || null,
      total_violations: findings.length
    }
  };

  console.log(`🧾 [${blobName}] Normalized report summary:`);
  console.log({
    findingsCount: normalized.findings.length,
    sampleFinding: normalized.findings[0] || 'none'
  });

  return normalized;
};

// 📄 GET /report — List all reports
router.get('/', async (req, res) => {
  try {
    const blobNames = await listPolicyBlobs('reports/');
    const reports = [];

    for (const blobName of blobNames) {
      if (!blobName.endsWith('.json')) continue;

      try {
        const stream = await downloadBlob(blobName);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        const reportJson = JSON.parse(buffer.toString('utf-8'));
        const normalized = ensureReportShape(reportJson, blobName);
        reports.push(normalized);
      } catch (err) {
        console.error(`⚠️ Error parsing blob ${blobName}:`, err.message);
      }
    }

    reports.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));
    res.status(200).json(reports);
  } catch (err) {
    console.error('❌ Failed to fetch reports:', err.message);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// 📄 GET /report/:reportId — Fetch one report
router.get('/:reportId', async (req, res) => {
  const { reportId } = req.params;
  const blobName = `reports/${reportId}.json`;

  try {
    const stream = await downloadBlob(blobName);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const reportJson = JSON.parse(buffer.toString('utf-8'));

    const normalized = ensureReportShape(reportJson, blobName);
    res.status(200).json(normalized);
  } catch (err) {
    console.error(`❌ Report not found (${reportId}):`, err.message);
    res.status(404).json({ error: `Report ${reportId} not found` });
  }
});

module.exports = router;
