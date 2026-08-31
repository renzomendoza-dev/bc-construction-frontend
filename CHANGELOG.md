# Changelog

All notable changes to this project are documented here, newest first. Dates are when the change was committed.

## 2026-08-31
- Add Site ↔ Warehouse Transfers and Material Requests: `Warehouse.type` (MAIN/SITE), Transfer Batches (list/create/detail/submit, with a pull-out-from-site vs dispatch-to-site direction toggle), Material Requests (list/create/detail/edit), and a "Create Dispatch from this Request" shortcut linking the two.
- Add this changelog and a proper Features section to the README.

## 2026-08-28
- Make the app responsive for phone-width screens (collapsible/overlay sidebar, scrollable tables, stacked forms).

## 2026-08-02
- Gate mutating UI actions (create/edit/deactivate/checkout/adjust/etc.) behind fine-grained permissions read from the Keycloak JWT.

## 2026-08-01
- Add Admin Users page for status/role management.
- Containerize frontend with a multi-stage Docker build.
- Replace equipment checkout user ID input with a name picker.

## 2026-07-31
- Add Equipment page with checkout/checkin and edit.

## 2026-07-28
- Add Purchase Receipts list, detail, and create (draft → confirm applies stock).
- Add Stock Levels page with adjust/transfer modals; later grouped by item instead of by location, with inline reorder-threshold editing.
- Add view/edit toggle to Item Detail.
- Fix warehouse-level stock display in Adjust/Transfer pickers.
- Wire dashboard inventory stats to real data.
- Add category list for items.

## 2026-07-26
- Initial Angular scaffold with Keycloak auth integration.
- Add collapsible sidebar nav, top bar with authenticated user identity, and dashboard with module cards.
- Add Items list/detail/create, Suppliers list with create/edit drawer, and Warehouse list.
