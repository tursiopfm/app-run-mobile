package com.franck.trailcockpit.data

object SampleData {

    // Week table (lundi → dimanche)
    val weekDays = listOf(
        WeekDay("Lun", "Footing récup", "8.2 km", "95 m"),
        WeekDay("Mar", "Fractionné", "10.5 km", "180 m"),
        WeekDay("Mer", "Repos", "—", "—"),
        WeekDay("Jeu", "Côtes", "9.8 km", "320 m"),
        WeekDay("Ven", "Vélo", "25.5 km", "210 m"),
        WeekDay("Sam", "Sortie longue", "22.0 km", "688 m"),
        WeekDay("Dim", "Repos", "—", "—"),
    )

    val weekTotal = WeekDay("Total", "4 séances", "40.5 km", "1283 m")

    // KPIs semaine
    val weekRunKm = 40.5f
    val weekRunDPlus = 1283
    val weekSuffer = 119
    val weekBikeKm = 25.5f

    // KPIs YTD
    val ytdRunKm = 982.5f
    val chargeAtl = 26f
    val chargeCtl = 33f
    val chargeTsb = 7f
    val ytdBikeKm = 403.4f

    // Objectives
    val objectives = listOf(
        ObjectiveProgress("Objectif annuel", 982.5f, 2800f, "km"),
        ObjectiveProgress("Volume semaine", 40.5f, 55f, "km"),
        ObjectiveProgress("D+ semaine", 1283f, 1800f, "m"),
    )

    // Km 16 semaines
    val weeklyKm = listOf(
        WeeklyPoint("S1", 32f), WeeklyPoint("S2", 45f), WeeklyPoint("S3", 28f),
        WeeklyPoint("S4", 52f), WeeklyPoint("S5", 38f), WeeklyPoint("S6", 61f),
        WeeklyPoint("S7", 44f), WeeklyPoint("S8", 35f), WeeklyPoint("S9", 55f),
        WeeklyPoint("S10", 48f), WeeklyPoint("S11", 62f), WeeklyPoint("S12", 41f),
        WeeklyPoint("S13", 50f), WeeklyPoint("S14", 36f), WeeklyPoint("S15", 58f),
        WeeklyPoint("S16", 40.5f),
    )

    // D+ 16 semaines
    val weeklyDPlus = listOf(
        WeeklyPoint("S1", 820f), WeeklyPoint("S2", 1150f), WeeklyPoint("S3", 680f),
        WeeklyPoint("S4", 1320f), WeeklyPoint("S5", 950f), WeeklyPoint("S6", 1580f),
        WeeklyPoint("S7", 1100f), WeeklyPoint("S8", 870f), WeeklyPoint("S9", 1400f),
        WeeklyPoint("S10", 1200f), WeeklyPoint("S11", 1620f), WeeklyPoint("S12", 1050f),
        WeeklyPoint("S13", 1280f), WeeklyPoint("S14", 900f), WeeklyPoint("S15", 1480f),
        WeeklyPoint("S16", 1283f),
    )

    // ATL / CTL / TSB
    val fitnessData = listOf(
        FitnessPoint("S1", 20f, 28f, 8f),
        FitnessPoint("S2", 28f, 29f, 1f),
        FitnessPoint("S3", 18f, 28f, 10f),
        FitnessPoint("S4", 32f, 30f, -2f),
        FitnessPoint("S5", 24f, 29f, 5f),
        FitnessPoint("S6", 36f, 31f, -5f),
        FitnessPoint("S7", 28f, 31f, 3f),
        FitnessPoint("S8", 22f, 30f, 8f),
        FitnessPoint("S9", 34f, 31f, -3f),
        FitnessPoint("S10", 30f, 31f, 1f),
        FitnessPoint("S11", 38f, 32f, -6f),
        FitnessPoint("S12", 26f, 32f, 6f),
        FitnessPoint("S13", 32f, 32f, 0f),
        FitnessPoint("S14", 22f, 31f, 9f),
        FitnessPoint("S15", 35f, 32f, -3f),
        FitnessPoint("S16", 26f, 33f, 7f),
    )

    // Répartition intensités (donut)
    val intensityZones = listOf(
        IntensityZone("Z1 Récup", 25f, 0),
        IntensityZone("Z2 Endurance", 42f, 1),
        IntensityZone("Z3 Tempo", 18f, 2),
        IntensityZone("Z4 Seuil", 10f, 3),
        IntensityZone("Z5 VMA", 5f, 4),
    )

    // Suffer score 16 sem
    val weeklySuffer = listOf(
        WeeklyPoint("S1", 85f), WeeklyPoint("S2", 120f), WeeklyPoint("S3", 72f),
        WeeklyPoint("S4", 135f), WeeklyPoint("S5", 98f), WeeklyPoint("S6", 155f),
        WeeklyPoint("S7", 110f), WeeklyPoint("S8", 88f), WeeklyPoint("S9", 140f),
        WeeklyPoint("S10", 125f), WeeklyPoint("S11", 160f), WeeklyPoint("S12", 105f),
        WeeklyPoint("S13", 130f), WeeklyPoint("S14", 90f), WeeklyPoint("S15", 148f),
        WeeklyPoint("S16", 119f),
    )

    // Ratio D+/km
    val weeklyRatio = listOf(
        WeeklyPoint("S1", 25.6f), WeeklyPoint("S2", 25.5f), WeeklyPoint("S3", 24.3f),
        WeeklyPoint("S4", 25.4f), WeeklyPoint("S5", 25.0f), WeeklyPoint("S6", 25.9f),
        WeeklyPoint("S7", 25.0f), WeeklyPoint("S8", 24.9f), WeeklyPoint("S9", 25.5f),
        WeeklyPoint("S10", 25.0f), WeeklyPoint("S11", 26.1f), WeeklyPoint("S12", 25.6f),
        WeeklyPoint("S13", 25.6f), WeeklyPoint("S14", 25.0f), WeeklyPoint("S15", 25.5f),
        WeeklyPoint("S16", 31.7f),
    )

    // Cumul km par année (14 saisons)
    val yearlyAccum = listOf(
        YearlyAccum("2013", 420f), YearlyAccum("2014", 680f),
        YearlyAccum("2015", 910f), YearlyAccum("2016", 1150f),
        YearlyAccum("2017", 1380f), YearlyAccum("2018", 1620f),
        YearlyAccum("2019", 1850f), YearlyAccum("2020", 1540f),
        YearlyAccum("2021", 2010f), YearlyAccum("2022", 2280f),
        YearlyAccum("2023", 2450f), YearlyAccum("2024", 2650f),
        YearlyAccum("2025", 2520f), YearlyAccum("2026", 982.5f),
    )

    // Cumul km par mois (4 derniers mois de l'année en cours)
    val monthlyAccum = listOf(
        MonthlyAccum(1, 180f, "2026"), MonthlyAccum(2, 420f, "2026"),
        MonthlyAccum(3, 710f, "2026"), MonthlyAccum(4, 982.5f, "2026"),
        MonthlyAccum(1, 165f, "2025"), MonthlyAccum(2, 385f, "2025"),
        MonthlyAccum(3, 640f, "2025"), MonthlyAccum(4, 880f, "2025"),
        MonthlyAccum(1, 190f, "2024"), MonthlyAccum(2, 440f, "2024"),
        MonthlyAccum(3, 730f, "2024"), MonthlyAccum(4, 1010f, "2024"),
        MonthlyAccum(1, 155f, "2023"), MonthlyAccum(2, 360f, "2023"),
        MonthlyAccum(3, 600f, "2023"), MonthlyAccum(4, 840f, "2023"),
    )
}
