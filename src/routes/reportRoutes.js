const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const { listPolicyBlobs, downloadBlob } = require('../services/blobService');

const router = express.Router();

// Default value helpers
const ensureReportShape = (json) => {
  const now = new Date().toISOString();

  // Add default metadata
  json.metadata = {
    ...json.metadata,
    triggered_by: json.metadata?.triggered_by || "unknown",
    created_by: json.metadata?.created_by || "unknown",
    last_updated: json.metadata?.last_updated || now,
    audit_id: json.metadata?.audit_id || json.report_id || "unknown",
    plan_blob_url: json.metadata?.plan_blob_url || "",
    report_blob_url: json.metadata?.report_blob_url || ""
  };

  // Add summary shape
  json.summary = {
    owner: json.summary?.owner || "Unassigned",
    duration: json.summary?.duration || null,
    tags: json.summary?.tags || [],
    notes: json.summary?.notes || null
  };

  // Normalize score and status
  json.score = json.score ?? 100;
  json.status = json.status || "Completed";

  // Findings and remediation steps
  json.findings = json.findings || json.violations || [];
  json.remediation_steps = json.remediation_steps || [];

  return json;
};

// GET /report — List all full JSON reports
router.get('/', async (req, res) => {
  try {
    const blobs = await listPolicyBlobs('reports/');
    const reports = [];

    for (const blobName of blobs) {
      if (!blobName.endsWith('.json')) continue;

      try {
        const stream = await downloadBlob(blobName);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        const json = JSON.parse(buffer.toString('utf-8'));
        reports.push(ensureReportShape(json));
      } catch (error) {
        console.error(`Error reading/parsing ${blobName}:`, error.message);
      }
    }

    reports.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));
    res.json(reports);
  } catch (err) {
    console.error('Failed to list reports:', err.message);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// GET /report/:reportId — Return full JSON of one report
router.get('/:reportId', async (req, res) => {
  const { reportId } = req.params;
  const blobName = `reports/${reportId}.json`;

  try {
    const stream = await downloadBlob(blobName);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const json = JSON.parse(buffer.toString('utf-8'));

    res.json(ensureReportShape(json));
  } catch (err) {
    console.error('Error retrieving report blob:', err.message);
    res.status(404).json({ error: `Report ${reportId} not found` });
  }
});

// DELETE /report/:reportId — Delete a report by blob name
router.delete('/:reportId', async (req, res) => {
  const { reportId } = req.params;
  const blobName = `reports/${reportId}.json`;

  try {
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.deleteIfExists();
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting report blob:', err.message);
    res.status(500).json({ error: `Failed to delete report ${reportId}` });
  }
});

module.exports = router;
