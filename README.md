# Flight Search Bot

Bot de busca de passagens aéreas baratas por data e destino.

## Funcionalidades

- Busca de aeroportos por nome de cidade
- Pesquisa de voos por data, origem e destino
- Suporte a ida e volta
- Filtro por classe (econômica, executiva, primeira classe)
- Ordenação por preço, melhor oferta ou mais rápido
- Exibição em tabela formatada com preços em BRL

## Requisitos

- Python 3.10+
- Chave de API gratuita da [Sky Scrapper (RapidAPI)](https://rapidapi.com/apiheya/api/sky-scrapper)

## Instalação

```bash
# Clone o repositório
git clone https://github.com/Feleonel/hallo-world.git
cd hallo-world

# Instale as dependências
pip install -r requirements.txt

# Configure sua chave de API
cp .env.example .env
# Edite o arquivo .env e adicione sua RAPIDAPI_KEY
```

## Uso

```bash
python main.py
```

O bot vai guiar você interativamente:

1. Digite a cidade/aeroporto de origem
2. Selecione o aeroporto da lista
3. Digite a cidade/aeroporto de destino
4. Informe a data de ida (formato: AAAA-MM-DD)
5. Opcionalmente, informe data de volta
6. Escolha a classe e ordenação
7. Veja os resultados em uma tabela formatada

## Exemplo de saída

```
╭───────────┬─────────┬──────────────────┬──────────────────┬─────────┬───────────┬───────────╮
│ Companhia │ Rota    │ Partida          │ Chegada          │ Duração │ Paradas   │ Preço     │
├───────────┼─────────┼──────────────────┼──────────────────┼─────────┼───────────┼───────────┤
│ LATAM     │ GRU->MIA│ 2026-07-15 22:00 │ 2026-07-16 06:30 │ 8h30m   │ Direto    │ R$ 2.450  │
│ GOL       │ GRU->MIA│ 2026-07-15 18:00 │ 2026-07-16 04:00 │ 10h00m  │ 1 parada  │ R$ 1.890  │
╰───────────┴─────────┴──────────────────┴──────────────────┴─────────┴───────────┴───────────╯
```

## Estrutura do projeto

```
├── main.py                  # Ponto de entrada (CLI interativo)
├── flight_search/
│   ├── __init__.py
│   ├── api.py               # Cliente da API Sky Scrapper
│   └── formatter.py         # Formatação dos resultados
├── requirements.txt         # Dependências Python
├── .env.example             # Exemplo de configuração
└── .gitignore
```
