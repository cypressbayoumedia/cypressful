import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard-header',
  imports: [RouterLink],
  templateUrl: './dashboard-header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardHeader {
  public user = input<any>(null);
  public currentSpace = input<any>(null);
  public spaces = input<any[]>([]);
  public isReady = input(false);
  public showSpaceMenu = input(false);

  public toggleSpaceMenu = output<void>();
  public selectSpace = output<string>();
  public openEntries = output<void>();
  public openMedia = output<void>();
  public toggleModels = output<void>();
  public logoutClicked = output<void>();
}
