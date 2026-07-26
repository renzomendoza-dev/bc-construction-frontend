import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuppliersList } from './suppliers-list';

describe('SuppliersList', () => {
  let component: SuppliersList;
  let fixture: ComponentFixture<SuppliersList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuppliersList],
    }).compileComponents();

    fixture = TestBed.createComponent(SuppliersList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
