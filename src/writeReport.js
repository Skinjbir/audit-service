// src/writeReport.js

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Build a simple summary of violations by severity.
 */
function summarize(violations) {
  const summary = { high: 0, medium: 0, low: 0, unknown: 0 };
  for (const v of violations) {
    const key = v.severity || 'unknown';
    summary[key] = (summary[key] || 0) + 1;
  }
  return summary;
}

/**
 * Extract a sorted, deduplicated array of all controls from the violations list.
 */
function extractUniqueControls(violations) {
  const controlSet = new Set();
  for (const v of violations) {
    if (v.control) controlSet.add(v.control);
  }
  return Array.from(controlSet).sort();
}

/**
 * Given an array of 'raw' violations, enrich each violation with defaults,
 * generate a report_id (UUID), and build a full audit-report object.
 *
 * @param {Array<Object>} violations
 * @param {string|null} sourceFile   – name of the source plan (used in metadata)
 * @returns {Object}                 – the full audit report object
 */
function generateAuditReport(violations, sourceFile = 'inline.json') {
  // Normalize each violation and ensure rule_id / other fields exist
  const enhancedViolations = violations.map((v, i) => ({
    resource_type: v.resource_type || 'unknown',
    resource_name:
      v.resource_name ||
      `unnamed-${v.resource_type || 'resource'}-${i + 1}`,
    message: v.message || '',
    severity: v.severity || 'unknown',
    control: v.control || 'N/A',
    rule_id:
      v.rule_id || `RULE-${String(i + 1).padStart(3, '0')}`,
  }));

  return {
    report_id: uuidv4(),
    generated_at: new Date().toISOString(),
    source_file: path.basename(sourceFile || 'unknown'),
    summary: {
      total_violations: enhancedViolations.length,
      by_severity: summarize(enhancedViolations),
    },
    controls: extractUniqueControls(enhancedViolations),
    violations: enhancedViolations,
  };
}

/**
 * Write the audit report to disk under an `output/` directory, ensuring a unique filename.
 *
 * @param {Array<Object>} violations
 * @param {string|null} outputPath
 *      – If null/undefined: write to "output/audit-report-<UUID>.json"
 *      – If a directory path (ends with "/" or exists as a folder):
 *          write to "<thatDir>/audit-report-<UUID>.json" (but base it under output/)
 *      – If a filename:
 *          insert "-<UUID>" before the extension (or at end if no extension),
 *          then place that file under "output/".
 * @param {string|null} sourceFile  – optional path of the input plan (used in metadata)
 */
function writeJsonReport(violations, outputPath, sourceFile = null) {
  const report = generateAuditReport(violations, sourceFile);
  const uuidSuffix = report.report_id; // used in filename

  // 1) Ensure the top‐level "output/" folder exists
  const baseOutputDir = path.resolve('output');
  if (!fs.existsSync(baseOutputDir)) {
    fs.mkdirSync(baseOutputDir, { recursive: true });
  }

  let finalFilename;

  if (!outputPath) {
    // No path given → audit-report-<UUID>.json under "output/"
    finalFilename = `audit-report-${uuidSuffix}.json`;
  } else {
    // Determine if outputPath is meant to be a directory or a file
    let stat = null;
    try {
      stat = fs.statSync(outputPath);
    } catch (err) {
      stat = null;
    }

    if (
      outputPath.endsWith(path.sep) || // explicitly ends with "/"
      (stat && stat.isDirectory())
    ) {
      // Case A: Treat outputPath as a directory (relative or absolute)
      // But we still want to place everything under our top‐level "output/".
      // So if outputPath is "reports/", we write to "output/reports/audit-report-<UUID>.json"
      //
      const subDir = path.basename(outputPath.replace(/\/$/, ''));
      const targetDir = path.join(baseOutputDir, subDir);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      finalFilename = path.join(subDir, `audit-report-${uuidSuffix}.json`);
    } else {
      // Case B: Treat outputPath as a desired filename (with or without extension).
      // Insert "-<UUID>" just before the extension (or at the end if no extension).
      //
      // Example:
      //   outputPath = "myreport.json"   → "myreport-<UUID>.json"
      //   outputPath = "customName"       → "customName-<UUID>.json"
      //   outputPath = "reports/week1"    → "reports/week1-<UUID>.json"
      //
      const parsed = path.parse(outputPath);
      const namePart = parsed.name; // e.g. "myreport" from "myreport.json"
      const extPart = parsed.ext || '.json'; // default to ".json" if none

      // We ignore parsed.dir here, because all final filenames must live under "output/"
      // If the user included a subfolder path, we'll respect it under "output/".
      // So if they passed "reports/week1.json", we create "output/reports/week1-<UUID>.json".
      //
      let relativeDir = parsed.dir || '';
      // Normalize leading/trailing slashes
      relativeDir = relativeDir.replace(/^\/+|\/+$/g, '');

      if (relativeDir) {
        // Ensure subdirectory under output/ exists
        const fullSubDir = path.join(baseOutputDir, relativeDir);
        if (!fs.existsSync(fullSubDir)) {
          fs.mkdirSync(fullSubDir, { recursive: true });
        }
        finalFilename = path.join(
          relativeDir,
          `${namePart}-${uuidSuffix}${extPart}`
        );
      } else {
        // No subfolder—file lives directly under "output/"
        finalFilename = `${namePart}-${uuidSuffix}${extPart}`;
      }
    }
  }

  // 2) Compute the absolute path where we will write:
  const absoluteOutPath = path.join(baseOutputDir, finalFilename);

  // 3) Write the JSON to that file
  fs.writeFileSync(absoluteOutPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n📝 JSON report saved to ${absoluteOutPath}\n`);
}

module.exports = {
  writeJsonReport,
  generateAuditReport,
};
