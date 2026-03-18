"""
Flask web application for the Options Trading Bot.
Provides dashboard, options chain viewer, strategy analyzer, and portfolio management.
"""

import os
from flask import Flask, render_template, request, jsonify

from options_bot.market_data import (
    get_stock_price, get_stock_info, generate_options_chain,
    POPULAR_TICKERS, SELIC_RATE, get_next_expiration_dates,
)
from options_bot.greeks import calculate_all_greeks, implied_volatility
from options_bot.strategies import (
    covered_call, protective_put, bull_call_spread, bear_put_spread,
    straddle, find_best_covered_call, generate_signals,
)
from options_bot.portfolio import (
    load_portfolio, save_portfolio, add_position, close_position,
    get_portfolio_summary, check_risk_limits,
)

app = Flask(__name__, template_folder="templates_options", static_folder="static_options")


@app.route("/")
def dashboard():
    """Main dashboard with market overview."""
    return render_template("options_dashboard.html", tickers=POPULAR_TICKERS)


@app.route("/api/stock/<ticker>")
def api_stock_info(ticker):
    """Get stock info for a ticker."""
    info = get_stock_info(ticker.upper())
    if info is None:
        return jsonify({"error": f"Ativo {ticker} não encontrado"}), 404
    return jsonify(info)


@app.route("/api/chain/<ticker>")
def api_options_chain(ticker):
    """Get options chain for a ticker."""
    chain = generate_options_chain(ticker.upper())
    if chain is None:
        return jsonify({"error": f"Não foi possível gerar chain para {ticker}"}), 404
    return jsonify(chain)


@app.route("/api/greeks", methods=["POST"])
def api_greeks():
    """Calculate Greeks for given parameters."""
    data = request.json
    try:
        result = calculate_all_greeks(
            S=float(data["spot"]),
            K=float(data["strike"]),
            T=float(data["days"]) / 365.0,
            r=float(data.get("rate", SELIC_RATE)),
            sigma=float(data["volatility"]) / 100.0,
            option_type=data.get("type", "call"),
        )
        return jsonify(result)
    except (KeyError, ValueError) as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/signals/<ticker>")
def api_signals(ticker):
    """Generate trading signals for a ticker."""
    ticker = ticker.upper()
    info = get_stock_info(ticker)
    chain = generate_options_chain(ticker, info["price"] if info else None)
    if not chain:
        return jsonify({"error": "Dados não disponíveis"}), 404
    signals = generate_signals(chain, info)
    return jsonify({"ticker": ticker, "info": info, "signals": signals})


@app.route("/api/portfolio")
def api_portfolio():
    """Get portfolio summary."""
    portfolio = load_portfolio()
    summary = get_portfolio_summary(portfolio)
    warnings = check_risk_limits(portfolio)
    return jsonify({"summary": summary, "warnings": warnings})


@app.route("/api/portfolio/trade", methods=["POST"])
def api_trade():
    """Execute a trade (paper trading)."""
    data = request.json
    portfolio = load_portfolio()
    result = add_position(
        portfolio,
        ticker=data["ticker"],
        option_type=data["type"],
        strike=float(data["strike"]),
        expiration=data["expiration"],
        qty=int(data["qty"]),
        price=float(data["price"]),
        action=data.get("action", "BUY"),
    )
    return jsonify(result)


@app.route("/api/portfolio/close", methods=["POST"])
def api_close():
    """Close a position."""
    data = request.json
    portfolio = load_portfolio()
    result = close_position(portfolio, int(data["position_id"]), float(data["price"]))
    return jsonify(result)


@app.route("/api/strategy/analyze", methods=["POST"])
def api_analyze_strategy():
    """Analyze a specific strategy with given parameters."""
    data = request.json
    strategy_type = data.get("strategy")
    spot = float(data["spot"])

    if strategy_type == "covered_call":
        result = covered_call(spot, float(data["strike"]), float(data["premium"]))
    elif strategy_type == "protective_put":
        result = protective_put(spot, float(data["strike"]), float(data["premium"]))
    elif strategy_type == "bull_call_spread":
        result = bull_call_spread(
            spot, float(data["lower_strike"]), float(data["upper_strike"]),
            float(data["lower_premium"]), float(data["upper_premium"])
        )
    elif strategy_type == "bear_put_spread":
        result = bear_put_spread(
            spot, float(data["upper_strike"]), float(data["lower_strike"]),
            float(data["upper_premium"]), float(data["lower_premium"])
        )
    elif strategy_type == "straddle":
        result = straddle(
            spot, float(data["strike"]),
            float(data["call_premium"]), float(data["put_premium"])
        )
    else:
        return jsonify({"error": "Estratégia não reconhecida"}), 400

    return jsonify(result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=True)
