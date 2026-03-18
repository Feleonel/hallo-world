"""
Options trading strategies analyzer for Brazilian market.
Evaluates common strategies and generates trade signals.
"""

from options_bot.greeks import calculate_all_greeks, black_scholes_price


def covered_call(spot_price, call_strike, call_premium, shares=100):
    """
    Covered Call (Venda Coberta): Own stock + sell OTM call.
    Most popular strategy on B3 for income generation.
    """
    max_profit = (call_strike - spot_price) * shares + call_premium * shares
    max_loss = (spot_price * shares) - (call_premium * shares)
    breakeven = spot_price - call_premium
    return_if_called = ((call_strike - spot_price + call_premium) / spot_price) * 100

    return {
        "strategy": "Venda Coberta (Covered Call)",
        "description": "Compra ação + vende call OTM para gerar renda",
        "max_profit": round(max_profit, 2),
        "max_loss": round(max_loss, 2),
        "breakeven": round(breakeven, 2),
        "return_if_called": round(return_if_called, 2),
        "risk_level": "Moderado",
        "legs": [
            {"action": "BUY", "instrument": "Ação", "qty": shares, "price": spot_price},
            {"action": "SELL", "instrument": "Call", "qty": shares, "strike": call_strike,
             "premium": call_premium},
        ],
    }


def protective_put(spot_price, put_strike, put_premium, shares=100):
    """
    Protective Put (Put Protetiva): Own stock + buy put for protection.
    """
    max_profit = float("inf")
    max_loss = (spot_price - put_strike + put_premium) * shares
    breakeven = spot_price + put_premium

    return {
        "strategy": "Put Protetiva (Protective Put)",
        "description": "Compra ação + compra put para proteção contra queda",
        "max_profit": "Ilimitado",
        "max_loss": round(max_loss, 2),
        "breakeven": round(breakeven, 2),
        "risk_level": "Baixo",
        "legs": [
            {"action": "BUY", "instrument": "Ação", "qty": shares, "price": spot_price},
            {"action": "BUY", "instrument": "Put", "qty": shares, "strike": put_strike,
             "premium": put_premium},
        ],
    }


def bull_call_spread(spot_price, lower_strike, upper_strike,
                     lower_premium, upper_premium, contracts=1):
    """
    Trava de Alta com Call (Bull Call Spread).
    """
    qty = contracts * 100
    net_debit = (lower_premium - upper_premium) * qty
    max_profit = (upper_strike - lower_strike) * qty - net_debit
    max_loss = net_debit
    breakeven = lower_strike + (lower_premium - upper_premium)

    return {
        "strategy": "Trava de Alta com Call (Bull Call Spread)",
        "description": "Compra call ITM/ATM + vende call OTM - aposta na alta moderada",
        "max_profit": round(max_profit, 2),
        "max_loss": round(max_loss, 2),
        "breakeven": round(breakeven, 2),
        "net_debit": round(net_debit, 2),
        "risk_reward": round(max_profit / max_loss, 2) if max_loss > 0 else 0,
        "risk_level": "Moderado",
        "legs": [
            {"action": "BUY", "instrument": "Call", "qty": qty, "strike": lower_strike,
             "premium": lower_premium},
            {"action": "SELL", "instrument": "Call", "qty": qty, "strike": upper_strike,
             "premium": upper_premium},
        ],
    }


def bear_put_spread(spot_price, upper_strike, lower_strike,
                    upper_premium, lower_premium, contracts=1):
    """
    Trava de Baixa com Put (Bear Put Spread).
    """
    qty = contracts * 100
    net_debit = (upper_premium - lower_premium) * qty
    max_profit = (upper_strike - lower_strike) * qty - net_debit
    max_loss = net_debit
    breakeven = upper_strike - (upper_premium - lower_premium)

    return {
        "strategy": "Trava de Baixa com Put (Bear Put Spread)",
        "description": "Compra put ITM/ATM + vende put OTM - aposta na queda moderada",
        "max_profit": round(max_profit, 2),
        "max_loss": round(max_loss, 2),
        "breakeven": round(breakeven, 2),
        "net_debit": round(net_debit, 2),
        "risk_reward": round(max_profit / max_loss, 2) if max_loss > 0 else 0,
        "risk_level": "Moderado",
        "legs": [
            {"action": "BUY", "instrument": "Put", "qty": qty, "strike": upper_strike,
             "premium": upper_premium},
            {"action": "SELL", "instrument": "Put", "qty": qty, "strike": lower_strike,
             "premium": lower_premium},
        ],
    }


