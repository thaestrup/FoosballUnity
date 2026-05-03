import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { CountdownComponent } from './countdown/countdown.component';
import { IndividualResultsComponent } from './individual-results/individual-results.component';
import { AvailablePlayersComponent } from './available-players/available-players.component';
import { PreviousGamesComponent } from './previous-games/previous-games.component';
import { RankingListComponent } from './ranking-list/ranking-list.component';
import { FixedRankingListComponent } from './fixed-ranking-list/fixed-ranking-list.component';
import { GamesOverviewComponent } from './games-overview/games-overview.component';
import { RfidRegistrationComponent } from './rfid-registration/rfid-registration.component';

import { AlertModule } from 'ngx-bootstrap';
import { ButtonsModule } from 'ngx-bootstrap';
import { TabsModule } from 'ngx-bootstrap';
import { ProgressbarModule } from 'ngx-bootstrap';

import { ChartsModule } from 'ng2-charts/ng2-charts';
import { TrainingOverviewComponent } from './training-overview/training-overview.component';
import { GameResultComponent } from './game-result/game-result.component';

@NgModule({
  declarations: [
    AppComponent,
    CountdownComponent,
    IndividualResultsComponent,
    AvailablePlayersComponent,
    PreviousGamesComponent,
    RankingListComponent,
    FixedRankingListComponent,
    GamesOverviewComponent,
    TrainingOverviewComponent,
    RfidRegistrationComponent,
    GameResultComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    AlertModule.forRoot(),
    ButtonsModule.forRoot(),
    TabsModule.forRoot(),
    ProgressbarModule.forRoot(),
    ChartsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
