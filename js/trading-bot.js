// Trading Bot Engine
const TradingBot = {
    isRunning: false,
    config: {
        strategy: 'sma_crossover',
        capitalPerTrade: 5,
        stopLoss: 2,
        takeProfit: 4,
        maxDailyTrades: 10,
        maxDailyLoss: 2000,
        trailingStop: 'none',
        smaShort: 9,
        smaLong: 21,
        rsiPeriod: 14,
        rsiOverbought: 70,
        rsiOversold: 30,
        watchedAssets: ['PETR4', 'VALE3', 'USDBRL']
    },

    // Account state
    balance: 100000,
    initialBalance: 100000,
    positions: [],
    pendingOrders: [],
    executedOrders: [],
    tradeHistory: [],
    equityHistory: [{ time: Date.now(), value: 100000 }],
    dailyPnL: 0,
    dailyTrades: 0,
    orderIdCounter: 1000,

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this._log('Bot iniciado! Estratégia: ' + this._strategyName(), 'success');
        this._log('Monitorando: ' + this.config.watchedAssets.join(', '), 'info');
        this._log('Capital por operação: ' + this.config.capitalPerTrade + '% | Stop Loss: ' + this.config.stopLoss + '% | Take Profit: ' + this.config.takeProfit + '%', 'info');
    },

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        this._log('Bot desligado.', 'warning');
    },

    // Called on each market tick
    onTick(updates) {
        if (!this.isRunning) return;

        // Check daily limits
        if (this.dailyTrades >= this.config.maxDailyTrades) {
            return;
        }
        if (Math.abs(this.dailyPnL) >= this.config.maxDailyLoss && this.dailyPnL < 0) {
            this._log('Perda máxima diária atingida! Bot pausado.', 'error');
            this.stop();
            return;
        }

        // Manage open positions (stop loss / take profit)
        this._managePositions(updates);

        // Check for new signals
        for (const symbol of this.config.watchedAssets) {
            if (!updates[symbol]) continue;
            this._analyzeAndTrade(symbol);
        }

        // Update equity
        const equity = this._calculateEquity();
        this.equityHistory.push({ time: Date.now(), value: equity });
        if (this.equityHistory.length > 500) this.equityHistory.shift();
    },

    _analyzeAndTrade(symbol) {
        // Don't open if already in position
        if (this.positions.find(p => p.symbol === symbol)) return;

        const signal = this._getSignal(symbol);
        if (!signal) return;

        const price = MarketData.getPrice(symbol);
        const capitalForTrade = this.balance * (this.config.capitalPerTrade / 100);
        const qty = Math.floor(capitalForTrade / price);

        if (qty <= 0 || capitalForTrade > this.balance) return;

        this._executeOrder({
            symbol,
            side: signal.side,
            type: 'market',
            qty,
            price,
            strategy: this._strategyName(),
            reason: signal.reason
        });
    },

    _getSignal(symbol) {
        const closes = MarketData.getCloses(symbol, 50);
        if (closes.length < 30) return null;

        switch (this.config.strategy) {
            case 'sma_crossover': return this._smaCrossoverSignal(closes);
            case 'rsi_reversal': return this._rsiReversalSignal(closes);
            case 'bollinger_breakout': return this._bollingerSignal(closes);
            case 'macd_signal': return this._macdSignal(closes);
            case 'scalping': return this._scalpingSignal(closes);
            default: return null;
        }
    },

    _smaCrossoverSignal(closes) {
        const smaShort = Indicators.SMA(closes, this.config.smaShort);
        const smaLong = Indicators.SMA(closes, this.config.smaLong);

        const len = closes.length;
        const curr = { short: smaShort[len - 1], long: smaLong[len - 1] };
        const prev = { short: smaShort[len - 2], long: smaLong[len - 2] };

        if (!curr.short || !curr.long || !prev.short || !prev.long) return null;

        // Golden cross (buy)
        if (prev.short <= prev.long && curr.short > curr.long) {
            return { side: 'buy', reason: `Cruzamento de alta SMA(${this.config.smaShort}) > SMA(${this.config.smaLong})` };
        }
        // Death cross (sell)
        if (prev.short >= prev.long && curr.short < curr.long) {
            return { side: 'sell', reason: `Cruzamento de baixa SMA(${this.config.smaShort}) < SMA(${this.config.smaLong})` };
        }

        return null;
    },

    _rsiReversalSignal(closes) {
        const rsi = Indicators.RSI(closes, this.config.rsiPeriod);
        const len = closes.length;
        const currRSI = rsi[len - 1];
        const prevRSI = rsi[len - 2];

        if (!currRSI || !prevRSI) return null;

        // RSI crossing up from oversold
        if (prevRSI < this.config.rsiOversold && currRSI >= this.config.rsiOversold) {
            return { side: 'buy', reason: `RSI saindo de sobrevendido (${currRSI.toFixed(1)})` };
        }
        // RSI crossing down from overbought
        if (prevRSI > this.config.rsiOverbought && currRSI <= this.config.rsiOverbought) {
            return { side: 'sell', reason: `RSI saindo de sobrecomprado (${currRSI.toFixed(1)})` };
        }

        return null;
    },

    _bollingerSignal(closes) {
        const bb = Indicators.BollingerBands(closes, 20, 2);
        const len = closes.length;
        const price = closes[len - 1];
        const prevPrice = closes[len - 2];

        if (!bb.upper[len - 1] || !bb.lower[len - 1]) return null;

        // Price breaks below lower band then returns
        if (prevPrice < bb.lower[len - 2] && price >= bb.lower[len - 1]) {
            return { side: 'buy', reason: 'Reversão na banda inferior de Bollinger' };
        }
        // Price breaks above upper band then returns
        if (prevPrice > bb.upper[len - 2] && price <= bb.upper[len - 1]) {
            return { side: 'sell', reason: 'Reversão na banda superior de Bollinger' };
        }

        return null;
    },

    _macdSignal(closes) {
        const { macd, signal } = Indicators.MACD(closes);
        const len = closes.length;

        if (!macd[len - 1] || !signal[len - 1] || !macd[len - 2] || !signal[len - 2]) return null;

        // MACD crosses above signal
        if (macd[len - 2] <= signal[len - 2] && macd[len - 1] > signal[len - 1]) {
            return { side: 'buy', reason: 'MACD cruzou acima da linha de sinal' };
        }
        // MACD crosses below signal
        if (macd[len - 2] >= signal[len - 2] && macd[len - 1] < signal[len - 1]) {
            return { side: 'sell', reason: 'MACD cruzou abaixo da linha de sinal' };
        }

        return null;
    },

    _scalpingSignal(closes) {
        const len = closes.length;
        if (len < 5) return null;

        // Momentum: 3 consecutive candles in same direction
        const changes = [];
        for (let i = len - 4; i < len; i++) {
            changes.push(closes[i] - closes[i - 1]);
        }

        const allUp = changes.every(c => c > 0);
        const allDown = changes.every(c => c < 0);

        // Check RSI for confirmation
        const rsi = Indicators.RSI(closes, 7);
        const currRSI = rsi[len - 1];

        if (allUp && currRSI && currRSI < 75) {
            return { side: 'buy', reason: 'Momentum de alta (3 candles consecutivos)' };
        }
        if (allDown && currRSI && currRSI > 25) {
            return { side: 'sell', reason: 'Momentum de baixa (3 candles consecutivos)' };
        }

        return null;
    },

    _managePositions(updates) {
        for (let i = this.positions.length - 1; i >= 0; i--) {
            const pos = this.positions[i];
            const currentPrice = MarketData.getPrice(pos.symbol);
            const pnlPercent = pos.side === 'buy'
                ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100
                : ((pos.entryPrice - currentPrice) / pos.entryPrice) * 100;

            pos.currentPrice = currentPrice;
            pos.pnl = pos.side === 'buy'
                ? (currentPrice - pos.entryPrice) * pos.qty
                : (pos.entryPrice - currentPrice) * pos.qty;
            pos.pnlPercent = pnlPercent;

            // Trailing stop update
            if (this.config.trailingStop === 'fixed' && pnlPercent > 0) {
                const trailLevel = pos.side === 'buy'
                    ? currentPrice * (1 - 0.01)
                    : currentPrice * (1 + 0.01);
                if (pos.side === 'buy' && (!pos.trailStop || trailLevel > pos.trailStop)) {
                    pos.trailStop = trailLevel;
                }
                if (pos.side === 'sell' && (!pos.trailStop || trailLevel < pos.trailStop)) {
                    pos.trailStop = trailLevel;
                }
            }

            // Check stop loss
            if (pnlPercent <= -this.config.stopLoss) {
                this._closePosition(i, 'Stop Loss');
                continue;
            }

            // Check take profit
            if (pnlPercent >= this.config.takeProfit) {
                this._closePosition(i, 'Take Profit');
                continue;
            }

            // Check trailing stop
            if (pos.trailStop) {
                if (pos.side === 'buy' && currentPrice <= pos.trailStop) {
                    this._closePosition(i, 'Trailing Stop');
                    continue;
                }
                if (pos.side === 'sell' && currentPrice >= pos.trailStop) {
                    this._closePosition(i, 'Trailing Stop');
                }
            }
        }
    },

    _executeOrder(order) {
        const id = ++this.orderIdCounter;
        const cost = order.price * order.qty;

        if (order.side === 'buy') {
            this.balance -= cost;
        }

        const position = {
            id,
            symbol: order.symbol,
            side: order.side,
            qty: order.qty,
            entryPrice: order.price,
            currentPrice: order.price,
            pnl: 0,
            pnlPercent: 0,
            time: new Date(),
            strategy: order.strategy,
            trailStop: null
        };

        this.positions.push(position);
        this.dailyTrades++;

        const executed = {
            id,
            time: new Date(),
            symbol: order.symbol,
            side: order.side,
            qty: order.qty,
            price: order.price,
            type: order.type
        };
        this.executedOrders.push(executed);

        const sideLabel = order.side === 'buy' ? 'COMPRA' : 'VENDA';
        this._log(`[${sideLabel}] ${order.symbol} | ${order.qty} @ R$ ${order.price.toFixed(2)} | ${order.reason}`, 'trade');
    },

    _closePosition(index, reason) {
        const pos = this.positions[index];
        const currentPrice = MarketData.getPrice(pos.symbol);
        const pnl = pos.side === 'buy'
            ? (currentPrice - pos.entryPrice) * pos.qty
            : (pos.entryPrice - currentPrice) * pos.qty;

        // Return capital
        if (pos.side === 'buy') {
            this.balance += currentPrice * pos.qty;
        } else {
            this.balance += pos.entryPrice * pos.qty + pnl;
        }

        this.dailyPnL += pnl;

        const trade = {
            date: new Date(),
            symbol: pos.symbol,
            side: pos.side,
            entryPrice: pos.entryPrice,
            exitPrice: currentPrice,
            qty: pos.qty,
            pnl: +pnl.toFixed(2),
            strategy: pos.strategy,
            reason
        };
        this.tradeHistory.push(trade);

        const pnlStr = pnl >= 0 ? `+R$ ${pnl.toFixed(2)}` : `-R$ ${Math.abs(pnl).toFixed(2)}`;
        const logType = pnl >= 0 ? 'success' : 'error';
        this._log(`[FECHAMENTO] ${pos.symbol} | ${reason} | P&L: ${pnlStr}`, logType);

        this.positions.splice(index, 1);
    },

    // Manual order
    placeManualOrder(asset, side, type, qty, price) {
        if (type === 'market') {
            price = MarketData.getPrice(asset);
        }

        this._executeOrder({
            symbol: asset,
            side,
            type,
            qty: parseInt(qty),
            price,
            strategy: 'Manual',
            reason: 'Ordem manual do usuário'
        });
    },

    closePositionManual(positionId) {
        const index = this.positions.findIndex(p => p.id === positionId);
        if (index !== -1) {
            this._closePosition(index, 'Fechamento manual');
        }
    },

    _calculateEquity() {
        let equity = this.balance;
        for (const pos of this.positions) {
            const price = MarketData.getPrice(pos.symbol);
            if (pos.side === 'buy') {
                equity += price * pos.qty;
            }
        }
        return +equity.toFixed(2);
    },

    getStats() {
        const wins = this.tradeHistory.filter(t => t.pnl > 0).length;
        const total = this.tradeHistory.length;
        const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '--';
        const equity = this._calculateEquity();
        const totalReturn = ((equity - this.initialBalance) / this.initialBalance * 100).toFixed(2);
        const exposure = this.positions.reduce((sum, p) => sum + p.entryPrice * p.qty, 0);

        return {
            equity,
            balance: this.balance,
            totalReturn,
            todayPnL: this.dailyPnL,
            todayTrades: this.dailyTrades,
            winRate,
            openPositions: this.positions.length,
            exposure: +exposure.toFixed(2)
        };
    },

    _strategyName() {
        const names = {
            sma_crossover: 'Cruzamento de Médias',
            rsi_reversal: 'Reversão por RSI',
            bollinger_breakout: 'Rompimento de Bollinger',
            macd_signal: 'Sinal MACD',
            scalping: 'Scalping (Momentum)'
        };
        return names[this.config.strategy] || this.config.strategy;
    },

    _log(message, type = 'info') {
        const time = new Date().toLocaleTimeString('pt-BR');
        const entry = { time, message, type };
        if (!this.logEntries) this.logEntries = [];
        this.logEntries.push(entry);
        if (this.logEntries.length > 200) this.logEntries.shift();

        // Dispatch event for UI
        window.dispatchEvent(new CustomEvent('bot-log', { detail: entry }));
    }
};
