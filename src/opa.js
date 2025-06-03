const { writeFileSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

function evaluatePolicy(policyDir, inputData, policyPackage) {
  const inputPath = path.join('/tmp', `input-${Date.now()}.json`);
  writeFileSync(inputPath, JSON.stringify(inputData, null, 2));

  const result = spawnSync('opa', [
    'eval',
    '-i', inputPath,
    '-d', policyDir,
    `data.${policyPackage}.deny`,
    '--format', 'json'
  ]);

  if (result.error) {
    console.error('OPA execution error:', result.error.message);
    return [];
  }

  if (result.stderr.length > 0) {
    console.warn('OPA stderr:', result.stderr.toString());
  }

  try {
    const output = JSON.parse(result.stdout.toString());
    return output.result?.[0]?.expressions?.[0]?.value || [];
  } catch (err) {
    console.error(`Error parsing OPA result for ${policyPackage}:`, err.message);
    console.error(result.stdout.toString());
    return [];
  }
}

module.exports = { evaluatePolicy };
