# BarStock Permission Matrix

This document records the access behavior before the RBAC refactor. Roles remain presets; users do not receive individual permissions.

| Role                 | Pages                                                                      | Data scope                                                                  | Write access                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| bartender            | Inventories, write-offs, transfers, messages                               | Own network, own restaurant, bar                                            | Create/edit/close bar inventories; create bar write-offs and transfers; confirm incoming and cancel own outgoing transfers                          |
| kitchen_manager      | Inventories, write-offs, transfers, messages                               | Own network, own restaurant, kitchen                                        | Same operational actions as bartender, limited to kitchen                                                                                           |
| accountant           | Reports, write-offs, transfers, admin, statistics, messages                | Own network, all restaurants, all areas                                     | Accounting quantities/comments, corrections, exports, inventories deletion, staff/products/categories/restaurants management, transfer cancellation |
| manager              | Statistics, reports opened from statistics, transfers, messages            | Own network; assigned restaurant when present, otherwise network; all areas | Read-only                                                                                                                                           |
| bar_manager          | Statistics, reports, write-offs, transfers, bar staff, messages            | Own network, all restaurants, bar                                           | Read-only operational/accounting data; create/deactivate own announcements                                                                          |
| kitchen_area_manager | Statistics, reports, write-offs, transfers, kitchen staff, messages        | Own network, all restaurants, kitchen                                       | Read-only operational/accounting data; create/deactivate own announcements                                                                          |
| super_admin          | Admin, reports, write-offs, transfers, statistics, messages, login history | All networks, all restaurants, all areas                                    | All existing administrative, accounting and export actions                                                                                          |

## Server Permission Presets

| Permission group                   | bartender | kitchen_manager | accountant            | manager | bar_manager | kitchen_area_manager | super_admin |
| ---------------------------------- | --------- | --------------- | --------------------- | ------- | ----------- | -------------------- | ----------- |
| Inventories view/create/edit/close | Yes       | Yes             | No                    | No      | No          | No                   | Yes         |
| Inventories reopen/delete          | No        | No              | Yes                   | No      | No          | No                   | Yes         |
| Reports view                       | No        | No              | Yes                   | Yes     | Yes         | Yes                  | Yes         |
| Reports accounting/export          | No        | No              | Yes                   | No      | No          | No                   | Yes         |
| Statistics view                    | No        | No              | Yes                   | Yes     | Yes         | Yes                  | Yes         |
| Write-offs view                    | Yes       | Yes             | Yes                   | No      | Yes         | Yes                  | Yes         |
| Write-offs create                  | Yes       | Yes             | No                    | No      | No          | No                   | Yes         |
| Transfers view                     | Yes       | Yes             | Yes                   | Yes     | Yes         | Yes                  | Yes         |
| Transfers create/confirm           | Yes       | Yes             | No                    | No      | No          | No                   | Yes         |
| Transfers cancel                   | Yes, own  | Yes, own        | Yes                   | No      | No          | No                   | Yes         |
| Announcements view                 | Yes       | Yes             | Yes                   | Yes     | Yes         | Yes                  | Yes         |
| Announcements create/deactivate    | No        | No              | No                    | No      | Yes, own    | Yes, own             | Yes         |
| Staff view                         | No        | No              | Yes                   | No      | Yes, area   | Yes, area            | Yes         |
| Staff create/edit/delete           | No        | No              | Yes, restricted roles | No      | No          | No                   | Yes         |
| Products/categories manage         | No        | No              | Yes                   | No      | No          | No                   | Yes         |
| Restaurants manage                 | No        | No              | Yes                   | No      | No          | No                   | Yes         |
| Networks/login history             | No        | No              | No                    | No      | No          | No                   | Yes         |
| Assign privileged system roles     | No        | No              | No                    | No      | No          | No                   | Yes         |

## Scope Rules

- `own` network means `resource.network_id = currentUser.network_id`.
- `all` network is reserved for `super_admin`.
- `own` restaurant requires the user's restaurant on ordinary resources. Transfers are visible when the restaurant is either endpoint.
- `network` restaurant scope covers restaurants only after network scope succeeds.
- `assigned_or_network` restricts to the assigned restaurant when present and otherwise covers the user's network.
- `bar` and `kitchen` scopes are always checked independently from permissions.
- Accounting permissions do not imply operational inventory or transfer permissions.

## Remaining Direct Role Checks

Direct comparisons are intentionally limited to:

- localized role labels in UI;
- login/bootstrap compatibility allowing `super_admin.network_id = null`;
- system-role assignment rules that prevent accountants from assigning `bar_manager`,
  `kitchen_area_manager`, `accountant`, or `super_admin`;
- role-specific form requirements, such as a mandatory restaurant for operational roles;
- dirty-state comparison in the staff editor.

Ordinary route access, menu visibility, server actions, network access, restaurant access, and area
access use permissions and scopes.

## Safe Rollout

1. Apply `db/kitchen_area_manager.sql` first if it has not already been applied.
2. Apply `db/rbac_permissions.sql`.
3. Confirm all seven rows exist in `app_roles` and every `users.role` has a matching role.
4. Confirm role permission rows were seeded.
5. Deploy the application code.
6. Test one user from every role, then test a direct request against another network and area.
