// src/routes/policyRoutes.js

const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const router = express.Router();

// Base directory for all Azure policies:
const AZURE_POLICY_DIR = path.resolve('config/policies/azure');
fs.ensureDirSync(AZURE_POLICY_DIR);

// only allow ".rego"
function isRegoFile(fn) {
  return fn.endsWith('.rego');
}

// Helper to extract compliance controls (optional)
function extractControlsFromMessage(message) {
  if (!message) return [];
  const controlRegex =
    /(ISO 27001: A\.\d+\.\d+\.\d+|NIST [A-Z]+-\d+(\(\d+\))?|CIS Azure \d+\.\d+)/g;
  return [...new Set(message.match(controlRegex) || [])];
}

// Helper to extract metadata from Rego content (optional)
function extractPolicyMetadata(content) {
  const lines = content.split('\n');
  const descriptionLines = lines
    .filter((l) => l.trim().startsWith('#') && !l.includes('Rule '))
    .map((l) => l.replace(/^#\s*/, '').trim())
    .filter((l) => l.length > 0);
  const description =
    descriptionLines.length > 0
      ? descriptionLines.join(' ')
      : 'No description available';

  const ruleMatches =
    content.match(/deny\s*\[\s*{[^}]*}\s*\]|deny\s*\[\s*msg\s*\]\s*{[^}]*}/g) ||
    [];
  const rules = ruleMatches.map((rule) => {
    const messageMatch = rule.match(
      /"message":\s*"([^"]+)"|msg\s*:=\s*"([^"]+)"/
    );
    const severityMatch = rule.match(/"severity":\s*"([^"]+)"/);
    const controlMatch = rule.match(/"control":\s*"([^"]+)"/);
    const ruleIdMatch = rule.match(/"rule_id":\s*"([^"]+)"/);
    const message = messageMatch
      ? messageMatch[1] || messageMatch[2]
      : null;
    return {
      message,
      severity: severityMatch ? severityMatch[1] : 'unknown',
      control: controlMatch
        ? controlMatch[1]
        : extractControlsFromMessage(message)[0] || null,
      ruleId: ruleIdMatch ? ruleIdMatch[1] : null,
      controls: extractControlsFromMessage(message),
    };
  });

  const pkgMatch = content.match(/package\s+terraform\.azure\.([^\s]+)/);
  const resourceType = pkgMatch ? pkgMatch[1] : 'unknown';

  const complianceControls = [
    ...new Set(rules.flatMap((r) => r.controls)),
  ];
  const severityLevels = [
    ...new Set(rules.map((r) => r.severity).filter((s) => s)),
  ];

  return {
    description,
    ruleCount: rules.length,
    rules,
    resourceType,
    complianceControls,
    severityLevels,
  };
}

// GET /policies
//   → list all .rego files + metadata (and optionally content)
router.get('/', async (req, res) => {
  try {
    let allFiles = await fs.readdir(AZURE_POLICY_DIR);
    allFiles = allFiles.filter(isRegoFile);

    const entries = [];
    for (const file of allFiles) {
      const fullPath = path.join(AZURE_POLICY_DIR, file);
      const stats = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath, 'utf8');
      const meta = extractPolicyMetadata(content);

      const entry = {
        name: file,
        metadata: {
          sizeBytes: stats.size,
          lastModified: stats.mtime.toISOString(),
          description: meta.description,
          ruleCount: meta.ruleCount,
          resourceType: meta.resourceType,
          complianceControls: meta.complianceControls,
          severityLevels: meta.severityLevels,
          rules: meta.rules.map((r) => ({
            message: r.message,
            severity: r.severity,
            control: r.control,
            ruleId: r.ruleId,
            controls: r.controls,
          })),
        },
      };

      // include content unless explicitly disabled
      if (req.query.includeContent !== 'false') {
        entry.content = content;
      }
      entries.push(entry);
    }

    // Filtering, sorting, pagination (optional; same as before)
    let result = entries;
    const filterResource = req.query.resource;
    const filterControl = req.query.control;
    const sortBy = req.query.sort || 'name';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    if (filterResource) {
      result = result.filter((p) =>
        p.metadata.resourceType
          .toLowerCase()
          .includes(filterResource.toLowerCase())
      );
    }
    if (filterControl) {
      result = result.filter((p) =>
        p.metadata.complianceControls.some((c) =>
          c.toLowerCase().includes(filterControl.toLowerCase())
        )
      );
    }

    if (sortBy === 'ruleCount') {
      result.sort((a, b) => b.metadata.ruleCount - a.metadata.ruleCount);
    } else if (sortBy === 'lastModified') {
      result.sort(
        (a, b) =>
          new Date(b.metadata.lastModified) -
          new Date(a.metadata.lastModified)
      );
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    const totalCount = result.length;
    const start = (page - 1) * limit;
    const paginated = result.slice(start, start + limit);

    // summary stats (optional)
    const totalRules = result.reduce(
      (sum, p) => sum + p.metadata.ruleCount,
      0
    );
    const severityCounts = result.reduce((acc, p) => {
      p.metadata.rules.forEach((r) => {
        acc[r.severity] = (acc[r.severity] || 0) + 1;
      });
      return acc;
    }, {});
    const complianceSummary = result.reduce((acc, p) => {
      p.metadata.complianceControls.forEach((c) => {
        const std = c.split(':')[0].trim() || 'Other';
        acc[std] = acc[std] || {};
        acc[std][c] = (acc[std][c] || 0) + 1;
      });
      return acc;
    }, {});

    const pretty = req.query.pretty === 'true';
    const opts = pretty ? { spaces: 2 } : {};

    return res.json(
      {
        status: 'success',
        count: paginated.length,
        totalCount,
        page,
        limit,
        summary: {
          totalPolicies: result.length,
          totalRules,
          severityCounts,
          complianceSummary,
        },
        policies: paginated,
        timestamp: new Date().toISOString(),
      },
      opts
    );
  } catch (err) {
    console.error('Failed to list policies:', err);
    return res.status(500).json({
      status: 'error',
      error: 'Could not list policies',
      details: err.message,
    });
  }
});

