import { HttpClient } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('bc-construction-frontend');
  
  constructor(private http: HttpClient) {
    this.http.get(`${environment.apiBaseUrl}/actuator/health`).subscribe();
  }
}
