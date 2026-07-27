import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PurchaseReceiptDetail } from './purchase-receipt-detail';

describe('PurchaseReceiptDetail', () => {
  let component: PurchaseReceiptDetail;
  let fixture: ComponentFixture<PurchaseReceiptDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchaseReceiptDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(PurchaseReceiptDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
