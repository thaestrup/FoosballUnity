import { Component, OnInit } from '@angular/core';

import { SharedCommunicationService } from './shared-communication.service';
import { Subscription } from 'rxjs/Subscription';

import { RankingItem } from './ranking-item';
import { RankingItemService } from './ranking-item.service';

@Component({
  selector: 'RankingListComponent',
  templateUrl: './ranking-list.component.html',
  styleUrls: ['./ranking-list.component.css']
})
export class RankingListComponent implements OnInit {

  showRankingPeriod = 'hour';

  public noRankingListAlerts:Array<Object> = [];

  subscriptionPlayerForStatistics : Subscription ;
  subscriptionNewMatchReported : Subscription ;

  playerForStatistics : string;

  rankingItems: RankingItem[];

  constructor(
    private rankingItemService: RankingItemService,
    private sharedCommunicationService: SharedCommunicationService
  ) {
    this.subscriptionPlayerForStatistics = sharedCommunicationService.playerForStatisticsChanged$.subscribe(
      playerForStatistics => {
        this.playerForStatistics = playerForStatistics;
      }
    )
    this.subscriptionNewMatchReported = sharedCommunicationService.newMatchReported$.subscribe(
      information => {
        this.showRankingForPeriod(this.showRankingPeriod);
      }
    )
   }

  ngOnInit() {
    this.getRankingItems();
  }

  public addNoRankingListAlert(msg: string, type: string):void {
    this.noRankingListAlerts.push({msg: msg, type: type, closable: false});
  }

  changePlayerForStatistics(playerForStatistics: string) {
    this.sharedCommunicationService.informAboutPlayerForStatisticsChanged(playerForStatistics);
  }

  getImageUrl(playerName : string) : string {
    if (playerName == null) {
      return "assets/img/Wildcard.jpg";
    } else {
      return "assets/img/" + playerName + ".jpg";
    }
  }

  // TABS RELATED
  public showRankingForPeriod(period: string):void {
    //alert("i ts: " + period)
    this.noRankingListAlerts = [];
    this.showRankingPeriod = period;
    this.rankingItems  = null;
    this.rankingItemService.getRankingItems(period).then(
      (rankingItems : RankingItem[]) => this.rankingItems = rankingItems)
    .catch(err => {
      console.log('Problemer med at hente ranking-liste for perioden ' + period);
      this.addNoRankingListAlert('Kunne ikke hente ranglisten for den valgte periode. Tjek evt. om der er problemer med adgangen til serveren?', 'danger');
    });
  };

  // RANKINGITEMS RELATED
  getRankingItems(): void {
    this.rankingItemService.getRankingItems(this.showRankingPeriod).then((rankingItems : RankingItem[]) => this.rankingItems = rankingItems);
  }

}
