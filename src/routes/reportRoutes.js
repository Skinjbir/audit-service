const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const { listPolicyBlobs, downloadBlob } = require('../services/blobService');

const router = express.Router();

// 🔧 Helper : Normalise la structure des rapports
const ensureReportShape = (json) => {
  const now = new Date().toISOString();

  // 🔁 Synchronisation findings <-> violations
  const findings = (json.findings && json.findings.length > 0)
    ? json.findings
    : (json.violations || []);

  // 🧱 Rebuild normalized report
  return {
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
      owner: json.summary?.owner || "Unassigned",
      duration: json.summary?.duration || null,
      tags: json.summary?.tags || [],
      notes: json.summary?.notes || null,
      total_violations: findings.length,
      ...(json.summary || {})
    }
  };
};

// 📄 GET /report — Lister tous les rapports
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
        reports.push(ensureReportShape(reportJson));
      } catch (err) {
        console.error(`⚠️ Erreur lecture/parsing ${blobName} :`, err.message);
      }
    }

    reports.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));
    res.status(200).json(reports);
  } catch (err) {
    console.error('❌ Échec de récupération des rapports :', err.message);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// 📄 GET /report/:reportId — Récupérer un rapport
router.get('/:reportId', async (req, res) => {
  const { reportId } = req.params;
  const blobName = `reports/${reportId}.json`;

  try {
    const stream = await downloadBlob(blobName);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const reportJson = JSON.parse(buffer.toString('utf-8'));

    res.status(200).json(ensureReportShape(reportJson));
  } catch (err) {
    console.error(`❌ Rapport non trouvé (${reportId}) :`, err.message);
    res.status(404).json({ error: `Report ${reportId} not found` });
  }
});

// 🗑️ DELETE /report/:reportId — Supprimer un rapport
router.delete('/:reportId', async (req, res) => {
  const { reportId } = req.params;
  const blobName = `reports/${reportId}.json`;

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    const containerClient = blobServiceClient.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NAME
    );
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.deleteIfExists();
    res.status(204).end();
  } catch (err) {
    console.error(`❌ Échec suppression rapport ${reportId} :`, err.message);
    res.status(500).json({ error: `Failed to delete report ${reportId}` });
  }
});
// 🧨 DELETE /report — Supprimer tous les rapports
router.delete('/', async (req, res) => {
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER_NAME);

    const blobNames = await listPolicyBlobs('reports/');
    const toDelete = blobNames.filter(name => name.endsWith('.json'));

    for (const name of toDelete) {
      const blockBlobClient = containerClient.getBlockBlobClient(name);
      await blockBlobClient.deleteIfExists();
    }

    res.status(204).end();
  } catch (err) {
    console.error('❌ Échec suppression de tous les rapports :', err.message);
    res.status(500).json({ error: 'Failed to delete all reports' });
  }
});

module.exports = router;
