import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-content-models-panel',
  templateUrl: './content-models-panel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentModelsPanel {
  public show = input(false);
  public contentTypes = input<any[]>([]);

  public closed = output<void>();
}
