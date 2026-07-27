import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PurchaseReceiptCreate } from './purchase-receipt-create';

describe('PurchaseReceiptCreate', () => {
  let component: PurchaseReceiptCreate;
  let fixture: ComponentFixture<PurchaseReceiptCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchaseReceiptCreate],
    }).compileComponents();

    fixture = TestBed.createComponent(PurchaseReceiptCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
