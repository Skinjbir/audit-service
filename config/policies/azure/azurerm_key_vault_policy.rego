package terraform.azure.azurerm_key_vault

deny[msg] {
  some i
  res := input.resource_changes[i]
  res.type == "azurerm_key_vault"

  object.get(res.change.after, "enabled_for_disk_encryption", false) == false
  msg := "Key Vault must be enabled for disk encryption (ISO 27001: A.10.1.1, NIST SC-12, CIS Azure 5.1)."
}

deny[msg] {
  some i
  res := input.resource_changes[i]
  res.type == "azurerm_key_vault"

  object.get(res.change.after, "enable_rbac_authorization", false) == false
  msg := "Key Vault must use RBAC authorization instead of access policies (ISO 27001: A.9.2.3, NIST AC-6)."
}

deny[msg] {
  some i
  res := input.resource_changes[i]
  res.type == "azurerm_key_vault"

  object.get(res.change.after, "enable_purge_protection", false) == false
  msg := "Key Vault must enable purge protection to prevent accidental deletion (ISO 27001: A.12.3.1, NIST CP-9, AU-9)."
}

deny[msg] {
  some i
  res := input.resource_changes[i]
  res.type == "azurerm_key_vault"

  object.get(res.change.after, "enable_soft_delete", true) == false
  msg := "Key Vault must enable soft delete to allow recovery (ISO 27001: A.12.3.1, CIS Azure 5.4)."
}

deny[msg] {
  some i
  res := input.resource_changes[i]
  res.type == "azurerm_key_vault"

  object.get(res.change.after, "public_network_access", "Enabled") != "Disabled"
  msg := "Key Vault must block public network access (ISO 27001: A.13.1.1, CIS Azure 5.5, NIST AC-3)."
}
