// src/reportRoutes.js

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Assume all reports are JSON files directly under "./output/"
const OUTPUT_DIR = path.resolve('output');

// Helper: read & parse a JSON file, return null on parse error
function safeReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// GET /api/reports
// Returns a list of all reports, each with { report_id, generated_at, source_file, summary }
router.get('/', (req, res) => {
  // Ensure OUTPUT_DIR exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    return res.json([]); // no reports yet
  }

  // Read all files in OUTPUT_DIR that end with .json
  const files = fs.readdirSync(OUTPUT_DIR).filter((fn) => fn.endsWith('.json'));

  const result = [];
  for (const filename of files) {
    const fullPath = path.join(OUTPUT_DIR, filename);
    const parsed = safeReadJson(fullPath);
    if (parsed && typeof parsed.report_id === 'string') {
      // Only pick the fields we want
      result.push({
        report_id: parsed.report_id,
        generated_at: parsed.generated_at,
        source_file: parsed.source_file,
        summary: parsed.summary,
      });
    }
  }

  // Sort by generated_at descending
  result.sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at));

  return res.json(result);
});

// GET /api/reports/:reportId
// Returns the full JSON of the matching report, or 404 if not found
router.get('/:reportId', (req, res) => {
  const { reportId } = req.params;

  if (!fs.existsSync(OUTPUT_DIR)) {
    return res.status(404).json({ error: 'No reports directory found' });
  }

  // Scan each JSON in OUTPUT_DIR to find matching report_id
  const files = fs.readdirSync(OUTPUT_DIR).filter((fn) => fn.endsWith('.json'));
  for (const filename of files) {
    const fullPath = path.join(OUTPUT_DIR, filename);
    const parsed = safeReadJson(fullPath);
    if (parsed && parsed.report_id === reportId) {
      // Stream the entire file back
      return res.json(parsed);
    }
  }

  return res.status(404).json({ error: `Report ${reportId} not found` });
});

// DELETE /api/reports/:reportId
// Deletes the matching report file, returns 204 on success or 404 if not found
router.delete('/:reportId', (req, res) => {
  const { reportId } = req.params;

  if (!fs.existsSync(OUTPUT_DIR)) {
    return res.status(404).json({ error: 'No reports directory found' });
  }

  const files = fs.readdirSync(OUTPUT_DIR).filter((fn) => fn.endsWith('.json'));
  for (const filename of files) {
    const fullPath = path.join(OUTPUT_DIR, filename);
    const parsed = safeReadJson(fullPath);
    if (parsed && parsed.report_id === reportId) {
      try {
        fs.unlinkSync(fullPath);
        return res.status(204).end();
      } catch (err) {
        return res.status(500).json({ error: 'Failed to delete report' });
      }
    }
  }

  return res.status(404).json({ error: `Report ${reportId} not found` });
});

module.exports = router;
