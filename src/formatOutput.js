let chalk;
async function ensureChalk() {
  if (!chalk) chalk = (await import('./chalk.mjs')).default;
}

async function printViolations(violations) {
  await ensureChalk();

  console.log(chalk.red(`\n❌ ${violations.length} Policy Violation(s):`));
  violations.forEach((v, idx) => {
    const severityColor =
      v.severity === 'high' ? chalk.red.bold :
      v.severity === 'medium' ? chalk.yellow :
      v.severity === 'low' ? chalk.cyan : chalk.gray;

    console.log(`${idx + 1}. [${v.resource_type}] ${v.message}`);
    console.log(`    ${severityColor(`Severity: ${v.severity.toUpperCase()}`)}, Control: ${v.control}${v.rule_id ? `, Rule: ${v.rule_id}` : ''}`);
  });
}

async function printSummary(violations) {
  await ensureChalk();

  const severityOrder = ['high', 'medium', 'low', 'unknown'];
  const summary = {};

  violations.forEach(v => {
    const level = v.severity || 'unknown';
    summary[level] = (summary[level] || 0) + 1;
  });

  console.log(chalk.bold(`\n📊 Violation Summary by Severity:`));
  severityOrder.forEach(level => {
    if (summary[level]) {
      const label = `${level.toUpperCase()}:`.padEnd(10);
      const color =
        level === 'high' ? chalk.red :
        level === 'medium' ? chalk.yellow :
        level === 'low' ? chalk.cyan : chalk.gray;
      console.log(`- ${color(label)} ${summary[level]}`);
    }
  });
}

module.exports = { printViolations, printSummary };
