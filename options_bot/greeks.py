"""
Black-Scholes Greeks calculator for options pricing.
Supports both CALL and PUT options on the Brazilian market (B3).
"""

import math
from scipy.stats import norm


def d1(S, K, T, r, sigma):
    """Calculate d1 parameter for Black-Scholes."""
    if T <= 0 or sigma <= 0:
        return 0.0
    return (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))


def d2(S, K, T, r, sigma):
    """Calculate d2 parameter for Black-Scholes."""
    if T <= 0 or sigma <= 0:
        return 0.0
    return d1(S, K, T, r, sigma) - sigma * math.sqrt(T)


def black_scholes_price(S, K, T, r, sigma, option_type="call"):
    """
    Calculate Black-Scholes option price.

    Args:
        S: Spot price of underlying asset
        K: Strike price
        T: Time to expiration (in years)
        r: Risk-free rate (SELIC annual rate)
        sigma: Implied volatility
        option_type: 'call' or 'put'
    """
    if T <= 0:
        if option_type == "call":
            return max(S - K, 0)
        return max(K - S, 0)

    _d1 = d1(S, K, T, r, sigma)
    _d2 = d2(S, K, T, r, sigma)

    if option_type == "call":
        return S * norm.cdf(_d1) - K * math.exp(-r * T) * norm.cdf(_d2)
    else:
        return K * math.exp(-r * T) * norm.cdf(-_d2) - S * norm.cdf(-_d1)


def delta(S, K, T, r, sigma, option_type="call"):
    """Delta: sensitivity of option price to underlying price changes."""
    if T <= 0:
        if option_type == "call":
            return 1.0 if S > K else 0.0
        return -1.0 if S < K else 0.0
    _d1 = d1(S, K, T, r, sigma)
    if option_type == "call":
        return norm.cdf(_d1)
    return norm.cdf(_d1) - 1


def gamma(S, K, T, r, sigma):
    """Gamma: rate of change of delta."""
    if T <= 0 or sigma <= 0:
        return 0.0
    _d1 = d1(S, K, T, r, sigma)
    return norm.pdf(_d1) / (S * sigma * math.sqrt(T))


def theta(S, K, T, r, sigma, option_type="call"):
    """Theta: time decay (per calendar day)."""
    if T <= 0 or sigma <= 0:
        return 0.0
    _d1 = d1(S, K, T, r, sigma)
    _d2 = d2(S, K, T, r, sigma)
    common = -(S * norm.pdf(_d1) * sigma) / (2 * math.sqrt(T))
    if option_type == "call":
        return (common - r * K * math.exp(-r * T) * norm.cdf(_d2)) / 365
    return (common + r * K * math.exp(-r * T) * norm.cdf(-_d2)) / 365


def vega(S, K, T, r, sigma):
    """Vega: sensitivity to volatility changes (per 1% change)."""
    if T <= 0 or sigma <= 0:
        return 0.0
    _d1 = d1(S, K, T, r, sigma)
    return S * norm.pdf(_d1) * math.sqrt(T) / 100


def rho(S, K, T, r, sigma, option_type="call"):
    """Rho: sensitivity to interest rate changes (per 1% change)."""
    if T <= 0:
        return 0.0
    _d2 = d2(S, K, T, r, sigma)
    if option_type == "call":
        return K * T * math.exp(-r * T) * norm.cdf(_d2) / 100
    return -K * T * math.exp(-r * T) * norm.cdf(-_d2) / 100


def implied_volatility(market_price, S, K, T, r, option_type="call",
                        max_iter=100, tol=1e-6):
    """
    Calculate implied volatility using Newton-Raphson method.
    """
    sigma = 0.3  # initial guess
    for _ in range(max_iter):
        price = black_scholes_price(S, K, T, r, sigma, option_type)
        v = vega(S, K, T, r, sigma) * 100  # undo the /100 in vega
        if v < 1e-10:
            break
        diff = market_price - price
        if abs(diff) < tol:
            return sigma
        sigma += diff / v
        sigma = max(sigma, 0.001)
    return sigma


def calculate_all_greeks(S, K, T, r, sigma, option_type="call"):
    """Return all Greeks as a dictionary."""
    return {
        "price": round(black_scholes_price(S, K, T, r, sigma, option_type), 4),
        "delta": round(delta(S, K, T, r, sigma, option_type), 4),
        "gamma": round(gamma(S, K, T, r, sigma), 4),
        "theta": round(theta(S, K, T, r, sigma, option_type), 4),
        "vega": round(vega(S, K, T, r, sigma), 4),
        "rho": round(rho(S, K, T, r, sigma, option_type), 4),
        "iv": round(sigma * 100, 2),
    }
