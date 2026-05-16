import { SapoPortalScraper } from "./sapo-portal.js";

export class CasaSapoScraper extends SapoPortalScraper {
  readonly name = "casa.sapo";
  readonly baseUrl = "https://casa.sapo.pt";
}
