const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { evaluatePolicy } = require('../core/opa');
const groupByType = require('../core/groupResources');
const { generateAuditReport } = require('../core/reportBuilder');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('file'), (req, res) => {
  const filePath = req.file.path;
  const originalName = req.file.originalname;

  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON format' });
  }

  if (!Array.isArray(plan.resource_changes)) {
    return res.status(400).json({ error: "'resource_changes' missing in file" });
  }

  const grouped = groupByType(plan.resource_changes);
  const violations = [];

  for (const [type, resources] of Object.entries(grouped)) {
    const policyPkg = `terraform.azure.${type.replaceAll('.', '_')}`;

    resources.forEach((res, idx) => {
      try {
        const result = evaluatePolicy(path.resolve('src/config/policies/azure'), { resource_changes: [res] }, policyPkg);
        result.forEach(v => {
          violations.push({
            resource_type: type,
            resource_name: res.address || `unnamed-${type}-${idx + 1}`,
            message: typeof v === 'object' ? v.message || JSON.stringify(v) : v,
            severity: typeof v === 'object' ? v.severity || 'unknown' : 'unknown',
            control: typeof v === 'object' ? v.control || 'N/A' : 'N/A',
            rule_id: typeof v === 'object' ? v.rule_id || null : null
          });
        });
      } catch (err) {
        console.warn(`Policy evaluation error for ${type}:`, err.message);
      }
    });
  }

  const report = generateAuditReport(violations, originalName);
  res.json(report);

  fs.unlink(filePath, () => {}); // optional cleanup
});

module.exports = router;
