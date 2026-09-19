import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ItemsService, PurchaseOrderResponse, PurchaseOrdersService } from '../../../../generated';
import { CurrentUserService } from '../../../../core/services/current-user';
import { PurchaseOrderDetailComponent } from './purchase-order-detail';

const Status = PurchaseOrderResponse.StatusEnum;

// Instantiated in an injection context rather than rendered, so these tests
// exercise the gating logic without needing HTTP, routing, or the template.
function createWithPermissions(permissions: string[]): PurchaseOrderDetailComponent {
  TestBed.configureTestingModule({
    providers: [
      { provide: CurrentUserService, useValue: { hasPermission: (p: string) => permissions.includes(p) } },
      { provide: ActivatedRoute, useValue: {} },
      { provide: Router, useValue: {} },
      { provide: PurchaseOrdersService, useValue: {} },
      { provide: ItemsService, useValue: {} },
    ],
  });
  return TestBed.runInInjectionContext(() => new PurchaseOrderDetailComponent());
}

const order = (status: PurchaseOrderResponse.StatusEnum): PurchaseOrderResponse => ({ status });

describe('PurchaseOrderDetailComponent permission gating', () => {
  it('shows Submit on a draft only to users holding PURCHASE_ORDER_SUBMIT', () => {
    expect(createWithPermissions(['PURCHASE_ORDER_SUBMIT']).canShowSubmit(order(Status.Draft))).toBe(true);
  });

  it('hides Submit from a user who can Edit but not Submit', () => {
    // Regression: Submit was previously gated on the Edit permission.
    expect(createWithPermissions(['PURCHASE_ORDER_EDIT']).canShowSubmit(order(Status.Draft))).toBe(false);
  });

  it('hides Submit, Edit, and Delete once the order is no longer a draft', () => {
    const component = createWithPermissions(['PURCHASE_ORDER_SUBMIT', 'PURCHASE_ORDER_EDIT', 'PURCHASE_ORDER_DELETE']);
    const submitted = order(Status.Submitted);
    expect(component.canShowSubmit(submitted)).toBe(false);
    expect(component.canShowEdit(submitted)).toBe(false);
    expect(component.canShowDelete(submitted)).toBe(false);
  });

  it('allows Close on any non-terminal order, but not once Received or Closed', () => {
    const component = createWithPermissions(['PURCHASE_ORDER_CLOSE']);
    expect(component.canShowClose(order(Status.Draft))).toBe(true);
    expect(component.canShowClose(order(Status.PartiallyReceived))).toBe(true);
    expect(component.canShowClose(order(Status.Received))).toBe(false);
    expect(component.canShowClose(order(Status.Closed))).toBe(false);
  });
});
