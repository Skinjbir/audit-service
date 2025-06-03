package terraform.aws.instance

# Deny any aws instance whose name contains "bad"
deny[msg] {
  some rc = input.resource_changes[_]
  rc.address                       # ensures rc.address exists
  rc.change.after.tags["Name"] == "bad-instance"
  msg := {
    "message": sprintf("AWS instance %v has forbidden name", [rc.address]),
    "severity": "high",
    "control": "CUSTOM-AWS-001",
    "rule_id": "AWS001"
  }
}
