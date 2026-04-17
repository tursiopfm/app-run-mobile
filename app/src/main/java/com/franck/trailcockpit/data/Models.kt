package com.franck.trailcockpit.data

data class DaySession(
    val day: String,
    val label: String,
    val volumeKm: Double,
    val denivelePos: Int
)

data class WeekOverview(
    val runKm: Double,
    val runTargetKm: Int,
    val runSessions: Int,
    val runDPlus: Int,
    val runDPlusTarget: Int,
    val runSuffer: Int,
    val bikeKm: Double,
    val bikeSessions: Int,
    val bikeDPlus: Int
)

data class YtdData(
    val runKm: Double,
    val runDPlus: Int,
    val bikeKm: Double,
    val bikeDPlus: Int,
    val atl: Int,
    val ctl: Int,
    val tsb: Int,
    val yearTarget: Int
)

data class WeeklyPoint(
    val weekLabel: String,
    val km: Double,
    val dPlus: Int,
    val suffer: Int,
    val atl: Int,
    val ctl: Int,
    val tsb: Int
)

data class IntensityShare(
    val label: String,
    val km: Double
)

data class YearCumulativePoint(
    val dayOfYear: Int,
    val km: Double
)

data class YearSeries(
    val year: Int,
    val points: List<YearCumulativePoint>
)

data class MonthCumulativePoint(
    val dayOfMonth: Int,
    val km: Double
)

data class MonthSeries(
    val label: String,
    val points: List<MonthCumulativePoint>
)
