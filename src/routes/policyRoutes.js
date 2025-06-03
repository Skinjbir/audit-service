const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const POLICY_DIR = path.resolve('config/policies/azure');

// Ensure the directory exists
if (!fs.existsSync(POLICY_DIR)) {
  fs.mkdirSync(POLICY_DIR, { recursive: true });
}

// GET /policies
router.get('/', (req, res) => {
  fs.readdir(POLICY_DIR, (err, files) => {
    if (err) {
      console.error('Error listing policy files:', err.message);
      return res.status(500).json({ error: 'Failed to list policies' });
    }

    const policies = files
      .filter((file) => file.endsWith('.rego'))
      .map((file) => ({ name: file, path: path.join(POLICY_DIR, file) }));

    res.json(policies);
  });
});

// GET /policies/:name
router.get('/:name', (req, res) => {
  const filePath = path.join(POLICY_DIR, req.params.name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Policy not found' });
  }

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading policy file:', err.message);
      return res.status(500).json({ error: 'Failed to read policy' });
    }

    res.type('text/plain').send(data);
  });
});

// POST /policies/:name
router.post('/:name', express.text({ type: '*/*' }), (req, res) => {
  const filePath = path.join(POLICY_DIR, req.params.name);
  const content = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Policy content is required' });
  }

  fs.writeFile(filePath, content, 'utf8', (err) => {
    if (err) {
      console.error('Error saving policy file:', err.message);
      return res.status(500).json({ error: 'Failed to save policy' });
    }

    res.status(201).json({ message: 'Policy saved', name: req.params.name });
  });
});

// DELETE /policies/:name
router.delete('/:name', (req, res) => {
  const filePath = path.join(POLICY_DIR, req.params.name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Policy not found' });
  }

  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Error deleting policy file:', err.message);
      return res.status(500).json({ error: 'Failed to delete policy' });
    }

    res.status(204).end();
  });
});

module.exports = router;
