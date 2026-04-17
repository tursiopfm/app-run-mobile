package com.franck.trailcockpit.data

data class WeekDay(
    val day: String,
    val session: String,
    val volume: String,
    val dPlus: String
)

data class WeeklyPoint(
    val week: String,
    val value: Float
)

data class MonthlyAccum(
    val month: Int,
    val km: Float,
    val year: String
)

data class YearlyAccum(
    val year: String,
    val totalKm: Float
)

data class IntensityZone(
    val label: String,
    val percent: Float,
    val colorIndex: Int
)

data class FitnessPoint(
    val week: String,
    val atl: Float,
    val ctl: Float,
    val tsb: Float
)

data class ObjectiveProgress(
    val label: String,
    val current: Float,
    val target: Float,
    val unit: String
)
