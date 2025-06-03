function groupByType(resourceChanges) {
  const grouped = {};
  for (const change of resourceChanges) {
    const type = change.type;
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(change);
  }
  return grouped;
}
module.exports = groupByType;
