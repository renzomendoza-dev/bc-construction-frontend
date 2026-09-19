# Changelog

All notable changes to this project are documented here, newest first. Dates are when the change was committed.

## 2026-09-19
- Replace the 22 hand-rolled dialogs, the Suppliers and Admin Users side drawers, and the receipt image viewer with one shared modal component: Escape closes, Tab stays inside the dialog, focus returns to what opened it, and screen readers announce it as a titled dialog. Removes the duplicated dialog/drawer styles from 12 pages.
- Make clickable list rows keyboard-accessible (Tab to focus, Enter to open; Space too for rows that open a drawer or expand), with a visible focus ring; Escape now also closes the mobile sidebar.
- Link every form label to its field, so clicking a label focuses the field and screen readers read the right name.
- Promote the template accessibility lint rules from warnings to errors now that the count is zero.
- Add ESLint (`angular-eslint`) with an `ng lint` target; the generated API client is excluded. Template accessibility rules are temporarily warnings until the shared form/dialog cleanup lands.
- Replace the unmaintained, non-compiling CLI scaffold specs with real unit tests covering permission gating (including the PO Submit regression), Purchase Order action visibility, the Attendance Calendar month grid, and peso formatting.
- Fix four small lint findings (unused import, constructor injection, two ternaries used as statements).

## 2026-09-08
- Fix Item Category showing/defaulting to the wrong value everywhere (Item Detail, Create, and the Items list filter) — the dropdown was pulling from a leftover, unrelated category list, so a new item could silently save with the wrong category unless someone manually corrected it. Category is now a free-text field with autocomplete suggestions drawn from your actual items.
- Fix Purchase Order's "Submit to Supplier" button being gated by the Edit permission instead of its own Submit permission.
- Fix "1 locations" grammar on the Warehouses & Sites page.

## 2026-09-07
- Add an Attendance Calendar for Workers: pick a project, see a month view of which days already have recorded attendance and how many workers, and click any day to batch-record attendance (time in/out per worker) for that project's assigned crew in one submission.
- Add a Crew section to Project detail for assigning/removing workers to a project, feeding the Attendance Calendar's per-day worker list.

## 2026-09-06
- Add Projects: track a project's code/name/budget/dates through an Active → On Hold → Completed lifecycle, with manual expense entry (Labor/Material/Other), a running expense summary against budget, and a filterable expense history.
- Add a Projects card to the Dashboard (Active Projects, Total Budget, and an Over Budget count across open projects).
- Fix Movement History showing every Transfer as a decrease, even on the destination side where stock actually increased — now driven by the backend's own direction signal per movement.
- Add Workers: a field-labor roster (name/position/daily rate, active/inactive) with a daily Attendance log per worker, where each recorded attendance auto-generates a Labor expense on the chosen project.
- Add an optional Project field to Transfers involving a site — submitting the transfer auto-records a Material expense on that project (a cost when dispatching to the site, a credit when pulling out), linked back to the transfer for reference.

## 2026-09-05
- Set the browser tab title to "BC Construction Services" and the favicon to the app's own logo, replacing the unconfigured Angular CLI defaults.
- Prevent picking the same item twice on one document — every item line form (Material Request, Transfer Batch, Purchase Receipt, Purchase Order, and their edit-in-place forms) now excludes items already chosen on another line of that same form from the dropdown.
- Fix New Purchase Order's auto-suggested line items not displaying correctly when a supplier has more than one suggestion (the same native-`<select>` timing issue fixed elsewhere) — suggested lines now show their item as fixed text; remove and re-add a line to pick a different item.

## 2026-09-03
- Add Delete for Material Requests and Purchase Orders (matching the existing Transfer Batch delete), each with its own confirm dialog and locked to the same status/edit rules as the entity's own Edit action.
- Add an "Awaiting Purchase" stat to the Dashboard's Inventory card, and a new Equipment card (Total Equipment, Checked Out, Overdue).
- Fix Stock Levels not making it obvious when the list is scoped to a single warehouse — a banner now shows "Showing stock for [Warehouse] only" with a one-click "Show All Warehouses" reset whenever a warehouse filter is active.
- Fix the item on a Material Request / Purchase Order edit form not displaying correctly, or only the first line item working, when editing an existing draft with more than one line — existing lines now show their item as fixed text (remove and re-add the line to pick a different item) instead of a native dropdown, sidestepping a persistent browser/Angular timing bug with pre-filled `<select>` elements.

## 2026-09-02
- Add a "View Stock" shortcut on each warehouse card that jumps to Stock Levels pre-filtered to that warehouse, so browsing what's on hand no longer requires finding it in the filter dropdown.
- Clean up equipment list/overdue/assignment-batches loading now that a backend spec regression (documented as returning a single object instead of an array) has been fixed — removed the array-cast workarounds.

## 2026-09-01
- Add Material Request ↔ Purchasing linkage: a Transfer Batch that fails submit for insufficient stock automatically becomes `AWAITING_PURCHASE` and is blocked in the UI until a linked Purchase Receipt (`fulfillsTransferBatchId`) is confirmed, which flips it back to Draft for resubmission.
- Add per-line stock availability hints (and an origin-shortfall warning) to Transfer Batch and Material Request create/edit screens.
- Add a Delete action for draft Transfer Batches.
- Add batch equipment assignment/return (Assign to Site / Return to Warehouse) with new list/create/detail pages, and link Equipment to real Warehouse records (`currentWarehouseId`) instead of a free-text site.
- Fix pre-filled dropdowns (destination site, line items, warehouse) not displaying correctly when populated asynchronously from a fulfilling Material Request or Transfer Batch — replaced with locked read-only text for those fields.
- Add direct site-to-site equipment transfer: a "Transfer" action on checked-out/in-use equipment (and a matching batch tab) moves it straight to another site without an intermediate return to a warehouse.
- Add Purchase Orders: an earlier ordering-ahead stage before Purchase Receipts, with auto-suggested (but freely editable) line items pulled from stock shortfalls, low stock, and open material requests. Draft → Submit → Partially Received/Received workflow, manual Close for abandoned shortfalls, and a "Receive Against This Order" shortcut that pre-fills a Purchase Receipt with the outstanding quantities.

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
