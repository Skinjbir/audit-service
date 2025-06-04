// enrichRemediations.js
const fs = require('fs');
const path = require('path');
const { getRemediationSuggestion } = require('./ai');
require('dotenv').config();

async function enrichReportsWithRemediations(reportFilePath, outputFilePath) {
  const raw = fs.readFileSync(reportFilePath, 'utf-8');
  const reports = JSON.parse(raw);

  for (const report of reports) {
    const violations = report.violations || report.findings || [];
    if (violations.length === 0) continue;

    console.log(`🛠 Enhancing report ${report.report_id} with remediations...`);
    const remediations = [];

    for (const v of violations) {
      const remediation = await getRemediationSuggestion(v);
      remediations.push({
        rule_id: v.rule_id,
        resource_name: v.resource_name,
        remediation
      });
    }

    report.remediation_steps = remediations;
  }

  fs.writeFileSync(outputFilePath, JSON.stringify(reports, null, 2), 'utf-8');
  console.log(`✅ Enhanced report written to ${outputFilePath}`);
}

// Example usage:
enrichReportsWithRemediations('audit-reports.json', 'audit-reports-with-remediation.json');
