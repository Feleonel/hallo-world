#!/usr/bin/env python3
"""Flight Search Bot - Busca passagens aéreas baratas por data e destino."""

import os
import sys
from datetime import datetime

from dotenv import load_dotenv

from flight_search.api import FlightSearchClient
from flight_search.formatter import format_airport_choices, format_flight_results


def get_api_key() -> str:
    load_dotenv()
    key = os.getenv("RAPIDAPI_KEY")
    if not key or key == "your_rapidapi_key_here":
        print("=" * 60)
        print("  CONFIGURAÇÃO NECESSÁRIA")
        print("=" * 60)
        print()
        print("Para usar este bot, você precisa de uma chave da RapidAPI.")
        print()
        print("1. Acesse: https://rapidapi.com/apiheya/api/sky-scrapper")
        print("2. Crie uma conta gratuita e assine o plano Basic (grátis)")
        print("3. Copie sua chave (X-RapidAPI-Key)")
        print("4. Crie um arquivo .env com:")
        print("   RAPIDAPI_KEY=sua_chave_aqui")
        print()
        key = input("Ou cole sua chave aqui agora: ").strip()
        if not key:
            print("Chave não fornecida. Encerrando.")
            sys.exit(1)
    return key


def select_airport(client: FlightSearchClient, prompt: str) -> tuple[str, str]:
    """Ask user for an airport and return (skyId, entityId)."""
    while True:
        query = input(f"\n{prompt}: ").strip()
        if not query:
            print("Por favor, digite o nome de uma cidade ou aeroporto.")
            continue

        print(f"Buscando '{query}'...")
        results = client.search_airport(query)
        if not results:
            print("Nenhum aeroporto encontrado. Tente novamente.")
            continue

        print("\nAeroportos encontrados:")
        print(format_airport_choices(results))

        while True:
            choice = input(f"\nEscolha um número (1-{len(results)}): ").strip()
            if choice.isdigit() and 1 <= int(choice) <= len(results):
                selected = results[int(choice) - 1]
                sky_id = selected.get("skyId", "")
                entity_id = selected.get("entityId", "")
                name = selected.get("presentation", {}).get("title", sky_id)
                print(f"Selecionado: {name} ({sky_id})")
                return sky_id, entity_id
            print("Opção inválida. Tente novamente.")


def get_date(prompt: str) -> str:
    """Ask user for a date in YYYY-MM-DD format."""
    while True:
        date_str = input(f"\n{prompt} (AAAA-MM-DD): ").strip()
        try:
            parsed = datetime.strptime(date_str, "%Y-%m-%d")
            if parsed.date() < datetime.now().date():
                print("A data não pode ser no passado.")
                continue
            return date_str
        except ValueError:
            print("Formato inválido. Use AAAA-MM-DD (ex: 2026-07-15).")


def main():
    print()
    print("=" * 60)
    print("  ✈  BOT DE BUSCA DE PASSAGENS AÉREAS BARATAS  ✈")
    print("=" * 60)
    print()

    api_key = get_api_key()
    client = FlightSearchClient(api_key)

    while True:
        print("\n" + "-" * 60)
        print("  NOVA BUSCA")
        print("-" * 60)

        origin_sky, origin_entity = select_airport(client, "Cidade/aeroporto de ORIGEM")
        dest_sky, dest_entity = select_airport(client, "Cidade/aeroporto de DESTINO")
        dep_date = get_date("Data de IDA")

        rt = input("\nViagem de ida e volta? (s/n): ").strip().lower()
        ret_date = None
        if rt in ("s", "sim", "y", "yes"):
            ret_date = get_date("Data de VOLTA")

        cabin_input = input(
            "\nClasse (1=Econômica, 2=Premium Economy, 3=Executiva, 4=Primeira) [1]: "
        ).strip()
        cabin_map = {"1": "economy", "2": "premium_economy", "3": "business", "4": "first"}
        cabin = cabin_map.get(cabin_input, "economy")

        sort_input = input(
            "Ordenar por (1=Melhor, 2=Mais barato, 3=Mais rápido) [2]: "
        ).strip()
        sort_map = {"1": "best", "2": "price_low", "3": "fastest"}
        sort_by = sort_map.get(sort_input, "price_low")

        print(f"\nBuscando voos de {origin_sky} para {dest_sky} em {dep_date}...")
        print("Aguarde...\n")

        try:
            results = client.search_flights(
                origin_sky_id=origin_sky,
                origin_entity_id=origin_entity,
                dest_sky_id=dest_sky,
                dest_entity_id=dest_entity,
                date=dep_date,
                return_date=ret_date,
                cabin_class=cabin,
                sort_by=sort_by,
            )
            print(format_flight_results(results))
        except Exception as e:
            print(f"Erro ao buscar voos: {e}")

        again = input("\nDeseja fazer outra busca? (s/n): ").strip().lower()
        if again not in ("s", "sim", "y", "yes"):
            print("\nObrigado por usar o Bot de Passagens! Boa viagem! ✈")
            break


if __name__ == "__main__":
    main()
