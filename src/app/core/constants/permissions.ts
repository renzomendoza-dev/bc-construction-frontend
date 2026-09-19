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

  // Verified directly against PurchaseOrderController source
  // (@PreAuthorize("hasRole('...')")) — the original guess turned out
  // correct, and confirmed PURCHASE_ORDER_SUBMIT is a distinct role from
  // PURCHASE_ORDER_EDIT (previously missing here; the Submit action had
  // been incorrectly gated on Edit instead).
  PurchaseOrderCreate: 'PURCHASE_ORDER_CREATE',
  PurchaseOrderEdit: 'PURCHASE_ORDER_EDIT',
  PurchaseOrderSubmit: 'PURCHASE_ORDER_SUBMIT',
  PurchaseOrderClose: 'PURCHASE_ORDER_CLOSE',

  // Verified directly against MaterialRequestController source.
  MaterialRequestDelete: 'MATERIAL_REQUEST_DELETE',

  // Verified directly against PurchaseOrderController source (see also
  // PurchaseOrderSubmit above).
  PurchaseOrderDelete: 'PURCHASE_ORDER_DELETE',

  // Verified directly against ProjectController/ProjectExpenseController
  // source.
  ProjectCreate: 'PROJECT_CREATE',
  ProjectEdit: 'PROJECT_EDIT',
  ProjectComplete: 'PROJECT_COMPLETE',
  ProjectExpenseCreate: 'PROJECT_EXPENSE_CREATE',
  ProjectExpenseDelete: 'PROJECT_EXPENSE_DELETE',

  // Verified directly against WorkerController/AttendanceController source
  // (@PreAuthorize("hasRole('...')")), unlike every unverified block above —
  // the Workers module backend prompt explicitly asked for these and got them.
  WorkerCreate: 'WORKER_CREATE',
  WorkerEdit: 'WORKER_EDIT',
  WorkerDeactivate: 'WORKER_DEACTIVATE',
  AttendanceCreate: 'ATTENDANCE_CREATE',
  AttendanceDelete: 'ATTENDANCE_DELETE',

  // Also verified (see comment above) — the calendar/batch-attendance phase 2
  // backend prompt's ask for exact role names, including for the new
  // WorkerProjectAssignment feature, was answered the same way.
  WorkerAssignmentCreate: 'WORKER_ASSIGNMENT_CREATE',
  WorkerAssignmentDeactivate: 'WORKER_ASSIGNMENT_DEACTIVATE',
  AttendanceBatchCreate: 'ATTENDANCE_BATCH_CREATE',
} as const;

export type PermissionValue = (typeof Permission)[keyof typeof Permission];
