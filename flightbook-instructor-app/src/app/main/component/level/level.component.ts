import { Component, EventEmitter, Input, NgZone, OnInit, Output } from '@angular/core';
import { Level } from 'src/app/shared/domain/level';

@Component({
    selector: 'fb-level',
    templateUrl: './level.component.html',
    styleUrl: './level.component.scss',
    standalone: false
})
export class LevelComponent implements OnInit{
  @Input()
  level: Level | undefined;

  @Output() saveLevelEvent = new EventEmitter<Level>();

  constructor() { }

  ngOnInit(): void {
  }

  saveLevel(value: number, key: any) {
    if (this.level) {
      this.level[key] = value;
      this.saveLevelEvent.emit(this.level);
    }
  }
}
