# Lightning Fleet Dashboard — Scraper Instructions

## Cron Job
- **ID:** 39745336-9c4d-4b95-a25b-3daefe417dd0
- **Schedule:** Every 12 hours
- **Model:** zai/glm-5.2 (fallbacks: xiaomi/mimo-v2.5, zai/glm-5.1)
- **Session:** Isolated

## What Gets Scraped (all from logged-in Turo host account)

| Data | Source URL | Repeatable | Method |
|---|---|---|---|
| Calendar prices | /trips/calendar | ✅ | Extract price buttons via JS evaluate |
| Market data + competitors | /trips/calendar → Insights button | ✅ | Click Insights, extract sample cars |
| Earnings | /business/earnings | ✅ | Extract page text |
| Performance | /business/performance | ✅ | Extract page text |
| Trips | /trips/booked | ✅ | Extract page text |
| Vehicle status | /listings (Vehicles page) | ✅ | Extract listing status per vehicle |
| Santa Fe competitors | Search page | ✅ | Count results for Hyundai Santa Fe in LV |

## What Does NOT Get Scraped (manually maintained)

| Data | Why | How to update |
|---|---|---|
| Action items | Manually curated priorities | Edit data.json directly or tell Jarvis |
| Costs (insurance, cleaning, Turo fee) | Static config, rarely changes | Edit data.json costs object |

## Data Structure (data.json)

```
host: { name, tier, nextAssessment }
fleet: [{ id, make, model, year, licensePlate, status, details, listingComplete, utilization, utilizationLabel, yourMedianPrice }]
earnings: { totalEarned, upcoming, reimbursements, incentives, missedEarnings, currency }
costs: { turoFeePercent, insuranceMonthly, cleaningMonthlyPerCar, chargingSkipped, vehiclesCovered, policyStart, policyEnd }
performance: { cancellationRate, fiveStarRate, maintenance, cleanliness, completedTrips }
calendar: { averagePrice, days: [{ date, day, price, weekend? }] }
trips: [{ id, guest, vehicle, endDate, endTime, location, status }]
marketData: { source, sampleMonth, sampleSize, areaWeekendMedian, areaWeekdayMedian, yourMedianPrice, yourUtilization, yourCalendarWeekendAvg, yourCalendarWeekdayAvg, competitors: [...] }
santaFeMarket: { competitorCount, note }
actionItems: [{ priority, item, status }]
actionItemsNote: "Manually maintained"
history: [{ date, totalEarned, upcoming, completedTrips, utilization }]
```

## Turo Session
- Login cookies persist in the openclaw browser profile at `~/.openclaw/browser/openclaw/user-data`
- If session expires (redirects to login), the cron will notify Jordyn to re-login
- Re-login: start browser, navigate to turo.com/login, Jordyn logs in manually

## Utilization Labels (estimated, not from Turo)
- **Low:** <30% (~less than 9 booked days/month)
- **Medium:** 30-50% (~9-15 booked days/month)  
- **High:** 50%+ (~15+ booked days/month)
- Turo does not publish exact percentage thresholds
