package terraform.azure.azurerm_linux_virtual_machine

deny[{
  "message": "Linux VM must disable password authentication (ISO 27001: A.9.2.1, NIST IA-2, CIS Azure 2.1).",
  "severity": "high",
  "control": "ISO 27001: A.9.2.1"
}] {
  some i
  vm := input.resource_changes[i]
  vm.type == "azurerm_linux_virtual_machine"
  not object.get(vm.change.after.os_profile_linux_config, "disable_password_authentication", true)
}

deny[{
  "message": "Linux VM OS disk must be encrypted (ISO 27001: A.10.1.1, NIST SC-12, CIS Azure 2.5).",
  "severity": "high",
  "control": "ISO 27001: A.10.1.1"
}] {
  some i
  vm := input.resource_changes[i]
  vm.type == "azurerm_linux_virtual_machine"
  object.get(vm.change.after.os_disk, "encryption_enabled", false) == false
}

deny[{
  "message": "Linux VM must use managed identity for secure resource access (ISO 27001: A.9.2.1, NIST IA-4).",
  "severity": "medium",
  "control": "ISO 27001: A.9.2.1"
}] {
  some i
  vm := input.resource_changes[i]
  vm.type == "azurerm_linux_virtual_machine"
  not object.get(vm.change.after, "identity", null)
}
