import { readFile, writeFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../data.json', import.meta.url), 'utf8'));

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: data.earnings?.currency || 'USD',
  maximumFractionDigits: 0
});

function pctGap(current, market) {
  if (!Number.isFinite(current) || !Number.isFinite(market) || market <= 0) return null;
  return Math.round(((market - current) / market) * 100);
}

function median(values) {
  const nums = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  const middle = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[middle] : (nums[middle - 1] + nums[middle]) / 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function recommendPrice({ current, marketMedian, utilization, eventMultiplier = 1 }) {
  if (!Number.isFinite(current) || current <= 0 || !Number.isFinite(marketMedian) || marketMedian <= 0) {
    return null;
  }

  let target = current;

  if (utilization < 25) {
    target = marketMedian * 0.95;
  } else if (utilization >= 25 && utilization < 50) {
    target = marketMedian;
  } else if (utilization >= 50) {
    target = marketMedian * 1.08;
  }

  target *= eventMultiplier;
  return Math.round(clamp(target, current * 0.85, current * 1.35));
}

function analyzeMarketData() {
  const md = data.marketData || {};
  const competitors = md.competitors || [];

  const competitorWeekendMedian = median(competitors.map(c => c.weekendPrice));
  const competitorWeekdayMedian = median(competitors.map(c => c.weekdayPrice));

  const weekendMarket = Number.isFinite(md.areaWeekendMedian) ? md.areaWeekendMedian : competitorWeekendMedian;
  const weekdayMarket = Number.isFinite(md.areaWeekdayMedian) ? md.areaWeekdayMedian : competitorWeekdayMedian;

  const currentWeekend = md.yourCalendarWeekendAvg || md.yourMedianPrice;
  const currentWeekday = md.yourCalendarWeekdayAvg || md.yourMedianPrice;
  const utilization = md.yourUtilization ?? data.fleet?.[0]?.utilization ?? 0;

  const weekendGap = pctGap(currentWeekend, weekendMarket);
  const weekdayGap = pctGap(currentWeekday, weekdayMarket);

  const suggestedWeekend = recommendPrice({ current: currentWeekend, marketMedian: weekendMarket, utilization });
  const suggestedWeekday = recommendPrice({ current: currentWeekday, marketMedian: weekdayMarket, utilization });

  return {
    segment: 'Tesla Model 3 Las Vegas',
    sampleMonth: md.sampleMonth,
    sampleSize: md.sampleSize,
    caveat: md.dataLagWarning || 'Market numbers may lag or be manually maintained.',
    current: {
      weekday: currentWeekday,
      weekend: currentWeekend,
      utilization
    },
    market: {
      weekdayMedian: weekdayMarket,
      weekendMedian: weekendMarket,
      competitorWeekdayMedian,
      competitorWeekendMedian
    },
    gaps: {
      weekdayGapPercent: weekdayGap,
      weekendGapPercent: weekendGap
    },
    recommendations: {
      suggestedWeekday,
      suggestedWeekend,
      summary: buildPricingSummary({ weekdayGap, weekendGap, suggestedWeekday, suggestedWeekend, currentWeekday, currentWeekend })
    }
  };
}

function buildPricingSummary({ weekdayGap, weekendGap, suggestedWeekday, suggestedWeekend, currentWeekday, currentWeekend }) {
  const notes = [];
  if (weekdayGap !== null && weekdayGap > 5) {
    notes.push(`Weekday listing price is about ${weekdayGap}% below market; test ${currency.format(suggestedWeekday)}.`);
  } else if (weekdayGap !== null && weekdayGap < -5) {
    notes.push(`Weekday listing price is above market; hold only if bookings stay strong.`);
  } else {
    notes.push('Weekday listing price is close to market.');
  }

  if (weekendGap !== null && weekendGap > 5) {
    notes.push(`Weekend listing price is about ${weekendGap}% below market; test ${currency.format(suggestedWeekend)}.`);
  } else if (weekendGap !== null && weekendGap < -5) {
    notes.push('Weekend listing price is above market; watch conversion and lead time.');
  } else {
    notes.push('Weekend listing price is close to market.');
  }

  if (suggestedWeekday && suggestedWeekend && (suggestedWeekday !== currentWeekday || suggestedWeekend !== currentWeekend)) {
    notes.push(`Recommended test range: ${currency.format(suggestedWeekday)} weekdays and ${currency.format(suggestedWeekend)} weekends.`);
  }

  return notes;
}

function analyzeLiveCompetitors() {
  const live = data.liveCompetitors || {};
  return Object.entries(live).map(([segment, payload]) => {
    const competitors = payload.competitors || [];
    const currentPrices = competitors.map(c => c.currentPrice).filter(Number.isFinite);
    const currentUtils = competitors
      .map(c => c.calendarUtilization?.currentMonth?.utilization)
      .filter(Number.isFinite);

    return {
      segment,
      lastScraped: payload.lastScraped,
      competitorCount: competitors.length,
      medianCurrentPrice: median(currentPrices),
      averageCurrentUtilization: currentUtils.length
        ? Math.round((currentUtils.reduce((a, b) => a + b, 0) / currentUtils.length) * 10) / 10
        : null,
      topObservedCompetitors: competitors
        .slice()
        .sort((a, b) => (b.calendarUtilization?.currentMonth?.utilization || 0) - (a.calendarUtilization?.currentMonth?.utilization || 0))
        .slice(0, 5)
        .map(c => ({
          year: c.year,
          trim: c.trim,
          currentPrice: c.currentPrice,
          tripCount: c.tripCount,
          rating: c.rating,
          hostName: c.hostName,
          currentMonthUtilization: c.calendarUtilization?.currentMonth?.utilization ?? null
        }))
    };
  });
}

function analyzeFleetProfit() {
  const gross = data.earnings?.totalEarned || 0;
  const turoFees = gross * ((data.costs?.turoFeePercent || 0) / 100);
  const insuranceMonthly = data.costs?.insuranceMonthly || 0;
  const cleaningMonthlyPerCar = data.costs?.cleaningMonthlyPerCar || 0;
  const vehiclesCovered = data.costs?.vehiclesCovered || data.fleet?.length || 1;
  const policyStart = data.costs?.policyStart ? new Date(data.costs.policyStart) : new Date(data.lastUpdated);
  const updated = new Date(data.lastUpdated);
  const monthsElapsed = Math.max(1, Math.round((updated - policyStart) / (1000 * 60 * 60 * 24 * 30)));
  const overhead = insuranceMonthly * monthsElapsed + cleaningMonthlyPerCar * vehiclesCovered * monthsElapsed;
  const netProfit = gross - turoFees - overhead;

  return {
    gross,
    turoFees: Math.round(turoFees * 100) / 100,
    overhead: Math.round(overhead * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    note: 'This excludes car payments, depreciation, charging/fuel, repairs, tires, registration, tolls, tickets, and taxes unless added to data.json.'
  };
}

function buildActionPlan(marketAnalysis, liveAnalysis, profitAnalysis) {
  const actions = [];
  const rec = marketAnalysis.recommendations;

  if (rec.suggestedWeekend && rec.suggestedWeekend > marketAnalysis.current.weekend) {
    actions.push({
      priority: 'high',
      action: `Raise/test weekend Tesla Model 3 price to ${currency.format(rec.suggestedWeekend)} for the next 2 weekends.`,
      reason: `Current weekend price ${currency.format(marketAnalysis.current.weekend)} vs market median ${currency.format(marketAnalysis.market.weekendMedian)}.`
    });
  }

  if (rec.suggestedWeekday && rec.suggestedWeekday > marketAnalysis.current.weekday) {
    actions.push({
      priority: 'medium',
      action: `Test weekday Tesla Model 3 price at ${currency.format(rec.suggestedWeekday)}.`,
      reason: `Current weekday price ${currency.format(marketAnalysis.current.weekday)} vs market median ${currency.format(marketAnalysis.market.weekdayMedian)}.`
    });
  }

  const incompleteVehicles = (data.fleet || []).filter(v => !v.listingComplete);
  for (const vehicle of incompleteVehicles) {
    actions.push({
      priority: 'high',
      action: `Finish ${vehicle.year} ${vehicle.make} ${vehicle.model} listing.`,
      reason: vehicle.details || 'Incomplete listings cannot produce revenue.'
    });
  }

  if (profitAnalysis.netProfit < 0) {
    actions.push({
      priority: 'high',
      action: 'Add missing fixed costs and verify break-even pricing before scaling fleet.',
      reason: 'Current tracked profit is negative or incomplete.'
    });
  }

  return actions;
}

const marketAnalysis = analyzeMarketData();
const liveAnalysis = analyzeLiveCompetitors();
const profitAnalysis = analyzeFleetProfit();
const actionPlan = buildActionPlan(marketAnalysis, liveAnalysis, profitAnalysis);

const report = {
  generatedAt: new Date().toISOString(),
  sourceLastUpdated: data.lastUpdated,
  marketAnalysis,
  liveAnalysis,
  profitAnalysis,
  actionPlan,
  nextDataToCollect: [
    'Actual booked daily rates by trip',
    'Lead time from booking date to trip start',
    'Cancellation/no-show history',
    'Delivery option and delivery fee per competitor',
    'Photo quality score per competitor',
    'Vegas event calendar with demand score',
    'Car payment, depreciation, charging/fuel, maintenance, tires, registration, and cleaning labor'
  ]
};

await writeFile(new URL('../intelligence-report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);

console.log('Market intelligence report generated: intelligence-report.json');
console.log(`Suggested weekday: ${currency.format(marketAnalysis.recommendations.suggestedWeekday || 0)}`);
console.log(`Suggested weekend: ${currency.format(marketAnalysis.recommendations.suggestedWeekend || 0)}`);
for (const item of actionPlan) {
  console.log(`- [${item.priority}] ${item.action}`);
}
