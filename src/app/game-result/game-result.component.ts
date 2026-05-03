import {Component, Input, OnInit} from '@angular/core';
import {Game} from 'app/model/game';

@Component({selector: '[gameResult]', templateUrl: './game-result.component.html', 
// styleUrls: ['./game-result.component.scss']
})
export class GameResultComponent implements OnInit {

  @Input()result : Game;
  constructor() {}

  ngOnInit() {}

}
