import { Component, Input, OnInit } from '@angular/core';

import { Player } from '../model/player';
import { TrainingResult }  from '../model/training-result';
import { Game } from '../model/game';
import { GameService } from '../services/game.service';

import { SharedCommunicationService } from '../services/shared-communication.service';

@Component({
  selector: 'training-overview',
  templateUrl: './training-overview.component.html',
  // styleUrls: ['./training-overview.component.scss']
})
export class TrainingOverviewComponent implements OnInit {
  @Input()
  players: Player[];

  playerForStatistics : string;
  games: Game[];

  lastManualUpdate = "n/a"
  public noGamesAlerts:Array<Object> = [];

  trainingResultLastMonth: TrainingResult[];
  trainingResultCurrentMonth: TrainingResult[];

  constructor(
    private gameService: GameService,
    private sharedCommunicationService: SharedCommunicationService
    ) {
    sharedCommunicationService.playerForStatisticsChanged$.subscribe(
      playerForStatistics => {
        this.playerForStatistics = playerForStatistics;
      }
    )
  }

  ngOnInit() {
  }

  public addNoGamesAlert(msg: string, type: string):void {
    this.noGamesAlerts.push({msg: msg, type: type, closable: false});
  }

  getGamesForPeriod(period : string): void {
     this.noGamesAlerts = [];
     this.games  = null;

     this.gameService.getGames(period).subscribe(
       games => {
          this.games = games;

          this.trainingResultCurrentMonth = new Array();
          this.trainingResultLastMonth = new Array();

          var today;
          today = new Date();

          var currentMonthAsNumber = today.getMonth();
          var currentYearAsNumber = today.getFullYear();

          var lastMonthAsNumber;
          var lastYearAsNumber;

          if (currentMonthAsNumber == 0) {
            lastMonthAsNumber = 11;
            lastYearAsNumber = currentYearAsNumber - 1;
          } else {
            lastMonthAsNumber = currentMonthAsNumber - 1;
            lastYearAsNumber = currentYearAsNumber;
          }

          var lastMonth = new Array();
          var currentMonth = new Array();

          var index = 0;
          for (let player of this.players) {
            var objectForLastMonthData =  {
              name: player.name
            };
            lastMonth[index] = objectForLastMonthData;
            var objectForCurrentMonthData =  {
              name: player.name
            };
            currentMonth[index] = objectForCurrentMonthData;
            index++;
          }

          for (let game of games) {
            var arr = null;
            var gameDateInMilli = Date.parse(game.lastUpdated)
            var gameDateDateAsDate = new Date(gameDateInMilli)

            var gameDateDateAsNumber = gameDateDateAsDate.getDate()
            var gameDateMonthAsNumber = gameDateDateAsDate.getMonth();
            var gameDateYearAsNumber = gameDateDateAsDate.getFullYear()
            var gameDateHourAsNumber = gameDateDateAsDate.getHours();
            var gameDateMinutesAsNumber = gameDateDateAsDate.getMinutes();
            var gameDateDayOfWeekAsNumber = gameDateDateAsDate.getDay();

            var gameFound = false;
            if (gameDateMonthAsNumber == currentMonthAsNumber && gameDateYearAsNumber == currentYearAsNumber) {
              arr = currentMonth;
              gameFound = true;
            } else if (gameDateMonthAsNumber == lastMonthAsNumber && gameDateYearAsNumber == lastYearAsNumber) {
              arr = lastMonth;
              gameFound = true;
            } else {
              // Do nothing
            }

            if (gameFound) {
              if ((gameDateDayOfWeekAsNumber != 0 && gameDateDayOfWeekAsNumber != 6) && ((gameDateHourAsNumber == 11 && (gameDateMinutesAsNumber >= 27 && gameDateMinutesAsNumber <= 59)) ||
                (gameDateHourAsNumber == 12 && (gameDateMinutesAsNumber >= 0 && gameDateMinutesAsNumber <= 33)))) {
                var j = 0;

                for (let player of this.players) {
                  if (game.player_red_1 == player.name || game.player_red_2 == player.name || game.player_blue_1 == player.name || game.player_blue_2 == player.name) {
                    var thisObject = arr[j];
                    thisObject[gameDateDateAsNumber] = 1;
                    arr[j] = thisObject;
                  }
                  j++;
                }
              }
            }
          }

          var k = 0;
          for (let player of this.players) {
            var currentNumber = 0;
            var playerObject = currentMonth[k];
            var keys = Object.keys(playerObject);
            for (var l = 0; l < keys.length; l++) {
                var val = playerObject[keys[l]];
                if (val == 1) {
                  currentNumber++;
                }
            }
            var result = new TrainingResult(player.name, currentNumber)
            this.trainingResultCurrentMonth[k] = result;
            k++;
          }

          k = 0;
          for (let player of this.players) {

            var currentNumber2 = 0;
            var playerObject2 = lastMonth[k];
            var keys2 = Object.keys(playerObject2);

            for (var l = 0; l < keys2.length; l++) {
                var val = playerObject2[keys2[l]];
                if (val == 1) {
                  currentNumber2++;
                }
            }

            var result2 = new TrainingResult(player.name, currentNumber2)
            this.trainingResultLastMonth[k] = result2;
            k++;
          }

          this.trainingResultLastMonth = this.sortedResults(this.trainingResultLastMonth)
          this.trainingResultCurrentMonth = this.sortedResults(this.trainingResultCurrentMonth)

          var h = today.getHours();
          var m = today.getMinutes();
          var s = today.getSeconds();
          var month = today.getMonth();
          var date = today.getDate();
          // add a zero in front of numbers<10
          m = this.checkTime(m);
          s = this.checkTime(s);
          this.lastManualUpdate = "D. " + date + "/" + (month +1 ) + " kl. "+  h + ":" + m + ":" + s

        },
        err => {
          console.log('Problemer med at udregne træningsflid for perioden ' + period);
          this.addNoGamesAlert('Kunne ikke udregne træningsflid. Tjek evt. om der er problemer med adgangen til serveren?', 'danger');
        });
   }

  private checkTime(i) {
      if (i < 10) {
          i = "0" + i;
      }
      return i;
  }

  sortedResults(unsortedArray:TrainingResult[]) {
    var sortedArray: TrainingResult[] = unsortedArray.sort((n1,n2) => {
      if (n1.daysTrained > n2.daysTrained) {
          return -1;
      }

      if (n1.daysTrained < n2.daysTrained) {
          return 1;
      }

      return 0;
    });
    return sortedArray;
  }

  getImageUrl(playerName : string) : string {
    if (playerName == null) {
      return "assets/img/Wildcard.jpg";
    } else {
      return "assets/img/" + playerName.toLocaleLowerCase() + ".jpg";
    }
  }

  changePlayerForStatistics(playerForStatistics: string) {
    this.sharedCommunicationService.informAboutPlayerForStatisticsChanged(playerForStatistics);
  }

  private calculateTraining() {
    this.getGamesForPeriod("alltime");
  }
}