// GET /policies/:policyName
//   → return { name, content }
router.get('/:policyName', async (req, res) => {
  const policyName = req.params.policyName;
  if (!isRegoFile(policyName)) {
    return res.status(400).json({ error: 'Invalid policy filename' });
  }
  const fullPath = path.join(AZURE_POLICY_DIR, policyName);
  try {
    if (!await fs.pathExists(fullPath)) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    const content = await fs.readFile(fullPath, 'utf8');
    return res.json({ name: policyName, content });
  } catch (err) {
    console.error('Error reading policy:', err);
    return res.status(500).json({ error: 'Failed to read policy' });
  }
});

// POST /policies
//   Body: { name, content } → creates new .rego
router.post('/', async (req, res) => {
  const { name, content } = req.body;
  if (!name || !content) {
    return res
      .status(400)
      .json({ error: 'Both "name" and "content" are required' });
  }
  if (!isRegoFile(name)) {
    return res
      .status(400)
      .json({ error: 'Policy name must end with .rego' });
  }
  const targetPath = path.join(AZURE_POLICY_DIR, name);
  if (await fs.pathExists(targetPath)) {
    return res.status(409).json({ error: 'Policy already exists' });
  }
  try {
    await fs.writeFile(targetPath, content, 'utf8');
    return res.status(201).json({ message: 'Policy created', name });
  } catch (err) {
    console.error('Error writing new policy:', err);
    return res.status(500).json({ error: 'Failed to write policy file' });
  }
});

// PUT /policies/:policyName
//   Body: { content } → replaces existing .rego
router.put('/:policyName', async (req, res) => {
  const policyName = req.params.policyName;
  const { content } = req.body;
  if (!isRegoFile(policyName)) {
    return res.status(400).json({ error: 'Invalid policy filename' });
  }
  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'Content is required' });
  }
  const fullPath = path.join(AZURE_POLICY_DIR, policyName);
  if (!await fs.pathExists(fullPath)) {
    return res.status(404).json({ error: 'Policy not found' });
  }
  try {
    await fs.writeFile(fullPath, content, 'utf8');
    return res.json({ message: 'Policy updated', name: policyName });
  } catch (err) {
    console.error('Error updating policy:', err);
    return res.status(500).json({ error: 'Failed to update policy file' });
  }
});

// DELETE /policies/:policyName
//   → delete a .rego file
router.delete('/:policyName', async (req, res) => {
  const policyName = req.params.policyName;
  if (!isRegoFile(policyName)) {
    return res.status(400).json({ error: 'Invalid policy filename' });
  }
  const fullPath = path.join(AZURE_POLICY_DIR, policyName);
  if (!await fs.pathExists(fullPath)) {
    return res.status(404).json({ error: 'Policy not found' });
  }
  try {
    await fs.unlink(fullPath);
    return res.json({ message: 'Policy deleted', name: policyName });
  } catch (err) {
    console.error('Error deleting policy:', err);
    return res.status(500).json({ error: 'Failed to delete policy file' });
  }
});

module.exports = router;
