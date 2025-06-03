# config/policies/custom/foobar.rego
package terraform.custom.foobar

# Deny any custom resource whose “foo” attribute equals "deny"
deny[msg] {
  some rc = input.resource_changes[_]
  rc.address
  rc.change.after.foo == "deny"
  msg := {
    "message": sprintf("Custom resource %v has foo=deny", [rc.address]),
    "severity": "low",
    "control": "CUSTOM-FOO-001",
    "rule_id": "FOOBAR001"
  }
}
