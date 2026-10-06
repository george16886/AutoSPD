/**
 * AutoSPD - Charts Module
 * Custom canvas-based charts for analytics
 */

const Charts = (() => {
    const COLORS = {
        primary: '#6C5CE7',
        primaryLight: '#A29BFE',
        accent: '#FD79A8',
        teal: '#00CEC9',
        green: '#00B894',
        yellow: '#FDCB6E',
        orange: '#E17055',
        blue: '#74B9FF',
        coral: '#FF6B6B',
        text: '#A0A0C0',
        textDim: '#6B6B90',
        grid: 'rgba(108, 92, 231, 0.08)',
        bg: '#0A0A1A'
    };

    const CHART_COLORS = [
        COLORS.primary,
        COLORS.accent,
        COLORS.teal,
        COLORS.green,
        COLORS.yellow,
        COLORS.orange,
        COLORS.blue,
        COLORS.coral,
        COLORS.primaryLight,
        '#E056A0',
        '#55EAFF',
        '#FF9F43'
    ];

    /**
     * Render daily watch count bar chart
     */
    function renderDailyChart(dailyCounts) {
        const canvas = document.getElementById('daily-chart-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = container.clientWidth * dpr;
        canvas.height = container.clientHeight * dpr;
        canvas.style.width = container.clientWidth + 'px';
        canvas.style.height = container.clientHeight + 'px';
        ctx.scale(dpr, dpr);

        const w = container.clientWidth;
        const h = container.clientHeight;
        const padding = { top: 20, right: 20, bottom: 40, left: 40 };

        ctx.clearRect(0, 0, w, h);

        // Generate last 14 days
        const days = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            days.push({
                label: d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
                value: dailyCounts[key] || Math.floor(Math.random() * 5) + 1
            });
        }

        const maxValue = Math.max(...days.map(d => d.value), 5);
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;
        const barWidth = (chartW / days.length) * 0.6;
        const barGap = (chartW / days.length) * 0.4;

        // Draw grid lines
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            // Grid labels
            const val = Math.round(maxValue - (maxValue / 4) * i);
            ctx.fillStyle = COLORS.textDim;
            ctx.font = '11px Inter';
            ctx.textAlign = 'right';
            ctx.fillText(val, padding.left - 8, y + 4);
        }

        // Draw bars
        days.forEach((day, i) => {
            const x = padding.left + i * (barWidth + barGap) + barGap / 2;
            const barH = (day.value / maxValue) * chartH;
            const y = padding.top + chartH - barH;

            // Bar gradient
            const gradient = ctx.createLinearGradient(x, y, x, y + barH);
            gradient.addColorStop(0, COLORS.primary);
            gradient.addColorStop(1, COLORS.primaryLight);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            roundedRect(ctx, x, y, barWidth, barH, 4);
            ctx.fill();

            // X labels (show every other)
            if (i % 2 === 0 || days.length <= 7) {
                ctx.fillStyle = COLORS.textDim;
                ctx.font = '10px Inter';
                ctx.textAlign = 'center';
                ctx.fillText(day.label, x + barWidth / 2, h - padding.bottom + 20);
            }
        });
    }

    /**
     * Render category distribution doughnut chart
     */
    function renderCategoryChart(distribution) {
        const canvas = document.getElementById('category-chart-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = container.clientWidth * dpr;
        canvas.height = container.clientHeight * dpr;
        canvas.style.width = container.clientWidth + 'px';
        canvas.style.height = container.clientHeight + 'px';
        ctx.scale(dpr, dpr);

        const w = container.clientWidth;
        const h = container.clientHeight;

        ctx.clearRect(0, 0, w, h);

        const entries = Object.entries(distribution);
        if (entries.length === 0) {
            // Add demo data
            entries.push(
                ['sports', 3], ['music', 2], ['science', 4],
                ['unboxing', 3], ['education', 2], ['cooking', 1]
            );
        }

        const total = entries.reduce((sum, [, v]) => sum + v, 0);
        const centerX = w * 0.35;
        const centerY = h / 2;
        const radius = Math.min(centerX, centerY) - 10;
        const innerRadius = radius * 0.55;

        let startAngle = -Math.PI / 2;

        entries.forEach(([catId, count], i) => {
            const sliceAngle = (count / total) * Math.PI * 2;
            const midAngle = startAngle + sliceAngle / 2;

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
            ctx.fill();

            startAngle += sliceAngle;
        });

        // Center text
        ctx.fillStyle = COLORS.text;
        ctx.font = 'bold 20px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(total, centerX, centerY - 8);
        ctx.font = '11px Inter';
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText('總觀看', centerX, centerY + 12);

        // Legend
        const legendX = w * 0.65;
        let legendY = 20;
        const categories = Store.getCategories();

        entries.slice(0, 6).forEach(([catId, count], i) => {
            const cat = categories.find(c => c.id === catId);
            const name = cat ? cat.name : catId;
            const pct = ((count / total) * 100).toFixed(0);

            ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
            ctx.beginPath();
            ctx.arc(legendX, legendY + 6, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = COLORS.text;
            ctx.font = '12px Inter';
            ctx.textAlign = 'left';
            ctx.fillText(`${name}`, legendX + 14, legendY + 10);

            ctx.fillStyle = COLORS.textDim;
            ctx.font = '11px Inter';
            ctx.fillText(`${pct}%`, legendX + 14, legendY + 26);

            legendY += 35;
        });
    }

    /**
     * Render speed distribution horizontal bar chart
     */
    function renderSpeedChart(distribution) {
        const canvas = document.getElementById('speed-chart-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = container.clientWidth * dpr;
        canvas.height = container.clientHeight * dpr;
        canvas.style.width = container.clientWidth + 'px';
        canvas.style.height = container.clientHeight + 'px';
        ctx.scale(dpr, dpr);

        const w = container.clientWidth;
        const h = container.clientHeight;
        const padding = { top: 10, right: 20, bottom: 10, left: 60 };

        ctx.clearRect(0, 0, w, h);

        let entries = Object.entries(distribution);
        if (entries.length === 0) {
            entries = [['1.0x', 5], ['1.25x', 4], ['1.5x', 6], ['2.0x', 1]];
        }

        // Sort by speed
        entries.sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));

        const maxValue = Math.max(...entries.map(([, v]) => v));
        const chartW = w - padding.left - padding.right;
        const barHeight = Math.min(30, (h - padding.top - padding.bottom) / entries.length - 10);

        entries.forEach(([speed, count], i) => {
            const y = padding.top + i * (barHeight + 12);
            const barW = (count / maxValue) * chartW;

            // Speed label
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 13px Inter';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(speed, padding.left - 10, y + barHeight / 2);

            // Bar
            const gradient = ctx.createLinearGradient(padding.left, y, padding.left + barW, y);
            const colorIdx = i % CHART_COLORS.length;
            gradient.addColorStop(0, CHART_COLORS[colorIdx]);
            gradient.addColorStop(1, CHART_COLORS[(colorIdx + 1) % CHART_COLORS.length]);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            roundedRect(ctx, padding.left, y, barW, barHeight, 4);
            ctx.fill();

            // Count label
            ctx.fillStyle = COLORS.text;
            ctx.font = '12px Inter';
            ctx.textAlign = 'left';
            ctx.fillText(count + ' 部', padding.left + barW + 8, y + barHeight / 2);
        });
    }

    /**
     * Helper: Draw rounded rectangle
     */
    function roundedRect(ctx, x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
    }

    return {
        renderDailyChart,
        renderCategoryChart,
        renderSpeedChart
    };
})();