def straddle(spot_price, strike, call_premium, put_premium, contracts=1):
    """
    Straddle: Buy call + put at same strike. Bets on high volatility.
    """
    qty = contracts * 100
    total_cost = (call_premium + put_premium) * qty
    breakeven_up = strike + call_premium + put_premium
    breakeven_down = strike - call_premium - put_premium

    return {
        "strategy": "Straddle",
        "description": "Compra call + put no mesmo strike - aposta em alta volatilidade",
        "max_profit": "Ilimitado",
        "max_loss": round(total_cost, 2),
        "breakeven_up": round(breakeven_up, 2),
        "breakeven_down": round(breakeven_down, 2),
        "total_cost": round(total_cost, 2),
        "risk_level": "Alto",
        "legs": [
            {"action": "BUY", "instrument": "Call", "qty": qty, "strike": strike,
             "premium": call_premium},
            {"action": "BUY", "instrument": "Put", "qty": qty, "strike": strike,
             "premium": put_premium},
        ],
    }


def iron_condor(spot_price, put_lower, put_upper, call_lower, call_upper,
                put_lower_prem, put_upper_prem, call_lower_prem, call_upper_prem,
                contracts=1):
    """
    Iron Condor: Sell put spread + sell call spread. Bets on low volatility.
    """
    qty = contracts * 100
    net_credit = (put_upper_prem - put_lower_prem + call_lower_prem - call_upper_prem) * qty
    max_profit = net_credit
    width = max(put_upper - put_lower, call_upper - call_lower)
    max_loss = width * qty - net_credit
    breakeven_up = call_lower + net_credit / qty
    breakeven_down = put_upper - net_credit / qty

    return {
        "strategy": "Iron Condor",
        "description": "Vende put spread + vende call spread - aposta em baixa volatilidade",
        "max_profit": round(max_profit, 2),
        "max_loss": round(max_loss, 2),
        "breakeven_up": round(breakeven_up, 2),
        "breakeven_down": round(breakeven_down, 2),
        "net_credit": round(net_credit, 2),
        "risk_reward": round(max_profit / max_loss, 2) if max_loss > 0 else 0,
        "risk_level": "Moderado",
        "legs": [
            {"action": "BUY", "instrument": "Put", "qty": qty, "strike": put_lower,
             "premium": put_lower_prem},
            {"action": "SELL", "instrument": "Put", "qty": qty, "strike": put_upper,
             "premium": put_upper_prem},
            {"action": "SELL", "instrument": "Call", "qty": qty, "strike": call_lower,
             "premium": call_lower_prem},
            {"action": "BUY", "instrument": "Call", "qty": qty, "strike": call_upper,
             "premium": call_upper_prem},
        ],
    }


def find_best_covered_call(chain_data, min_otm_pct=2, max_otm_pct=10):
    """
    Scan options chain to find the best covered call opportunity.
    Looks for OTM calls with good premium and reasonable risk.
    """
    if not chain_data:
        return None

    spot = chain_data["spot_price"]
    calls = [o for o in chain_data["chain"]
             if o["type"] == "call" and not o["itm"]
             and min_otm_pct <= abs(o["otm_pct"]) <= max_otm_pct]

    if not calls:
        return None

    # Score by: premium yield / days * volume (prefer liquid, high yield, short term)
    best = None
    best_score = 0
    for c in calls:
        premium_yield = (c["last"] / spot) * 100
        days = max(c["days_to_expiry"], 1)
        annualized = premium_yield * (365 / days)
        liquidity = min(c["volume"] / 10000, 1.0)
        score = annualized * liquidity
        if score > best_score:
            best_score = score
            best = c

    if best is None:
        return None

    result = covered_call(spot, best["strike"], best["last"])
    result["selected_option"] = best
    result["annualized_return"] = round(
        (best["last"] / spot) * (365 / max(best["days_to_expiry"], 1)) * 100, 2
    )
    return result


