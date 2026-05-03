import { Component, OnInit } from '@angular/core';

import { Observable } from 'rxjs/Rx';
import { Subscription } from 'rxjs/Rx';
import { TimerObservable } from "rxjs/observable/TimerObservable";

import { ProgressbarModule } from 'ngx-bootstrap';

import { Player } from '../model/player';

import { SharedCommunicationService } from '../services/shared-communication.service';

@Component({
  selector: 'rfid-registration',
  templateUrl: './rfid-registration.component.html',
  // styleUrls: ['./rfid-registration.component.scss']
})
export class RfidRegistrationComponent implements OnInit {

  public navn : any;
  public registeredRFIDTag : any;

  public registeredPlayerAlerts:Array<Object> = [];

  constructor(private sharedCommunicationService: SharedCommunicationService) {

    sharedCommunicationService.registeredPlayerChanged$.subscribe(
      registeredPlayer => {
        //this.inverseSelectionForPlayer(registeredPlayer);
        this.navn = registeredPlayer.name;
        this.registeredRFIDTag = registeredPlayer.registeredRFIDTag;
        if (registeredPlayer.name == "") {
          this.addRegisteredPlayerAlert("Ukendt RFID '" + registeredPlayer.registeredRFIDTag + "' (Bed Nikolaj, Peter eller en anden erfaren om at oprette dit RFID i databasen)", this.getImageUrl("unknownRFID"), registeredPlayer.registeredRFIDTag,  'warning', '4000');
        } else {
          if (registeredPlayer.playerReady) {
            this.addRegisteredPlayerAlert(this.navn + " tilføjet (klar til kamp)" , this.getImageUrl(this.navn) , registeredPlayer.registeredRFIDTag, 'success', '1500');
          } else {
            this.addRegisteredPlayerAlert(this.navn + " fjernet (ikke længere klar til kamp)"  , this.getImageUrl(this.navn), registeredPlayer.registeredRFIDTag, 'danger', '1500');
          }
        }
      }

    )

  }

  ngOnInit() {
  }



  public addRegisteredPlayerAlert(header: string, image : string, rfid:string, type: string, duration: string):void {

    this.registeredPlayerAlerts.push({header: header, image: image, rfid: rfid, type: type, closable: false, duration: duration});
  }

  getImageUrl(playerName : string) : string {
    if (playerName == null) {
      return "assets/img/Wildcard.jpg";
    } else {
      return "assets/img/" + playerName.toLocaleLowerCase() + ".jpg";
    }
  }

}
