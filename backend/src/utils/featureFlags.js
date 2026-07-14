function enabled(name, defaultValue = false) {
  const value = process.env[name];
  if (value == null || value === "") return defaultValue;
  return String(value).toLowerCase() === "true";
}

module.exports = {
  superAdminManagerRolesEnabled: () => enabled("ENABLE_SUPER_ADMIN_MANAGER_ROLES", false),
  licenseSystemEnabled: () => enabled("ENABLE_LICENSE_SYSTEM", false)
};
