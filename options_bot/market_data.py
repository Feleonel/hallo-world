"""
Market data fetcher for Brazilian options market (B3).
Uses yfinance for stock prices and simulates B3 options chain data.
"""

import datetime
import math
import random

import yfinance as yf

from options_bot.greeks import black_scholes_price, implied_volatility

# SELIC rate (Brazilian risk-free rate) - updated periodically
SELIC_RATE = 0.1375  # 13.75% annual

# B3 options expiration months mapping
# Calls: A=Jan, B=Feb, ..., L=Dec
# Puts:  M=Jan, N=Feb, ..., X=Dec
CALL_MONTHS = {1: "A", 2: "B", 3: "C", 4: "D", 5: "E", 6: "F",
               7: "G", 8: "H", 9: "I", 10: "J", 11: "K", 12: "L"}
PUT_MONTHS = {1: "M", 2: "N", 3: "O", 4: "P", 5: "Q", 6: "R",
              7: "S", 8: "T", 9: "U", 10: "V", 11: "W", 12: "X"}

# Popular Brazilian stocks with options liquidity
POPULAR_TICKERS = [
    "PETR4", "VALE3", "ITUB4", "BBDC4", "ABEV3",
    "B3SA3", "WEGE3", "RENT3", "BBAS3", "SUZB3",
    "MGLU3", "VIIA3", "COGN3", "CIEL3", "CSNA3",
]


def get_stock_price(ticker):
    """
    Fetch current stock price from Yahoo Finance.
    B3 tickers use .SA suffix on Yahoo Finance.
    """
    yf_ticker = f"{ticker}.SA"
    try:
        stock = yf.Ticker(yf_ticker)
        hist = stock.history(period="5d")
        if hist.empty:
            return None
        price = float(hist["Close"].iloc[-1])
        return round(price, 2)
    except Exception:
        return None


def get_stock_info(ticker):
    """Fetch stock information."""
    yf_ticker = f"{ticker}.SA"
    try:
        stock = yf.Ticker(yf_ticker)
        hist = stock.history(period="30d")
        if hist.empty:
            return None
        current_price = float(hist["Close"].iloc[-1])
        returns = hist["Close"].pct_change().dropna()
        volatility = float(returns.std()) * math.sqrt(252)
        change_1d = float(returns.iloc[-1]) * 100 if len(returns) > 0 else 0
        volume = int(hist["Volume"].iloc[-1])
        high_30d = float(hist["High"].max())
        low_30d = float(hist["Low"].min())
        return {
            "ticker": ticker,
            "price": round(current_price, 2),
            "volatility_30d": round(volatility * 100, 2),
            "change_1d": round(change_1d, 2),
            "volume": volume,
            "high_30d": round(high_30d, 2),
            "low_30d": round(low_30d, 2),
        }
    except Exception:
        return None


def get_next_expiration_dates(n=3):
    """
    Get next N options expiration dates.
    B3 options expire on the 3rd Monday of each month.
    """
    today = datetime.date.today()
    expirations = []
    month = today.month
    year = today.year

    while len(expirations) < n:
        first_day = datetime.date(year, month, 1)
        weekday = first_day.weekday()  # 0=Monday
        if weekday <= 0:
            first_monday = first_day
        else:
            first_monday = first_day + datetime.timedelta(days=(7 - weekday))
        third_monday = first_monday + datetime.timedelta(weeks=2)

        if third_monday > today:
            expirations.append(third_monday)

        month += 1
        if month > 12:
            month = 1
            year += 1

    return expirations


def generate_option_ticker(base_ticker, strike, expiration_date, option_type):
    """
    Generate B3 option ticker symbol.
    Format: BASE + MONTH_LETTER + STRIKE_CODE
    Example: PETRA20 (PETR4 Call January strike ~20)
    """
    base = base_ticker[:4]
    month = expiration_date.month
    if option_type == "call":
        letter = CALL_MONTHS[month]
    else:
        letter = PUT_MONTHS[month]
    strike_code = str(int(strike))
    return f"{base}{letter}{strike_code}"


def generate_options_chain(ticker, spot_price=None, r=SELIC_RATE):
    """
    Generate a realistic options chain for a given ticker.
    Uses current stock price and generates strikes around it.
    """
    if spot_price is None:
        spot_price = get_stock_price(ticker)
    if spot_price is None:
        return None

    expirations = get_next_expiration_dates(3)
    today = datetime.date.today()
    chain = []

    # Generate strikes: 80% to 120% of spot price, in round intervals
    step = max(0.5, round(spot_price * 0.025, 1))
    strikes = []
    base_strike = round(spot_price * 0.80 / step) * step
    while base_strike <= spot_price * 1.20:
        strikes.append(round(base_strike, 2))
        base_strike += step

    for exp_date in expirations:
        T = max((exp_date - today).days / 365.0, 0.001)
        for strike in strikes:
            base_vol = 0.30 + random.uniform(-0.05, 0.05)
            moneyness = abs(math.log(spot_price / strike))
            vol = base_vol + 0.1 * moneyness  # volatility smile

            for opt_type in ["call", "put"]:
                price = black_scholes_price(spot_price, strike, T, r, vol, opt_type)
                opt_ticker = generate_option_ticker(ticker, strike, exp_date, opt_type)

                itm = (opt_type == "call" and spot_price > strike) or \
                      (opt_type == "put" and spot_price < strike)
                otm_pct = ((spot_price - strike) / spot_price * 100) if opt_type == "call" \
                    else ((strike - spot_price) / spot_price * 100)

                chain.append({
                    "ticker": opt_ticker,
                    "underlying": ticker,
                    "type": opt_type,
                    "strike": strike,
                    "expiration": exp_date.isoformat(),
                    "days_to_expiry": (exp_date - today).days,
                    "bid": round(max(price * 0.97, 0.01), 2),
                    "ask": round(price * 1.03, 2),
                    "last": round(price, 2),
                    "iv": round(vol * 100, 2),
                    "volume": random.randint(100, 50000),
                    "open_interest": random.randint(500, 200000),
                    "itm": itm,
                    "otm_pct": round(otm_pct, 2),
                })

    return {
        "underlying": ticker,
        "spot_price": spot_price,
        "selic_rate": r,
        "chain": chain,
        "expirations": [d.isoformat() for d in expirations],
    }
