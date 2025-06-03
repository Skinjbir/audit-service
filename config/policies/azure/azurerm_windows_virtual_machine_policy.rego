package terraform.azure.azurerm_windows_virtual_machine

# Rule 1: OS Disk must be encrypted
deny[{
  "message": "Windows VM OS disk must be encrypted (ISO 27001: A.10.1.1, NIST SC-12, CIS Azure 2.5).",
  "severity": "high",
  "control": "ISO 27001: A.10.1.1"
}] {
  vm := input.resource_changes[_]
  vm.type == "azurerm_windows_virtual_machine"

  disk := object.get(vm.change.after, "os_disk", {})
  object.get(disk, "encryption_enabled", false) == false
}

# Rule 2: Managed identity must be enabled
deny[{
  "message": "Windows VM must use managed identity (ISO 27001: A.9.2.1, NIST IA-4).",
  "severity": "medium",
  "control": "ISO 27001: A.9.2.1"
}] {
  vm := input.resource_changes[_]
  vm.type == "azurerm_windows_virtual_machine"

  not object.get(vm.change.after, "identity", null)
}

# Rule 3: Must include 'Environment' tag
deny[{
  "message": "Windows VM must be tagged with 'Environment' for audit and classification (ISO 27001: A.8.1.1, NIST CM-8).",
  "severity": "medium",
  "control": "ISO 27001: A.8.1.1"
}] {
  vm := input.resource_changes[_]
  vm.type == "azurerm_windows_virtual_machine"

  tags := object.get(vm.change.after, "tags", {})
  not tags["Environment"]
}
