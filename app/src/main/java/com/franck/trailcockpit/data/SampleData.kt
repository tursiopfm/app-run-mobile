package com.franck.trailcockpit.data

object SampleData {

    val week: List<DaySession> = listOf(
        DaySession("lundi", "footing", 10.01, 137),
        DaySession("mardi", "2X3000 @5/10 /200", 11.68, 23),
        DaySession("mercredi", "A/R c\u00f4tes", 9.37, 1009),
        DaySession("jeudi", "Runtaf", 9.42, 114),
        DaySession("vendredi", "Trail vallon\u00e9e", 10.0, 0),
        DaySession("samedi", "", 0.0, 0),
        DaySession("dimanche", "SL trail", 20.0, 0)
    )

    val overview = WeekOverview(
        runKm = 40.5,
        runTargetKm = 80,
        runSessions = 4,
        runDPlus = 1283,
        runDPlusTarget = 2000,
        runSuffer = 119,
        bikeKm = 25.5,
        bikeSessions = 3,
        bikeDPlus = 176
    )

    val ytd = YtdData(
        runKm = 982.5,
        runDPlus = 12073,
        bikeKm = 403.4,
        bikeDPlus = 2673,
        atl = 26,
        ctl = 33,
        tsb = 7,
        yearTarget = 3000
    )

    val weekly: List<WeeklyPoint> = listOf(
        WeeklyPoint("2025-12-29", 52.7, 483, 261, 24, 28, 4),
        WeeklyPoint("2026-01-05", 53.1, 555, 281, 25, 29, 4),
        WeeklyPoint("2026-01-12", 51.7, 268, 285, 27, 30, 3),
        WeeklyPoint("2026-01-19", 41.6, 357, 210, 23, 30, 7),
        WeeklyPoint("2026-01-26", 43.8, 337, 215, 24, 30, 6),
        WeeklyPoint("2026-02-02", 56.2, 429, 349, 28, 31, 3),
        WeeklyPoint("2026-02-09", 76.2, 1033, 348, 32, 32, 0),
        WeeklyPoint("2026-02-16", 85.3, 772, 424, 35, 33, -2),
        WeeklyPoint("2026-02-23", 93.3, 1570, 435, 38, 34, -4),
        WeeklyPoint("2026-03-02", 87.4, 840, 412, 40, 35, -5),
        WeeklyPoint("2026-03-09", 87.4, 632, 319, 37, 35, -2),
        WeeklyPoint("2026-03-16", 89.1, 1598, 185, 36, 36, 0),
        WeeklyPoint("2026-03-23", 71.4, 1037, 182, 32, 35, 3),
        WeeklyPoint("2026-03-30", 57.5, 503, 187, 28, 34, 6),
        WeeklyPoint("2026-04-06", 80.5, 1293, 342, 29, 34, 5),
        WeeklyPoint("2026-04-13", 40.5, 1283, 119, 26, 33, 7)
    )

    val intensities: List<IntensityShare> = listOf(
        IntensityShare("Runtaf", 52.2),
        IntensityShare("VMA", 17.4),
        IntensityShare("Seuil", 20.8),
        IntensityShare("C\u00f4tes", 21.3),
        IntensityShare("Sortie longue", 38.5),
        IntensityShare("Footing / EF", 119.4),
        IntensityShare("Autre", 0.0)
    )

    val ratio16: List<Double> = listOf(
        9.27, 10.44, 5.19, 10.29, 7.76, 7.62, 13.56, 9.05,
        14.23, 9.63, 6.67, 17.93, 14.46, 9.16, 17.98, 31.69
    )

    val yearSeries: List<YearSeries> = run {
        val yearTotals = mapOf(
            2013 to 1400, 2014 to 1650, 2015 to 1950, 2016 to 2100,
            2017 to 2250, 2018 to 2600, 2019 to 2400, 2020 to 2300,
            2021 to 2550, 2022 to 2700, 2023 to 2850, 2024 to 2900,
            2025 to 3350
        )
        val list = mutableListOf<YearSeries>()
        yearTotals.toSortedMap().forEach { (year, total) ->
            val pts = mutableListOf<YearCumulativePoint>()
            var cumulative = 0.0
            for (d in 1..365) {
                val daily = total.toDouble() / 365.0 +
                    (((d * (year % 7 + 1)) % 5) - 2).toDouble()
                cumulative += daily.coerceAtLeast(0.0)
                if (d % 3 == 0 || d == 365) {
                    pts.add(YearCumulativePoint(d, cumulative))
                }
            }
            list.add(YearSeries(year, pts))
        }
        val pts2026 = mutableListOf<YearCumulativePoint>()
        var c = 0.0
        val target = 982.5
        for (d in 1..106) {
            val daily = target / 106.0 + (((d * 3) % 7) - 3).toDouble() * 0.4
            c += daily.coerceAtLeast(0.0)
            if (d % 2 == 0 || d == 106) {
                pts2026.add(YearCumulativePoint(d, c))
            }
        }
        list.add(YearSeries(2026, pts2026))
        list
    }

    val monthSeries: List<MonthSeries> = listOf(
        MonthSeries(
            "janv. 2026",
            listOf(
                1 to 3.0, 4 to 19.0, 7 to 35.0, 10 to 50.0, 14 to 72.0,
                18 to 95.0, 22 to 120.0, 25 to 150.0, 28 to 180.0, 31 to 210.0
            ).map { (d, km) -> MonthCumulativePoint(d, km) }
        ),
        MonthSeries(
            "f\u00e9vr. 2026",
            listOf(
                1 to 5.0, 4 to 25.0, 7 to 50.0, 10 to 85.0, 14 to 115.0,
                18 to 140.0, 22 to 175.0, 25 to 205.0, 28 to 230.3
            ).map { (d, km) -> MonthCumulativePoint(d, km) }
        ),
        MonthSeries(
            "mars 2026",
            listOf(
                1 to 6.0, 4 to 30.0, 7 to 56.8, 10 to 95.0, 14 to 145.0,
                18 to 190.0, 22 to 240.0, 25 to 270.0, 28 to 295.0, 31 to 326.8
            ).map { (d, km) -> MonthCumulativePoint(d, km) }
        ),
        MonthSeries(
            "avr. 2026",
            listOf(
                1 to 4.0, 3 to 14.0, 6 to 32.0, 9 to 60.0, 12 to 92.0, 15 to 130.0
            ).map { (d, km) -> MonthCumulativePoint(d, km) }
        )
    )
}
