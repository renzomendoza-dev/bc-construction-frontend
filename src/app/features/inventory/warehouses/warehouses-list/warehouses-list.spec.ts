import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WarehousesList } from './warehouses-list';

describe('WarehousesList', () => {
  let component: WarehousesList;
  let fixture: ComponentFixture<WarehousesList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WarehousesList],
    }).compileComponents();

    fixture = TestBed.createComponent(WarehousesList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
