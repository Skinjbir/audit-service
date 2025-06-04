// policies.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const SUPPORTED_PROVIDERS = ['azure', 'aws', 'gcp'];

/**
 * Helper: Resolve provider policy directory
 */
function getPolicyDir(provider) {
  if (!SUPPORTED_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  const dir = path.resolve('config/policies', provider);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * GET /policies/:provider
 * List all .rego files for a cloud provider
 */
router.get('/:provider', (req, res) => {
  const { provider } = req.params;
  let dir;
  try {
    dir = getPolicyDir(provider);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  fs.readdir(dir, (err, files) => {
    if (err) {
      console.error('Error reading policy directory:', err.message);
      return res.status(500).json({ error: 'Failed to list policy files' });
    }

    const policies = files
      .filter(f => f.endsWith('.rego'))
      .map(f => ({ name: f, path: `/${provider}/${f}` }));

    res.json(policies);
  });
});

/**
 * GET /policies/:provider/:name
 * Read a specific policy file
 */
router.get('/:provider/:name', (req, res) => {
  let filePath;
  try {
    filePath = path.join(getPolicyDir(req.params.provider), req.params.name);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Policy not found' });
  }

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading policy:', err.message);
      return res.status(500).json({ error: 'Failed to read policy file' });
    }
    res.type('text/plain').send(data);
  });
});

/**
 * POST /policies/:provider/:name
 * Save or update a policy file (text/plain body)
 */
router.post('/:provider/:name', express.text({ type: '*/*' }), (req, res) => {
  const { provider, name } = req.params;
  const content = req.body;

  if (!content || !name.endsWith('.rego')) {
    return res.status(400).json({ error: 'Valid .rego policy content is required' });
  }

  let filePath;
  try {
    filePath = path.join(getPolicyDir(provider), name);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  fs.writeFile(filePath, content, 'utf8', (err) => {
    if (err) {
      console.error('Error writing policy:', err.message);
      return res.status(500).json({ error: 'Failed to save policy' });
    }
    res.status(201).json({ message: 'Policy saved', file: name, provider });
  });
});

/**
 * DELETE /policies/:provider/:name
 * Delete a policy file
 */
router.delete('/:provider/:name', (req, res) => {
  let filePath;
  try {
    filePath = path.join(getPolicyDir(req.params.provider), req.params.name);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Policy not found' });
  }

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Error deleting policy:', err.message);
      return res.status(500).json({ error: 'Failed to delete policy' });
    }
    res.status(204).end();
  });
});

module.exports = router;
