const fs = require('fs');
const path = require('path');
const { evaluatePolicy } = require('./opa.js');
const groupByType = require('./groupResources');
const { writeJsonReport } = require('./writeReport');
const { getRemediationSuggestion } = require('./services/ai'); // DeepSeek integration

async function auditPlan(planFile) {
  const policyRoot = path.resolve('config/policies/azure');
  let chalk = (await import('./chalk.mjs')).default;

  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  } catch (e) {
    throw new Error('Failed to read or parse plan file: ' + e.message);
  }

  const resourceChanges = plan.resource_changes;
  if (!Array.isArray(resourceChanges)) {
    throw new Error("plan.json doesn't have a valid 'resource_changes' array.");
  }

  const grouped = groupByType(resourceChanges);
  const allViolations = [];

  for (const [type, changes] of Object.entries(grouped)) {
    const policyPkg = `terraform.azure.${type.replaceAll('.', '_')}`;

    for (const [idx, res] of changes.entries()) {
      const inputForOPA = { resource_changes: [res] };

      try {
        const violations = evaluatePolicy(policyRoot, inputForOPA, policyPkg);

        for (const v of violations) {
          const violation = {
            resource_type: type,
            resource_name: res.address || `unnamed-${type}-${idx + 1}`,
            message: typeof v === 'object' ? v.message || JSON.stringify(v) : v,
            severity: typeof v === 'object' ? v.severity || 'unknown' : 'unknown',
            control: typeof v === 'object' ? v.control || 'N/A' : 'N/A',
            rule_id: typeof v === 'object' ? v.rule_id || null : null
          };

          // 🔐 AI-based remediation with error handling
          try {
            violation.remediation = await getRemediationSuggestion(violation);
          } catch (err) {
            console.warn(`[AI ERROR] Failed remediation for ${violation.resource_name}: ${err.message}`);
            violation.remediation = 'AI remediation unavailable due to internal error.';
          }

          allViolations.push(violation);
        }

      } catch (err) {
        throw new Error(`Error evaluating ${type}: ${err.message}`);
      }
    }
  }

  const report = {
    summary: {
      total_violations: allViolations.length,
      by_severity: {
        high: allViolations.filter(v => v.severity === 'high').length,
        medium: allViolations.filter(v => v.severity === 'medium').length,
        low: allViolations.filter(v => v.severity === 'low').length,
        unknown: allViolations.filter(v => v.severity === 'unknown').length
      }
    },
    violations: allViolations
  };

  writeJsonReport(allViolations, 'audit-report.json', planFile);
  return report;
}

module.exports = { auditPlan };
