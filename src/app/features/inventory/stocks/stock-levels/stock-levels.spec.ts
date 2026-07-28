import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StockLevels } from './stock-levels';

describe('StockLevels', () => {
  let component: StockLevels;
  let fixture: ComponentFixture<StockLevels>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StockLevels],
    }).compileComponents();

    fixture = TestBed.createComponent(StockLevels);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
