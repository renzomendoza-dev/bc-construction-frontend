import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemCreate } from './item-create';

describe('ItemCreate', () => {
  let component: ItemCreate;
  let fixture: ComponentFixture<ItemCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemCreate],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
