package terraform.azure.azurerm_storage_account

# Helper function to check if a field exists and is not null
has_field(obj, field) {
  object.get(obj, field, null) != null
}

# Convert SAS expiration to seconds
to_seconds(exp_period) {
  parts := split(exp_period, ".")
  days := to_number(parts[0]) * 86400
  time_parts := split(parts[1], ":")
  hours := to_number(time_parts[0]) * 3600
  minutes := to_number(time_parts[1]) * 60
  seconds := to_number(time_parts[2])
  days + hours + minutes + seconds
}

# Check for private endpoint
has_private_endpoint(storage_name) {
  some i
  pe := input.resource_changes[i]
  pe.type == "azurerm_private_endpoint"
  resource_id := object.get(pe.change.after.properties, "resource_id", "")
  contains(lower(resource_id), lower(storage_name))
}

deny[{
  "rule_id": "RULE-001",
  "message": "Storage Account must enforce HTTPS traffic (ISO 27001: A.13.2.1, CIS Azure 3.4, NIST SC-12).",
  "severity": "high",
  "control": "ISO 27001: A.13.2.1"
}] {
  rc := input.resource_changes[_]
  rc.type == "azurerm_storage_account"
  not object.get(rc.change.after, "enable_https_traffic_only", true)
}

deny[{
  "rule_id": "RULE-002",
  "message": "Storage Account must enforce TLS 1.2 or higher (ISO 27001: A.13.2.1, NIST SC-12).",
  "severity": "high",
  "control": "NIST SC-12"
}] {
  rc := input.resource_changes[_]
  rc.type == "azurerm_storage_account"
  valid_tls_versions := {"TLS1_2", "TLS1_3"}
  tls_version := object.get(rc.change.after, "minimum_tls_version", "TLS1_2")
  not valid_tls_versions[tls_version]
}

deny[{
  "rule_id": "RULE-003",
  "message": "Storage Account must use a customer-managed key (ISO 27001: A.10.1.1, CIS Azure 3.8, NIST SC-12(3)).",
  "severity": "high",
  "control": "ISO 27001: A.10.1.1"
}] {
  rc := input.resource_changes[_]
  rc.type == "azurerm_storage_account"
  encryption := object.get(rc.change.after, "encryption", {})
  not has_field(encryption, "key_vault_key_id")
}

deny[{
  "rule_id": "RULE-004",
  "message": "Storage Account must not allow public network access (ISO 27001: A.13.1.1, CIS Azure 3.5, NIST AC-3).",
  "severity": "high",
  "control": "ISO 27001: A.13.1.1"
}] {
  rc := input.resource_changes[_]
  rc.type == "azurerm_storage_account"
  public_access := object.get(rc.change.after, "public_network_access", "Enabled")
  public_access != "Disabled"
}

deny[{
  "rule_id": "RULE-005",
  "message": "Storage Account must be integrated with a private endpoint (ISO 27001: A.13.1.1, NIST AC-4, SC-7).",
  "severity": "high",
  "control": "ISO 27001: A.13.1.1"
}] {
  rc := input.resource_changes[_]
  rc.type == "azurerm_storage_account"
  not has_private_endpoint(rc.change.after.name)
}

deny[{
  "rule_id": "RULE-006",
  "message": "Blob soft delete must be enabled with 1–365 day retention (ISO 27001: A.18.1.3, NIST AU-9, CP-9).",
  "severity": "medium",
  "control": "ISO 27001: A.18.1.3"
}] {
  rc := input.resource_changes[_]
  rc.type == "azurerm_storage_account"
  blob_props := object.get(rc.change.after, "blob_properties", {})
  rp := object.get(blob_props, "delete_retention_policy", {})
  days := object.get(rp, "days", 0)
  not days >= 1
  not days <= 365
}

deny[{
  "rule_id": "RULE-007",
  "message": "SAS token expiry must not exceed 24 hours (ISO 27001: A.9.4.2, NIST AC-12, AC-2(5)).",
  "severity": "medium",
  "control": "ISO 27001: A.9.4.2"
}] {
  rc := input.resource_changes[_]
  rc.type == "azurerm_storage_account"
  sas_policy := object.get(rc.change.after, "sas_policy", {})
  exp_period := object.get(sas_policy, "expiration_period", "0.00:00:00")
  to_seconds(exp_period) > 86400
}

deny[{
  "rule_id": "RULE-008",
  "message": "Blob versioning must be enabled for recovery (ISO 27001: A.18.1.3, NIST CP-6).",
  "severity": "medium",
  "control": "ISO 27001: A.18.1.3"
}] {
  rc := input.resource_changes[_]
  rc.type == "azurerm_storage_account"
  blob_props := object.get(rc.change.after, "blob_properties", {})
  not has_field(blob_props, "versioning_enabled")
  not blob_props.versioning_enabled
}
