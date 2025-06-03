const fs = require('fs');
const path = require('path');
const { evaluatePolicy } = require('./opa.js');
const groupByType = require('./groupResources');
const { printViolations, printSummary } = require('./formatOutput');
const { writeJsonReport } = require('./writeReport');

let chalk;

(async () => {
  chalk = (await import('./chalk.mjs')).default;

  const planFile = process.argv[2];
  const policyRoot = path.resolve('config/policies/azure');

  if (!planFile) {
    console.error('Usage: node src/audit.js <path-to-plan.json>');
    process.exit(1);
  }

  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  } catch (e) {
    console.error('Failed to read or parse plan file:', e.message);
    process.exit(1);
  }

  const resourceChanges = plan.resource_changes;
  if (!Array.isArray(resourceChanges)) {
    console.error("❌ plan.json doesn't have a valid 'resource_changes' array.");
    process.exit(1);
  }

  const grouped = groupByType(resourceChanges);
  const allViolations = [];

  for (const [type, changes] of Object.entries(grouped)) {
    const policyPkg = `terraform.azure.${type.replaceAll('.', '_')}`;
    console.log(`\n🔍 Evaluating ${changes.length} resources of type: ${type}`);

    changes.forEach((res, idx) => {
      console.log(`--- Resource #${idx + 1} ---`);
      console.dir(res, { depth: null, colors: true });

      const inputForOPA = { resource_changes: [res] };

      try {
        const violations = evaluatePolicy(policyRoot, inputForOPA, policyPkg);
        if (violations.length) {
          violations.forEach(v => {
            allViolations.push({
              resource_type: type,
              resource_name: res.address || `unnamed-${type}-${idx + 1}`,
              message: typeof v === 'object' ? v.message || JSON.stringify(v) : v,
              severity: typeof v === 'object' ? v.severity || 'unknown' : 'unknown',
              control: typeof v === 'object' ? v.control || 'N/A' : 'N/A',
              rule_id: typeof v === 'object' ? v.rule_id || null : null
            });
          });
        } else {
          console.log(chalk.green(`✅ ${type}: No violations for resource #${idx + 1}`));
        }
      } catch (err) {
        console.error(`⚠️  Error evaluating ${type}:`, err.message);
      }
    });
  }

  if (allViolations.length === 0) {
    console.log(chalk.green('\n🎉 All checks passed. No policy violations.'));
  } else {
    await printViolations(allViolations);
    await printSummary(allViolations);
    writeJsonReport(allViolations, 'audit-report.json', planFile);
    process.exit(2);
  }
})();
