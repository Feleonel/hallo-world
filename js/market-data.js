// Market Data Simulator - Simula dados de mercado em tempo real
const MarketData = {
    assets: {
        PETR4: { name: 'Petrobras PN', type: 'Ação', price: 38.45, basePrice: 38.45, volatility: 0.015, volume: 0 },
        VALE3: { name: 'Vale ON', type: 'Ação', price: 68.20, basePrice: 68.20, volatility: 0.012, volume: 0 },
        ITUB4: { name: 'Itaú Unibanco PN', type: 'Ação', price: 32.80, basePrice: 32.80, volatility: 0.008, volume: 0 },
        BBDC4: { name: 'Bradesco PN', type: 'Ação', price: 15.50, basePrice: 15.50, volatility: 0.010, volume: 0 },
        USDBRL: { name: 'Dólar/Real', type: 'Dólar', price: 5.12, basePrice: 5.12, volatility: 0.005, volume: 0 },
        WINFUT: { name: 'Mini Índice', type: 'Futuro', price: 128500, basePrice: 128500, volatility: 0.008, volume: 0 },
        DOLFUT: { name: 'Mini Dólar', type: 'Futuro', price: 5125, basePrice: 5125, volatility: 0.005, volume: 0 }
    },

    priceHistory: {},
    listeners: [],
    intervalId: null,

    init() {
        for (const symbol of Object.keys(this.assets)) {
            this.priceHistory[symbol] = this._generateInitialHistory(symbol, 100);
        }
    },

    _generateInitialHistory(symbol, count) {
        const asset = this.assets[symbol];
        const history = [];
        let price = asset.basePrice * (1 - asset.volatility * 5);

        for (let i = 0; i < count; i++) {
            const change = (Math.random() - 0.48) * asset.volatility * price;
            price = Math.max(price * 0.9, price + change);
            const high = price + Math.random() * asset.volatility * price;
            const low = price - Math.random() * asset.volatility * price;
            const open = price + (Math.random() - 0.5) * asset.volatility * price * 0.5;
            const volume = Math.floor(Math.random() * 1000000) + 100000;

            history.push({
                time: Date.now() - (count - i) * 60000,
                open: +open.toFixed(2),
                high: +high.toFixed(2),
                low: +low.toFixed(2),
                close: +price.toFixed(2),
                volume
            });
        }

        // Set current price to last close
        this.assets[symbol].price = history[history.length - 1].close;
        return history;
    },

    startSimulation(intervalMs = 2000) {
        if (this.intervalId) return;

        this.intervalId = setInterval(() => {
            this._tick();
        }, intervalMs);
    },

    stopSimulation() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    },

    _tick() {
        const updates = {};

        for (const [symbol, asset] of Object.entries(this.assets)) {
            const trend = (Math.random() - 0.48); // slight upward bias
            const change = trend * asset.volatility * asset.price;
            const oldPrice = asset.price;
            asset.price = +(asset.price + change).toFixed(symbol === 'WINFUT' ? 0 : 2);

            if (asset.price <= 0) asset.price = oldPrice;

            const volume = Math.floor(Math.random() * 500000) + 50000;
            asset.volume = volume;

            const candle = {
                time: Date.now(),
                open: oldPrice,
                high: Math.max(oldPrice, asset.price) + Math.random() * Math.abs(change) * 0.5,
                low: Math.min(oldPrice, asset.price) - Math.random() * Math.abs(change) * 0.5,
                close: asset.price,
                volume
            };

            candle.high = +candle.high.toFixed(2);
            candle.low = +candle.low.toFixed(2);

            this.priceHistory[symbol].push(candle);
            if (this.priceHistory[symbol].length > 500) {
                this.priceHistory[symbol].shift();
            }

            updates[symbol] = {
                price: asset.price,
                change: asset.price - asset.basePrice,
                changePercent: ((asset.price - asset.basePrice) / asset.basePrice * 100).toFixed(2),
                volume,
                candle
            };
        }

        this._notifyListeners(updates);
    },

    onUpdate(callback) {
        this.listeners.push(callback);
    },

    _notifyListeners(updates) {
        for (const cb of this.listeners) {
            cb(updates);
        }
    },

    getPrice(symbol) {
        return this.assets[symbol]?.price || 0;
    },

    getHistory(symbol, periods = 100) {
        const hist = this.priceHistory[symbol] || [];
        return hist.slice(-periods);
    },

    getCloses(symbol, periods = 100) {
        return this.getHistory(symbol, periods).map(c => c.close);
    }
};
