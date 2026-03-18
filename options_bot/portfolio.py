"""
Portfolio and risk management for the options trading bot.
Tracks positions, P&L, and enforces risk limits.
"""

import json
import os
import datetime

DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "portfolio.json")


def _ensure_data_dir():
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)


def load_portfolio():
    """Load portfolio from disk."""
    _ensure_data_dir()
    if not os.path.exists(DATA_FILE):
        return {
            "cash": 100000.00,
            "positions": [],
            "history": [],
            "created_at": datetime.datetime.now().isoformat(),
        }
    with open(DATA_FILE, "r") as f:
        return json.load(f)


def save_portfolio(portfolio):
    """Save portfolio to disk."""
    _ensure_data_dir()
    portfolio["updated_at"] = datetime.datetime.now().isoformat()
    with open(DATA_FILE, "w") as f:
        json.dump(portfolio, f, indent=2, default=str)


def add_position(portfolio, ticker, option_type, strike, expiration,
                 qty, price, action="BUY"):
    """Add a new position to the portfolio."""
    cost = qty * price * (1 if action == "BUY" else -1)

    # Check cash for buys
    if action == "BUY" and cost > portfolio["cash"]:
        return {"error": "Saldo insuficiente", "available": portfolio["cash"], "required": cost}

    position = {
        "id": len(portfolio["positions"]) + 1,
        "ticker": ticker,
        "type": option_type,
        "strike": strike,
        "expiration": expiration,
        "qty": qty if action == "BUY" else -qty,
        "entry_price": price,
        "action": action,
        "opened_at": datetime.datetime.now().isoformat(),
        "status": "open",
    }

    portfolio["positions"].append(position)
    portfolio["cash"] -= cost

    portfolio["history"].append({
        "action": action,
        "ticker": ticker,
        "qty": qty,
        "price": price,
        "total": cost,
        "timestamp": datetime.datetime.now().isoformat(),
    })

    save_portfolio(portfolio)
    return {"success": True, "position": position, "remaining_cash": portfolio["cash"]}


def close_position(portfolio, position_id, close_price):
    """Close an existing position."""
    for pos in portfolio["positions"]:
        if pos["id"] == position_id and pos["status"] == "open":
            pnl = (close_price - pos["entry_price"]) * pos["qty"]
            pos["status"] = "closed"
            pos["close_price"] = close_price
            pos["closed_at"] = datetime.datetime.now().isoformat()
            pos["pnl"] = round(pnl, 2)

            portfolio["cash"] += close_price * abs(pos["qty"])

            portfolio["history"].append({
                "action": "CLOSE",
                "ticker": pos["ticker"],
                "qty": abs(pos["qty"]),
                "price": close_price,
                "pnl": round(pnl, 2),
                "timestamp": datetime.datetime.now().isoformat(),
            })

            save_portfolio(portfolio)
            return {"success": True, "pnl": round(pnl, 2), "cash": portfolio["cash"]}

    return {"error": "Posição não encontrada ou já fechada"}


def get_portfolio_summary(portfolio):
    """Calculate portfolio summary with P&L."""
    open_positions = [p for p in portfolio["positions"] if p["status"] == "open"]
    closed_positions = [p for p in portfolio["positions"] if p["status"] == "closed"]

    realized_pnl = sum(p.get("pnl", 0) for p in closed_positions)
    total_invested = sum(abs(p["qty"]) * p["entry_price"] for p in open_positions)

    return {
        "cash": round(portfolio["cash"], 2),
        "open_positions": len(open_positions),
        "closed_positions": len(closed_positions),
        "total_invested": round(total_invested, 2),
        "realized_pnl": round(realized_pnl, 2),
        "total_trades": len(portfolio["history"]),
        "positions": open_positions,
    }


def check_risk_limits(portfolio, max_position_pct=20, max_total_invested_pct=80):
    """
    Check risk management limits.
    Returns warnings if limits are being approached or exceeded.
    """
    total_value = portfolio["cash"] + sum(
        abs(p["qty"]) * p["entry_price"]
        for p in portfolio["positions"] if p["status"] == "open"
    )
    warnings = []

    for pos in portfolio["positions"]:
        if pos["status"] != "open":
            continue
        pos_value = abs(pos["qty"]) * pos["entry_price"]
        pos_pct = (pos_value / total_value) * 100
        if pos_pct > max_position_pct:
            warnings.append({
                "level": "HIGH",
                "message": f"Posição {pos['ticker']} representa {pos_pct:.1f}% do portfólio "
                           f"(limite: {max_position_pct}%)",
            })

    invested = sum(
        abs(p["qty"]) * p["entry_price"]
        for p in portfolio["positions"] if p["status"] == "open"
    )
    invested_pct = (invested / total_value) * 100 if total_value > 0 else 0
    if invested_pct > max_total_invested_pct:
        warnings.append({
            "level": "HIGH",
            "message": f"Total investido ({invested_pct:.1f}%) excede limite de "
                       f"{max_total_invested_pct}%",
        })

    if portfolio["cash"] < total_value * 0.1:
        warnings.append({
            "level": "MEDIUM",
            "message": f"Caixa baixo: R$ {portfolio['cash']:.2f} "
                       f"({(portfolio['cash'] / total_value * 100):.1f}% do portfólio)",
        })

    return warnings
