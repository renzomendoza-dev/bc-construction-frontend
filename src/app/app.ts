import { HttpClient } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { Sidebar } from './core/layout/sidebar/sidebar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('bc-construction-frontend');
  
  constructor(private http: HttpClient) {
    this.http.get(`${environment.apiBaseUrl}/actuator/health`).subscribe();
  }
}
