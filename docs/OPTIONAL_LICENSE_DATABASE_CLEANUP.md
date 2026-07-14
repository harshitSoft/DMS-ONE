# Optional license database cleanup

The license system is disabled by default with `ENABLE_LICENSE_SYSTEM=false`. The application no longer seeds, reads, allocates, approves, or enforces licenses in its normal flow. Existing license records are intentionally retained for history and rollback.

## Tables retained but unused

- `license_plans`
- `license_inventory`
- `company_licenses`
- `license_purchase_requests`
- `super_admin_targets`
- `super_admin_pinned_messages`
- `super_admin_chats`

The legacy license and Super Admin manager columns on `Companies` are also retained. Do not remove any table or column until a database backup has been tested and all foreign keys have been inventoried in the target environment.

## Future removal procedure (do not run automatically)

1. Back up the production database and restore it into a disposable environment.
2. Query `information_schema.KEY_COLUMN_USAGE` for every foreign key referencing the tables above.
3. Export historical license, target, pinned-message, and chat data required for audit retention.
4. Confirm no application logs contain calls to disabled license or legacy Super Admin manager endpoints.
5. Create a reviewed, environment-specific migration that drops foreign keys before tables and removes legacy company columns last.
6. Run the full authentication, organization, dealer, inventory, order, delivery, finance, credit, reporting, message, and profile regression suites against the restored copy.

To temporarily restore compatible backend behavior before permanent cleanup, set `ENABLE_LICENSE_SYSTEM=true` and/or `ENABLE_SUPER_ADMIN_MANAGER_ROLES=true`, then restart the backend. The frontend remains simplified; use the backup Git commit for a complete UI rollback.
