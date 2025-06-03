const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');
const { downloadBlob } = require('../services/blobService');

const router = express.Router();

// GET /report/
// Lists all report blobs (by name only)
router.get('/', async (req, res) => {
  try {
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
    const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const result = [];

    for await (const blob of containerClient.listBlobsFlat({ prefix: 'reports/' })) {
      const name = blob.name.split('/').pop();
      if (name.endsWith('.json')) {
        result.push({
          report_id: name.replace('.json', ''), // strip extension
          blob_name: blob.name,
          last_modified: blob.properties.lastModified,
        });
      }
    }

    result.sort((a, b) => new Date(b.last_modified) - new Date(a.last_modified));
    res.json(result);
  } catch (err) {
    console.error('Error listing report blobs:', err);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

// GET /report/:reportId
// Downloads and returns full JSON of the report
router.get('/:reportId', async (req, res) => {
  const { reportId } = req.params;
  const blobName = `reports/${reportId}.json`;

  try {
    const stream = await downloadBlob(blobName);
    const chunks = [];

    for await (const chunk of stream) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const json = JSON.parse(buffer.toString('utf-8'));

    res.json(json);
  } catch (err) {
    console.error('Error retrieving report blob:', err.message);
    res.status(404).json({ error: `Report ${reportId} not found` });
  }
});

// DELETE /report/:reportId
// Deletes a report blob by ID
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
