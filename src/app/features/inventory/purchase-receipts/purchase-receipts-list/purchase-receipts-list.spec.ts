import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PurchaseReceiptsList } from './purchase-receipts-list';

describe('PurchaseReceiptsList', () => {
  let component: PurchaseReceiptsList;
  let fixture: ComponentFixture<PurchaseReceiptsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchaseReceiptsList],
    }).compileComponents();

    fixture = TestBed.createComponent(PurchaseReceiptsList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
