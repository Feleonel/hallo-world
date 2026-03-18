// Technical Indicators
const Indicators = {
    // Simple Moving Average
    SMA(data, period) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                result.push(null);
            } else {
                const slice = data.slice(i - period + 1, i + 1);
                const avg = slice.reduce((a, b) => a + b, 0) / period;
                result.push(+avg.toFixed(2));
            }
        }
        return result;
    },

    // Exponential Moving Average
    EMA(data, period) {
        const result = [];
        const multiplier = 2 / (period + 1);

        // Start with SMA for first value
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                sum += data[i];
                result.push(null);
            } else if (i === period - 1) {
                sum += data[i];
                result.push(+(sum / period).toFixed(2));
            } else {
                const ema = (data[i] - result[i - 1]) * multiplier + result[i - 1];
                result.push(+ema.toFixed(2));
            }
        }
        return result;
    },

    // Relative Strength Index
    RSI(data, period = 14) {
        const result = [];
        const gains = [];
        const losses = [];

        for (let i = 0; i < data.length; i++) {
            if (i === 0) {
                result.push(null);
                continue;
            }

            const change = data[i] - data[i - 1];
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);

            if (i < period) {
                result.push(null);
            } else if (i === period) {
                const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
                const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                result.push(+(100 - 100 / (1 + rs)).toFixed(2));
            } else {
                const prevRSI = result[i - 1];
                const avgGain = (gains[gains.length - 1] + (period - 1) * (gains.slice(-period - 1, -1).reduce((a, b) => a + b, 0) / period)) / period;
                const avgLoss = (losses[losses.length - 1] + (period - 1) * (losses.slice(-period - 1, -1).reduce((a, b) => a + b, 0) / period)) / period;
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                result.push(+(100 - 100 / (1 + rs)).toFixed(2));
            }
        }
        return result;
    },

    // MACD
    MACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const emaFast = this.EMA(data, fastPeriod);
        const emaSlow = this.EMA(data, slowPeriod);

        const macdLine = [];
        for (let i = 0; i < data.length; i++) {
            if (emaFast[i] === null || emaSlow[i] === null) {
                macdLine.push(null);
            } else {
                macdLine.push(+(emaFast[i] - emaSlow[i]).toFixed(4));
            }
        }

        const validMacd = macdLine.filter(v => v !== null);
        const signalLine = this.EMA(validMacd, signalPeriod);

        // Pad signal line
        const paddedSignal = [];
        let validIdx = 0;
        for (let i = 0; i < macdLine.length; i++) {
            if (macdLine[i] === null) {
                paddedSignal.push(null);
            } else {
                paddedSignal.push(signalLine[validIdx] || null);
                validIdx++;
            }
        }

        const histogram = [];
        for (let i = 0; i < macdLine.length; i++) {
            if (macdLine[i] === null || paddedSignal[i] === null) {
                histogram.push(null);
            } else {
                histogram.push(+(macdLine[i] - paddedSignal[i]).toFixed(4));
            }
        }

        return { macd: macdLine, signal: paddedSignal, histogram };
    },

    // Bollinger Bands
    BollingerBands(data, period = 20, stdDev = 2) {
        const sma = this.SMA(data, period);
        const upper = [];
        const lower = [];

        for (let i = 0; i < data.length; i++) {
            if (sma[i] === null) {
                upper.push(null);
                lower.push(null);
            } else {
                const slice = data.slice(i - period + 1, i + 1);
                const mean = sma[i];
                const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
                const sd = Math.sqrt(variance);
                upper.push(+(mean + stdDev * sd).toFixed(2));
                lower.push(+(mean - stdDev * sd).toFixed(2));
            }
        }

        return { middle: sma, upper, lower };
    },

    // Average True Range
    ATR(highs, lows, closes, period = 14) {
        const trueRanges = [];
        for (let i = 0; i < highs.length; i++) {
            if (i === 0) {
                trueRanges.push(highs[i] - lows[i]);
            } else {
                const tr = Math.max(
                    highs[i] - lows[i],
                    Math.abs(highs[i] - closes[i - 1]),
                    Math.abs(lows[i] - closes[i - 1])
                );
                trueRanges.push(tr);
            }
        }
        return this.SMA(trueRanges, period);
    }
};
