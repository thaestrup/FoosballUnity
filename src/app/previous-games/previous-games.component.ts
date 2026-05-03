import {Component, OnInit} from '@angular/core';

import {Game} from '../model/game';
import {GameService} from '../services/game.service';

import {SharedCommunicationService} from '../services/shared-communication.service';
import {Subscription} from 'rxjs/Subscription';

@Component({selector: 'previous-games', templateUrl: './previous-games.component.html'
//  styleUrls: ['./previous-games.component.scss']
}
 )
export class PreviousGamesComponent implements OnInit {

  showMatchesPeriod = 'hour';

  public noGamesAlerts : Array < Object > = [];

  games : Game[];

  tempSpiller2 : string;

  subscriptionPlayerForStatistics : Subscription;
  subscriptionNewMatchReported : Subscription;

  playerForStatistics : string;

  constructor(private gameService : GameService, private sharedCommunicationService : SharedCommunicationService) {
    this.subscriptionPlayerForStatistics = sharedCommunicationService
      .playerForStatisticsChanged$
      .subscribe(playerForStatistics => {
        this.playerForStatistics = playerForStatistics;
      })
    this.subscriptionNewMatchReported = sharedCommunicationService
      .newMatchReported$
      .subscribe(information => {
        this.showGamesForPeriod(this.showMatchesPeriod);
      })
  }

  ngOnInit() {
    this.showGamesForPeriod(this.showMatchesPeriod);
  }

  getImageUrl(playerName : string) : string {
    if(playerName == null) {
      return "assets/img/Wildcard.jpg";
    } else {
      return "assets/img/" + playerName.toLocaleLowerCase() + ".jpg";
    }
  }

  public addNoGamesAlert(msg : string, type : string) : void {
    this
      .noGamesAlerts
      .push({msg: msg, type: type, closable: false});
  }

  // GAMES RELATED
  showGamesForPeriod(period : string) : void {
    this.noGamesAlerts = [];
    this.showMatchesPeriod = period;
    this.games = null;
    this
      .gameService
      .getGames(period)
      .subscribe(games => this.games = games, err => {
        console.log('Problemer med at hente kampene for perioden ' + period);
        this.addNoGamesAlert('Kunne ikke hente kampene for den valgte periode. Tjek evt. om der er problemer m' +
            'ed adgangen til serveren?',
        'danger');
      });
  }

  changePlayerForStatistics(playerForStatistics : string) {
    this
      .sharedCommunicationService
      .informAboutPlayerForStatisticsChanged(playerForStatistics);
  }

}
