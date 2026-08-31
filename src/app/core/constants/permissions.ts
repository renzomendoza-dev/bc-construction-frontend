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
} as const;

export type PermissionValue = (typeof Permission)[keyof typeof Permission];
