/**
 * Fine-grained permission strings, mirroring the Keycloak realm roles that
 * back each mutating endpoint. Positions (ADMIN, MANAGER,
 * WAREHOUSE_CUSTODIAN, FIELD_WORKER) are composite roles that bundle these
 * into realm_access.roles, so checking for a permission string here is
 * equivalent to checking the same claim the backend authorizes against.
 *
 * Reads (GET) require no permission — only mutating actions are gated.
 */
export const Permission = {
  EquipmentCreate: 'EQUIPMENT_CREATE',
  EquipmentEdit: 'EQUIPMENT_EDIT',
  EquipmentCheckout: 'EQUIPMENT_CHECKOUT',
  EquipmentCheckin: 'EQUIPMENT_CHECKIN',

  ItemCreate: 'ITEM_CREATE',
  ItemEdit: 'ITEM_EDIT',
  ItemDeactivate: 'ITEM_DEACTIVATE',

  WarehouseCreate: 'WAREHOUSE_CREATE',
  WarehouseEdit: 'WAREHOUSE_EDIT',
  WarehouseDeactivate: 'WAREHOUSE_DEACTIVATE',
  WarehouseManageLocations: 'WAREHOUSE_MANAGE_LOCATIONS',

  SupplierCreate: 'SUPPLIER_CREATE',
  SupplierEdit: 'SUPPLIER_EDIT',
  SupplierDeactivate: 'SUPPLIER_DEACTIVATE',
  SupplierLinkItem: 'SUPPLIER_LINK_ITEM',

  PurchaseReceiptCreate: 'PURCHASE_RECEIPT_CREATE',
  PurchaseReceiptConfirm: 'PURCHASE_RECEIPT_CONFIRM',

  StockAdjust: 'STOCK_ADJUST',
  StockTransfer: 'STOCK_TRANSFER',
  StockSetReorderThreshold: 'STOCK_SET_REORDER_THRESHOLD',

  // Unverified: the OpenAPI spec doesn't expose @PreAuthorize role names
  // (every endpoint just declares the generic bearerAuth scheme), so these
  // are guesses following the established naming pattern above, not
  // confirmed against the backend controllers. If gating misbehaves for a
  // role that should/shouldn't have access, check these three first.
  TransferBatchCreate: 'TRANSFER_BATCH_CREATE',
  TransferBatchSubmit: 'TRANSFER_BATCH_SUBMIT',
  MaterialRequestCreate: 'MATERIAL_REQUEST_CREATE',

  // Also unverified (see comment above) — the backend confirmed the
  // PUT /api/inventory/material-requests/{id} endpoint's behavior and
  // status codes directly, but not its @PreAuthorize role name.
  MaterialRequestEdit: 'MATERIAL_REQUEST_EDIT',

  // Also unverified (see comment above) — DELETE /api/inventory/transfer-batches/{id}
  // shipped with its status codes documented (422 if not DRAFT, 404 if
  // missing) but no @PreAuthorize role name in the spec.
  TransferBatchDelete: 'TRANSFER_BATCH_DELETE',

  // Also unverified (see comment above) — the Purchase Order feature's
  // backend prompt explicitly asked for these role names and never got an
  // answer; every other detail (entity/field/status names, response codes)
  // was confirmed directly.
  PurchaseOrderCreate: 'PURCHASE_ORDER_CREATE',
  PurchaseOrderEdit: 'PURCHASE_ORDER_EDIT',
  PurchaseOrderClose: 'PURCHASE_ORDER_CLOSE',

  // Also unverified (see comment above) — DELETE /api/inventory/material-requests/{id}
  // shipped with its status codes and lock rule documented (422 once
  // PARTIALLY_FULFILLED/FULFILLED, matching the existing edit-lock; 404 if
  // missing) but no @PreAuthorize role name in the spec.
  MaterialRequestDelete: 'MATERIAL_REQUEST_DELETE',

  // Also unverified (see comment above) — DELETE /api/purchase-orders/{id}
  // shipped with its status codes documented (422 if not DRAFT, 409 if a
  // PurchaseReceipt already references it, 404 if missing) but no
  // @PreAuthorize role name, the third unanswered ask for a PO permission.
  PurchaseOrderDelete: 'PURCHASE_ORDER_DELETE',

  // Also unverified (see comment above) — the new Project + Project Expense
  // feature's endpoints never state @PreAuthorize role names either, same
  // as everything else in this project.
  ProjectCreate: 'PROJECT_CREATE',
  ProjectEdit: 'PROJECT_EDIT',
  ProjectComplete: 'PROJECT_COMPLETE',
  ProjectExpenseCreate: 'PROJECT_EXPENSE_CREATE',

  // Verified directly against WorkerController/AttendanceController source
  // (@PreAuthorize("hasRole('...')")), unlike every unverified block above —
  // the Workers module backend prompt explicitly asked for these and got them.
  WorkerCreate: 'WORKER_CREATE',
  WorkerEdit: 'WORKER_EDIT',
  WorkerDeactivate: 'WORKER_DEACTIVATE',
  AttendanceCreate: 'ATTENDANCE_CREATE',
  AttendanceDelete: 'ATTENDANCE_DELETE',
} as const;

export type PermissionValue = (typeof Permission)[keyof typeof Permission];
