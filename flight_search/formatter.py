"""Format flight search results for display."""

from tabulate import tabulate


def format_airport_choices(airports: list[dict]) -> str:
    """Format airport search results as a numbered list."""
    lines = []
    for i, airport in enumerate(airports, 1):
        presentation = airport.get("presentation", {})
        name = presentation.get("title", "N/A")
        subtitle = presentation.get("subtitle", "")
        sky_id = airport.get("skyId", "")
        lines.append(f"  {i}. {name} ({sky_id}) - {subtitle}")
    return "\n".join(lines)


def format_flight_results(data: dict) -> str:
    """Format flight search results into a readable table."""
    if not data.get("status"):
        return "Nenhum resultado encontrado."

    itineraries = data.get("data", {}).get("itineraries", [])
    if not itineraries:
        return "Nenhum voo encontrado para esta rota e data."

    rows = []
    for it in itineraries[:15]:
        price = it.get("price", {}).get("formatted", "N/A")

        legs = it.get("legs", [])
        if not legs:
            continue

        leg = legs[0]
        origin = leg.get("origin", {}).get("displayCode", "?")
        dest = leg.get("destination", {}).get("displayCode", "?")
        departure = leg.get("departure", "")[:16].replace("T", " ")
        arrival = leg.get("arrival", "")[:16].replace("T", " ")
        duration = leg.get("durationInMinutes", 0)
        hours, mins = divmod(duration, 60)
        duration_str = f"{hours}h{mins:02d}m"
        stops = leg.get("stopCount", 0)
        stops_str = "Direto" if stops == 0 else f"{stops} parada(s)"

        carriers = leg.get("carriers", {}).get("marketing", [])
        airline = carriers[0].get("name", "N/A") if carriers else "N/A"

        rows.append([airline, f"{origin}->{dest}", departure, arrival, duration_str, stops_str, price])

    if not rows:
        return "Nenhum voo encontrado para esta rota e data."

    headers = ["Companhia", "Rota", "Partida", "Chegada", "Duração", "Paradas", "Preço"]
    return tabulate(rows, headers=headers, tablefmt="rounded_grid")
