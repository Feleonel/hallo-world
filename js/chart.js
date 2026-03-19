// Chart Renderer - Canvas-based price chart
const ChartRenderer = {
    canvas: null,
    ctx: null,
    currentSymbol: 'PETR4',
    showSMA: true,
    showEMA: false,
    showBollinger: false,
    showVolume: true,
    tooltip: null,

    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this._resize();
        window.addEventListener('resize', () => this._resize());

        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this._hideTooltip());
    },

    _resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        this.render();
    },

    setSymbol(symbol) {
        this.currentSymbol = symbol;
        this.render();
    },

    render() {
        if (!this.ctx) return;

        const { width, height } = this.canvas;
        const ctx = this.ctx;
        const data = MarketData.getHistory(this.currentSymbol, 80);

        if (data.length < 2) return;

        // Clear
        ctx.clearRect(0, 0, width, height);

        const padding = { top: 20, right: 60, bottom: this.showVolume ? 80 : 30, left: 10 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        const prices = data.flatMap(d => [d.high, d.low]);
        let minPrice = Math.min(...prices);
        let maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice || 1;
        minPrice -= priceRange * 0.05;
        maxPrice += priceRange * 0.05;

        const barWidth = chartW / data.length;
        const candleWidth = Math.max(barWidth * 0.6, 2);

        // Helper functions
        const priceToY = (p) => padding.top + chartH - ((p - minPrice) / (maxPrice - minPrice)) * chartH;
        const indexToX = (i) => padding.left + i * barWidth + barWidth / 2;

        // Grid lines
        ctx.strokeStyle = 'rgba(55, 65, 81, 0.3)';
        ctx.lineWidth = 0.5;
        const gridCount = 5;
        for (let i = 0; i <= gridCount; i++) {
            const y = padding.top + (chartH / gridCount) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // Price labels
            const price = maxPrice - ((maxPrice - minPrice) / gridCount) * i;
            ctx.fillStyle = '#9ca3af';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(this._formatPrice(price), width - padding.right + 5, y + 3);
        }

        // Volume bars
        if (this.showVolume) {
            const maxVol = Math.max(...data.map(d => d.volume));
            const volHeight = 50;
            const volTop = height - padding.bottom + 10;

            for (let i = 0; i < data.length; i++) {
                const d = data[i];
                const x = indexToX(i);
                const h = (d.volume / maxVol) * volHeight;
                const color = d.close >= d.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)';

                ctx.fillStyle = color;
                ctx.fillRect(x - candleWidth / 2, volTop + volHeight - h, candleWidth, h);
            }
        }

        // Bollinger Bands
        if (this.showBollinger) {
            const closes = data.map(d => d.close);
            const bb = Indicators.BollingerBands(closes, 20, 2);

            // Fill between bands
            ctx.fillStyle = 'rgba(59, 130, 246, 0.05)';
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < data.length; i++) {
                if (bb.upper[i] !== null) {
                    const x = indexToX(i);
                    if (!started) { ctx.moveTo(x, priceToY(bb.upper[i])); started = true; }
                    else ctx.lineTo(x, priceToY(bb.upper[i]));
                }
            }
            for (let i = data.length - 1; i >= 0; i--) {
                if (bb.lower[i] !== null) {
                    ctx.lineTo(indexToX(i), priceToY(bb.lower[i]));
                }
            }
            ctx.closePath();
            ctx.fill();

            // Upper band
            this._drawLine(data, bb.upper, indexToX, priceToY, 'rgba(59, 130, 246, 0.4)', 1);
            // Lower band
            this._drawLine(data, bb.lower, indexToX, priceToY, 'rgba(59, 130, 246, 0.4)', 1);
            // Middle band
            this._drawLine(data, bb.middle, indexToX, priceToY, 'rgba(59, 130, 246, 0.6)', 1);
        }

        // SMA
        if (this.showSMA) {
            const closes = data.map(d => d.close);
            const sma = Indicators.SMA(closes, 20);
            this._drawLine(data, sma, indexToX, priceToY, '#f59e0b', 1.5);
        }

        // EMA
        if (this.showEMA) {
            const closes = data.map(d => d.close);
            const ema = Indicators.EMA(closes, 9);
            this._drawLine(data, ema, indexToX, priceToY, '#a78bfa', 1.5);
        }

        // Candlesticks
        for (let i = 0; i < data.length; i++) {
            const d = data[i];
            const x = indexToX(i);
            const isUp = d.close >= d.open;
            const color = isUp ? '#10b981' : '#ef4444';

            // Wick
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, priceToY(d.high));
            ctx.lineTo(x, priceToY(d.low));
            ctx.stroke();

            // Body
            const bodyTop = priceToY(Math.max(d.open, d.close));
            const bodyBottom = priceToY(Math.min(d.open, d.close));
            const bodyHeight = Math.max(bodyBottom - bodyTop, 1);

            if (isUp) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
            } else {
                ctx.fillStyle = color;
                ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
            }
        }

        // Current price line
        const lastPrice = data[data.length - 1].close;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = data[data.length - 1].close >= data[data.length - 2]?.close ? '#10b981' : '#ef4444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, priceToY(lastPrice));
        ctx.lineTo(width - padding.right, priceToY(lastPrice));
        ctx.stroke();
        ctx.setLineDash([]);

        // Price label
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillRect(width - padding.right, priceToY(lastPrice) - 8, 55, 16);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(this._formatPrice(lastPrice), width - padding.right + 3, priceToY(lastPrice) + 3);

        // Store data for tooltip
        this._chartData = data;
        this._indexToX = indexToX;
        this._priceToY = priceToY;
        this._barWidth = barWidth;
        this._padding = padding;
    },

    _drawLine(data, values, indexToX, priceToY, color, lineWidth) {
        const ctx = this.ctx;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < data.length; i++) {
            if (values[i] !== null) {
                const x = indexToX(i);
                const y = priceToY(values[i]);
                if (!started) { ctx.moveTo(x, y); started = true; }
                else ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    },

    _formatPrice(price) {
        if (price >= 1000) return price.toFixed(0);
        return price.toFixed(2);
    },

    _onMouseMove(e) {
        if (!this._chartData) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const data = this._chartData;

        const idx = Math.floor((x - this._padding.left) / this._barWidth);
        if (idx >= 0 && idx < data.length) {
            const d = data[idx];
            this._showTooltip(e.clientX, e.clientY, d);
        }
    },

    _showTooltip(x, y, data) {
        if (!this.tooltip) {
            this.tooltip = document.createElement('div');
            this.tooltip.className = 'chart-tooltip';
            document.body.appendChild(this.tooltip);
        }

        const change = ((data.close - data.open) / data.open * 100).toFixed(2);
        const changeColor = change >= 0 ? '#10b981' : '#ef4444';

        this.tooltip.innerHTML = `
            <div class="tooltip-title">${this.currentSymbol}</div>
            <div class="tooltip-row"><span class="tooltip-label">Abertura:</span> ${this._formatPrice(data.open)}</div>
            <div class="tooltip-row"><span class="tooltip-label">Máxima:</span> ${this._formatPrice(data.high)}</div>
            <div class="tooltip-row"><span class="tooltip-label">Mínima:</span> ${this._formatPrice(data.low)}</div>
            <div class="tooltip-row"><span class="tooltip-label">Fechamento:</span> ${this._formatPrice(data.close)}</div>
            <div class="tooltip-row"><span class="tooltip-label">Variação:</span> <span style="color:${changeColor}">${change}%</span></div>
            <div class="tooltip-row"><span class="tooltip-label">Volume:</span> ${data.volume.toLocaleString('pt-BR')}</div>
        `;

        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (x + 15) + 'px';
        this.tooltip.style.top = (y - 60) + 'px';
    },

    _hideTooltip() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
        }
    },

    // Simple equity chart
    renderEquityChart(canvasId, equityData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || equityData.length < 2) return;

        const ctx = canvas.getContext('2d');
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = 250;

        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);

        const padding = { top: 20, right: 60, bottom: 30, left: 10 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        const values = equityData.map(e => e.value);
        const min = Math.min(...values) * 0.99;
        const max = Math.max(...values) * 1.01;

        const xStep = chartW / (equityData.length - 1);
        const yScale = (v) => padding.top + chartH - ((v - min) / (max - min)) * chartH;

        // Grid
        ctx.strokeStyle = 'rgba(55, 65, 81, 0.3)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            const val = max - ((max - min) / 4) * i;
            ctx.fillStyle = '#9ca3af';
            ctx.font = '10px sans-serif';
            ctx.fillText('R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 0 }), width - padding.right + 5, y + 3);
        }

        // Line
        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        const isPositive = values[values.length - 1] >= values[0];
        const lineColor = isPositive ? '#10b981' : '#ef4444';
        gradient.addColorStop(0, isPositive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        // Fill
        ctx.beginPath();
        ctx.moveTo(padding.left, yScale(values[0]));
        for (let i = 1; i < values.length; i++) {
            ctx.lineTo(padding.left + i * xStep, yScale(values[i]));
        }
        ctx.lineTo(padding.left + (values.length - 1) * xStep, height - padding.bottom);
        ctx.lineTo(padding.left, height - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Line
        ctx.beginPath();
        ctx.moveTo(padding.left, yScale(values[0]));
        for (let i = 1; i < values.length; i++) {
            ctx.lineTo(padding.left + i * xStep, yScale(values[i]));
        }
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.stroke();
    },

    // Bar chart for per-trade P&L
    renderTradePnlChart(canvasId, trades) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = 280;

        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);

        if (!trades || trades.length === 0) {
            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Nenhum trade finalizado ainda', width / 2, height / 2);
            return;
        }

        const padding = { top: 20, right: 60, bottom: 40, left: 10 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        const pnls = trades.map(t => t.pnl);
        const maxPnl = Math.max(...pnls, 0);
        const minPnl = Math.min(...pnls, 0);
        const range = (maxPnl - minPnl) || 1;
        const adjMax = maxPnl + range * 0.1;
        const adjMin = minPnl - range * 0.1;
        const adjRange = adjMax - adjMin;

        const barWidth = Math.min(chartW / trades.length, 40);
        const gap = Math.max(barWidth * 0.2, 1);
        const barNet = barWidth - gap;
        const totalBarsWidth = trades.length * barWidth;
        const offsetX = padding.left + (chartW - totalBarsWidth) / 2;

        // Zero line
        const zeroY = padding.top + chartH - ((0 - adjMin) / adjRange) * chartH;

        // Grid
        ctx.strokeStyle = 'rgba(55, 65, 81, 0.3)';
        ctx.lineWidth = 0.5;
        const gridSteps = 5;
        for (let i = 0; i <= gridSteps; i++) {
            const y = padding.top + (chartH / gridSteps) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            const val = adjMax - (adjRange / gridSteps) * i;
            ctx.fillStyle = '#9ca3af';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('R$ ' + val.toFixed(0), width - padding.right + 5, y + 3);
        }

        // Zero line highlight
        ctx.strokeStyle = 'rgba(156, 163, 175, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, zeroY);
        ctx.lineTo(width - padding.right, zeroY);
        ctx.stroke();

        // Bars
        for (let i = 0; i < trades.length; i++) {
            const pnl = trades[i].pnl;
            const x = offsetX + i * barWidth + gap / 2;
            const barY = padding.top + chartH - ((pnl - adjMin) / adjRange) * chartH;

            const isPositive = pnl >= 0;
            ctx.fillStyle = isPositive ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)';

            if (isPositive) {
                ctx.fillRect(x, barY, barNet, zeroY - barY);
            } else {
                ctx.fillRect(x, zeroY, barNet, barY - zeroY);
            }

            // Trade number label at bottom
            if (trades.length <= 40) {
                ctx.fillStyle = '#9ca3af';
                ctx.font = '9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(i + 1, x + barNet / 2, height - padding.bottom + 14);
            }
        }

        // Cumulative P&L overlay line
        if (trades.length > 1) {
            let cumulative = 0;
            const cumValues = trades.map(t => { cumulative += t.pnl; return cumulative; });
            const cumMax = Math.max(...cumValues);
            const cumMin = Math.min(...cumValues, 0);
            const cumRange = (cumMax - cumMin) || 1;

            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            for (let i = 0; i < cumValues.length; i++) {
                const x = offsetX + i * barWidth + barNet / 2;
                const y = padding.top + chartH - ((cumValues[i] - cumMin) / cumRange) * chartH * 0.9 - chartH * 0.05;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Label
            ctx.fillStyle = '#3b82f6';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('Acumulado', offsetX + trades.length * barWidth + 5, padding.top + 12);
        }
    },

    // Pie chart for portfolio
    renderPortfolioChart(canvasId, holdings) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = 250;

        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);

        if (holdings.length === 0) {
            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Nenhum ativo em carteira', width / 2, height / 2);
            return;
        }

        const total = holdings.reduce((sum, h) => sum + h.value, 0);
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a78bfa', '#ec4899', '#14b8a6'];
        const cx = width / 2 - 60;
        const cy = height / 2;
        const radius = Math.min(cx, cy) - 20;

        let startAngle = -Math.PI / 2;

        holdings.forEach((h, i) => {
            const sliceAngle = (h.value / total) * Math.PI * 2;
            const color = colors[i % colors.length];

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            startAngle += sliceAngle;
        });

        // Legend
        const legendX = width / 2 + 40;
        let legendY = 30;
        holdings.forEach((h, i) => {
            const color = colors[i % colors.length];
            const pct = ((h.value / total) * 100).toFixed(1);

            ctx.fillStyle = color;
            ctx.fillRect(legendX, legendY, 12, 12);

            ctx.fillStyle = '#e5e7eb';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${h.symbol} (${pct}%)`, legendX + 18, legendY + 10);

            legendY += 22;
        });
    }
};
