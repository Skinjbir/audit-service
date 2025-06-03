const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER_NAME);

async function uploadBlob(name, bufferOrString) {
  const blockBlobClient = containerClient.getBlockBlobClient(name);
  const content = typeof bufferOrString === 'string'
    ? Buffer.from(bufferOrString, 'utf-8')
    : bufferOrString;
  await blockBlobClient.upload(content, content.length);
  return blockBlobClient.url;
}

async function downloadBlob(name) {
  const blobClient = containerClient.getBlobClient(name);
  const response = await blobClient.download();
  return response.readableStreamBody;
}

async function deleteBlob(name) {
  const blobClient = containerClient.getBlobClient(name);
  return await blobClient.deleteIfExists();
}

async function blobExists(name) {
  const blobClient = containerClient.getBlobClient(name);
  return await blobClient.exists();
}

async function listPolicyBlobs(prefix = '') {
  const blobNames = [];
  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    blobNames.push(blob.name);
  }
  return blobNames;
}

module.exports = {
  uploadBlob,
  downloadBlob,
  deleteBlob,
  blobExists,
  listPolicyBlobs
};
