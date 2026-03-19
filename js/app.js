// Main Application - Ties everything together
(function () {
    'use strict';

    // Initialize market data
    MarketData.init();

    // Initialize chart
    ChartRenderer.init('priceChart');

    // Start market simulation
    MarketData.startSimulation(2000);

    // --- Navigation ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.dataset.section;
            navItems.forEach(n => n.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            document.getElementById('section-' + target).classList.add('active');

            if (target === 'history') updateHistoryView();
            if (target === 'results') updateResultsView();
            if (target === 'wallet') updateWalletView();
        });
    });

    // --- Clock ---
    function updateClock() {
        const now = new Date();
        document.getElementById('clock').textContent = now.toLocaleTimeString('pt-BR');

        const hour = now.getHours();
        const statusEl = document.getElementById('marketStatus');
        if (hour >= 10 && hour < 17) {
            statusEl.textContent = 'Mercado Aberto';
            statusEl.className = 'market-status open';
        } else {
            statusEl.textContent = 'Mercado Fechado';
            statusEl.className = 'market-status closed';
        }
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- Bot Toggle ---
    const btnToggle = document.getElementById('btnToggleBot');
    const botIndicator = document.getElementById('botIndicator');

    btnToggle.addEventListener('click', () => {
        if (TradingBot.isRunning) {
            TradingBot.stop();
            btnToggle.textContent = 'Iniciar Bot';
            btnToggle.className = 'btn btn-start';
            botIndicator.querySelector('.dot').className = 'dot offline';
            botIndicator.querySelector('.status-text').textContent = 'Desligado';
        } else {
            // Load config before starting
            loadConfigToBot();
            TradingBot.start();
            btnToggle.textContent = 'Parar Bot';
            btnToggle.className = 'btn btn-stop';
            botIndicator.querySelector('.dot').className = 'dot online';
            botIndicator.querySelector('.status-text').textContent = 'Ativo';
        }
    });

    // --- Market Data Updates ---
    MarketData.onUpdate((updates) => {
        updateMarketList(updates);
        updateDashboardStats();
        updatePositionsTable();
        ChartRenderer.render();

        // Feed bot
        TradingBot.onTick(updates);
    });

    // --- Market List ---
    function updateMarketList() {
        const list = document.getElementById('marketList');
        let html = '';

        for (const [symbol, asset] of Object.entries(MarketData.assets)) {
            const change = asset.price - asset.basePrice;
            const changePct = ((change / asset.basePrice) * 100).toFixed(2);
            const isPositive = change >= 0;
            const changeClass = isPositive ? 'positive' : 'negative';
            const sign = isPositive ? '+' : '';
            const priceStr = symbol === 'WINFUT' ? asset.price.toLocaleString('pt-BR') : asset.price.toFixed(2);

            html += `
                <div class="market-item" data-symbol="${symbol}">
                    <div>
                        <div class="market-name">${symbol}</div>
                        <div class="market-type">${asset.type} - ${asset.name}</div>
                    </div>
                    <div class="market-price">
                        <div class="price">R$ ${priceStr}</div>
                        <div class="change ${changeClass}">${sign}${changePct}%</div>
                    </div>
                </div>
            `;
        }

        list.innerHTML = html;

        // Click to change chart
        list.querySelectorAll('.market-item').forEach(item => {
            item.addEventListener('click', () => {
                const symbol = item.dataset.symbol;
                document.getElementById('chartAsset').value = symbol;
                ChartRenderer.setSymbol(symbol);
            });
        });
    }

    // Initialize market list
    updateMarketList();

    // --- Dashboard Stats ---
    function updateDashboardStats() {
        const stats = TradingBot.getStats();

        document.getElementById('totalBalance').textContent = 'R$ ' + stats.equity.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        document.getElementById('balanceChange').textContent = (stats.totalReturn >= 0 ? '+' : '') + stats.totalReturn + '%';
        document.getElementById('balanceChange').className = 'stat-change ' + (stats.totalReturn >= 0 ? 'positive' : 'negative');

        document.getElementById('todayProfit').textContent = (stats.todayPnL >= 0 ? '+' : '') + 'R$ ' + stats.todayPnL.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        document.getElementById('todayProfit').style.color = stats.todayPnL >= 0 ? 'var(--green)' : 'var(--red)';

        const pnlPct = ((stats.todayPnL / TradingBot.initialBalance) * 100).toFixed(2);
        document.getElementById('profitChange').textContent = (pnlPct >= 0 ? '+' : '') + pnlPct + '%';
        document.getElementById('profitChange').className = 'stat-change ' + (pnlPct >= 0 ? 'positive' : 'negative');

        document.getElementById('todayTrades').textContent = stats.todayTrades;
        document.getElementById('winRate').textContent = 'Win Rate: ' + stats.winRate + (stats.winRate !== '--' ? '%' : '');

        document.getElementById('openPositions').textContent = stats.openPositions;
        document.getElementById('exposure').textContent = 'Exposição: R$ ' + stats.exposure.toLocaleString('pt-BR');
    }

    // --- Positions Table ---
    function updatePositionsTable() {
        const tbody = document.getElementById('positionsTable');
        if (TradingBot.positions.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="7">Nenhuma posição aberta</td></tr>';
            return;
        }

        tbody.innerHTML = TradingBot.positions.map(pos => {
            const pnlClass = pos.pnl >= 0 ? 'pl-positive' : 'pl-negative';
            const sideClass = pos.side === 'buy' ? 'badge-buy' : 'badge-sell';
            const sideLabel = pos.side === 'buy' ? 'Compra' : 'Venda';
            const pnlStr = (pos.pnl >= 0 ? '+' : '') + 'R$ ' + pos.pnl.toFixed(2);

            return `
                <tr>
                    <td>${pos.symbol}</td>
                    <td><span class="badge ${sideClass}">${sideLabel}</span></td>
                    <td>${pos.qty}</td>
                    <td>R$ ${pos.entryPrice.toFixed(2)}</td>
                    <td>R$ ${pos.currentPrice.toFixed(2)}</td>
                    <td class="${pnlClass}">${pnlStr} (${pos.pnlPercent.toFixed(2)}%)</td>
                    <td><button class="btn btn-danger" onclick="TradingBot.closePositionManual(${pos.id})">Fechar</button></td>
                </tr>
            `;
        }).join('');
    }

    // --- Bot Log ---
    window.addEventListener('bot-log', (e) => {
        const log = document.getElementById('botLog');
        const entry = e.detail;
        const div = document.createElement('div');
        div.className = 'log-entry ' + entry.type;
        div.textContent = `[${entry.time}] ${entry.message}`;
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;

        // Keep max entries
        while (log.children.length > 100) {
            log.removeChild(log.firstChild);
        }
    });

    // --- Chart Controls ---
    document.getElementById('chartAsset').addEventListener('change', (e) => {
        ChartRenderer.setSymbol(e.target.value);
    });

    document.getElementById('showSMA').addEventListener('change', (e) => {
        ChartRenderer.showSMA = e.target.checked;
        ChartRenderer.render();
    });

    document.getElementById('showEMA').addEventListener('change', (e) => {
        ChartRenderer.showEMA = e.target.checked;
        ChartRenderer.render();
    });

    document.getElementById('showBollinger').addEventListener('change', (e) => {
        ChartRenderer.showBollinger = e.target.checked;
        ChartRenderer.render();
    });

    document.getElementById('showVolume').addEventListener('change', (e) => {
        ChartRenderer.showVolume = e.target.checked;
        ChartRenderer.render();
    });

    // --- Bot Config ---
    function loadConfigToBot() {
        TradingBot.config.strategy = document.getElementById('strategy').value;
        TradingBot.config.capitalPerTrade = parseFloat(document.getElementById('capitalPerTrade').value);
        TradingBot.config.stopLoss = parseFloat(document.getElementById('stopLoss').value);
        TradingBot.config.takeProfit = parseFloat(document.getElementById('takeProfit').value);
        TradingBot.config.maxDailyTrades = parseInt(document.getElementById('maxDailyTrades').value);
        TradingBot.config.maxDailyLoss = parseFloat(document.getElementById('maxDailyLoss').value);
        TradingBot.config.trailingStop = document.getElementById('trailingStop').value;
        TradingBot.config.smaShort = parseInt(document.getElementById('smaShort').value);
        TradingBot.config.smaLong = parseInt(document.getElementById('smaLong').value);
        TradingBot.config.rsiPeriod = parseInt(document.getElementById('rsiPeriod').value);
        TradingBot.config.rsiOverbought = parseInt(document.getElementById('rsiOverbought').value);
        TradingBot.config.rsiOversold = parseInt(document.getElementById('rsiOversold').value);

        const checked = document.querySelectorAll('#watchedAssets input:checked');
        TradingBot.config.watchedAssets = Array.from(checked).map(c => c.value);
    }

    document.getElementById('btnSaveConfig').addEventListener('click', () => {
        loadConfigToBot();
        alert('Configurações salvas com sucesso!');
    });

    document.getElementById('btnResetConfig').addEventListener('click', () => {
        document.getElementById('strategy').value = 'sma_crossover';
        document.getElementById('capitalPerTrade').value = 5;
        document.getElementById('stopLoss').value = 2;
        document.getElementById('takeProfit').value = 4;
        document.getElementById('maxDailyTrades').value = 10;
        document.getElementById('maxDailyLoss').value = 2000;
        document.getElementById('trailingStop').value = 'none';
        document.getElementById('smaShort').value = 9;
        document.getElementById('smaLong').value = 21;
        document.getElementById('rsiPeriod').value = 14;
        document.getElementById('rsiOverbought').value = 70;
        document.getElementById('rsiOversold').value = 30;
        loadConfigToBot();
    });

    // --- Manual Order ---
    document.getElementById('btnNewOrder').addEventListener('click', () => {
        document.getElementById('orderModal').classList.add('active');
    });

    document.getElementById('closeOrderModal').addEventListener('click', () => {
        document.getElementById('orderModal').classList.remove('active');
    });

    document.getElementById('orderType').addEventListener('change', (e) => {
        document.getElementById('orderPriceGroup').style.display = e.target.value === 'market' ? 'none' : 'block';
    });

    document.getElementById('btnSubmitOrder').addEventListener('click', () => {
        const asset = document.getElementById('orderAsset').value;
        const side = document.getElementById('orderSide').value;
        const type = document.getElementById('orderType').value;
        const qty = document.getElementById('orderQty').value;
        const price = parseFloat(document.getElementById('orderPrice').value) || 0;

        TradingBot.placeManualOrder(asset, side, type, qty, price);
        document.getElementById('orderModal').classList.remove('active');
        updatePositionsTable();
    });

    // --- Orders Section ---
    function updateOrdersView() {
        // Executed orders
        const execTbody = document.getElementById('executedOrders');
        if (TradingBot.executedOrders.length === 0) {
            execTbody.innerHTML = '<tr class="empty-row"><td colspan="7">Nenhuma ordem executada hoje</td></tr>';
        } else {
            execTbody.innerHTML = TradingBot.executedOrders.slice().reverse().map(o => {
                const sideClass = o.side === 'buy' ? 'badge-buy' : 'badge-sell';
                const sideLabel = o.side === 'buy' ? 'Compra' : 'Venda';
                return `
                    <tr>
                        <td>#${o.id}</td>
                        <td>${o.time.toLocaleTimeString('pt-BR')}</td>
                        <td>${o.symbol}</td>
                        <td><span class="badge ${sideClass}">${sideLabel}</span></td>
                        <td>${o.qty}</td>
                        <td>R$ ${o.price.toFixed(2)}</td>
                        <td><span class="badge badge-filled">Executada</span></td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Update orders view periodically
    setInterval(updateOrdersView, 3000);

    // --- History Section ---
    function updateHistoryView() {
        const history = TradingBot.tradeHistory;

        document.getElementById('histTotalTrades').textContent = history.length;

        const totalProfit = history.reduce((sum, t) => sum + t.pnl, 0);
        document.getElementById('histTotalProfit').textContent = (totalProfit >= 0 ? '+' : '') + 'R$ ' + totalProfit.toFixed(2);
        document.getElementById('histTotalProfit').style.color = totalProfit >= 0 ? 'var(--green)' : 'var(--red)';

        const wins = history.filter(t => t.pnl > 0).length;
        document.getElementById('histWinRate').textContent = history.length > 0 ? ((wins / history.length) * 100).toFixed(1) + '%' : '--';

        // Simple Sharpe approximation
        if (history.length > 1) {
            const returns = history.map(t => t.pnl);
            const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
            const variance = returns.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / returns.length;
            const stdDev = Math.sqrt(variance);
            const sharpe = stdDev > 0 ? (avg / stdDev).toFixed(2) : '--';
            document.getElementById('histSharpe').textContent = sharpe;
        }

        // History table
        const tbody = document.getElementById('historyTable');
        if (history.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Nenhuma operação registrada</td></tr>';
        } else {
            tbody.innerHTML = history.slice().reverse().map(t => {
                const pnlClass = t.pnl >= 0 ? 'pl-positive' : 'pl-negative';
                const sideClass = t.side === 'buy' ? 'badge-buy' : 'badge-sell';
                const sideLabel = t.side === 'buy' ? 'Compra' : 'Venda';
                return `
                    <tr>
                        <td>${t.date.toLocaleString('pt-BR')}</td>
                        <td>${t.symbol}</td>
                        <td><span class="badge ${sideClass}">${sideLabel}</span></td>
                        <td>R$ ${t.entryPrice.toFixed(2)}</td>
                        <td>R$ ${t.exitPrice.toFixed(2)}</td>
                        <td>${t.qty}</td>
                        <td class="${pnlClass}">${t.pnl >= 0 ? '+' : ''}R$ ${t.pnl.toFixed(2)}</td>
                        <td>${t.strategy}</td>
                    </tr>
                `;
            }).join('');
        }

        // Equity chart
        ChartRenderer.renderEquityChart('equityChart', TradingBot.equityHistory);
    }

    // --- Results Section ---
    function getFilteredTrades() {
        let trades = TradingBot.tradeHistory.slice();
        const filter = document.getElementById('resultsFilter').value;
        const assetFilter = document.getElementById('resultsAssetFilter').value;

        if (filter === 'wins') trades = trades.filter(t => t.pnl > 0);
        if (filter === 'losses') trades = trades.filter(t => t.pnl < 0);
        if (assetFilter !== 'all') trades = trades.filter(t => t.symbol === assetFilter);

        return trades;
    }

    function updateResultsView() {
        const trades = getFilteredTrades();
        const allTrades = TradingBot.tradeHistory;

        // Summary stats (use filtered for display)
        const wins = trades.filter(t => t.pnl > 0);
        const losses = trades.filter(t => t.pnl < 0);

        document.getElementById('resTotalTrades').textContent = trades.length;
        document.getElementById('resWinLoss').textContent = `${wins.length} ganhos / ${losses.length} perdas`;

        const netProfit = trades.reduce((sum, t) => sum + t.pnl, 0);
        document.getElementById('resNetProfit').textContent = (netProfit >= 0 ? '+' : '') + 'R$ ' + netProfit.toFixed(2);
        document.getElementById('resNetProfit').style.color = netProfit >= 0 ? 'var(--green)' : 'var(--red)';

        const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? '∞' : '--');
        document.getElementById('resProfitFactor').textContent = 'Fator de Lucro: ' + profitFactor;

        // Best / Worst trade
        if (trades.length > 0) {
            const best = trades.reduce((a, b) => a.pnl > b.pnl ? a : b);
            const worst = trades.reduce((a, b) => a.pnl < b.pnl ? a : b);

            document.getElementById('resBestTrade').textContent = '+R$ ' + best.pnl.toFixed(2);
            document.getElementById('resBestTradeInfo').textContent = `${best.symbol} - ${best.strategy}`;
            document.getElementById('resWorstTrade').textContent = (worst.pnl >= 0 ? '+' : '') + 'R$ ' + worst.pnl.toFixed(2);
            document.getElementById('resWorstTradeInfo').textContent = `${worst.symbol} - ${worst.strategy}`;
        } else {
            document.getElementById('resBestTrade').textContent = '--';
            document.getElementById('resBestTradeInfo').textContent = '--';
            document.getElementById('resWorstTrade').textContent = '--';
            document.getElementById('resWorstTradeInfo').textContent = '--';
        }

        // Average win / loss
        document.getElementById('resAvgWin').textContent = wins.length > 0
            ? '+R$ ' + (grossProfit / wins.length).toFixed(2) : '--';
        document.getElementById('resAvgLoss').textContent = losses.length > 0
            ? '-R$ ' + (grossLoss / losses.length).toFixed(2) : '--';

        // Win/Loss streaks
        let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
        for (const t of trades) {
            if (t.pnl > 0) { curWin++; curLoss = 0; maxWin = Math.max(maxWin, curWin); }
            else { curLoss++; curWin = 0; maxLoss = Math.max(maxLoss, curLoss); }
        }
        document.getElementById('resWinStreak').textContent = maxWin;
        document.getElementById('resLossStreak').textContent = maxLoss;

        // Bar chart
        ChartRenderer.renderTradePnlChart('tradePnlChart', trades);

        // Table
        const tbody = document.getElementById('resultsTable');
        if (trades.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="11">Nenhum trade finalizado ainda</td></tr>';
        } else {
            tbody.innerHTML = trades.slice().reverse().map((t, idx) => {
                const num = trades.length - idx;
                const pnlClass = t.pnl >= 0 ? 'pl-positive' : 'pl-negative';
                const sideClass = t.side === 'buy' ? 'badge-buy' : 'badge-sell';
                const sideLabel = t.side === 'buy' ? 'Compra' : 'Venda';
                const pnlPct = ((t.exitPrice - t.entryPrice) / t.entryPrice * 100);
                const pnlPctAdj = t.side === 'sell' ? -pnlPct : pnlPct;
                const reasonClass = t.reason === 'Take Profit' ? 'badge-buy'
                    : t.reason === 'Stop Loss' ? 'badge-sell' : 'badge-filled';

                return `
                    <tr>
                        <td>${num}</td>
                        <td>${t.date.toLocaleString('pt-BR')}</td>
                        <td>${t.symbol}</td>
                        <td><span class="badge ${sideClass}">${sideLabel}</span></td>
                        <td>R$ ${t.entryPrice.toFixed(2)}</td>
                        <td>R$ ${t.exitPrice.toFixed(2)}</td>
                        <td>${t.qty}</td>
                        <td class="${pnlClass}">${t.pnl >= 0 ? '+' : ''}R$ ${t.pnl.toFixed(2)}</td>
                        <td class="${pnlClass}">${pnlPctAdj >= 0 ? '+' : ''}${pnlPctAdj.toFixed(2)}%</td>
                        <td><span class="badge ${reasonClass}">${t.reason}</span></td>
                        <td>${t.strategy}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    document.getElementById('resultsFilter').addEventListener('change', updateResultsView);
    document.getElementById('resultsAssetFilter').addEventListener('change', updateResultsView);

    // --- Wallet Section ---
    function updateWalletView() {
        const stats = TradingBot.getStats();

        document.getElementById('availableBalance').textContent = 'R$ ' + TradingBot.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        document.getElementById('inPositions').textContent = 'R$ ' + stats.exposure.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        document.getElementById('totalEquity').textContent = 'R$ ' + stats.equity.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        document.getElementById('totalReturn').textContent = (stats.totalReturn >= 0 ? '+' : '') + stats.totalReturn + '%';
        document.getElementById('totalReturn').style.color = stats.totalReturn >= 0 ? 'var(--green)' : 'var(--red)';

        // Portfolio holdings
        const holdings = TradingBot.positions.map(p => ({
            symbol: p.symbol,
            qty: p.qty,
            avgPrice: p.entryPrice,
            value: p.currentPrice * p.qty,
            pnl: p.pnl
        }));

        // Add cash
        const allHoldings = [{ symbol: 'Caixa', value: TradingBot.balance }, ...holdings];

        ChartRenderer.renderPortfolioChart('portfolioChart', allHoldings);

        // Assets table
        const tbody = document.getElementById('walletAssets');
        if (holdings.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Nenhum ativo em carteira</td></tr>';
        } else {
            tbody.innerHTML = holdings.map(h => {
                const pnlClass = h.pnl >= 0 ? 'pl-positive' : 'pl-negative';
                return `
                    <tr>
                        <td>${h.symbol}</td>
                        <td>${h.qty}</td>
                        <td>R$ ${h.avgPrice.toFixed(2)}</td>
                        <td>R$ ${h.value.toFixed(2)}</td>
                        <td class="${pnlClass}">${h.pnl >= 0 ? '+' : ''}R$ ${h.pnl.toFixed(2)}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Initial render
    updateDashboardStats();
    ChartRenderer.render();
})();