def find_best_spread(chain_data, direction="bull", max_risk=5000):
    """
    Find the best vertical spread opportunity.
    """
    if not chain_data:
        return None

    spot = chain_data["spot_price"]

    if direction == "bull":
        options = sorted(
            [o for o in chain_data["chain"] if o["type"] == "call"],
            key=lambda x: x["strike"]
        )
    else:
        options = sorted(
            [o for o in chain_data["chain"] if o["type"] == "put"],
            key=lambda x: x["strike"], reverse=True
        )

    best = None
    best_rr = 0

    for i in range(len(options) - 1):
        for j in range(i + 1, min(i + 4, len(options))):
            if options[i]["expiration"] != options[j]["expiration"]:
                continue
            if direction == "bull":
                result = bull_call_spread(
                    spot, options[i]["strike"], options[j]["strike"],
                    options[i]["last"], options[j]["last"]
                )
            else:
                result = bear_put_spread(
                    spot, options[i]["strike"], options[j]["strike"],
                    options[i]["last"], options[j]["last"]
                )

            if isinstance(result["max_loss"], (int, float)) and result["max_loss"] <= max_risk:
                rr = result.get("risk_reward", 0)
                if rr > best_rr:
                    best_rr = rr
                    best = result

    return best


def generate_signals(chain_data, stock_info=None):
    """
    Generate trading signals based on options chain analysis.
    Returns a list of recommended trades with rationale.
    """
    signals = []
    if not chain_data:
        return signals

    spot = chain_data["spot_price"]
    vol = stock_info.get("volatility_30d", 30) if stock_info else 30
    change = stock_info.get("change_1d", 0) if stock_info else 0

    # Signal 1: Covered call if vol is high
    if vol > 35:
        cc = find_best_covered_call(chain_data)
        if cc:
            signals.append({
                "type": "VENDA COBERTA",
                "direction": "Neutro/Alta",
                "confidence": min(70 + vol / 5, 90),
                "rationale": f"Volatilidade alta ({vol:.1f}%) favorece venda de prêmio",
                "strategy": cc,
            })

    # Signal 2: Bull spread if recent dip
    if change < -2:
        spread = find_best_spread(chain_data, "bull")
        if spread:
            signals.append({
                "type": "TRAVA DE ALTA",
                "direction": "Alta",
                "confidence": min(60 + abs(change) * 3, 85),
                "rationale": f"Queda recente de {change:.1f}% pode gerar oportunidade de reversão",
                "strategy": spread,
            })

    # Signal 3: Bear spread if recent spike
    if change > 2:
        spread = find_best_spread(chain_data, "bear")
        if spread:
            signals.append({
                "type": "TRAVA DE BAIXA",
                "direction": "Baixa",
                "confidence": min(55 + abs(change) * 2, 80),
                "rationale": f"Alta recente de {change:.1f}% pode indicar correção",
                "strategy": spread,
            })

    # Signal 4: Straddle before earnings or high vol events
    if vol < 25:
        atm_calls = [o for o in chain_data["chain"]
                     if o["type"] == "call" and abs(o["strike"] - spot) / spot < 0.02
                     and o["days_to_expiry"] <= 30]
        atm_puts = [o for o in chain_data["chain"]
                    if o["type"] == "put" and abs(o["strike"] - spot) / spot < 0.02
                    and o["days_to_expiry"] <= 30]
        if atm_calls and atm_puts:
            strad = straddle(spot, atm_calls[0]["strike"],
                             atm_calls[0]["last"], atm_puts[0]["last"])
            signals.append({
                "type": "STRADDLE",
                "direction": "Volatilidade",
                "confidence": 50,
                "rationale": f"IV baixa ({vol:.1f}%) - possível expansão de volatilidade",
                "strategy": strad,
            })

    return signals
