"""Flight search API client using Sky Scrapper (RapidAPI)."""

import requests


BASE_URL = "https://sky-scrapper.p.rapidapi.com/api/v1"


class FlightSearchClient:
    """Client to search flights via Sky Scrapper API on RapidAPI."""

    def __init__(self, api_key: str):
        self.headers = {
            "x-rapidapi-key": api_key,
            "x-rapidapi-host": "sky-scrapper.p.rapidapi.com",
        }

    def search_airport(self, query: str) -> list[dict]:
        """Search for airport/city by name and return matching entities."""
        resp = requests.get(
            f"{BASE_URL}/flights/searchAirport",
            headers=self.headers,
            params={"query": query, "locale": "pt-BR"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("status"):
            return []
        return data.get("data", [])

    def search_flights(
        self,
        origin_sky_id: str,
        origin_entity_id: str,
        dest_sky_id: str,
        dest_entity_id: str,
        date: str,
        return_date: str | None = None,
        adults: int = 1,
        cabin_class: str = "economy",
        sort_by: str = "best",
        currency: str = "BRL",
    ) -> dict:
        """Search for flights between two airports on a given date.

        Args:
            origin_sky_id: Origin airport skyId (e.g. "GRU").
            origin_entity_id: Origin entityId from airport search.
            dest_sky_id: Destination airport skyId (e.g. "MIA").
            dest_entity_id: Destination entityId from airport search.
            date: Departure date in YYYY-MM-DD format.
            return_date: Optional return date in YYYY-MM-DD format.
            adults: Number of adult passengers.
            cabin_class: economy, premium_economy, business, first.
            sort_by: best, price_high, price_low, fastest, outbound_take_off_time.
            currency: Currency code for prices.
        """
        params = {
            "originSkyId": origin_sky_id,
            "destinationSkyId": dest_sky_id,
            "originEntityId": origin_entity_id,
            "destinationEntityId": dest_entity_id,
            "date": date,
            "adults": str(adults),
            "cabinClass": cabin_class,
            "sortBy": sort_by,
            "currency": currency,
            "market": "BR",
            "countryCode": "BR",
            "locale": "pt-BR",
        }
        if return_date:
            params["returnDate"] = return_date

        resp = requests.get(
            f"{BASE_URL}/flights/searchFlights",
            headers=self.headers,
            params=params,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()
