import { SapoPortalScraper } from "./sapo-portal.js";

export class CasaIolScraper extends SapoPortalScraper {
  readonly name = "casa.iol";
  readonly baseUrl = "https://casa.iol.pt";
}
