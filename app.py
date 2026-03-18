#!/usr/bin/env python3
"""Flight Search Bot - Web version with Flask."""

import os

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

from flight_search.api import FlightSearchClient

load_dotenv()

app = Flask(__name__)

API_KEY = os.getenv("RAPIDAPI_KEY", "")


def get_client() -> FlightSearchClient:
    key = API_KEY or request.headers.get("X-Api-Key", "")
    if not key or key == "your_rapidapi_key_here":
        raise ValueError("API key not configured")
    return FlightSearchClient(key)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/airports")
def search_airports():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify([])
    try:
        client = get_client()
        results = client.search_airport(query)
        airports = []
        for ap in results:
            presentation = ap.get("presentation", {})
            airports.append({
                "skyId": ap.get("skyId", ""),
                "entityId": ap.get("entityId", ""),
                "name": presentation.get("title", ""),
                "subtitle": presentation.get("subtitle", ""),
            })
        return jsonify(airports)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Erro ao buscar aeroportos: {e}"}), 500


@app.route("/api/flights")
def search_flights():
    origin_sky = request.args.get("originSkyId", "")
    origin_entity = request.args.get("originEntityId", "")
    dest_sky = request.args.get("destSkyId", "")
    dest_entity = request.args.get("destEntityId", "")
    date = request.args.get("date", "")
    return_date = request.args.get("returnDate", "") or None
    cabin = request.args.get("cabin", "economy")
    sort_by = request.args.get("sortBy", "price_low")

    if not all([origin_sky, origin_entity, dest_sky, dest_entity, date]):
        return jsonify({"error": "Parâmetros obrigatórios faltando"}), 400

    try:
        client = get_client()
        raw = client.search_flights(
            origin_sky_id=origin_sky,
            origin_entity_id=origin_entity,
            dest_sky_id=dest_sky,
            dest_entity_id=dest_entity,
            date=date,
            return_date=return_date,
            cabin_class=cabin,
            sort_by=sort_by,
        )

        if not raw.get("status"):
            return jsonify({"flights": [], "message": "Nenhum resultado encontrado."})

        itineraries = raw.get("data", {}).get("itineraries", [])
        flights = []
        for it in itineraries[:20]:
            price_raw = it.get("price", {}).get("raw", 0)
            price_fmt = it.get("price", {}).get("formatted", "N/A")
            legs = it.get("legs", [])
            if not legs:
                continue
            leg = legs[0]
            origin_code = leg.get("origin", {}).get("displayCode", "?")
            origin_name = leg.get("origin", {}).get("name", "")
            dest_code = leg.get("destination", {}).get("displayCode", "?")
            dest_name = leg.get("destination", {}).get("name", "")
            departure = leg.get("departure", "")
            arrival = leg.get("arrival", "")
            duration = leg.get("durationInMinutes", 0)
            stops = leg.get("stopCount", 0)
            carriers = leg.get("carriers", {}).get("marketing", [])
            airline = carriers[0].get("name", "N/A") if carriers else "N/A"
            logo = carriers[0].get("logoUrl", "") if carriers else ""

            flights.append({
                "airline": airline,
                "logo": logo,
                "origin": f"{origin_name} ({origin_code})",
                "destination": f"{dest_name} ({dest_code})",
                "departure": departure,
                "arrival": arrival,
                "duration": duration,
                "stops": stops,
                "price": price_fmt,
                "priceRaw": price_raw,
            })

        return jsonify({"flights": flights})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Erro ao buscar voos: {e}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
