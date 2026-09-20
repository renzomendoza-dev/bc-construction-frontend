import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PurchaseReceiptsListComponent } from './purchase-receipts-list';
import { PurchaseReceiptsService } from '../../../../generated';
import { CurrentUserService } from '../../../../core/services/current-user';
import { Router } from '@angular/router';

/**
 * listPurchaseReceipts takes (supplierId, fromDate, toDate,
 * fulfillsTransferBatchId, page, size, sort). Every argument is optional, so
 * skipping the batch filter compiles fine but shifts page/size — which is
 * exactly what happened: the list asked for page 300 of batch 0 and rendered
 * "no receipts" while the database held plenty.
 */
describe('PurchaseReceiptsListComponent', () => {
  function setup() {
    const calls: unknown[][] = [];
    const receiptsService = {
      listPurchaseReceipts: (...args: unknown[]) => {
        calls.push(args);
        return of({ content: [], totalElements: 0 });
      },
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: PurchaseReceiptsService, useValue: receiptsService },
        { provide: CurrentUserService, useValue: { hasPermission: () => true } },
        { provide: Router, useValue: { navigate: () => undefined } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new PurchaseReceiptsListComponent());
    return { component, calls };
  }

  it('requests the first page unfiltered, with page and size in the right positions', () => {
    const { component, calls } = setup();
    component.ngOnInit();

    expect(calls.length).toBe(1);
    const [supplierId, fromDate, toDate, fulfillsTransferBatchId, page, size] = calls[0];
    expect(supplierId).toBeUndefined();
    expect(fromDate).toBeUndefined();
    expect(toDate).toBeUndefined();
    expect(fulfillsTransferBatchId).toBeUndefined();
    expect(page).toBe(0);
    expect(size).toBeGreaterThan(1);
  });
});
