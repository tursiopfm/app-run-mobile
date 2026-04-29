@file:Suppress("AssignedValueIsNeverRead")

package com.franck.trailcockpit.ui.screens

import android.graphics.BitmapFactory
import android.webkit.WebView
import java.net.HttpURLConnection
import java.net.URL
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.draw.alpha
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.franck.trailcockpit.data.ActivityDetailDraft
import com.franck.trailcockpit.data.ActivityDraft
import com.franck.trailcockpit.data.ActivityMapPoint
import com.franck.trailcockpit.data.ActivitySplitDraft
import com.franck.trailcockpit.data.AthleteProfileSettings
import com.franck.trailcockpit.data.CycleDraft
import com.franck.trailcockpit.data.DaySession
import com.franck.trailcockpit.data.DraftData
import com.franck.trailcockpit.data.HeartRateZone
import com.franck.trailcockpit.data.HeartRateZoneCalculationInput
import com.franck.trailcockpit.data.HeartRateZoneConfidence
import com.franck.trailcockpit.data.HeartRateZoneMode
import com.franck.trailcockpit.data.HeartRateZones
import com.franck.trailcockpit.data.IntensityShare
import com.franck.trailcockpit.data.ProfileCalibrationMode
import com.franck.trailcockpit.data.CesCalculator
import com.franck.trailcockpit.data.RemoteDashboard
import com.franck.trailcockpit.data.SampleData
import com.franck.trailcockpit.data.TrainingLoadCalculator
import com.franck.trailcockpit.data.TrainingStatus
import com.franck.trailcockpit.data.WeeklyPoint
import com.franck.trailcockpit.data.YtdData
import com.franck.trailcockpit.data.WeekOverview
import com.franck.trailcockpit.ui.components.AreaChart
import com.franck.trailcockpit.ui.components.BarChart
import com.franck.trailcockpit.ui.components.ChartCard
import com.franck.trailcockpit.ui.components.ComboBarLineChart
import com.franck.trailcockpit.ui.components.LineChart
import com.franck.trailcockpit.ui.components.LineSeries
import com.franck.trailcockpit.ui.components.FullWidthBarStrip
import com.franck.trailcockpit.ui.components.PieChart
import com.franck.trailcockpit.ui.components.PieSlice
import com.franck.trailcockpit.ui.theme.ThemeMode
import com.franck.trailcockpit.ui.theme.TrailColors
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.PI
import kotlin.math.atan
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt
import androidx.annotation.StringRes
import androidx.compose.ui.res.stringResource
import com.franck.trailcockpit.R

private enum class DashboardTab(@StringRes val labelRes: Int) {
    Cockpit(R.string.dashboard_tab_cockpit),
    Stats(R.string.dashboard_tab_stats),
    Charge(R.string.dashboard_tab_charge),
    Plan(R.string.dashboard_tab_plan),
    Activities(R.string.dashboard_tab_activities),
    Settings(R.string.dashboard_tab_settings)
}

private const val CURRENT_COCKPIT_LAYOUT_VERSION = 2

private enum class StatsMetric(val label: String) {
    Km("Km"),
    DPlus("D+"),
    Suffer("Load"),
    Tsb("TSB")
}

private enum class ChartPeriod(@StringRes val labelRes: Int) {
    Week(R.string.chart_period_week),
    Month(R.string.chart_period_month),
    MonthYear(R.string.chart_period_month_year)
}

private enum class SportMode(@StringRes val labelRes: Int, val icon: String) {
    Run(R.string.sport_run, "🏃"),
    Bike(R.string.sport_bike, "🚴"),
    Swim(R.string.sport_swim, "🏊")
}

private enum class BlockType { Kpis, Goals, Chart, Days, KmDPlus, Load, Intensity, Strava, CumulMonths, CurrentWeek }

private enum class CockpitBlock(val type: BlockType, val sport: SportMode?) {
    KpisRun(BlockType.Kpis, SportMode.Run),
    KpisBike(BlockType.Kpis, SportMode.Bike),
    KpisSwim(BlockType.Kpis, SportMode.Swim),
    KpisAll(BlockType.Kpis, null),
    GoalsRun(BlockType.Goals, SportMode.Run),
    GoalsBike(BlockType.Goals, SportMode.Bike),
    GoalsSwim(BlockType.Goals, SportMode.Swim),
    GoalsAll(BlockType.Goals, null),
    ChartRun(BlockType.Chart, SportMode.Run),
    ChartBike(BlockType.Chart, SportMode.Bike),
    ChartSwim(BlockType.Chart, SportMode.Swim),
    DaysRun(BlockType.Days, SportMode.Run),
    DaysBike(BlockType.Days, SportMode.Bike),
    DaysSwim(BlockType.Days, SportMode.Swim),
    DaysAll(BlockType.Days, null),
    KmDPlusAll(BlockType.KmDPlus, null),
    CumulMonthsRun(BlockType.CumulMonths, SportMode.Run),
    CumulMonthsBike(BlockType.CumulMonths, SportMode.Bike),
    CumulMonthsSwim(BlockType.CumulMonths, SportMode.Swim),
    CumulMonthsAll(BlockType.CumulMonths, null),
    Load(BlockType.Load, SportMode.Run),
    Intensity(BlockType.Intensity, SportMode.Run),
    Strava(BlockType.Strava, null),
    CurrentWeek(BlockType.CurrentWeek, null)
}

@Composable
private fun CockpitBlock.displayName(): String {
    val base = when (type) {
        BlockType.Kpis -> stringResource(R.string.block_kpis)
        BlockType.Goals -> stringResource(R.string.block_goals)
        BlockType.Chart -> stringResource(R.string.block_chart)
        BlockType.Days -> stringResource(R.string.block_history)
        BlockType.KmDPlus -> stringResource(R.string.block_km_dplus)
        BlockType.CumulMonths -> stringResource(R.string.block_cumul_months)
        BlockType.Load -> stringResource(R.string.block_load)
        BlockType.Intensity -> stringResource(R.string.block_intensities)
        BlockType.Strava -> stringResource(R.string.block_strava)
        BlockType.CurrentWeek -> "Semaine en cours"
    }
    val allActivities = stringResource(R.string.block_all_activities)
    return when {
        type == BlockType.Strava -> base
        type == BlockType.CurrentWeek -> base
        type == BlockType.KmDPlus -> base
        type == BlockType.CumulMonths -> if (sport != null) "$base — ${stringResource(sport.labelRes)}" else "$base — $allActivities"
        sport != null -> "$base — ${stringResource(sport.labelRes)}"
        else -> "$base — $allActivities"
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    authEvent: String?,
    remoteDashboard: RemoteDashboard?,
    sessionFirstName: String? = null,
    onConnectStrava: () -> Unit,
    onSyncStrava: (onDone: () -> Unit) -> Unit = {},
    onUpdateActivity: (
        activityId: String,
        name: String,
        distanceKm: Double,
        movingTimeMin: Double,
        dPlus: Int,
        type: String,
        intensity: String?,
        onDone: (Result<Unit>) -> Unit
    ) -> Unit = { _, _, _, _, _, _, _, onDone -> onDone(Result.success(Unit)) },
    onLoadActivityDetail: (
        activityId: String,
        onDone: (Result<ActivityDetailDraft>) -> Unit
    ) -> Unit = { _, onDone -> onDone(Result.failure(IllegalStateException("Détail indisponible"))) },
    themeMode: ThemeMode,
    onThemeModeChange: (ThemeMode) -> Unit,
    athleteProfile: AthleteProfileSettings = AthleteProfileSettings(),
    onAthleteProfileChange: (AthleteProfileSettings) -> Unit = {},
    onLogout: () -> Unit = {},
    initialVisibleBlockNames: List<String>? = null,
    cockpitLayoutVersion: Int = 2,
    onVisibleBlocksChange: (List<String>) -> Unit = {}
) {
    val overview = remoteDashboard?.weekOverview ?: SampleData.overview
    val ytd = remoteDashboard?.ytd ?: SampleData.ytd
    val weekSessions = if (remoteDashboard?.weekSessions?.isNotEmpty() == true) {
        remoteDashboard.weekSessions
    } else {
        SampleData.week
    }
    val activities = if (remoteDashboard?.recentActivities?.isNotEmpty() == true) {
        remoteDashboard.recentActivities
    } else {
        DraftData.recentActivities
    }
    val athleteName = remoteDashboard?.athleteName?.takeIf { it.isNotBlank() && it != "null" }
        ?: sessionFirstName?.takeIf { it.isNotBlank() }
        ?: "Franck"
    val connected = remoteDashboard?.connected ?: false
    val weekly = remoteDashboard?.weeklyHistory?.takeIf { it.isNotEmpty() } ?: SampleData.weekly
    val bikeWeekDailyKm = remoteDashboard?.cwDailyRideKm?.takeIf { it.isNotEmpty() } ?: List(7) { 0.0 }
    val bikeMonthlyKm = remoteDashboard?.ytdMonthlyRideKm?.takeIf { it.isNotEmpty() } ?: List(12) { 0.0 }
    val swimWeekDailyKm = remoteDashboard?.cwDailySwimKm?.takeIf { it.isNotEmpty() } ?: List(7) { 0.0 }
    val swimMonthlyKm = remoteDashboard?.ytdMonthlySwimKm?.takeIf { it.isNotEmpty() } ?: List(12) { 0.0 }
    val intensityBreakdown = remoteDashboard?.intensityBreakdown?.takeIf { it.isNotEmpty() } ?: SampleData.intensities

    var activitiesState by remember { mutableStateOf(activities) }

    LaunchedEffect(activities) {
        activitiesState = activities
    }

    var selectedTab by remember { mutableStateOf(DashboardTab.Cockpit) }
    var statsMetric by remember { mutableStateOf(StatsMetric.Km) }
    var isRefreshing by remember { mutableStateOf(false) }
    val pullState = rememberPullToRefreshState()
    val defaultVisibleBlocks = listOf(
        CockpitBlock.KpisRun, CockpitBlock.GoalsRun, CockpitBlock.ChartRun,
        CockpitBlock.Load, CockpitBlock.DaysRun, CockpitBlock.CumulMonthsRun, CockpitBlock.Intensity, CockpitBlock.Strava,
        CockpitBlock.CurrentWeek
    )
    val visibleBlocks = remember {
        val parsed = initialVisibleBlockNames
            ?.mapNotNull { name -> CockpitBlock.entries.firstOrNull { it.name == name } }
            ?.let { blocks ->
                if (cockpitLayoutVersion < CURRENT_COCKPIT_LAYOUT_VERSION && CockpitBlock.CurrentWeek !in blocks) {
                    blocks + CockpitBlock.CurrentWeek
                } else {
                    blocks
                }
            }
            ?.takeIf { it.isNotEmpty() }
        mutableStateListOf<CockpitBlock>().apply { addAll(parsed ?: defaultVisibleBlocks) }
    }
    val hiddenBlocks = remember {
        mutableStateListOf<CockpitBlock>().apply {
            addAll(CockpitBlock.entries.filter { it !in visibleBlocks })
        }
    }
    LaunchedEffect(Unit) {
        snapshotFlow { visibleBlocks.toList() }.collect { snapshot ->
            onVisibleBlocksChange(snapshot.map { it.name })
        }
    }
    var showProfile by remember { mutableStateOf(false) }
    var showHrTestProtocol by remember { mutableStateOf(false) }
    var configuringBlockType by remember { mutableStateOf<BlockType?>(null) }
    var editingActivity by remember { mutableStateOf<ActivityDraft?>(null) }
    var selectedActivityDetail by remember { mutableStateOf<ActivityDetailDraft?>(null) }
    var loadingActivityDetailId by remember { mutableStateOf<String?>(null) }
    var activityDetailError by remember { mutableStateOf<String?>(null) }
    val cockpitScrollState = rememberLazyListState()
    val activitiesScrollState = rememberLazyListState()

    val updateActivityWithState = { activityId: String, name: String, distanceKm: Double, movingTimeMin: Double, dPlus: Int, type: String, intensity: String?, onDone: (Result<Unit>) -> Unit ->
        onUpdateActivity(activityId, name, distanceKm, movingTimeMin, dPlus, type, intensity) { result ->
            result.onSuccess {
                activitiesState = activitiesState.map { activity ->
                    if (activity.id == activityId) {
                        activity.copy(
                            name = name,
                            distanceKm = distanceKm,
                            movingTimeMin = movingTimeMin,
                            dPlus = dPlus,
                            type = type,
                            intensity = intensity
                        )
                    } else {
                        activity
                    }
                }
                editingActivity = null
            }
            onDone(result)
        }
    }

    if (showHrTestProtocol) {
        HeartRateTestProtocolScreen(
            onBack = { showHrTestProtocol = false },
            onUseLthrMode = {
                onAthleteProfileChange(updateProfileWithHeartRateCalculation(athleteProfile.copy(heartRateZoneMode = HeartRateZoneMode.LthrFieldTest)))
                showHrTestProtocol = false
                showProfile = true
            }
        )
    } else if (showProfile) {
        AthleteProfileScreen(
            athleteName = athleteName,
            profile = athleteProfile,
            activities = activitiesState,
            onProfileChange = onAthleteProfileChange,
            onOpenHrTestProtocol = { showHrTestProtocol = true },
            onBack = { showProfile = false }
        )
    } else if (configuringBlockType != null) {
        BlockConfigScreen(
            blockType = configuringBlockType!!,
            visibleBlocks = visibleBlocks,
            hiddenBlocks = hiddenBlocks,
            onBack = { configuringBlockType = null }
        )
    } else if (selectedActivityDetail != null) {
        ActivityDetailScreen(
            detail = selectedActivityDetail!!,
            athleteProfile = athleteProfile,
            activities = activitiesState,
            onBack = { selectedActivityDetail = null }
        )
    } else if (loadingActivityDetailId != null || activityDetailError != null) {
        ActivityDetailStatusScreen(
            isLoading = loadingActivityDetailId != null,
            error = activityDetailError,
            onBack = {
                loadingActivityDetailId = null
                activityDetailError = null
            }
        )
    } else if (editingActivity != null) {
        ActivityEditScreen(
            activity = editingActivity!!,
            onBack = { editingActivity = null },
            onSave = updateActivityWithState
        )
    } else {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(TrailColors.Background)
    ) {
        TopHeader(
            athleteName = athleteName,
            onSettingsClick = { selectedTab = DashboardTab.Settings },
            onProfileClick = { showProfile = true }
        )

        PullToRefreshBox(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            isRefreshing = isRefreshing,
            state = pullState,
            onRefresh = {
                isRefreshing = true
                onSyncStrava { isRefreshing = false }
            }
        ) {
            when (selectedTab) {
                DashboardTab.Cockpit -> CockpitTab(
                    overview = overview,
                    ytd = ytd,
                    weekSessions = weekSessions,
                    weekly = weekly,
                    bikeWeekDailyKm = bikeWeekDailyKm,
                    bikeMonthlyKm = bikeMonthlyKm,
                    swimWeekDailyKm = swimWeekDailyKm,
                    swimMonthlyKm = swimMonthlyKm,
                    activities = activities,
                    intensityBreakdown = intensityBreakdown,
                    authEvent = authEvent,
                    connected = connected,
                    onConnectStrava = onConnectStrava,
                    onSyncStrava = { onSyncStrava {} },
                    visibleBlocks = visibleBlocks,
                    onConfigureBlockType = { configuringBlockType = it },
                    scrollState = cockpitScrollState
                )
                DashboardTab.Stats -> StatsTab(
                    metric = statsMetric,
                    onMetricChange = { statsMetric = it },
                    weekly = weekly
                )
                DashboardTab.Charge -> LoadTab(activities = activitiesState)
                DashboardTab.Plan -> PlanTab(cycles = DraftData.trainingCycles)
                DashboardTab.Activities -> ActivitiesTab(
                    activities = activitiesState,
                    scrollState = activitiesScrollState,
                    onEditActivity = { editingActivity = it },
                    onOpenActivity = { activity ->
                        activityDetailError = null
                        loadingActivityDetailId = activity.id
                        onLoadActivityDetail(activity.id) { result ->
                            loadingActivityDetailId = null
                            result
                                .onSuccess { selectedActivityDetail = it }
                                .onFailure { activityDetailError = it.message ?: "Impossible de charger l'activité." }
                        }
                    }
                )
                DashboardTab.Settings -> SettingsTab(
                    connected = connected,
                    athleteName = athleteName,
                    authEvent = authEvent,
                    themeMode = themeMode,
                    onThemeModeChange = onThemeModeChange,
                    onConnectStrava = onConnectStrava,
                    onSyncStrava = { onSyncStrava {} },
                    onLogout = onLogout
                )
            }
        }

        BottomTabs(
            selectedTab = selectedTab,
            onSelectedTab = { selectedTab = it }
        )
    }
    }
}

@Composable
private fun AthleteProfileScreen(
    athleteName: String,
    profile: AthleteProfileSettings,
    activities: List<ActivityDraft>,
    onProfileChange: (AthleteProfileSettings) -> Unit,
    onOpenHrTestProtocol: () -> Unit,
    onBack: () -> Unit
) {
    val profileModel = buildHeartRateProfile(profile, activities)
    val calculation = calculateProfileHeartRateZones(profile)
    fun updateProfile(next: AthleteProfileSettings) {
        onProfileChange(updateProfileWithHeartRateCalculation(next))
    }

    Column(Modifier.fillMaxSize().background(TrailColors.Background)) {
        DetailHeader(title = "Profil sportif", onBack = onBack)
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                SectionCard {
                    Text(
                        text = athleteName,
                        color = TrailColors.Text,
                        fontWeight = FontWeight.Black,
                        fontSize = 24.sp
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "Ce profil sert à calibrer les zones de fréquence cardiaque et à mieux interpréter le niveau d'effort.",
                        color = TrailColors.SubtleText,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )
                }
            }

            item {
                SectionCard {
                    SectionTitle("Méthode de calcul des zones")
                    Spacer(Modifier.height(10.dp))
                    HeartRateZoneMode.entries.forEach { mode ->
                        ProfileModeRow(
                            title = mode.displayName,
                            subtitle = mode.description,
                            selected = profile.heartRateZoneMode == mode,
                            accent = confidenceColor(confidenceForMode(mode)),
                            onClick = {
                                updateProfile(
                                    profile.copy(
                                        heartRateZoneMode = mode,
                                        calibrationMode = if (mode == HeartRateZoneMode.EstimatedMaxHr) {
                                            ProfileCalibrationMode.Inferred
                                        } else {
                                            profile.calibrationMode
                                        }
                                    )
                                )
                            }
                        )
                        Spacer(Modifier.height(8.dp))
                    }
                }
            }

            item {
                SectionCard {
                    SectionTitle("Source des valeurs")
                    Spacer(Modifier.height(10.dp))
                    ProfileModeRow(
                        title = "Je renseigne mes valeurs",
                        subtitle = "Les champs du profil sont utilisés directement pour calculer tes zones.",
                        selected = profile.calibrationMode == ProfileCalibrationMode.Manual,
                        accent = TrailColors.GreenOk,
                        onClick = { updateProfile(profile.copy(calibrationMode = ProfileCalibrationMode.Manual)) }
                    )
                    Spacer(Modifier.height(8.dp))
                    ProfileModeRow(
                        title = "Déduire automatiquement",
                        subtitle = "L'app peut compléter les valeurs manquantes avec l'âge ou l'historique disponible.",
                        selected = profile.calibrationMode == ProfileCalibrationMode.Inferred,
                        accent = TrailColors.ChargeOrange,
                        onClick = { updateProfile(profile.copy(calibrationMode = ProfileCalibrationMode.Inferred)) }
                    )
                }
            }

            item {
                SectionCard {
                    SectionTitle("Données cardio")
                    Spacer(Modifier.height(10.dp))
                    HeartRateModeFields(
                        profile = profile,
                        profileModel = profileModel,
                        calculation = calculation,
                        onOpenHrTestProtocol = onOpenHrTestProtocol,
                        onProfileChange = ::updateProfile
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = helpTextForMode(profile.heartRateZoneMode),
                        color = TrailColors.SubtleText,
                        fontSize = 12.sp,
                        lineHeight = 16.sp
                    )
                }
            }

            item {
                SectionCard {
                    SectionTitle("Infos athlète")
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProfileNumberField(
                            label = "Poids (kg)",
                            value = profile.weightKg,
                            placeholder = "ex. 72",
                            enabled = true,
                            keyboardType = KeyboardType.Decimal,
                            modifier = Modifier.weight(1f),
                            onValueChange = { updateProfile(profile.copy(weightKg = it.filterDecimal(5))) }
                        )
                        ProfileNumberField(
                            label = "Année naissance",
                            value = profile.birthYear,
                            placeholder = "ex. 1985",
                            enabled = true,
                            modifier = Modifier.weight(1f),
                            onValueChange = { updateProfile(profile.copy(birthYear = it.filterDigits(4))) }
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "Ces infos améliorent les estimations si tu ne renseignes pas directement tes zones.",
                        color = TrailColors.SubtleText,
                        fontSize = 12.sp,
                        lineHeight = 16.sp
                    )
                }
            }

            item {
                SectionCard {
                    SectionTitle("Zones FC utilisées")
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ProfileMetricCard("Méthode", compactModeLabel(profile.heartRateZoneMode), confidenceColor(calculation.confidence), Modifier.weight(1f))
                        ProfileMetricCard("Fiabilité", compactConfidenceLabel(calculation.confidence), confidenceColor(calculation.confidence), Modifier.weight(1f))
                        ProfileMetricCard("FC max", "${calculation.maxHrUsed ?: profileModel.maxHeartRate}", TrailColors.RunRed, Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(10.dp))
                    val zonesToShow = calculation.zones.map { it.toUi() }.ifEmpty { profileModel.zones }
                    zonesToShow.forEach { zone ->
                        HeartRateZoneRow(zone)
                        Spacer(Modifier.height(6.dp))
                    }
                    if (profile.heartRateZoneUpdatedAt.isNotBlank()) {
                        Text("Dernière mise à jour : ${profile.heartRateZoneUpdatedAt}", color = TrailColors.SubtleText, fontSize = 11.sp)
                        Spacer(Modifier.height(4.dp))
                    }
                    (calculation.missingFields.map { "Champ manquant : $it" } + calculation.warnings).forEach { message ->
                        Text(message, color = TrailColors.ChargeOrange, fontSize = 12.sp, lineHeight = 16.sp)
                        Spacer(Modifier.height(4.dp))
                    }
                    Text(
                        text = improvementHint(profile, calculation),
                        color = confidenceColor(calculation.confidence),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        lineHeight = 16.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun HeartRateTestProtocolScreen(
    onBack: () -> Unit,
    onUseLthrMode: () -> Unit
) {
    Column(Modifier.fillMaxSize().background(TrailColors.Background)) {
        DetailHeader(title = "Protocole du test terrain 30 minutes", onBack = onBack)
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                SectionCard {
                    SectionTitle("Introduction")
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Le test terrain de 30 minutes permet d'estimer ta fréquence cardiaque au seuil. Cette valeur est appelée LTHR, pour Lactate Threshold Heart Rate. Elle sert à créer des zones cardio plus fiables qu'un simple calcul basé sur l'âge ou la FC max.",
                        color = TrailColors.SubtleText,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )
                }
            }
            item {
                SectionCard {
                    SectionTitle("Avant de commencer")
                    Spacer(Modifier.height(8.dp))
                    listOf(
                        "Réalise ce test uniquement si tu es en bonne santé.",
                        "Ne fais pas ce test en cas de fatigue importante, douleur, fièvre ou reprise après blessure.",
                        "Choisis un parcours plat, régulier et sans interruption.",
                        "Utilise idéalement une ceinture cardio plutôt qu'un capteur optique au poignet.",
                        "Évite les fortes chaleurs, le vent fort ou les parcours vallonnés.",
                        "Ne fais pas ce test après une grosse séance ou une compétition récente.",
                        "Prévois au moins 48 h sans entraînement intense avant le test."
                    ).forEach { BulletLine(it) }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Ce test ne remplace pas un avis médical. En cas de doute, demande l'avis d'un professionnel de santé.",
                        color = TrailColors.ChargeOrange,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        lineHeight = 16.sp
                    )
                }
            }
            item {
                SectionCard {
                    SectionTitle("Échauffement")
                    Spacer(Modifier.height(8.dp))
                    NumberedStep("1", "Échauffe-toi 15 à 20 minutes en endurance facile.")
                    NumberedStep("2", "Ajoute 3 à 4 accélérations progressives de 15 à 20 secondes pour préparer l'effort.")
                    NumberedStep("3", "Récupère 2 à 3 minutes en footing facile avant de commencer le test.")
                }
            }
            item {
                SectionCard {
                    SectionTitle("Le test")
                    Spacer(Modifier.height(8.dp))
                    NumberedStep("1", "Lance une activité course à pied sur ta montre.")
                    NumberedStep("2", "Cours 30 minutes au meilleur effort régulier possible.")
                    NumberedStep("3", "Ne pars pas trop vite. L'objectif est de tenir une intensité forte mais stable pendant toute la durée du test.")
                    NumberedStep("4", "Si ta montre le permet, appuie sur le bouton LAP après les 10 premières minutes.")
                    NumberedStep("5", "La fréquence cardiaque moyenne des 20 dernières minutes correspond à ton estimation de LTHR.")
                    Spacer(Modifier.height(8.dp))
                    Text("Exemple : si ta FC moyenne sur les 20 dernières minutes est de 174 bpm, alors ton LTHR estimé est 174.", color = TrailColors.Text, fontSize = 12.sp, lineHeight = 16.sp)
                }
            }
            item {
                SectionCard {
                    SectionTitle("Après le test")
                    Spacer(Modifier.height(8.dp))
                    Text("Entre ta valeur LTHR dans ton profil, dans le mode 'Test terrain 30 minutes'. L'app calculera automatiquement tes zones cardio.", color = TrailColors.SubtleText, fontSize = 13.sp, lineHeight = 18.sp)
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = onUseLthrMode) {
                        Text("Renseigner ma FC seuil", color = TrailColors.ChargeOrange, fontWeight = FontWeight.Bold)
                    }
                }
            }
            item {
                SectionCard {
                    SectionTitle("Conseils d'interprétation")
                    Spacer(Modifier.height(8.dp))
                    listOf(
                        "Si tu as explosé dans les 10 dernières minutes, le test est probablement parti trop vite.",
                        "Si tu as fini avec beaucoup de marge, tu étais probablement trop prudent.",
                        "Répète le test toutes les 8 à 12 semaines si ton entraînement évolue.",
                        "Garde des conditions similaires pour comparer les résultats."
                    ).forEach { BulletLine(it) }
                }
            }
        }
    }
}

@Composable
private fun NumberedStep(number: String, text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(vertical = 4.dp)) {
        Text(number, color = TrailColors.ChargeOrange, fontWeight = FontWeight.Black, fontSize = 13.sp, modifier = Modifier.width(18.dp))
        Text(text, color = TrailColors.SubtleText, fontSize = 13.sp, lineHeight = 18.sp, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun HeartRateModeFields(
    profile: AthleteProfileSettings,
    profileModel: HeartRateProfileUi,
    calculation: com.franck.trailcockpit.data.HeartRateZoneCalculationResult,
    onOpenHrTestProtocol: () -> Unit,
    onProfileChange: (AthleteProfileSettings) -> Unit
) {
    fun updateMax(value: String) {
        val digits = value.filterDigits(3)
        onProfileChange(profile.copy(maxHr = digits, maxHeartRate = digits))
    }

    fun updateResting(value: String) {
        val digits = value.filterDigits(3)
        onProfileChange(profile.copy(restingHr = digits, restingHeartRate = digits))
    }

    fun updateLthr(value: String) {
        val digits = value.filterDigits(3)
        onProfileChange(profile.copy(lactateThresholdHr = digits, thresholdHeartRate = digits))
    }

    when (profile.heartRateZoneMode) {
        HeartRateZoneMode.PhysiologicalThresholds -> {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProfileNumberField("FC max", profile.maxHr, profileModel.inferredMaxHeartRate.toString(), true, Modifier.weight(1f), onValueChange = ::updateMax)
                ProfileNumberField("Seuil aérobie / AeT", profile.aerobicThresholdHr, "ex. 150", true, Modifier.weight(1f)) {
                    onProfileChange(profile.copy(aerobicThresholdHr = it.filterDigits(3)))
                }
            }
            Spacer(Modifier.height(8.dp))
            ProfileNumberField("Seuil anaérobie / LTHR", profile.lactateThresholdHr, "ex. 174", true, onValueChange = ::updateLthr)
        }
        HeartRateZoneMode.LthrFieldTest -> {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProfileNumberField("FC max", profile.maxHr, profileModel.inferredMaxHeartRate.toString(), true, Modifier.weight(1f), onValueChange = ::updateMax)
                ProfileNumberField("FC seuil test 30 min", profile.lactateThresholdHr, "ex. 174", true, Modifier.weight(1f), onValueChange = ::updateLthr)
            }
            TextButton(onClick = onOpenHrTestProtocol) {
                Text("Voir le protocole du test 30 min", color = TrailColors.ChargeOrange, fontWeight = FontWeight.Bold)
            }
        }
        HeartRateZoneMode.HeartRateReserve -> {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProfileNumberField("FC max", profile.maxHr, profileModel.inferredMaxHeartRate.toString(), true, Modifier.weight(1f), onValueChange = ::updateMax)
                ProfileNumberField("FC repos", profile.restingHr, profileModel.inferredRestingHeartRate.toString(), true, Modifier.weight(1f), onValueChange = ::updateResting)
            }
        }
        HeartRateZoneMode.PercentMaxHr -> {
            ProfileNumberField("FC max", profile.maxHr, profileModel.inferredMaxHeartRate.toString(), true, onValueChange = ::updateMax)
        }
        HeartRateZoneMode.EstimatedMaxHr -> {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ProfileNumberField("Année naissance", profile.birthYear, "ex. 1985", true, Modifier.weight(1f)) {
                    onProfileChange(profile.copy(birthYear = it.filterDigits(4)))
                }
                ProfileNumberField("FCmax estimée", calculation.maxHrUsed?.toString().orEmpty(), "auto", false, Modifier.weight(1f)) {}
            }
        }
        HeartRateZoneMode.Manual -> {
            parseManualZones(profile.heartRateZones).forEach { zone ->
                ManualZoneEditRow(zone) { min, max ->
                    val updated = parseManualZones(profile.heartRateZones).map {
                        if (it.zone == zone.zone) it.copy(min = min.toIntOrNull(), max = max.toIntOrNull() ?: it.max) else it
                    }
                    onProfileChange(profile.copy(heartRateZones = zonesToJson(updated)))
                }
                Spacer(Modifier.height(6.dp))
            }
        }
    }
}

@Composable
private fun ManualZoneEditRow(zone: HeartRateZone, onChange: (String, String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("Z${zone.zone}", color = TrailColors.Text, fontWeight = FontWeight.Bold, modifier = Modifier.width(32.dp))
        ProfileNumberField(
            label = "Min",
            value = zone.min?.toString().orEmpty(),
            placeholder = if (zone.zone == 1) "vide" else "min",
            enabled = true,
            modifier = Modifier.weight(1f),
            onValueChange = { onChange(it.filterDigits(3), zone.max.toString()) }
        )
        ProfileNumberField(
            label = "Max",
            value = zone.max.toString(),
            placeholder = "max",
            enabled = true,
            modifier = Modifier.weight(1f),
            onValueChange = { onChange(zone.min?.toString().orEmpty(), it.filterDigits(3)) }
        )
    }
}

private fun calculateProfileHeartRateZones(profile: AthleteProfileSettings) =
    HeartRateZones.calculateHeartRateZones(
        HeartRateZoneCalculationInput(
            mode = profile.heartRateZoneMode,
            maxHr = profile.maxHr.toIntOrNull(),
            restingHr = profile.restingHr.toIntOrNull(),
            age = profile.birthYear.toIntOrNull()?.let { LocalDate.now().year - it },
            aerobicThresholdHr = profile.aerobicThresholdHr.toIntOrNull(),
            lactateThresholdHr = profile.lactateThresholdHr.toIntOrNull(),
            manualZones = parseManualZones(profile.heartRateZones)
        )
    )

private fun updateProfileWithHeartRateCalculation(profile: AthleteProfileSettings): AthleteProfileSettings {
    val calculation = calculateProfileHeartRateZones(profile)
    return profile.copy(
        estimatedMaxHr = if (profile.heartRateZoneMode == HeartRateZoneMode.EstimatedMaxHr) calculation.maxHrUsed?.toString().orEmpty() else profile.estimatedMaxHr,
        heartRateZones = if (calculation.zones.isNotEmpty()) zonesToJson(calculation.zones) else profile.heartRateZones,
        heartRateZoneConfidence = calculation.confidence.name,
        heartRateZoneUpdatedAt = LocalDate.now().toString()
    )
}

private fun suggestHeartRateZoneMode(profile: AthleteProfileSettings): HeartRateZoneMode {
    val maxHr = profile.maxHr.toIntOrNull()
    val restingHr = profile.restingHr.toIntOrNull()
    val aet = profile.aerobicThresholdHr.toIntOrNull()
    val lthr = profile.lactateThresholdHr.toIntOrNull()
    val age = profile.birthYear.toIntOrNull()
    return when {
        maxHr != null && aet != null && lthr != null -> HeartRateZoneMode.PhysiologicalThresholds
        maxHr != null && lthr != null -> HeartRateZoneMode.LthrFieldTest
        maxHr != null && restingHr != null -> HeartRateZoneMode.HeartRateReserve
        maxHr != null -> HeartRateZoneMode.PercentMaxHr
        age != null -> HeartRateZoneMode.EstimatedMaxHr
        else -> profile.heartRateZoneMode
    }
}

private fun parseManualZones(json: String): List<HeartRateZone> {
    if (json.isBlank()) return defaultManualZones()
    return runCatching {
        val array = JSONArray(json)
        List(array.length()) { index ->
            val item = array.getJSONObject(index)
            HeartRateZone(
                zone = item.optInt("zone", index + 1),
                name = item.optString("name", defaultManualZones()[index.coerceIn(0, 4)].name),
                min = if (item.isNull("min")) null else item.optInt("min"),
                max = item.optInt("max"),
                description = item.optString("description", defaultManualZones()[index.coerceIn(0, 4)].description)
            )
        }
    }.getOrElse { defaultManualZones() }
}

private fun defaultManualZones(): List<HeartRateZone> = listOf(
    HeartRateZone(1, "Récupération", null, 139, "Footing très facile, récupération, échauffement."),
    HeartRateZone(2, "Endurance fondamentale", 140, 159, "Endurance fondamentale, aisance respiratoire, base aérobie."),
    HeartRateZone(3, "Endurance active", 160, 171, "Endurance active, effort soutenu mais contrôlé."),
    HeartRateZone(4, "Seuil", 172, 180, "Travail au seuil, effort difficile mais tenable."),
    HeartRateZone(5, "Très intense", 181, 195, "VO₂max, côtes, intervalles courts, effort très intense.")
)

private fun zonesToJson(zones: List<HeartRateZone>): String {
    return JSONArray().apply {
        zones.forEach { zone ->
            put(JSONObject().apply {
                put("zone", zone.zone)
                put("name", zone.name)
                if (zone.min == null) put("min", JSONObject.NULL) else put("min", zone.min)
                put("max", zone.max)
                put("description", zone.description)
            })
        }
    }.toString()
}

@Composable
private fun HeartRateZone.toUi(): HeartRateZoneUi {
    return HeartRateZoneUi("Z$zone", name, formatZoneRange(this), zoneColor(zone))
}

private fun formatZoneRange(zone: HeartRateZone): String {
    return if (zone.min == null) "≤${zone.max}" else "${zone.min}-${zone.max}"
}

@Composable
private fun zoneColor(zone: Int): Color = when (zone) {
    1 -> TrailColors.GreenOk
    2 -> TrailColors.SeriesBlue
    3 -> TrailColors.SeriesYellow
    4 -> TrailColors.ChargeOrange
    else -> TrailColors.RunRed
}

private fun confidenceForMode(mode: HeartRateZoneMode): HeartRateZoneConfidence = when (mode) {
    HeartRateZoneMode.PhysiologicalThresholds -> HeartRateZoneConfidence.High
    HeartRateZoneMode.LthrFieldTest -> HeartRateZoneConfidence.Good
    HeartRateZoneMode.HeartRateReserve -> HeartRateZoneConfidence.Medium
    HeartRateZoneMode.PercentMaxHr -> HeartRateZoneConfidence.Low
    HeartRateZoneMode.EstimatedMaxHr -> HeartRateZoneConfidence.VeryLow
    HeartRateZoneMode.Manual -> HeartRateZoneConfidence.Custom
}

@Composable
private fun confidenceColor(confidence: HeartRateZoneConfidence): Color = when (confidence) {
    HeartRateZoneConfidence.High, HeartRateZoneConfidence.Good, HeartRateZoneConfidence.Custom -> TrailColors.GreenOk
    HeartRateZoneConfidence.Medium -> TrailColors.SeriesYellow
    HeartRateZoneConfidence.Low -> TrailColors.ChargeOrange
    HeartRateZoneConfidence.VeryLow -> TrailColors.RunRed
}

private fun confidenceLabel(confidence: HeartRateZoneConfidence): String = when (confidence) {
    HeartRateZoneConfidence.High -> "Fiabilité excellente"
    HeartRateZoneConfidence.Good -> "Fiabilité bonne"
    HeartRateZoneConfidence.Medium -> "Fiabilité moyenne"
    HeartRateZoneConfidence.Low -> "Fiabilité faible"
    HeartRateZoneConfidence.VeryLow -> "Fiabilité très faible"
    HeartRateZoneConfidence.Custom -> "Zones personnalisées"
}

private fun compactConfidenceLabel(confidence: HeartRateZoneConfidence): String = when (confidence) {
    HeartRateZoneConfidence.High -> "Excellente"
    HeartRateZoneConfidence.Good -> "Bonne"
    HeartRateZoneConfidence.Medium -> "Moyenne"
    HeartRateZoneConfidence.Low -> "Faible"
    HeartRateZoneConfidence.VeryLow -> "Très faible"
    HeartRateZoneConfidence.Custom -> "Personnalisée"
}

private fun compactModeLabel(mode: HeartRateZoneMode): String = when (mode) {
    HeartRateZoneMode.PhysiologicalThresholds -> "Seuils physio"
    HeartRateZoneMode.LthrFieldTest -> "Test terrain"
    HeartRateZoneMode.HeartRateReserve -> "FC réserve"
    HeartRateZoneMode.PercentMaxHr -> "% FC max"
    HeartRateZoneMode.EstimatedMaxHr -> "Estimation"
    HeartRateZoneMode.Manual -> "Personnalisé"
}

private fun helpTextForMode(mode: HeartRateZoneMode): String = when (mode) {
    HeartRateZoneMode.PhysiologicalThresholds -> "Cette méthode est la plus précise si tes seuils ont été mesurés en test labo ou test terrain fiable."
    HeartRateZoneMode.LthrFieldTest -> "Cette méthode est recommandée si tu peux réaliser un test terrain régulier de 30 minutes."
    HeartRateZoneMode.HeartRateReserve -> "Cette méthode tient compte de ta FC repos et personnalise mieux les zones."
    HeartRateZoneMode.PercentMaxHr -> "Cette méthode est simple mais moins personnalisée que la méthode FC réserve ou le test terrain."
    HeartRateZoneMode.EstimatedMaxHr -> "Cette méthode est une estimation. Elle peut être imprécise selon ton profil."
    HeartRateZoneMode.Manual -> "Vérifie que les zones personnalisées sont continues, croissantes et sans chevauchement."
}

private fun improvementHint(profile: AthleteProfileSettings, calculation: com.franck.trailcockpit.data.HeartRateZoneCalculationResult): String {
    return when {
        calculation.zones.isEmpty() -> "Renseigne au minimum ta FC max ou ta date de naissance pour calculer tes zones."
        profile.heartRateZoneMode == HeartRateZoneMode.PercentMaxHr -> "Tes zones sont actuellement calculées avec la méthode % FC max. Pour une meilleure précision, ajoute ta FC repos ou réalise le test terrain de 30 minutes."
        profile.heartRateZoneMode == HeartRateZoneMode.EstimatedMaxHr -> "Pour un coaching plus fiable, renseigne ta FC repos, ta FC max réelle ou réalise un test terrain."
        profile.heartRateZoneMode == HeartRateZoneMode.HeartRateReserve -> "Bon compromis. Le test terrain de 30 minutes peut encore améliorer la précision."
        else -> "Méthode utilisée : ${profile.heartRateZoneMode.displayName}."
    }
}

@Composable
private fun ProfileModeRow(
    title: String,
    subtitle: String,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) accent.copy(alpha = 0.14f) else TrailColors.Surface)
            .border(1.dp, if (selected) accent else TrailColors.Border, RoundedCornerShape(14.dp))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        RadioButton(
            selected = selected,
            onClick = onClick,
            colors = RadioButtonDefaults.colors(
                selectedColor = accent,
                unselectedColor = TrailColors.SubtleText
            )
        )
        Column(Modifier.weight(1f)) {
            Text(title, color = TrailColors.Text, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Spacer(Modifier.height(2.dp))
            Text(subtitle, color = TrailColors.SubtleText, fontSize = 12.sp, lineHeight = 16.sp)
        }
    }
}

@Composable
private fun ProfileNumberField(
    label: String,
    value: String,
    placeholder: String,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    keyboardType: KeyboardType = KeyboardType.Number,
    onValueChange: (String) -> Unit
) {
    Column(modifier = modifier) {
        Text(label, color = TrailColors.SubtleText, fontSize = 11.sp)
        Spacer(Modifier.height(4.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            singleLine = true,
            placeholder = { Text(placeholder, color = TrailColors.SubtleText.copy(alpha = 0.65f)) },
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = TrailColors.Text,
                unfocusedTextColor = TrailColors.Text,
                disabledTextColor = TrailColors.SubtleText,
                focusedBorderColor = TrailColors.ChargeOrange,
                unfocusedBorderColor = TrailColors.Border,
                disabledBorderColor = TrailColors.Border.copy(alpha = 0.55f),
                focusedContainerColor = TrailColors.Surface,
                unfocusedContainerColor = TrailColors.Surface,
                disabledContainerColor = TrailColors.Surface.copy(alpha = 0.65f)
            ),
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun ProfileMetricCard(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(color.copy(alpha = 0.12f))
            .border(1.dp, color.copy(alpha = 0.28f), RoundedCornerShape(12.dp))
            .padding(horizontal = 8.dp, vertical = 8.dp)
            .defaultMinSize(minHeight = 58.dp)
    ) {
        Text(label, color = TrailColors.SubtleText, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text(
            value,
            color = TrailColors.Text,
            fontSize = 14.sp,
            fontWeight = FontWeight.Black,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            lineHeight = 16.sp
        )
    }
}

@Composable
private fun HeartRateZoneRow(zone: HeartRateZoneUi) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(TrailColors.Surface)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(zone.color)
        )
        Text(zone.label, color = TrailColors.Text, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(72.dp))
        Text(zone.description, color = TrailColors.SubtleText, fontSize = 12.sp, modifier = Modifier.weight(1f))
        Text(zone.range, color = TrailColors.Text, fontSize = 13.sp, fontWeight = FontWeight.Black)
    }
}

private data class HeartRateProfileUi(
    val sourceLabel: String,
    val sourceColor: Color,
    val precisionNote: String,
    val maxHeartRate: Int,
    val restingHeartRate: Int,
    val inferredMaxHeartRate: Int,
    val inferredRestingHeartRate: Int,
    val inferredThresholdHeartRate: Int,
    val zones: List<HeartRateZoneUi>
)

private data class HeartRateZoneUi(
    val label: String,
    val description: String,
    val range: String,
    val color: Color
)

@Composable
private fun buildHeartRateProfile(
    profile: AthleteProfileSettings,
    activities: List<ActivityDraft>
): HeartRateProfileUi {
    val manualMax = profile.maxHr.toIntOrNull()?.takeIf { it in 120..230 }
    val manualRest = profile.restingHr.toIntOrNull()?.takeIf { it in 30..100 }
    val manualThreshold = profile.lactateThresholdHr.toIntOrNull()?.takeIf { it in 100..220 }
    val birthYear = profile.birthYear.toIntOrNull()
    val ageMax = birthYear
        ?.takeIf { it in 1930..LocalDate.now().year }
        ?.let { year -> (208 - 0.7 * (LocalDate.now().year - year)).roundToInt() }
    val observedMaxAverage = activities.mapNotNull { it.averageHeartRate }.maxOrNull()
    val inferredMax = listOfNotNull(
        observedMaxAverage?.plus(18),
        ageMax
    ).maxOrNull()?.coerceIn(165, 205) ?: 190
    val inferredRest = 55
    val inferredThreshold = (inferredMax * 0.88).roundToInt()

    val usesManualMode = profile.calibrationMode == ProfileCalibrationMode.Manual
    val maxHeartRate = if (usesManualMode) manualMax ?: inferredMax else inferredMax
    val restingHeartRate = if (usesManualMode) manualRest ?: inferredRest else inferredRest
    val thresholdHeartRate = if (usesManualMode) manualThreshold ?: inferredThreshold else inferredThreshold
    val isFullyManual = usesManualMode && manualMax != null && manualRest != null
    val sourceLabel = when {
        isFullyManual -> "Manuel"
        usesManualMode -> "Mixte"
        else -> "Déduit"
    }
    val sourceColor = when {
        isFullyManual -> TrailColors.GreenOk
        usesManualMode -> TrailColors.SeriesYellow
        else -> TrailColors.ChargeOrange
    }
    val precisionNote = when {
        isFullyManual -> "Profil précis : les zones utilisent tes valeurs personnelles."
        usesManualMode -> "Profil partiel : les valeurs manquantes sont encore estimées."
        observedMaxAverage != null -> "Profil estimé : basé sur l'historique Strava, donc moins précis qu'une valeur renseignée."
        else -> "Profil estimé : aucune FC exploitable trouvée, l'app utilise une estimation standard."
    }

    return HeartRateProfileUi(
        sourceLabel = sourceLabel,
        sourceColor = sourceColor,
        precisionNote = precisionNote,
        maxHeartRate = maxHeartRate,
        restingHeartRate = restingHeartRate,
        inferredMaxHeartRate = inferredMax,
        inferredRestingHeartRate = inferredRest,
        inferredThresholdHeartRate = thresholdHeartRate,
        zones = heartRateZones(maxHeartRate)
    )
}

@Composable
private fun heartRateZones(maxHeartRate: Int): List<HeartRateZoneUi> {
    fun percentOfMax(referenceBpm: Int): Int = (maxHeartRate * referenceBpm / 195.0).roundToInt()

    val z1Max = percentOfMax(139)
    val z2Min = z1Max + 1
    val z2Max = percentOfMax(159).coerceAtLeast(z2Min)
    val z3Min = z2Max + 1
    val z3Max = percentOfMax(171).coerceAtLeast(z3Min)
    val z4Min = z3Max + 1
    val z4Max = percentOfMax(180).coerceAtLeast(z4Min)
    val z5Min = z4Max + 1

    return listOf(
        HeartRateZoneUi("Z1", "Récupération", "≤$z1Max", TrailColors.GreenOk),
        HeartRateZoneUi("Z2", "Endurance fondamentale", "$z2Min-$z2Max", TrailColors.SeriesBlue),
        HeartRateZoneUi("Z3", "Tempo / vallonné actif", "$z3Min-$z3Max", TrailColors.SeriesYellow),
        HeartRateZoneUi("Z4", "Seuil", "$z4Min-$z4Max", TrailColors.ChargeOrange),
        HeartRateZoneUi("Z5", "VMA / très intense", "$z5Min-$maxHeartRate", TrailColors.RunRed)
    )
}

private fun String.filterDigits(maxLength: Int): String {
    return filter { it.isDigit() }.take(maxLength)
}

private fun String.filterDecimal(maxLength: Int): String {
    var hasSeparator = false
    return buildString {
        this@filterDecimal.forEach { char ->
            when {
                char.isDigit() -> append(char)
                (char == '.' || char == ',') && !hasSeparator -> {
                    append('.')
                    hasSeparator = true
                }
            }
        }
    }.take(maxLength)
}

@Composable
private fun TopHeader(
    athleteName: String,
    onSettingsClick: () -> Unit = {},
    onProfileClick: () -> Unit = {}
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(TrailColors.Surface)
            .border(1.dp, TrailColors.Border)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Bottom
    ) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                text = "TRAIL",
                color = TrailColors.ChargeOrange,
                fontWeight = FontWeight.Black,
                fontSize = 28.sp
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "COCKPIT",
                color = TrailColors.SubtleText,
                fontWeight = FontWeight.SemiBold,
                fontSize = 18.sp
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = athleteName,
                color = TrailColors.ChargeOrange,
                fontWeight = FontWeight.SemiBold,
                fontSize = 18.sp,
                modifier = Modifier.clickable { onSettingsClick() }
            )
            Icon(
                imageVector = Icons.Default.MoreVert,
                contentDescription = "Profil sportif",
                tint = TrailColors.SubtleText,
                modifier = Modifier
                    .size(22.dp)
                    .clickable { onProfileClick() }
            )
        }
    }
}

@Composable
private fun CockpitTab(
    overview: WeekOverview,
    ytd: YtdData,
    weekSessions: List<DaySession>,
    weekly: List<WeeklyPoint>,
    bikeWeekDailyKm: List<Double> = List(7) { 0.0 },
    bikeMonthlyKm: List<Double> = List(12) { 0.0 },
    swimWeekDailyKm: List<Double> = List(7) { 0.0 },
    swimMonthlyKm: List<Double> = List(12) { 0.0 },
    activities: List<ActivityDraft> = emptyList(),
    intensityBreakdown: List<IntensityShare> = emptyList(),
    authEvent: String?,
    connected: Boolean,
    onConnectStrava: () -> Unit,
    onSyncStrava: () -> Unit = {},
    visibleBlocks: SnapshotStateList<CockpitBlock>,
    onConfigureBlockType: (BlockType) -> Unit = {},
    scrollState: LazyListState = rememberLazyListState()
) {
    var runWeekTarget by remember { mutableIntStateOf(overview.runTargetKm) }
    var dplusWeekTarget by remember { mutableIntStateOf(overview.runDPlusTarget) }
    var runYearTarget by remember { mutableIntStateOf(ytd.yearTarget) }
    var bikeWeekTarget by remember { mutableIntStateOf(0) }
    var bikeYearTarget by remember { mutableIntStateOf(0) }
    var swimWeekTarget by remember { mutableIntStateOf(0) }
    var swimYearTarget by remember { mutableIntStateOf(0) }
    var allYearTarget by remember { mutableIntStateOf(0) }
    var showGoalDialogSport by remember { mutableStateOf<SportMode?>(null) }
    var showGoalDialogAll by remember { mutableStateOf(false) }
    var chartPeriod by remember { mutableStateOf(ChartPeriod.Week) }
    var showChartPeriodPicker by remember { mutableStateOf(false) }
    var showAddBlockDialog by remember { mutableStateOf(false) }
    val hiddenBlockTypes: List<BlockType> by remember(visibleBlocks) {
        derivedStateOf {
            BlockType.entries.filter { type ->
                CockpitBlock.entries.none { block -> block.type == type && block in visibleBlocks }
            }
        }
    }

    showGoalDialogSport?.let { sport ->
        when (sport) {
            SportMode.Run -> GoalSettingsDialog(
                runWeekTarget = runWeekTarget,
                dplusWeekTarget = dplusWeekTarget,
                runYearTarget = runYearTarget,
                onConfirm = { rw, dp, ry -> runWeekTarget = rw; dplusWeekTarget = dp; runYearTarget = ry; showGoalDialogSport = null },
                onDismiss = { showGoalDialogSport = null }
            )
            SportMode.Bike -> SimpleGoalDialog(
                title = stringResource(R.string.cockpit_goals_bike_title), sport = SportMode.Bike,
                weekTarget = bikeWeekTarget, yearTarget = bikeYearTarget,
                onConfirm = { w, y -> bikeWeekTarget = w; bikeYearTarget = y; showGoalDialogSport = null },
                onDismiss = { showGoalDialogSport = null }
            )
            SportMode.Swim -> SimpleGoalDialog(
                title = stringResource(R.string.cockpit_goals_swim_title), sport = SportMode.Swim,
                weekTarget = swimWeekTarget, yearTarget = swimYearTarget,
                onConfirm = { w, y -> swimWeekTarget = w; swimYearTarget = y; showGoalDialogSport = null },
                onDismiss = { showGoalDialogSport = null }
            )
        }
    }

    if (showGoalDialogAll) {
        var yearStr by remember { mutableStateOf(allYearTarget.toString()) }
        AlertDialog(
            onDismissRequest = { showGoalDialogAll = false },
            containerColor = TrailColors.CardBg,
            titleContentColor = TrailColors.Text,
            textContentColor = TrailColors.Text,
            title = { Text(stringResource(R.string.cockpit_goals_annual_km), fontWeight = FontWeight.Bold, fontSize = 16.sp) },
            text = { GoalField(stringResource(R.string.cockpit_goals_all_km), yearStr) { yearStr = it } },
            confirmButton = {
                TextButton(onClick = { allYearTarget = yearStr.toIntOrNull() ?: allYearTarget; showGoalDialogAll = false }) {
                    Text("Valider", color = TrailColors.ChargeOrange, fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = { TextButton(onClick = { showGoalDialogAll = false }) { Text("Annuler", color = TrailColors.SubtleText) } }
        )
    }

    if (showChartPeriodPicker) {
        ChartPeriodDialog(
            current = chartPeriod,
            onSelect = { chartPeriod = it; showChartPeriodPicker = false },
            onDismiss = { showChartPeriodPicker = false }
        )
    }

    if (showAddBlockDialog) {
        AddBlockDialog(
            hiddenBlockTypes = hiddenBlockTypes,
            onSelect = { blockType ->
                showAddBlockDialog = false
                onConfigureBlockType(blockType)
            },
            onDismiss = { showAddBlockDialog = false }
        )
    }

    val typeGroups: List<Pair<BlockType, List<CockpitBlock>>> = run {
        val groups = LinkedHashMap<BlockType, MutableList<CockpitBlock>>()
        visibleBlocks.forEach { groups.getOrPut(it.type) { mutableListOf() }.add(it) }
        groups.entries.map { it.key to it.value.toList() }
    }

    val lazyListState = scrollState
    val reorderState = rememberReorderableLazyListState(lazyListState) { from, to ->
        val currentGroups = LinkedHashMap<BlockType, MutableList<CockpitBlock>>()
        visibleBlocks.forEach { currentGroups.getOrPut(it.type) { mutableListOf() }.add(it) }
        val groupList = currentGroups.entries.toMutableList()
        if (from.index in groupList.indices && to.index in groupList.indices) {
            val moved = groupList.removeAt(from.index)
            groupList.add(to.index, moved)
            val newFlat = groupList.flatMap { it.value }
            visibleBlocks.clear()
            visibleBlocks.addAll(newFlat)
        }
    }

    val currentYear = LocalDate.now().year.toString()
    val monthNames = (1..12).map { i -> java.time.Month.of(i).getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.getDefault()) }
    val dayLabels = listOf("L", "M", "M", "J", "V", "S", "D")
    val monthLetters = listOf("J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D")

    LazyColumn(
        state = lazyListState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(typeGroups, key = { "grp_${it.first.name}" }) { (groupType, variants) ->
            ReorderableItem(reorderState, key = "grp_${groupType.name}") { isDragging ->
                val alpha by animateFloatAsState(if (isDragging) 0.75f else 1f, label = "drag-alpha")
                val pagerState = rememberPagerState(initialPage = 0) { variants.size.coerceAtLeast(1) }
                LaunchedEffect(variants.size) {
                    if (variants.isNotEmpty() && pagerState.currentPage >= variants.size) {
                        pagerState.scrollToPage(variants.size - 1)
                    }
                }
                Column(Modifier.fillMaxWidth().alpha(alpha).longPressDraggableHandle()) {
                  HorizontalPager(state = pagerState, modifier = Modifier.fillMaxWidth()) { pageIdx ->
                    val block = variants.getOrNull(pageIdx) ?: return@HorizontalPager
                    val sport = block.sport
                    Box(Modifier.fillMaxWidth()) {
                    when (block.type) {
                        BlockType.Kpis -> {
                            val kmWeek = when (sport) {
                                SportMode.Run -> overview.runKm
                                SportMode.Bike -> overview.bikeKm
                                SportMode.Swim -> overview.swimKm
                                null -> overview.runKm + overview.bikeKm + overview.swimKm
                            }
                            val sessionsWeek = when (sport) {
                                SportMode.Run -> overview.runSessions
                                SportMode.Bike -> overview.bikeSessions
                                SportMode.Swim -> overview.swimSessions
                                null -> overview.runSessions + overview.bikeSessions + overview.swimSessions
                            }
                            val dPlusWeek = when (sport) {
                                SportMode.Run -> overview.runDPlus
                                SportMode.Bike -> overview.bikeDPlus
                                null -> overview.runDPlus + overview.bikeDPlus
                                else -> 0
                            }
                            val kmYtd = when (sport) {
                                SportMode.Run -> ytd.runKm
                                SportMode.Bike -> ytd.bikeKm
                                SportMode.Swim -> ytd.swimKm
                                null -> ytd.runKm + ytd.bikeKm + ytd.swimKm
                            }
                            val dPlusYtd = when (sport) {
                                SportMode.Run -> ytd.runDPlus
                                SportMode.Bike -> ytd.bikeDPlus
                                null -> ytd.runDPlus + ytd.bikeDPlus
                                else -> 0
                            }
                            val weekKmRaw = when (sport) {
                                SportMode.Run -> weekSessions.map { it.volumeKm.toFloat() }
                                SportMode.Bike -> bikeWeekDailyKm.map { it.toFloat() }
                                SportMode.Swim -> swimWeekDailyKm.map { it.toFloat() }
                                null -> weekSessions.mapIndexed { i, s ->
                                    s.volumeKm.toFloat() + bikeWeekDailyKm.getOrElse(i) { 0.0 }.toFloat() + swimWeekDailyKm.getOrElse(i) { 0.0 }.toFloat()
                                }
                            }
                            val weekKmMax = weekKmRaw.maxOrNull()?.takeIf { it > 0f } ?: 1f
                            val weekKmNorm = weekKmRaw.map { it / weekKmMax }
                            val weekKmLabels = weekKmRaw.map { if (it > 0f) format1(it.toDouble()) else "" }
                            val weekDplusRaw = when (sport) {
                                SportMode.Run -> weekSessions.map { it.denivelePos.toFloat() }
                                null -> weekSessions.map { it.denivelePos.toFloat() }
                                else -> List(7) { 0f }
                            }
                            val weekDplusMax = weekDplusRaw.maxOrNull()?.takeIf { it > 0f } ?: 1f
                            val weekDplusNorm = weekDplusRaw.map { it / weekDplusMax }
                            val weekDplusLabels = weekDplusRaw.map { if (it > 0f) it.toInt().toString() else "" }
                            val monthlyKmRaw = when (sport) {
                                SportMode.Run -> (1..12).map { m -> weekly.filter { it.weekLabel.split("-").getOrNull(1)?.toIntOrNull() == m }.sumOf { it.km }.toFloat() }
                                SportMode.Bike -> bikeMonthlyKm.map { it.toFloat() }.let { if (it.size >= 12) it.take(12) else it + List(12 - it.size) { 0f } }
                                SportMode.Swim -> swimMonthlyKm.map { it.toFloat() }.let { if (it.size >= 12) it.take(12) else it + List(12 - it.size) { 0f } }
                                null -> (1..12).map { m ->
                                    weekly.filter { it.weekLabel.split("-").getOrNull(1)?.toIntOrNull() == m }.sumOf { it.km }.toFloat() +
                                        bikeMonthlyKm.getOrElse(m - 1) { 0.0 }.toFloat() +
                                        swimMonthlyKm.getOrElse(m - 1) { 0.0 }.toFloat()
                                }
                            }
                            val monthlyKmMax = monthlyKmRaw.maxOrNull()?.takeIf { it > 0f } ?: 1f
                            val monthlyKmNorm = monthlyKmRaw.map { it / monthlyKmMax }
                            val monthlyKmLabels = monthlyKmRaw.map { if (it > 0f) "%.0f".format(it) else "" }
                            val tsbLast7Raw = weekly.takeLast(7).map { it.tsb.toFloat() }
                            val tsbMin = tsbLast7Raw.minOrNull() ?: 0f
                            val tsbMaxVal = tsbLast7Raw.maxOrNull() ?: 1f
                            val tsbRange = (tsbMaxVal - tsbMin).takeIf { it > 0f } ?: 1f
                            val tsbLast7Norm = tsbLast7Raw.map { (it - tsbMin) / tsbRange }
                            val tsbLabels = tsbLast7Raw.map { it.toInt().toString() }
                            val sportColor = when (sport) {
                                SportMode.Run -> TrailColors.ChargeOrange
                                SportMode.Bike -> TrailColors.GreenOk
                                SportMode.Swim -> TrailColors.SeriesBlue
                                null -> TrailColors.ChargeOrange
                            }

                            SectionCard {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        Text(stringResource(R.string.cockpit_activites_label), color = TrailColors.SubtleText, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                                        Text(sport?.let { stringResource(it.labelRes) } ?: stringResource(R.string.common_label_all), color = sportColor, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                                        Text(sport?.icon ?: "⚡", fontSize = 16.sp)
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        TsbBadge(ytd.tsb)
                                        BlockMoreIcon(onClick = { onConfigureBlockType(groupType) })
                                    }
                                }
                                Spacer(Modifier.height(6.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    CockpitKpiTile("", "SEMAINE", "$sessionsWeek séances", weekKmNorm, weekKmLabels, sportColor, Modifier.weight(1f)) {
                                        Row(verticalAlignment = Alignment.Bottom) {
                                            Text(format1(kmWeek), color = TrailColors.Text, fontWeight = FontWeight.Black, fontSize = 21.sp)
                                            Spacer(Modifier.width(3.dp))
                                            Text("km", color = TrailColors.SubtleText, fontSize = 14.sp)
                                        }
                                    }
                                    CockpitKpiTile("", "D+ SEMAINE", "D+ semaine", weekDplusNorm, weekDplusLabels, TrailColors.SeriesBlue, Modifier.weight(1f)) {
                                        Row(verticalAlignment = Alignment.Bottom) {
                                            Text(dPlusWeek.toString(), color = TrailColors.Text, fontWeight = FontWeight.Black, fontSize = 21.sp)
                                            Spacer(Modifier.width(3.dp))
                                            Text("m", color = TrailColors.SubtleText, fontSize = 14.sp)
                                        }
                                    }
                                }
                                Spacer(Modifier.height(6.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    CockpitKpiTile("", "ANNÉE", "D+ $dPlusYtd m", monthlyKmNorm, monthlyKmLabels, sportColor, Modifier.weight(1f)) {
                                        Row(verticalAlignment = Alignment.Bottom) {
                                            Text(format1(kmYtd), color = TrailColors.Text, fontWeight = FontWeight.Black, fontSize = 20.sp)
                                            Spacer(Modifier.width(3.dp))
                                            Text("km", color = TrailColors.SubtleText, fontSize = 14.sp)
                                        }
                                    }
                                    CockpitKpiTile("⚡", "CHARGE (RUN)", "TSB ${ytd.tsb} • LAST 7 DAYS", tsbLast7Norm, tsbLabels, TrailColors.SeriesYellow, Modifier.weight(1f)) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text("ATL ", color = TrailColors.ChargeOrange, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                            Text(ytd.atl.toString(), color = TrailColors.ChargeOrange, fontWeight = FontWeight.Black, fontSize = 21.sp)
                                            Text(" • ", color = TrailColors.SubtleText, fontSize = 13.sp)
                                            Text("CTL ", color = TrailColors.SeriesBlue, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                            Text(ytd.ctl.toString(), color = TrailColors.SeriesBlue, fontWeight = FontWeight.Black, fontSize = 21.sp)
                                        }
                                    }
                                }
                            }
                        }

                        BlockType.Goals -> SectionCard {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    SectionTitle("Objectifs —")
                                    Text(
                                        text = if (sport != null) "${sport.icon} ${stringResource(sport.labelRes)}" else "⚡ Toutes activités",
                                        color = TrailColors.ChargeOrange, fontWeight = FontWeight.SemiBold, fontSize = 15.sp
                                    )
                                }
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Icon(Icons.Default.Settings, "Régler", tint = TrailColors.SubtleText,
                                        modifier = Modifier.size(16.dp).clickable {
                                            if (sport != null) showGoalDialogSport = sport else showGoalDialogAll = true
                                        }
                                    )
                                    BlockMoreIcon(onClick = { onConfigureBlockType(groupType) })
                                }
                            }
                            Spacer(Modifier.height(6.dp))
                            when (sport) {
                                SportMode.Run -> {
                                    GoalProgressRow("Distance (semaine)", overview.runKm, runWeekTarget.toDouble(), "km", TrailColors.ChargeOrange)
                                    Spacer(Modifier.height(6.dp))
                                    GoalProgressRow("Dénivelé + (semaine)", overview.runDPlus.toDouble(), dplusWeekTarget.toDouble(), "m", TrailColors.SeriesBlue)
                                    Spacer(Modifier.height(6.dp))
                                    GoalProgressRow("Distance (année)", ytd.runKm, runYearTarget.toDouble(), "km", TrailColors.GreenOk)
                                }
                                SportMode.Bike -> {
                                    GoalProgressRow("Distance (semaine)", overview.bikeKm, bikeWeekTarget.toDouble(), "km", TrailColors.ChargeOrange)
                                    Spacer(Modifier.height(6.dp))
                                    GoalProgressRow("Dénivelé + (semaine)", overview.bikeDPlus.toDouble(), 0.0, "m", TrailColors.SeriesBlue)
                                    Spacer(Modifier.height(6.dp))
                                    GoalProgressRow("Distance (année)", ytd.bikeKm, bikeYearTarget.toDouble(), "km", TrailColors.GreenOk)
                                }
                                SportMode.Swim -> {
                                    GoalProgressRow("Distance (semaine)", overview.swimKm, swimWeekTarget.toDouble(), "km", TrailColors.ChargeOrange)
                                    Spacer(Modifier.height(6.dp))
                                    GoalProgressRow("Distance (année)", ytd.swimKm, swimYearTarget.toDouble(), "km", TrailColors.GreenOk)
                                }
                                null -> {
                                    val totalKmYtd = ytd.runKm + ytd.bikeKm + ytd.swimKm
                                    val totalKmWeek = overview.runKm + overview.bikeKm + overview.swimKm
                                    GoalProgressRow("Distance semaine (toutes act.)", totalKmWeek, 0.0, "km", TrailColors.ChargeOrange)
                                    Spacer(Modifier.height(6.dp))
                                    GoalProgressRow("Distance année (toutes act.)", totalKmYtd, allYearTarget.toDouble(), "km", TrailColors.GreenOk)
                                }
                            }
                        }

                        BlockType.Chart -> {
                            val chartTitleColor = when (sport) {
                                SportMode.Run -> TrailColors.ChargeOrange
                                SportMode.Bike -> TrailColors.GreenOk
                                SportMode.Swim -> TrailColors.SeriesBlue
                                null -> TrailColors.ChargeOrange
                            }
                            val chartTitleLabel = when (sport) {
                                SportMode.Run -> "RUN"; SportMode.Bike -> "VÉLO"; SportMode.Swim -> "NATATION"
                                null -> "TOTAL"
                            }
                            val chartPoints = when (sport) {
                                SportMode.Run -> when (chartPeriod) {
                                    ChartPeriod.Week -> weekly.takeLast(10).map { Triple(shortWeekLabel(it.weekLabel), it.km, it.dPlus.toDouble()) }
                                    ChartPeriod.Month -> weekly.groupBy { it.weekLabel.substring(0, 7) }.entries.sortedBy { it.key }.takeLast(12).map { (k, v) -> Triple(monthShortLabel(k), v.sumOf { it.km }, v.sumOf { it.dPlus.toDouble() }) }
                                    ChartPeriod.MonthYear -> weekly.filter { it.weekLabel.startsWith(currentYear) }.groupBy { it.weekLabel.substring(0, 7) }.entries.sortedBy { it.key }.map { (k, v) -> Triple(monthShortLabel(k), v.sumOf { it.km }, v.sumOf { it.dPlus.toDouble() }) }
                                }
                                SportMode.Bike -> bikeMonthlyKm.take(12).mapIndexed { i, km -> Triple(monthNames.getOrElse(i) { "${i+1}" }, km, 0.0) }
                                SportMode.Swim -> swimMonthlyKm.take(12).mapIndexed { i, km -> Triple(monthNames.getOrElse(i) { "${i+1}" }, km, 0.0) }
                                null -> (0..11).map { i ->
                                    val runKm = weekly.filter { it.weekLabel.split("-").getOrNull(1)?.toIntOrNull() == i + 1 }.sumOf { it.km }
                                    Triple(monthNames.getOrElse(i) { "${i+1}" }, runKm + bikeMonthlyKm.getOrElse(i) { 0.0 } + swimMonthlyKm.getOrElse(i) { 0.0 }, 0.0)
                                }
                            }
                            val period10w = stringResource(R.string.cockpit_period_10w)
                            val period12m = stringResource(R.string.cockpit_period_12m)
                            val periodLabel = if (sport == SportMode.Run) when (chartPeriod) {
                                ChartPeriod.Week -> period10w; ChartPeriod.Month -> period12m; ChartPeriod.MonthYear -> "mois $currentYear"
                            } else period12m

                            ChartCard(title = "", minHeight = 220.dp, titleSlot = {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text("$chartTitleLabel km", color = chartTitleColor, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                        if (sport == SportMode.Run) {
                                            Text(" / ", color = TrailColors.SubtleText, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                                            Text("D+", color = TrailColors.SeriesBlue, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                        }
                                        Text(" — $periodLabel", color = TrailColors.SubtleText, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        if (sport == SportMode.Run) {
                                            Icon(Icons.Default.Settings, stringResource(R.string.cockpit_chart_period), tint = TrailColors.SubtleText,
                                                modifier = Modifier.size(16.dp).clickable { showChartPeriodPicker = true })
                                        }
                                        BlockMoreIcon(onClick = { onConfigureBlockType(groupType) })
                                    }
                                }
                            }) {
                                ComboBarLineChart(
                                    xLabels = chartPoints.map { it.first },
                                    barValues = chartPoints.map { it.third },
                                    lineValues = chartPoints.map { it.second },
                                    barColor = TrailColors.SeriesBlue,
                                    lineColor = chartTitleColor,
                                    xLabelEveryN = 1
                                )
                            }
                        }

                        BlockType.KmDPlus -> SectionCard {
                            val totalKmWeek = overview.runKm + overview.bikeKm + overview.swimKm
                            val totalDPlusWeek = overview.runDPlus + overview.bikeDPlus
                            val totalKmYtd = ytd.runKm + ytd.bikeKm + ytd.swimKm
                            val totalDPlusYtd = ytd.runDPlus + ytd.bikeDPlus
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text(stringResource(R.string.cockpit_toutes_activites_title), color = TrailColors.SubtleText, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                                BlockMoreIcon(onClick = { onConfigureBlockType(groupType) })
                            }
                            Spacer(Modifier.height(10.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                CompactMetricCard("km semaine", totalKmWeek.toInt(), "Distance totale", TrailColors.ChargeOrange, Modifier.weight(1f))
                                CompactMetricCard("m semaine", totalDPlusWeek, "D+ cumulé", TrailColors.SeriesBlue, Modifier.weight(1f))
                            }
                            Spacer(Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                CompactMetricCard("km année", totalKmYtd.toInt(), "Distance YTD", TrailColors.ChargeOrange, Modifier.weight(1f))
                                CompactMetricCard("m année", totalDPlusYtd, "D+ YTD", TrailColors.SeriesBlue, Modifier.weight(1f))
                            }
                        }

                        BlockType.CumulMonths -> {
                            val cumulData = getCumulativeMonthsData(sport, activities, bikeMonthlyKm, swimMonthlyKm)
                            val monthLabels = (1..4).map { i -> "${java.time.Month.of(i).getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.getDefault())} 2025" }
                            val monthColors = listOf(TrailColors.SeriesGreen, TrailColors.SeriesOrange, TrailColors.SeriesRed, TrailColors.SeriesBlue)
                            ChartCard(title = "", minHeight = 280.dp, titleSlot = {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text("${stringResource(R.string.cockpit_cumul_months_title)} — ${sport?.let { stringResource(it.labelRes) } ?: stringResource(R.string.block_all_activities)}", color = TrailColors.ChargeOrange, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                    BlockMoreIcon(onClick = { onConfigureBlockType(groupType) })
                                }
                            }) {
                                Column(modifier = Modifier.fillMaxSize()) {
                                    Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                                        LineChart(
                                            xLabels = cumulData.xLabels,
                                            series = cumulData.series,
                                            xLabelEveryN = 1
                                        )
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        monthLabels.forEachIndexed { i, label ->
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                                modifier = Modifier.weight(1f)
                                            ) {
                                                Box(
                                                    modifier = Modifier
                                                        .width(12.dp)
                                                        .height(3.dp)
                                                        .background(monthColors[i])
                                                )
                                                Text(label, fontSize = 13.sp, color = TrailColors.SubtleText)
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        BlockType.Load -> SectionCard {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                SectionTitle(stringResource(R.string.charge_training_load))
                                BlockMoreIcon(onClick = { onConfigureBlockType(groupType) })
                            }
                            Spacer(Modifier.height(10.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                CompactMetricCard("ATL", overview.runSuffer / 5, stringResource(R.string.charge_fatigue_7d), TrailColors.ChargeOrange, Modifier.weight(1f))
                                CompactMetricCard("CTL", ytd.ctl, stringResource(R.string.charge_fitness_28d), TrailColors.SeriesBlue, Modifier.weight(1f))
                            }
                            Spacer(Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                CompactMetricCard("TSB", ytd.tsb, stringResource(R.string.charge_form_label), if (ytd.tsb >= 0) TrailColors.GreenOk else TrailColors.RunRed, Modifier.weight(1f))
                                CompactMetricCard("Suffer", overview.runSuffer, stringResource(R.string.charge_weekly_short), TrailColors.SeriesYellow, Modifier.weight(1f))
                            }
                        }

                        BlockType.Days -> {
                            var showHistoryPeriodDialog by remember { mutableStateOf(false) }
                            var historyPeriod by remember { mutableStateOf("Semaine") }

                            data class PillData(val label: String, val km: Double, val dPlus: Int, val suffer: Int)

                            val pillItems: List<PillData> = when (historyPeriod) {
                                "Semaine" -> when (sport) {
                                    SportMode.Run -> weekSessions.map { PillData(it.day.take(1).uppercase(), it.volumeKm, it.denivelePos, it.suffer) }
                                    SportMode.Bike -> bikeWeekDailyKm.mapIndexed { i, km -> PillData(dayLabels.getOrElse(i) { "?" }, km, 0, 0) }
                                    SportMode.Swim -> swimWeekDailyKm.mapIndexed { i, km -> PillData(dayLabels.getOrElse(i) { "?" }, km, 0, 0) }
                                    null -> weekSessions.mapIndexed { i, s ->
                                        PillData(s.day.take(1).uppercase(),
                                            s.volumeKm + bikeWeekDailyKm.getOrElse(i) { 0.0 } + swimWeekDailyKm.getOrElse(i) { 0.0 },
                                            s.denivelePos, s.suffer)
                                    }
                                }
                                "Mois" -> when (sport) {
                                    SportMode.Run -> weekly.takeLast(5).map { wp ->
                                        val short = if (wp.weekLabel.length >= 10) "${wp.weekLabel.substring(8, 10)}/${wp.weekLabel.substring(5, 7)}" else wp.weekLabel
                                        PillData(short, wp.km, wp.dPlus, wp.suffer)
                                    }
                                    SportMode.Bike -> { val labels = listOf(stringResource(R.string.stats_n4),stringResource(R.string.stats_n3),stringResource(R.string.stats_n2),stringResource(R.string.stats_n1),stringResource(R.string.stats_current_week)); bikeMonthlyKm.takeLast(5).mapIndexed { i, km -> PillData(labels.getOrElse(i) { "?" }, km, 0, 0) } }
                                    SportMode.Swim -> { val labels = listOf(stringResource(R.string.stats_n4),stringResource(R.string.stats_n3),stringResource(R.string.stats_n2),stringResource(R.string.stats_n1),stringResource(R.string.stats_current_week)); swimMonthlyKm.takeLast(5).mapIndexed { i, km -> PillData(labels.getOrElse(i) { "?" }, km, 0, 0) } }
                                    null -> weekly.takeLast(5).map { wp ->
                                        val short = if (wp.weekLabel.length >= 10) "${wp.weekLabel.substring(8, 10)}/${wp.weekLabel.substring(5, 7)}" else wp.weekLabel
                                        PillData(short, wp.km, wp.dPlus, wp.suffer)
                                    }
                                }
                                "Année" -> when (sport) {
                                    SportMode.Run -> {
                                        val grouped = weekly.groupBy { wp -> wp.weekLabel.substring(5, 7).toIntOrNull()?.minus(1) ?: 0 }
                                        (0..11).map { month -> val pts = grouped[month] ?: emptyList(); PillData(monthLetters[month], pts.sumOf { it.km }, pts.sumOf { it.dPlus }, pts.sumOf { it.suffer }) }
                                    }
                                    SportMode.Bike -> bikeMonthlyKm.mapIndexed { i, km -> PillData(monthLetters.getOrElse(i) { "?" }, km, 0, 0) }
                                    SportMode.Swim -> swimMonthlyKm.mapIndexed { i, km -> PillData(monthLetters.getOrElse(i) { "?" }, km, 0, 0) }
                                    null -> {
                                        val grouped = weekly.groupBy { wp -> wp.weekLabel.substring(5, 7).toIntOrNull()?.minus(1) ?: 0 }
                                        (0..11).map { month ->
                                            val pts = grouped[month] ?: emptyList()
                                            PillData(monthLetters[month],
                                                pts.sumOf { it.km } + bikeMonthlyKm.getOrElse(month) { 0.0 } + swimMonthlyKm.getOrElse(month) { 0.0 },
                                                pts.sumOf { it.dPlus }, pts.sumOf { it.suffer })
                                        }
                                    }
                                }
                                else -> emptyList()
                            }

                            if (showHistoryPeriodDialog) {
                                AlertDialog(
                                    onDismissRequest = { showHistoryPeriodDialog = false },
                                    title = { Text(stringResource(R.string.cockpit_period_label), color = TrailColors.Text) },
                                    text = {
                                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            listOf("Semaine", "Mois", "Année").forEach { period ->
                                                Row(
                                                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
                                                        .background(if (historyPeriod == period) TrailColors.ChargeOrange.copy(alpha = 0.15f) else Color.Transparent)
                                                        .clickable { historyPeriod = period; showHistoryPeriodDialog = false }
                                                        .padding(horizontal = 12.dp, vertical = 10.dp),
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.SpaceBetween
                                                ) {
                                                    Text(period, color = if (historyPeriod == period) TrailColors.ChargeOrange else TrailColors.Text,
                                                        fontWeight = if (historyPeriod == period) FontWeight.SemiBold else FontWeight.Normal, fontSize = 15.sp)
                                                    if (historyPeriod == period) Icon(Icons.Filled.Bolt, null, tint = TrailColors.ChargeOrange, modifier = Modifier.size(16.dp))
                                                }
                                            }
                                        }
                                    },
                                    confirmButton = {},
                                    containerColor = TrailColors.Surface,
                                    titleContentColor = TrailColors.Text
                                )
                            }

                            SectionCard {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Text(stringResource(R.string.cockpit_historique), color = TrailColors.SubtleText, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                                        Text(sport?.let { stringResource(it.labelRes) } ?: stringResource(R.string.block_all_activities), color = TrailColors.ChargeOrange, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                                        if (sport != null) Text(sport.icon, fontSize = 15.sp)
                                    }
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Icon(Icons.Filled.Settings, stringResource(R.string.cockpit_period_label), tint = TrailColors.SubtleText,
                                            modifier = Modifier.size(18.dp).clickable { showHistoryPeriodDialog = true })
                                        BlockMoreIcon(onClick = { onConfigureBlockType(groupType) })
                                    }
                                }
                                Spacer(Modifier.height(10.dp))
                                Row(
                                    modifier = if (historyPeriod == "Année") Modifier.horizontalScroll(rememberScrollState()) else Modifier,
                                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                                ) {
                                    pillItems.forEach { pill ->
                                        HistoryPill(pill.label, pill.km, pill.dPlus, pill.suffer,
                                            modifier = if (historyPeriod == "Année") Modifier.width(44.dp) else Modifier.weight(1f))
                                    }
                                }
                            }
                        }

                        BlockType.Intensity -> {
                            val colorMap = mapOf(
                                "Runtaf" to TrailColors.PieRuntaf, "VMA" to TrailColors.PieVma,
                                "Seuil" to TrailColors.PieSeuil, "Côtes" to TrailColors.PieCotes,
                                "Sortie longue" to TrailColors.PieSortieLongue,
                                "Footing / EF" to TrailColors.PieFooting, "Autre" to TrailColors.PieAutre
                            )
                            val slices = intensityBreakdown.filter { it.km > 0 }.map { PieSlice(it.label, it.km, colorMap[it.label] ?: TrailColors.PieAutre) }
                            SectionCard {
                                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Text(stringResource(R.string.charge_intensity_run_title), color = TrailColors.SubtleText, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                                    BlockMoreIcon(onClick = { onConfigureBlockType(groupType) })
                                }
                                Spacer(Modifier.height(10.dp))
                                PieChart(slices = slices, modifier = Modifier.fillMaxWidth())
                            }
                        }

                        BlockType.CurrentWeek -> SectionCard {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                SectionTitle("Semaine en cours")
                                BlockMoreIcon(onClick = { onConfigureBlockType(groupType) })
                            }
                            Spacer(Modifier.height(10.dp))
                            weekSessions.forEach { session ->
                                PlanSessionRow(session)
                            }
                        }

                        BlockType.Strava -> SectionCard {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                SectionTitle("Sync Strava")
                                BlockMoreIcon(onClick = { onConfigureBlockType(groupType) })
                            }
                            Spacer(Modifier.height(8.dp))
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(if (connected) stringResource(R.string.cockpit_strava_connected) else stringResource(R.string.cockpit_strava_pending), color = TrailColors.Text, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                    Spacer(Modifier.height(3.dp))
                                    Text(authEvent ?: if (connected) stringResource(R.string.cockpit_sync_ready) else "On garde ce draft, puis on branche l'OAuth Strava réel.",
                                        color = TrailColors.SubtleText, fontSize = 11.sp)
                                }
                                Spacer(Modifier.width(8.dp))
                                Column(horizontalAlignment = Alignment.End) {
                                    ActionChip(label = if (connected) "Reconnecter" else "Connecter", active = true, onClick = onConnectStrava)
                                    if (connected) {
                                        Spacer(Modifier.height(4.dp))
                                        ActionChip(label = "Sync", active = true, onClick = onSyncStrava)
                                    }
                                }
                            }
                        }
                    }
                    }
                  }
                  if (variants.size > 1) {
                      Spacer(Modifier.height(4.dp))
                      PagerDotsRow(pageCount = variants.size, currentPage = pagerState.currentPage)
                  }
                }
            }
        }
        if (hiddenBlockTypes.isNotEmpty()) {
            item("add_block") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(TrailColors.CardBg)
                        .border(1.dp, TrailColors.Border, RoundedCornerShape(10.dp))
                        .clickable { showAddBlockDialog = true }
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Filled.Add,
                        contentDescription = null,
                        tint = TrailColors.SubtleText,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        stringResource(R.string.cockpit_add_block),
                        color = TrailColors.SubtleText,
                        fontSize = 14.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun StatsTab(
    metric: StatsMetric,
    onMetricChange: (StatsMetric) -> Unit,
    weekly: List<WeeklyPoint>
) {
    val chartValues = when (metric) {
        StatsMetric.Km -> weekly.map { it.km }
        StatsMetric.DPlus -> weekly.map { it.dPlus.toDouble() }
        StatsMetric.Suffer -> weekly.map { it.suffer.toDouble() }
        StatsMetric.Tsb -> weekly.map { it.tsb.toDouble() }
    }
    val chartColor = when (metric) {
        StatsMetric.Km -> TrailColors.ChargeOrange
        StatsMetric.DPlus -> TrailColors.SeriesBlue
        StatsMetric.Suffer -> TrailColors.SeriesYellow
        StatsMetric.Tsb -> TrailColors.GreenOk
    }
    val title = when (metric) {
        StatsMetric.Km -> "Volume (km)"
        StatsMetric.DPlus -> "D+ hebdo (m)"
        StatsMetric.Suffer -> "Charge Suffer"
        StatsMetric.Tsb -> "TSB Forme / Fatigue"
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                StatsMetric.entries.forEach { option ->
                    ActionChip(
                        label = option.label,
                        active = option == metric,
                        onClick = { onMetricChange(option) }
                    )
                }
            }
        }
        item {
            ChartCard(title = title, minHeight = 220.dp) {
                BarChart(
                    xLabels = weekly.map { shortWeekLabel(it.weekLabel) },
                    values = chartValues,
                    color = chartColor,
                    xLabelEveryN = 1,
                    showValueLabels = false
                )
            }
        }
        item {
            SectionCard {
                SectionTitle(stringResource(R.string.cockpit_period_16w))
                Spacer(Modifier.height(8.dp))
                weekly.asReversed().forEach { point ->
                    WeekRecapRow(point)
                }
            }
        }
    }
}

@Composable
private fun LoadTab(
    activities: List<ActivityDraft>
) {
    val daily = remember(activities) { TrainingLoadCalculator.aggregateActivitiesByDay(activities) }
    val weekly = remember(activities) { TrainingLoadCalculator.aggregateActivitiesByWeek(activities) }
    val status = remember(weekly) { TrainingLoadCalculator.computeStatus(weekly) }
    val xLabels = daily.map { shortDayLabel(it.dateLabel) }
    val fatigueByDay = daily.map { it.fatigue7d }  // Weighted 7-day fatigue (carries over rest days)
    val freshnessColors = status.freshnessSeries.map { v ->
        when {
            v >= 10.0 -> TrailColors.SeriesBlue
            v >= 0.0 -> TrailColors.GreenOk
            v >= -10.0 -> TrailColors.SeriesYellow
            else -> TrailColors.RunRed
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            ChartCard(title = stringResource(R.string.charge_weekly_title), minHeight = 200.dp) {
                AreaChart(
                    xLabels = xLabels,
                    values = fatigueByDay,
                    xLabelEveryN = 2
                )
            }
        }
        item { StatusCard(status) }
        item {
            ChartCard(title = stringResource(R.string.charge_fatigue_fitness_title), minHeight = 220.dp) {
                LineChart(
                    xLabels = xLabels,
                    series = listOf(
                        LineSeries(stringResource(R.string.charge_recent_fatigue), TrailColors.ChargeOrange, status.fatigueSeries, drawPoints = false, valueLabels = false),
                        LineSeries(stringResource(R.string.charge_training_capacity), TrailColors.SeriesBlue, status.fitnessSeries, drawPoints = false, valueLabels = false)
                    ),
                    xLabelEveryN = 2
                )
            }
        }
        item {
            ChartCard(title = stringResource(R.string.charge_freshness_title), minHeight = 200.dp) {
                BarChart(
                    xLabels = xLabels,
                    values = status.freshnessSeries,
                    colors = freshnessColors,
                    xLabelEveryN = 2,
                    showValueLabels = false,
                    allowNegative = true
                )
            }
        }
        item {
            ChartCard(title = stringResource(R.string.charge_intensity_title), minHeight = 220.dp) {
                val colorMap = mapOf(
                    "Runtaf" to TrailColors.PieRuntaf,
                    "VMA" to TrailColors.PieVma,
                    "Seuil" to TrailColors.PieSeuil,
                    "Côtes" to TrailColors.PieCotes,
                    "Sortie longue" to TrailColors.PieSortieLongue,
                    "Footing / EF" to TrailColors.PieFooting,
                    "Autre" to TrailColors.PieAutre
                )
                val slices = SampleData.intensities.mapNotNull { share ->
                    val color = colorMap[share.label] ?: TrailColors.PieAutre
                    if (share.km > 0) PieSlice(share.label, share.km, color) else null
                }
                PieChart(slices = slices, modifier = Modifier.fillMaxWidth())
            }
        }
    }
}

@Composable
private fun StatusCard(status: TrainingStatus) {
    SectionCard {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                SectionTitle(stringResource(R.string.charge_form_state))
                Spacer(Modifier.height(4.dp))
                Text(
                    text = statusRecommendation(status.status),
                    color = TrailColors.SubtleText,
                    fontSize = 11.sp,
                    lineHeight = 16.sp
                )
            }
            StatusPill(status.status, status.freshness)
        }
    }
}

@Composable
private fun StatusPill(status: String, freshness: Double) {
    val pillColor = when (status) {
        "Frais" -> TrailColors.SeriesBlue
        "Équilibré" -> TrailColors.GreenOk
        "Chargé" -> TrailColors.SeriesYellow
        "Surchargé" -> TrailColors.RunRed
        else -> TrailColors.SubtleText
    }
    Row(
        Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(pillColor.copy(alpha = 0.15f))
            .border(1.dp, pillColor.copy(alpha = 0.5f), RoundedCornerShape(20.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(status, color = pillColor, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        if (freshness > -100 && freshness < 100) {
            Spacer(Modifier.width(6.dp))
            Text(
                String.format(java.util.Locale.US, "%.0f", freshness),
                color = pillColor,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun statusRecommendation(status: String): String {
    return when (status) {
        "Frais" -> stringResource(R.string.charge_well_rested)
        "Équilibré" -> stringResource(R.string.charge_balanced_msg)
        "Chargé" -> stringResource(R.string.charge_rising_fatigue)
        "Surchargé" -> stringResource(R.string.charge_overloaded_msg)
        else -> stringResource(R.string.charge_insufficient_data)
    }
}

@Composable
private fun PlanTab(
    cycles: List<CycleDraft>
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            SectionCard {
                SectionTitle("Structure de prépa")
                Spacer(Modifier.height(10.dp))
                cycles.forEach { cycle ->
                    CycleRow(cycle)
                    Spacer(Modifier.height(8.dp))
                }
            }
        }
    }
}

@Composable
private fun ActivityCard(
    activity: ActivityDraft,
    onEditActivity: (ActivityDraft) -> Unit,
    onOpenActivity: (ActivityDraft) -> Unit
) {
    SectionCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clickable { onOpenActivity(activity) }
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TypeBadge(activity.type)
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = "${formatActivityDate(activity.startedAtLocal)} • ${formatActivityTime(activity.startedAtLocal)}",
                        color = TrailColors.SubtleText,
                        fontSize = 14.sp
                    )
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = activity.name,
                    color = TrailColors.Text,
                    fontWeight = FontWeight.Medium,
                    fontSize = 18.sp
                )
                Spacer(Modifier.height(4.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    ActivityMetricTile("Distance", format1(activity.distanceKm), "km", TrailColors.ChargeOrange)
                    ActivityMetricTile("Durée", formatDurationMinutes(activity.movingTimeMin), "", TrailColors.GreenOk)
                    ActivityMetricTile("D+", activity.dPlus.toString(), "m", TrailColors.SeriesBlue)
                    val fourthMetric = fourthMetricForActivity(activity)
                    ActivityMetricTile(fourthMetric.label, fourthMetric.value, fourthMetric.unit, TrailColors.Text)
                }
            }
            Spacer(Modifier.width(8.dp))
                    Column(horizontalAlignment = Alignment.End) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(TrailColors.Surface)
                                .border(1.dp, TrailColors.Border, CircleShape)
                                .clickable { onEditActivity(activity) },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Settings,
                                contentDescription = stringResource(R.string.activities_edit_title),
                                tint = TrailColors.ChargeOrange,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        Spacer(Modifier.height(4.dp))
                        val cesValue = if (activity.ces > 0) activity.ces else CesCalculator.computeCes(activity).toInt()
                        Text(
                            text = "⚡: $cesValue",
                            color = TrailColors.SeriesYellow,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                        activity.intensity?.let { intensity ->
                            Spacer(Modifier.height(1.dp))
                            Text(
                                text = intensityEmoji(intensity, activity.type),
                                color = TrailColors.GreenOk,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 19.sp,
                        modifier = Modifier.align(Alignment.CenterHorizontally)
                    )
                }
            }
        }
    }
}

@Composable
private fun ActivityDetailStatusScreen(
    isLoading: Boolean,
    error: String?,
    onBack: () -> Unit
) {
    Column(Modifier.fillMaxSize().background(TrailColors.Background)) {
        DetailHeader(title = if (isLoading) stringResource(R.string.common_label_loading) else stringResource(R.string.activities_detail_title), onBack = onBack)
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            SectionCard {
                Text(
                    text = if (isLoading) "Chargement..." else error.orEmpty(),
                    color = if (isLoading) TrailColors.SubtleText else TrailColors.RunRed,
                    fontSize = 14.sp
                )
            }
        }
    }
}

@Composable
private fun ActivityDetailScreen(
    detail: ActivityDetailDraft,
    athleteProfile: AthleteProfileSettings,
    activities: List<ActivityDraft>,
    onBack: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    Column(Modifier.fillMaxSize().background(TrailColors.Background)) {
        DetailHeader(title = displayActivityType(detail.type, context), onBack = onBack)
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                NativeActivityMapView(
                    points = detail.points,
                    encodedPolyline = detail.polyline,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(360.dp)
                )
            }
            item {
                Column(Modifier.padding(horizontal = 12.dp)) {
                    Text(
                        text = detail.name,
                        color = TrailColors.Text,
                        fontWeight = FontWeight.Black,
                        fontSize = 24.sp,
                        lineHeight = 28.sp
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "${formatActivityDate(detail.startedAtLocal)} • ${formatActivityTime(detail.startedAtLocal)}",
                        color = TrailColors.SubtleText,
                        fontSize = 13.sp
                    )
                }
            }
            item {
                ActivityDetailStats(detail)
            }
            item {
                ActivitySplitsPanel(detail.splits, detail.dPlus, athleteProfile, activities)
            }
        }
    }
}

@Composable
private fun DetailHeader(title: String, onBack: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(TrailColors.Surface)
            .border(1.dp, TrailColors.Border)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
            contentDescription = "Retour",
            tint = TrailColors.Text,
            modifier = Modifier.size(24.dp).clickable { onBack() }
        )
        Text(
            text = title,
            color = TrailColors.Text,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun NativeActivityMapView(
    points: List<ActivityMapPoint>,
    encodedPolyline: String,
    modifier: Modifier = Modifier
) {
    val routePoints = remember(points, encodedPolyline) {
        normalizedMapPoints(points, encodedPolyline)
    }

    if (routePoints.isEmpty()) {
        Box(
            modifier = modifier.background(TrailColors.Surface),
            contentAlignment = Alignment.Center
        ) {
            Text("Trace indisponible", color = TrailColors.SubtleText, fontSize = 14.sp)
        }
        return
    }

    var size by remember { mutableStateOf(IntSize.Zero) }
    var zoom by remember(routePoints) { mutableIntStateOf(13) }
    var centerLat by remember(routePoints) { mutableStateOf(routePoints.first().lat) }
    var centerLng by remember(routePoints) { mutableStateOf(routePoints.first().lng) }
    val tileCache = remember { mutableStateMapOf<MapTileKey, ImageBitmap?>() }
    val visibleTiles = remember(size, zoom, centerLat, centerLng) {
        visibleMapTiles(size, zoom, centerLat, centerLng)
    }

    LaunchedEffect(routePoints, size) {
        if (size.width > 0 && size.height > 0) {
            val camera = fitMapCamera(routePoints, size)
            zoom = camera.zoom
            centerLat = camera.lat
            centerLng = camera.lng
        }
    }

    LaunchedEffect(visibleTiles) {
        visibleTiles.map { it.key }.distinct().forEach { key ->
            if (!tileCache.containsKey(key) || tileCache[key] == null) {
                val image = loadOsmTile(key)
                if (image != null) {
                    tileCache[key] = image
                } else {
                    tileCache.remove(key)
                }
            }
        }
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(bottomStart = 22.dp, bottomEnd = 22.dp))
            .background(Color(0xFF10201B))
            .onSizeChanged { size = it }
            .pointerInput(routePoints, size, zoom, centerLat, centerLng) {
                var zoomAccumulator = 1f
                detectTransformGestures { _, pan, gestureZoom, _ ->
                    if (pan != Offset.Zero) {
                        val center = projectMapPoint(centerLat, centerLng, zoom)
                        val nextCenter = unprojectMapPoint(center.x - pan.x, center.y - pan.y, zoom)
                        centerLat = nextCenter.lat
                        centerLng = nextCenter.lng
                    }
                    zoomAccumulator *= gestureZoom
                    if (zoomAccumulator > 1.18f && zoom < MaxMapZoom) {
                        zoom += 1
                        zoomAccumulator = 1f
                    } else if (zoomAccumulator < 0.84f && zoom > MinMapZoom) {
                        zoom -= 1
                        zoomAccumulator = 1f
                    }
                }
            }
    ) {
        Canvas(Modifier.fillMaxSize()) {
            drawNativeMap(routePoints, visibleTiles, tileCache, zoom, centerLat, centerLng)
        }
        Column(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(12.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(Color.White.copy(alpha = 0.92f))
        ) {
            MapZoomButton("+") { zoom = (zoom + 1).coerceAtMost(MaxMapZoom) }
            Box(
                Modifier
                    .width(38.dp)
                    .height(1.dp)
                    .background(Color(0xFFE1E6E2))
            )
            MapZoomButton("-") { zoom = (zoom - 1).coerceAtLeast(MinMapZoom) }
        }
        Text(
            text = stringResource(R.string.activities_drag_map),
            color = Color.White.copy(alpha = 0.9f),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(12.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(Color(0xCC0C1915))
                .padding(horizontal = 10.dp, vertical = 7.dp)
        )
        Text(
            text = "© OpenStreetMap",
            color = Color(0xFF24312D),
            fontSize = 9.sp,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(8.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color.White.copy(alpha = 0.82f))
                .padding(horizontal = 6.dp, vertical = 3.dp)
        )
    }
}

@Composable
private fun MapZoomButton(label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(width = 38.dp, height = 36.dp)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = Color(0xFF0C1915),
            fontSize = 23.sp,
            fontWeight = FontWeight.Black
        )
    }
}

@Composable
private fun ActivityMapView(
    points: List<ActivityMapPoint>,
    encodedPolyline: String,
    modifier: Modifier = Modifier
) {
    if (points.isEmpty() && encodedPolyline.isBlank()) {
        Box(
            modifier = modifier.background(TrailColors.Surface),
            contentAlignment = Alignment.Center
        ) {
            Text("Tracé indisponible", color = TrailColors.SubtleText, fontSize = 14.sp)
        }
        return
    }

    val html = remember(points, encodedPolyline) {
        buildInteractiveMapHtml(points, encodedPolyline)
    }
    AndroidView(
        modifier = modifier,
        factory = { context ->
            WebView(context).apply {
                setBackgroundColor(android.graphics.Color.TRANSPARENT)
                isHorizontalScrollBarEnabled = false
                isVerticalScrollBarEnabled = false
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.loadsImagesAutomatically = true
                settings.blockNetworkImage = false
                settings.blockNetworkLoads = false
                settings.allowContentAccess = true
                settings.allowFileAccess = false
                loadDataWithBaseURL("https://tile.openstreetmap.org/", html, "text/html", "UTF-8", null)
            }
        },
        update = { webView ->
            webView.loadDataWithBaseURL("https://tile.openstreetmap.org/", html, "text/html", "UTF-8", null)
        }
    )
}

@Composable
private fun ActivityDetailStats(detail: ActivityDetailDraft) {
    SectionCard {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DetailMetricTile("Distance", format1(detail.distanceKm), "km", Modifier.weight(1f))
            DetailMetricTile("D+", detail.dPlus.toString(), "m", Modifier.weight(1f))
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DetailMetricTile("Temps", formatDurationMinutes(detail.movingTimeMin), "", Modifier.weight(1f))
            DetailMetricTile(stringResource(R.string.activities_field_pace), formatPace(detail.paceMinPerKm), stringResource(R.string.unit_per_km), Modifier.weight(1f))
        }
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DetailMetricTile("Calories", detail.calories.takeIf { it > 0 }?.toString() ?: "--", "kcal", Modifier.weight(1f))
            DetailMetricTile("Temps écoulé", formatDurationMinutes(detail.elapsedTimeMin), "", Modifier.weight(1f))
        }
    }
}

@Composable
private fun DetailMetricTile(
    label: String,
    value: String,
    unit: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(TrailColors.Surface)
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        Text(label, color = TrailColors.SubtleText, fontSize = 12.sp)
        Spacer(Modifier.height(4.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Text(value, color = TrailColors.Text, fontWeight = FontWeight.Black, fontSize = 22.sp)
            if (unit.isNotBlank()) {
                Spacer(Modifier.width(4.dp))
                Text(unit, color = TrailColors.SubtleText, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun ActivitySplitsPanel(
    splits: List<ActivitySplitDraft>,
    activityDPlus: Int,
    athleteProfile: AthleteProfileSettings,
    activities: List<ActivityDraft>
) {
    SectionCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            SectionTitle("Temps intermédiaires")
            if (splits.isNotEmpty()) {
                Text(
                    text = "${splits.size} segments",
                    color = TrailColors.SubtleText,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
        Spacer(Modifier.height(10.dp))
        if (splits.isEmpty()) {
            Text("Splits indisponibles pour cette activité.", color = TrailColors.SubtleText, fontSize = 13.sp)
            return@SectionCard
        }

        SplitSummaryRibbon(splits, activityDPlus, athleteProfile, activities)
        Spacer(Modifier.height(10.dp))

        val effortPaces = splits.mapNotNull { splitEffortPace(it).takeIf { pace -> pace > 0 } }
        val fastest = effortPaces.minOrNull() ?: 0.0
        val slowest = effortPaces.maxOrNull() ?: fastest
        val average = effortPaces.takeIf { it.isNotEmpty() }?.average() ?: 0.0
        splits.forEach { split ->
            SplitSegmentCard(
                split = split,
                fastestPace = fastest,
                slowestPace = slowest,
                averagePace = average
            )
        }
    }
}

@Composable
private fun SplitSummaryRibbon(
    splits: List<ActivitySplitDraft>,
    activityDPlus: Int,
    athleteProfile: AthleteProfileSettings,
    activities: List<ActivityDraft>
) {
    val validPaces = splits.mapNotNull { it.paceMinPerKm.takeIf { pace -> pace > 0 } }
    val best = validPaces.minOrNull() ?: 0.0
    val average = validPaces.takeIf { it.isNotEmpty() }?.average() ?: 0.0
    val effortLevel = splitEffortLevel(splits, activityDPlus, athleteProfile, activities)

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SplitSummaryPill("Meilleur", formatPace(best), TrailColors.GreenOk, Modifier.weight(1f))
        SplitSummaryPill("Moyenne", formatPace(average), TrailColors.ChargeOrange, Modifier.weight(1f))
        SplitSummaryPill("Effort", effortLevel, splitEffortColor(effortLevel), Modifier.weight(1f))
    }
}

@Composable
private fun SplitSummaryPill(
    label: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(color.copy(alpha = 0.14f))
            .border(1.dp, color.copy(alpha = 0.28f), RoundedCornerShape(14.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp)
    ) {
        Text(label, color = TrailColors.SubtleText, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(3.dp))
        Text(value, color = TrailColors.Text, fontSize = 15.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun SplitSegmentCard(
    split: ActivitySplitDraft,
    fastestPace: Double,
    slowestPace: Double,
    averagePace: Double
) {
    val effortPace = splitEffortPace(split)
    val position = splitPacePosition(effortPace, fastestPace, slowestPace)
    val rhythmColor = splitRhythmColor(effortPace, fastestPace, averagePace)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF0D1C17))
            .border(1.dp, TrailColors.Border.copy(alpha = 0.7f), RoundedCornerShape(16.dp))
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Column(
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(rhythmColor.copy(alpha = 0.18f))
                .border(1.dp, rhythmColor.copy(alpha = 0.5f), CircleShape),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                "KM",
                color = TrailColors.SubtleText,
                fontSize = 9.sp,
                lineHeight = 9.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                split.index.toString().padStart(2, '0'),
                color = TrailColors.Text,
                fontSize = 15.sp,
                lineHeight = 15.sp,
                fontWeight = FontWeight.Black,
                modifier = Modifier.padding(bottom = 1.dp)
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    text = formatPace(split.paceMinPerKm),
                    color = TrailColors.Text,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Black
                )
                Spacer(Modifier.width(4.dp))
                Text("/km", color = TrailColors.SubtleText, fontSize = 11.sp)
                Spacer(Modifier.width(8.dp))
                Text(
                    text = splitRhythmLabel(effortPace, fastestPace, averagePace),
                    color = rhythmColor,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(Modifier.height(8.dp))
            SplitRhythmTrack(position = position, color = rhythmColor)
        }

        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            SplitMetaPill("D±", formatSignedMeters(split.elevationDeltaM), TrailColors.SeriesBlue)
            SplitMetaPill("FC", split.averageHeartRate?.toString() ?: "--", TrailColors.ChargeOrange)
        }
    }
}

@Composable
private fun SplitRhythmTrack(position: Float, color: Color) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(16.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(5.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(TrailColors.Border.copy(alpha = 0.75f))
        )
        Box(
            modifier = Modifier
                .fillMaxWidth(position.coerceIn(0.04f, 1f))
                .height(5.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(color.copy(alpha = 0.72f))
        )
        Box(
            modifier = Modifier.fillMaxWidth(position.coerceIn(0.04f, 1f)),
            contentAlignment = Alignment.CenterEnd
        ) {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(color)
                    .border(2.dp, Color(0xFF0D1C17), CircleShape)
            )
        }
    }
}

@Composable
private fun SplitMetaPill(label: String, value: String, color: Color) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 8.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(label, color = color, fontSize = 10.sp, fontWeight = FontWeight.Black)
        Text(value, color = TrailColors.Text, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

private fun splitEffortPace(split: ActivitySplitDraft): Double {
    if (split.paceMinPerKm <= 0) return 0.0
    val distanceMeters = (split.distanceKm.takeIf { it > 0 } ?: 1.0) * 1000.0
    val grade = split.elevationDeltaM / distanceMeters
    val multiplier = when {
        grade > 0 -> 1.0 - (grade * 3.0).coerceIn(0.0, 0.28)
        grade < 0 -> 1.0 + (-grade * 1.4).coerceIn(0.0, 0.16)
        else -> 1.0
    }
    return split.paceMinPerKm * multiplier
}

private fun splitEffortLevel(
    splits: List<ActivitySplitDraft>,
    activityDPlus: Int,
    athleteProfile: AthleteProfileSettings,
    activities: List<ActivityDraft>
): String {
    val effortPaces = splits.mapNotNull { splitEffortPace(it).takeIf { pace -> pace > 0 } }
    if (effortPaces.isEmpty()) return "n/a"

    val averageEffortPace = effortPaces.average()
    val paceSpread = if (averageEffortPace > 0) {
        ((effortPaces.maxOrNull() ?: averageEffortPace) - (effortPaces.minOrNull() ?: averageEffortPace)) / averageEffortPace
    } else {
        0.0
    }
    val distanceKm = splits.sumOf { it.distanceKm.takeIf { distance -> distance > 0 } ?: 1.0 }.coerceAtLeast(1.0)
    val dPlusDensity = (activityDPlus.takeIf { it > 0 } ?: splits.sumOf { max(0, it.elevationDeltaM) }) / distanceKm
    val averageHr = splits.mapNotNull { it.averageHeartRate }.takeIf { it.isNotEmpty() }?.average()
    val heartRateBasis = resolveHeartRateBasis(athleteProfile, activities)
    val heartRateScore = if (averageHr == null) {
        0.0
    } else {
        val reserveRatio = ((averageHr - heartRateBasis.restingHeartRate) /
            (heartRateBasis.maxHeartRate - heartRateBasis.restingHeartRate).coerceAtLeast(1).toDouble()).coerceIn(0.0, 1.2)
        when {
            reserveRatio >= 0.90 -> 1.10
            reserveRatio >= 0.82 -> 0.78
            reserveRatio >= 0.72 -> 0.45
            reserveRatio >= 0.62 -> 0.20
            else -> 0.0
        }
    }
    val terrainScore = (dPlusDensity / 80.0).coerceIn(0.0, 0.8)
    val score = paceSpread * 0.9 + terrainScore * 0.5 + heartRateScore

    return when {
        score >= 1.65 -> "Très dur"
        score >= 1.2 -> "Dur"
        score >= 0.75 -> "Soutenu"
        score >= 0.35 -> "Modéré"
        else -> "Souple"
    }
}

private data class HeartRateBasis(val maxHeartRate: Int, val restingHeartRate: Int)

private fun resolveHeartRateBasis(
    profile: AthleteProfileSettings,
    activities: List<ActivityDraft>
): HeartRateBasis {
    val manualMax = profile.maxHr.toIntOrNull()?.takeIf { it in 120..230 }
    val manualRest = profile.restingHr.toIntOrNull()?.takeIf { it in 30..100 }
    val birthYear = profile.birthYear.toIntOrNull()
    val ageMax = birthYear
        ?.takeIf { it in 1930..LocalDate.now().year }
        ?.let { year -> (208 - 0.7 * (LocalDate.now().year - year)).roundToInt() }
    val observedMaxAverage = activities.mapNotNull { it.averageHeartRate }.maxOrNull()
    val inferredMax = listOfNotNull(observedMaxAverage?.plus(18), ageMax).maxOrNull()?.coerceIn(165, 205) ?: 190

    return HeartRateBasis(
        maxHeartRate = if (profile.calibrationMode == ProfileCalibrationMode.Manual) manualMax ?: inferredMax else inferredMax,
        restingHeartRate = if (profile.calibrationMode == ProfileCalibrationMode.Manual) manualRest ?: 55 else 55
    )
}

@Composable
private fun splitEffortColor(level: String): Color {
    return when (level) {
        "Très dur" -> TrailColors.RunRed
        "Dur" -> TrailColors.ChargeOrange
        "Soutenu" -> TrailColors.SeriesYellow
        "Modéré" -> TrailColors.SeriesBlue
        "Souple" -> TrailColors.GreenOk
        else -> TrailColors.SubtleText
    }
}

private fun formatSignedMeters(value: Int): String {
    return if (value > 0) "+${value} m" else "${value} m"
}

private fun splitPacePosition(pace: Double, fastest: Double, slowest: Double): Float {
    if (pace <= 0 || fastest <= 0 || slowest <= fastest) return 0.5f
    return ((slowest - pace) / (slowest - fastest)).toFloat().coerceIn(0.08f, 1f)
}

private fun splitRhythmLabel(pace: Double, fastest: Double, average: Double): String {
    return when {
        pace <= 0 -> "n/a"
        fastest > 0 && pace <= fastest + 0.08 -> "pic"
        average > 0 && pace <= average * 0.96 -> "rapide"
        average > 0 && pace >= average * 1.08 -> "gestion"
        else -> "stable"
    }
}

@Composable
private fun splitRhythmColor(pace: Double, fastest: Double, average: Double): Color {
    return when (splitRhythmLabel(pace, fastest, average)) {
        "pic" -> TrailColors.GreenOk
        "rapide" -> TrailColors.SeriesBlue
        "gestion" -> TrailColors.ChargeOrange
        else -> TrailColors.SubtleText
    }
}

@Composable
private fun ActivitySplitsCard(splits: List<ActivitySplitDraft>) {
    SectionCard {
        SectionTitle("Temps intermédiaires")
        Spacer(Modifier.height(12.dp))
        if (splits.isEmpty()) {
            Text("Splits indisponibles pour cette activité.", color = TrailColors.SubtleText, fontSize = 13.sp)
            return@SectionCard
        }
        SplitHeaderRow()
        Spacer(Modifier.height(8.dp))
        val slowest = splits.maxOfOrNull { it.paceMinPerKm.takeIf { pace -> pace > 0 } ?: 0.0 } ?: 1.0
        splits.forEach { split ->
            SplitRow(split = split, slowestPace = slowest)
        }
    }
}

@Composable
private fun SplitHeaderRow() {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text("Km", color = TrailColors.SubtleText, fontSize = 12.sp, modifier = Modifier.width(38.dp))
        Text(stringResource(R.string.activities_field_pace), color = TrailColors.SubtleText, fontSize = 12.sp, modifier = Modifier.width(64.dp))
        Text("", color = TrailColors.SubtleText, fontSize = 12.sp, modifier = Modifier.weight(1f))
        Text("Élev.", color = TrailColors.SubtleText, fontSize = 12.sp, modifier = Modifier.width(52.dp))
        Text("FC", color = TrailColors.SubtleText, fontSize = 12.sp, modifier = Modifier.width(38.dp))
    }
}

@Composable
private fun SplitRow(split: ActivitySplitDraft, slowestPace: Double) {
    val fraction = if (slowestPace > 0) (split.paceMinPerKm / slowestPace).toFloat().coerceIn(0.08f, 1f) else 0.1f
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(split.index.toString(), color = TrailColors.Text, fontSize = 14.sp, modifier = Modifier.width(38.dp))
        Text(formatPace(split.paceMinPerKm), color = TrailColors.Text, fontSize = 14.sp, modifier = Modifier.width(64.dp))
        Box(modifier = Modifier.weight(1f).height(24.dp), contentAlignment = Alignment.CenterStart) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(fraction)
                    .height(22.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(TrailColors.SeriesBlue)
            )
        }
        Text(split.elevationDeltaM.toString(), color = TrailColors.Text, fontSize = 14.sp, modifier = Modifier.width(52.dp))
        Text(split.averageHeartRate?.toString() ?: "--", color = TrailColors.Text, fontSize = 14.sp, modifier = Modifier.width(38.dp))
    }
}

private enum class ActivitiesScreenMode { LIST, SEARCH, FILTER }

private enum class ActivitySearchField(val label: String) {
    Title("Titre"),
    Distance("Distance"),
    Duration("Durée"),
    DPlus("D+")
}

private enum class ActivitySortCriterion(val label: String) {
    Type("Activité"),
    Date("Date"),
    Distance("Distance"),
    Pace("Allure"),
    Duration("Durée"),
    DPlus("D+")
}

private enum class SortDirection { Asc, Desc }

private data class ActivitySearchState(
    val field: ActivitySearchField = ActivitySearchField.Title,
    val query: String = ""
)

private data class ActivityFilterState(
    val criterion: ActivitySortCriterion = ActivitySortCriterion.Date,
    val direction: SortDirection = SortDirection.Desc,
    val typeFilter: String = "",
    val dateFrom: String = "",
    val dateTo: String = "",
    val distanceMin: String = "",
    val distanceMax: String = "",
    val paceMin: String = "",
    val paceMax: String = "",
    val durationMin: String = "",
    val durationMax: String = "",
    val dPlusMin: String = "",
    val dPlusMax: String = ""
) {
    fun hasValueFilters(): Boolean =
        typeFilter.isNotBlank() ||
        dateFrom.isNotBlank() || dateTo.isNotBlank() ||
        distanceMin.isNotBlank() || distanceMax.isNotBlank() ||
        paceMin.isNotBlank() || paceMax.isNotBlank() ||
        durationMin.isNotBlank() || durationMax.isNotBlank() ||
        dPlusMin.isNotBlank() || dPlusMax.isNotBlank()
}

private fun applyActivityValueFilters(
    activities: List<ActivityDraft>,
    f: ActivityFilterState
): List<ActivityDraft> {
    var result = activities

    if (f.typeFilter.isNotBlank()) {
        result = result.filter { it.type == f.typeFilter }
    }

    val dateFrom = f.dateFrom.trim().takeIf { it.isNotBlank() }
    val dateTo = f.dateTo.trim().takeIf { it.isNotBlank() }
    if (dateFrom != null || dateTo != null) {
        result = result.filter {
            val day = it.startedAtLocal.take(10)
            (dateFrom == null || day >= dateFrom) && (dateTo == null || day <= dateTo)
        }
    }

    val distMin = f.distanceMin.replace(',', '.').toDoubleOrNull()
    val distMax = f.distanceMax.replace(',', '.').toDoubleOrNull()
    if (distMin != null || distMax != null) {
        result = result.filter {
            (distMin == null || it.distanceKm >= distMin) &&
            (distMax == null || it.distanceKm <= distMax)
        }
    }

    val paceMin = parseDurationQuery(f.paceMin)
    val paceMax = parseDurationQuery(f.paceMax)
    if (paceMin != null || paceMax != null) {
        result = result.filter {
            it.paceMinPerKm > 0 &&
            (paceMin == null || it.paceMinPerKm >= paceMin) &&
            (paceMax == null || it.paceMinPerKm <= paceMax)
        }
    }

    val durMin = parseDurationQuery(f.durationMin)
    val durMax = parseDurationQuery(f.durationMax)
    if (durMin != null || durMax != null) {
        result = result.filter {
            (durMin == null || it.movingTimeMin >= durMin) &&
            (durMax == null || it.movingTimeMin <= durMax)
        }
    }

    val dPlusMin = f.dPlusMin.toIntOrNull()
    val dPlusMax = f.dPlusMax.toIntOrNull()
    if (dPlusMin != null || dPlusMax != null) {
        result = result.filter {
            (dPlusMin == null || it.dPlus >= dPlusMin) &&
            (dPlusMax == null || it.dPlus <= dPlusMax)
        }
    }
    return result
}

private fun applyActivitySearch(
    activities: List<ActivityDraft>,
    search: ActivitySearchState
): List<ActivityDraft> {
    val raw = search.query.trim()
    if (raw.isEmpty()) return activities
    return when (search.field) {
        ActivitySearchField.Title -> {
            val needle = raw.lowercase()
            activities.filter { it.name.lowercase().contains(needle) }
        }
        ActivitySearchField.Distance -> {
            val target = raw.replace(',', '.').toDoubleOrNull() ?: return activities
            activities.filter { kotlin.math.abs(it.distanceKm - target) < 0.5 }
        }
        ActivitySearchField.Duration -> {
            val target = parseDurationQuery(raw) ?: return activities
            activities.filter { kotlin.math.abs(it.movingTimeMin - target) < 1.0 }
        }
        ActivitySearchField.DPlus -> {
            val target = raw.toIntOrNull() ?: return activities
            activities.filter { kotlin.math.abs(it.dPlus - target) <= 25 }
        }
    }
}

private fun parseDurationQuery(input: String): Double? {
    val trimmed = input.trim()
    if (':' in trimmed) {
        val parts = trimmed.split(":")
        return when (parts.size) {
            2 -> {
                val minutes = parts[0].toIntOrNull() ?: return null
                val seconds = parts[1].toIntOrNull() ?: return null
                minutes + seconds / 60.0
            }
            3 -> {
                val hours = parts[0].toIntOrNull() ?: return null
                val minutes = parts[1].toIntOrNull() ?: return null
                val seconds = parts[2].toIntOrNull() ?: return null
                hours * 60.0 + minutes + seconds / 60.0
            }
            else -> null
        }
    }
    return trimmed.replace(',', '.').toDoubleOrNull()
}

private fun applyActivitySort(
    activities: List<ActivityDraft>,
    filter: ActivityFilterState
): List<ActivityDraft> {
    val comparator: Comparator<ActivityDraft> = when (filter.criterion) {
        ActivitySortCriterion.Type -> compareBy { it.type.lowercase() }
        ActivitySortCriterion.Date -> compareBy { it.startedAtLocal }
        ActivitySortCriterion.Distance -> compareBy { it.distanceKm }
        ActivitySortCriterion.Pace -> compareBy { if (it.paceMinPerKm > 0) it.paceMinPerKm else Double.MAX_VALUE }
        ActivitySortCriterion.Duration -> compareBy { it.movingTimeMin }
        ActivitySortCriterion.DPlus -> compareBy { it.dPlus }
    }
    val sorted = activities.sortedWith(comparator)
    return if (filter.direction == SortDirection.Desc) sorted.reversed() else sorted
}

@Composable
private fun ActivitiesTab(
    activities: List<ActivityDraft>,
    scrollState: LazyListState = rememberLazyListState(),
    onEditActivity: (ActivityDraft) -> Unit,
    onOpenActivity: (ActivityDraft) -> Unit
) {
    var mode by remember { mutableStateOf(ActivitiesScreenMode.LIST) }
    var search by remember { mutableStateOf(ActivitySearchState()) }
    var filter by remember { mutableStateOf(ActivityFilterState()) }

    val displayed = remember(activities, search, filter) {
        applyActivitySort(applyActivityValueFilters(applyActivitySearch(activities, search), filter), filter)
    }

    when (mode) {
        ActivitiesScreenMode.LIST -> ActivitiesListView(
            activities = displayed,
            state = scrollState,
            search = search,
            filter = filter,
            onClearSearch = { search = ActivitySearchState() },
            onResetFilter = { filter = ActivityFilterState() },
            onSearchClick = { mode = ActivitiesScreenMode.SEARCH },
            onFilterClick = { mode = ActivitiesScreenMode.FILTER },
            onEditActivity = onEditActivity,
            onOpenActivity = onOpenActivity
        )
        ActivitiesScreenMode.SEARCH -> ActivitiesSearchScreen(
            allActivities = activities,
            initial = search,
            onApply = { search = it; mode = ActivitiesScreenMode.LIST },
            onBack = { mode = ActivitiesScreenMode.LIST },
            onEditActivity = onEditActivity,
            onOpenActivity = onOpenActivity
        )
        ActivitiesScreenMode.FILTER -> ActivitiesFilterScreen(
            initial = filter,
            onApply = { filter = it; mode = ActivitiesScreenMode.LIST },
            onBack = { mode = ActivitiesScreenMode.LIST }
        )
    }
}

@Composable
private fun ActivitiesListView(
    activities: List<ActivityDraft>,
    state: LazyListState = rememberLazyListState(),
    search: ActivitySearchState,
    filter: ActivityFilterState,
    onClearSearch: () -> Unit,
    onResetFilter: () -> Unit,
    onSearchClick: () -> Unit,
    onFilterClick: () -> Unit,
    onEditActivity: (ActivityDraft) -> Unit,
    onOpenActivity: (ActivityDraft) -> Unit
) {
    LazyColumn(
        state = state,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            SearchFilterBar(
                onSearchClick = onSearchClick,
                onFilterClick = onFilterClick
            )
        }
        if (search.query.isNotBlank() || filter != ActivityFilterState() || filter.hasValueFilters()) {
            item {
                ActiveFiltersRow(
                    search = search,
                    filter = filter,
                    onClearSearch = onClearSearch,
                    onResetFilter = onResetFilter
                )
            }
        }
        if (activities.isEmpty()) {
            item {
                SectionCard {
                    Text(
                        text = "Aucune activité ne correspond.",
                        color = TrailColors.SubtleText,
                        fontSize = 14.sp
                    )
                }
            }
        } else {
            items(activities) { activity ->
                ActivityCard(
                    activity = activity,
                    onEditActivity = onEditActivity,
                    onOpenActivity = onOpenActivity
                )
            }
        }
    }
}

@Composable
private fun SearchFilterBar(
    onSearchClick: () -> Unit,
    onFilterClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(TrailColors.CardBg)
            .border(1.dp, TrailColors.Border, RoundedCornerShape(12.dp))
            .padding(horizontal = 6.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .clip(RoundedCornerShape(8.dp))
                .clickable { onSearchClick() }
                .padding(horizontal = 10.dp, vertical = 12.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Rechercher",
                    tint = TrailColors.SubtleText,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "Rechercher",
                    color = TrailColors.SubtleText,
                    fontSize = 14.sp
                )
            }
        }
        Box(
            modifier = Modifier
                .height(28.dp)
                .width(1.dp)
                .background(TrailColors.Border)
        )
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .clickable { onFilterClick() }
                .padding(horizontal = 14.dp, vertical = 12.dp),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.FilterList,
                contentDescription = stringResource(R.string.activities_filter_label),
                tint = TrailColors.ChargeOrange,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
private fun ActiveFiltersRow(
    search: ActivitySearchState,
    filter: ActivityFilterState,
    onClearSearch: () -> Unit,
    onResetFilter: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (search.query.isNotBlank()) {
            DismissChip(
                label = "${search.field.label}: ${search.query}",
                onDismiss = onClearSearch
            )
        }
        val sortChanged = filter.criterion != ActivityFilterState().criterion ||
            filter.direction != ActivityFilterState().direction
        if (sortChanged || filter.hasValueFilters()) {
            val arrow = if (filter.direction == SortDirection.Asc) "↑" else "↓"
            val parts = mutableListOf(stringResource(R.string.activities_sort_label, filter.criterion.label, arrow))
            if (filter.typeFilter.isNotBlank()) {
                parts += "${stringResource(R.string.activities_single)}=${displayActivityType(filter.typeFilter, context)}"
            }
            rangeChipText(
                "Date",
                formatIsoDateForDisplay(filter.dateFrom),
                formatIsoDateForDisplay(filter.dateTo)
            )?.let { parts += it }
            rangeChipText("Dist", filter.distanceMin, filter.distanceMax)?.let { parts += it }
            rangeChipText(stringResource(R.string.activities_field_pace), filter.paceMin, filter.paceMax)?.let { parts += it }
            rangeChipText("Durée", filter.durationMin, filter.durationMax)?.let { parts += it }
            rangeChipText("D+", filter.dPlusMin, filter.dPlusMax)?.let { parts += it }
            DismissChip(
                label = parts.joinToString(" • "),
                onDismiss = onResetFilter
            )
        }
    }
}

@Composable
private fun DismissChip(label: String, onDismiss: () -> Unit) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(TrailColors.ChargeOrange.copy(alpha = 0.16f))
            .border(1.dp, TrailColors.ChargeOrange, RoundedCornerShape(999.dp))
            .padding(start = 12.dp, end = 6.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            color = TrailColors.ChargeOrange,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(Modifier.width(4.dp))
        Icon(
            imageVector = Icons.Default.Close,
            contentDescription = "Effacer",
            tint = TrailColors.ChargeOrange,
            modifier = Modifier
                .size(14.dp)
                .clickable { onDismiss() }
        )
    }
}

@Composable
private fun ActivitiesSearchScreen(
    allActivities: List<ActivityDraft>,
    initial: ActivitySearchState,
    onApply: (ActivitySearchState) -> Unit,
    onBack: () -> Unit,
    onEditActivity: (ActivityDraft) -> Unit,
    onOpenActivity: (ActivityDraft) -> Unit
) {
    var field by remember { mutableStateOf(initial.field) }
    var query by remember { mutableStateOf(initial.query) }
    val current = ActivitySearchState(field, query)
    val results = remember(allActivities, current) { applyActivitySearch(allActivities, current) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(TrailColors.Background)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(TrailColors.Surface)
                .border(1.dp, TrailColors.Border)
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Retour",
                tint = TrailColors.Text,
                modifier = Modifier.size(22.dp).clickable { onBack() }
            )
            Text(
                text = "Rechercher",
                color = TrailColors.Text,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = "Appliquer",
                color = TrailColors.ChargeOrange,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                modifier = Modifier.clickable { onApply(current) }
            )
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                SectionCard {
                    SectionTitle(stringResource(R.string.activities_search_by))
                    Spacer(Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        ActivitySearchField.values().forEach { option ->
                            ActionChip(
                                label = option.label,
                                active = field == option,
                                onClick = {
                                    field = option
                                    query = ""
                                }
                            )
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    ActivityEditNumberField(
                        label = searchFieldHint(field),
                        value = query,
                        keyboardType = searchKeyboardType(field)
                    ) { query = it }
                }
            }
            item {
                Text(
                    text = "${results.size} résultat${if (results.size > 1) "s" else ""}",
                    color = TrailColors.SubtleText,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
            if (results.isEmpty()) {
                item {
                    SectionCard {
                        Text(
                            text = "Aucune activité ne correspond.",
                            color = TrailColors.SubtleText,
                            fontSize = 14.sp
                        )
                    }
                }
            } else {
                items(results) { activity ->
                    ActivityCard(
                        activity = activity,
                        onEditActivity = onEditActivity,
                        onOpenActivity = onOpenActivity
                    )
                }
            }
        }
    }
}

private fun searchFieldHint(field: ActivitySearchField): String = when (field) {
    ActivitySearchField.Title -> "Titre de l'activité"
    ActivitySearchField.Distance -> "Distance (km)"
    ActivitySearchField.Duration -> "Durée (min ou min:sec)"
    ActivitySearchField.DPlus -> "D+ (m)"
}

private fun searchKeyboardType(field: ActivitySearchField): KeyboardType = when (field) {
    ActivitySearchField.Title -> KeyboardType.Text
    ActivitySearchField.Distance -> KeyboardType.Decimal
    ActivitySearchField.Duration -> KeyboardType.Text
    ActivitySearchField.DPlus -> KeyboardType.Number
}

@Composable
private fun ActivitiesFilterScreen(
    initial: ActivityFilterState,
    onApply: (ActivityFilterState) -> Unit,
    onBack: () -> Unit
) {
    var criterion by remember { mutableStateOf(initial.criterion) }
    var direction by remember { mutableStateOf(initial.direction) }
    var typeFilter by remember { mutableStateOf(initial.typeFilter) }
    var dateFrom by remember { mutableStateOf(initial.dateFrom) }
    var dateTo by remember { mutableStateOf(initial.dateTo) }
    var distanceMin by remember { mutableStateOf(initial.distanceMin) }
    var distanceMax by remember { mutableStateOf(initial.distanceMax) }
    var paceMin by remember { mutableStateOf(initial.paceMin) }
    var paceMax by remember { mutableStateOf(initial.paceMax) }
    var durationMin by remember { mutableStateOf(initial.durationMin) }
    var durationMax by remember { mutableStateOf(initial.durationMax) }
    var dPlusMin by remember { mutableStateOf(initial.dPlusMin) }
    var dPlusMax by remember { mutableStateOf(initial.dPlusMax) }

    fun buildState() = ActivityFilterState(
        criterion = criterion,
        direction = direction,
        typeFilter = typeFilter,
        dateFrom = dateFrom,
        dateTo = dateTo,
        distanceMin = distanceMin,
        distanceMax = distanceMax,
        paceMin = paceMin,
        paceMax = paceMax,
        durationMin = durationMin,
        durationMax = durationMax,
        dPlusMin = dPlusMin,
        dPlusMax = dPlusMax
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(TrailColors.Background)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(TrailColors.Surface)
                .border(1.dp, TrailColors.Border)
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Retour",
                tint = TrailColors.Text,
                modifier = Modifier.size(22.dp).clickable { onBack() }
            )
            Text(
                text = stringResource(R.string.activities_filter_label),
                color = TrailColors.Text,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = "Appliquer",
                color = TrailColors.ChargeOrange,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                modifier = Modifier.clickable { onApply(buildState()) }
            )
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                SectionCard {
                    SectionTitle(stringResource(R.string.activities_sort_filter))
                    Spacer(Modifier.height(10.dp))
                    ActivitySortCriterion.values().forEach { option ->
                        val binding = rangeBindingFor(
                            option = option,
                            dateFrom = dateFrom, onDateFrom = { dateFrom = it },
                            dateTo = dateTo, onDateTo = { dateTo = it },
                            distanceMin = distanceMin, onDistanceMin = { distanceMin = it },
                            distanceMax = distanceMax, onDistanceMax = { distanceMax = it },
                            paceMin = paceMin, onPaceMin = { paceMin = it },
                            paceMax = paceMax, onPaceMax = { paceMax = it },
                            durationMin = durationMin, onDurationMin = { durationMin = it },
                            durationMax = durationMax, onDurationMax = { durationMax = it },
                            dPlusMin = dPlusMin, onDPlusMin = { dPlusMin = it },
                            dPlusMax = dPlusMax, onDPlusMax = { dPlusMax = it }
                        )
                        FilterCriterionRow(
                            label = option.label,
                            selected = criterion == option,
                            direction = direction,
                            range = binding,
                            typeFilter = if (option == ActivitySortCriterion.Type) typeFilter else null,
                            onTypeFilterChange = { typeFilter = it },
                            onSelectAsc = {
                                criterion = option
                                direction = SortDirection.Asc
                            },
                            onSelectDesc = {
                                criterion = option
                                direction = SortDirection.Desc
                            }
                        )
                    }
                }
            }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ActionChip(
                        label = "Réinitialiser",
                        active = false,
                        onClick = {
                            criterion = ActivitySortCriterion.Date
                            direction = SortDirection.Desc
                            typeFilter = ""
                            dateFrom = ""; dateTo = ""
                            distanceMin = ""; distanceMax = ""
                            paceMin = ""; paceMax = ""
                            durationMin = ""; durationMax = ""
                            dPlusMin = ""; dPlusMax = ""
                        }
                    )
                    ActionChip(
                        label = "Appliquer",
                        active = true,
                        onClick = { onApply(buildState()) }
                    )
                }
            }
        }
    }
}

private enum class FilterCellKind { Text, Date, PaceWheel, DurationWheel }

private data class FilterRangeBinding(
    val minValue: String,
    val maxValue: String,
    val placeholder: String,
    val keyboardType: KeyboardType,
    val cellKind: FilterCellKind,
    val onMinChange: (String) -> Unit,
    val onMaxChange: (String) -> Unit
)

private fun rangeBindingFor(
    option: ActivitySortCriterion,
    dateFrom: String, onDateFrom: (String) -> Unit,
    dateTo: String, onDateTo: (String) -> Unit,
    distanceMin: String, onDistanceMin: (String) -> Unit,
    distanceMax: String, onDistanceMax: (String) -> Unit,
    paceMin: String, onPaceMin: (String) -> Unit,
    paceMax: String, onPaceMax: (String) -> Unit,
    durationMin: String, onDurationMin: (String) -> Unit,
    durationMax: String, onDurationMax: (String) -> Unit,
    dPlusMin: String, onDPlusMin: (String) -> Unit,
    dPlusMax: String, onDPlusMax: (String) -> Unit
): FilterRangeBinding? = when (option) {
    ActivitySortCriterion.Type -> null
    ActivitySortCriterion.Date -> FilterRangeBinding(
        dateFrom, dateTo, "JJ/MM/AAAA", KeyboardType.Text, FilterCellKind.Date, onDateFrom, onDateTo
    )
    ActivitySortCriterion.Distance -> FilterRangeBinding(
        distanceMin, distanceMax, "km", KeyboardType.Decimal, FilterCellKind.Text, onDistanceMin, onDistanceMax
    )
    ActivitySortCriterion.Pace -> FilterRangeBinding(
        paceMin, paceMax, "mm:ss", KeyboardType.Text, FilterCellKind.PaceWheel, onPaceMin, onPaceMax
    )
    ActivitySortCriterion.Duration -> FilterRangeBinding(
        durationMin, durationMax, "h:mm:ss", KeyboardType.Text, FilterCellKind.DurationWheel, onDurationMin, onDurationMax
    )
    ActivitySortCriterion.DPlus -> FilterRangeBinding(
        dPlusMin, dPlusMax, "m", KeyboardType.Number, FilterCellKind.Text, onDPlusMin, onDPlusMax
    )
}

@Composable
private fun FilterCriterionRow(
    label: String,
    selected: Boolean,
    direction: SortDirection,
    range: FilterRangeBinding? = null,
    typeFilter: String? = null,
    onTypeFilterChange: (String) -> Unit = {},
    onSelectAsc: () -> Unit,
    onSelectDesc: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                color = TrailColors.Text,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                fontSize = 14.sp
            )
            if (typeFilter != null) {
                Spacer(Modifier.height(6.dp))
                ActivityTypeDropdown(
                    selectedType = typeFilter,
                    onChange = onTypeFilterChange
                )
            }
            if (range != null) {
                Spacer(Modifier.height(6.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("De", color = TrailColors.SubtleText, fontSize = 11.sp)
                    InlineFilterCell(
                        value = range.minValue,
                        placeholder = range.placeholder,
                        keyboardType = range.keyboardType,
                        cellKind = range.cellKind,
                        onChange = range.onMinChange
                    )
                    Text("à", color = TrailColors.SubtleText, fontSize = 11.sp)
                    InlineFilterCell(
                        value = range.maxValue,
                        placeholder = range.placeholder,
                        keyboardType = range.keyboardType,
                        cellKind = range.cellKind,
                        onChange = range.onMaxChange
                    )
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            SortDirectionButton(
                icon = Icons.Default.ArrowUpward,
                description = "Croissant",
                active = selected && direction == SortDirection.Asc,
                onClick = onSelectAsc
            )
            SortDirectionButton(
                icon = Icons.Default.ArrowDownward,
                description = "Décroissant",
                active = selected && direction == SortDirection.Desc,
                onClick = onSelectDesc
            )
        }
    }
}

@Composable
private fun ActivityTypeDropdown(
    selectedType: String,
    onChange: (String) -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var expanded by remember { mutableStateOf(false) }
    val label = if (selectedType.isBlank()) "Toutes" else displayActivityType(selectedType, context)
    Box {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(TrailColors.Surface)
                .border(1.dp, TrailColors.Border, RoundedCornerShape(8.dp))
                .clickable { expanded = true }
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                color = TrailColors.Text,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(Modifier.width(4.dp))
            Icon(
                imageVector = Icons.Default.ArrowDropDown,
                contentDescription = stringResource(R.string.cockpit_choose_type),
                tint = TrailColors.SubtleText,
                modifier = Modifier.size(18.dp)
            )
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            DropdownMenuItem(
                text = { Text("Toutes") },
                onClick = {
                    onChange("")
                    expanded = false
                }
            )
            editableActivityTypes.forEach { option ->
                DropdownMenuItem(
                    text = { Text(stringResource(option.labelRes)) },
                    onClick = {
                        onChange(option.value)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun InlineFilterCell(
    value: String,
    placeholder: String,
    keyboardType: KeyboardType,
    cellKind: FilterCellKind,
    onChange: (String) -> Unit
) {
    when (cellKind) {
        FilterCellKind.Date -> InlineDateCell(value, placeholder, onChange)
        FilterCellKind.PaceWheel -> InlineHmsCell(value, placeholder, withHours = false, onChange = onChange)
        FilterCellKind.DurationWheel -> InlineHmsCell(value, placeholder, withHours = true, onChange = onChange)
        FilterCellKind.Text -> InlineTextCell(value, placeholder, keyboardType, onChange)
    }
}

@Composable
private fun InlineTextCell(
    value: String,
    placeholder: String,
    keyboardType: KeyboardType,
    onChange: (String) -> Unit
) {
    Box(
        modifier = Modifier
            .width(96.dp)
            .height(34.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(TrailColors.Surface)
            .border(1.dp, TrailColors.Border, RoundedCornerShape(8.dp))
            .padding(horizontal = 8.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            textStyle = TextStyle(color = TrailColors.Text, fontSize = 13.sp),
            cursorBrush = SolidColor(TrailColors.ChargeOrange),
            decorationBox = { innerTextField ->
                if (value.isEmpty()) {
                    Text(
                        text = placeholder,
                        color = TrailColors.SubtleText,
                        fontSize = 12.sp
                    )
                }
                innerTextField()
            }
        )
    }
}

@Composable
private fun InlineHmsCell(
    value: String,
    placeholder: String,
    withHours: Boolean,
    onChange: (String) -> Unit
) {
    var showDialog by remember { mutableStateOf(false) }
    Box(
        modifier = Modifier
            .width(if (withHours) 110.dp else 96.dp)
            .height(34.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(TrailColors.Surface)
            .border(1.dp, TrailColors.Border, RoundedCornerShape(8.dp))
            .clickable { showDialog = true }
            .padding(horizontal = 8.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = value.ifEmpty { placeholder },
                color = if (value.isEmpty()) TrailColors.SubtleText else TrailColors.Text,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            if (value.isNotEmpty()) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Effacer",
                    tint = TrailColors.SubtleText,
                    modifier = Modifier
                        .size(14.dp)
                        .clickable { onChange("") }
                )
            }
        }
    }
    if (showDialog) {
        HmsWheelDialog(
            initial = value,
            withHours = withHours,
            onConfirm = {
                onChange(it)
                showDialog = false
            },
            onDismiss = { showDialog = false }
        )
    }
}

@Composable
private fun HmsWheelDialog(
    initial: String,
    withHours: Boolean,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val parts = parseHmsParts(initial)
    var hour by remember { mutableIntStateOf(if (withHours) parts.first else 0) }
    var minute by remember { mutableIntStateOf(parts.second) }
    var second by remember { mutableIntStateOf(parts.third) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (withHours) stringResource(R.string.cockpit_choose_duration) else stringResource(R.string.cockpit_choose_pace)) },
        text = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (withHours) {
                    WheelPickerColumn(
                        items = (0..23).toList(),
                        selected = hour,
                        unitLabel = "h",
                        onSelectedChange = { hour = it }
                    )
                }
                WheelPickerColumn(
                    items = (0..59).toList(),
                    selected = minute,
                    unitLabel = "min",
                    onSelectedChange = { minute = it }
                )
                WheelPickerColumn(
                    items = (0..59).toList(),
                    selected = second,
                    unitLabel = "sec",
                    onSelectedChange = { second = it }
                )
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val formatted = if (withHours) {
                    "%d:%02d:%02d".format(hour, minute, second)
                } else {
                    "%d:%02d".format(minute, second)
                }
                onConfirm(formatted)
            }) { Text("OK") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Annuler") }
        }
    )
}

private data class HmsParts(val first: Int, val second: Int, val third: Int)

private fun parseHmsParts(value: String): HmsParts {
    if (value.isBlank()) return HmsParts(0, 0, 0)
    val parts = value.split(":").mapNotNull { it.trim().toIntOrNull() }
    return when (parts.size) {
        3 -> HmsParts(parts[0].coerceIn(0, 23), parts[1].coerceIn(0, 59), parts[2].coerceIn(0, 59))
        2 -> HmsParts(0, parts[0].coerceIn(0, 59), parts[1].coerceIn(0, 59))
        else -> HmsParts(0, 0, 0)
    }
}

@Composable
private fun WheelPickerColumn(
    items: List<Int>,
    selected: Int,
    unitLabel: String,
    onSelectedChange: (Int) -> Unit
) {
    val itemHeight = 38.dp
    val visibleItems = 5
    val initialIndex = items.indexOf(selected).coerceAtLeast(0)
    val state = rememberLazyListState(initialFirstVisibleItemIndex = initialIndex)
    val flingBehavior = rememberSnapFlingBehavior(state)

    LaunchedEffect(state) {
        snapshotFlow { state.isScrollInProgress }
            .collect { scrolling ->
                if (!scrolling) {
                    items.getOrNull(state.firstVisibleItemIndex)?.let(onSelectedChange)
                }
            }
    }

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .width(72.dp)
                .height(itemHeight * visibleItems)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(itemHeight)
                    .align(Alignment.Center)
                    .clip(RoundedCornerShape(8.dp))
                    .background(TrailColors.ChargeOrange.copy(alpha = 0.12f))
                    .border(1.dp, TrailColors.ChargeOrange, RoundedCornerShape(8.dp))
            )
            LazyColumn(
                state = state,
                flingBehavior = flingBehavior,
                contentPadding = PaddingValues(vertical = itemHeight * 2),
                modifier = Modifier.fillMaxSize()
            ) {
                items(items) { value ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(itemHeight),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "%02d".format(value),
                            color = TrailColors.Text,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
        Text(
            text = unitLabel,
            color = TrailColors.SubtleText,
            fontSize = 11.sp,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InlineDateCell(
    value: String,
    placeholder: String,
    onChange: (String) -> Unit
) {
    var showPicker by remember { mutableStateOf(false) }
    Box(
        modifier = Modifier
            .width(110.dp)
            .height(34.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(TrailColors.Surface)
            .border(1.dp, TrailColors.Border, RoundedCornerShape(8.dp))
            .clickable { showPicker = true }
            .padding(horizontal = 8.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = if (value.isEmpty()) placeholder else formatIsoDateForDisplay(value),
                color = if (value.isEmpty()) TrailColors.SubtleText else TrailColors.Text,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            if (value.isNotEmpty()) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Effacer",
                    tint = TrailColors.SubtleText,
                    modifier = Modifier
                        .size(14.dp)
                        .clickable { onChange("") }
                )
            }
        }
    }

    if (showPicker) {
        val pickerState = rememberDatePickerState(
            initialSelectedDateMillis = parseIsoDateToMillis(value)
        )
        DatePickerDialog(
            onDismissRequest = { showPicker = false },
            confirmButton = {
                TextButton(onClick = {
                    pickerState.selectedDateMillis?.let { ms ->
                        onChange(formatMillisToIsoDate(ms))
                    }
                    showPicker = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showPicker = false }) { Text("Annuler") }
            }
        ) {
            DatePicker(state = pickerState)
        }
    }
}

private fun rangeChipText(label: String, min: String, max: String): String? {
    val hasMin = min.isNotBlank()
    val hasMax = max.isNotBlank()
    return when {
        hasMin && hasMax -> "$label=$min→$max"
        hasMin -> "$label≥$min"
        hasMax -> "$label≤$max"
        else -> null
    }
}

private fun parseIsoDateToMillis(date: String): Long? {
    if (date.isBlank()) return null
    return try {
        val ld = java.time.LocalDate.parse(date.take(10))
        ld.atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli()
    } catch (_: Exception) {
        null
    }
}

private fun formatMillisToIsoDate(ms: Long): String {
    val ld = java.time.Instant.ofEpochMilli(ms)
        .atZone(java.time.ZoneOffset.UTC)
        .toLocalDate()
    return ld.toString()
}

private fun formatIsoDateForDisplay(iso: String): String {
    if (iso.isBlank()) return iso
    return try {
        val ld = java.time.LocalDate.parse(iso.take(10))
        "%02d/%02d/%04d".format(ld.dayOfMonth, ld.monthValue, ld.year)
    } catch (_: Exception) {
        iso
    }
}

@Composable
private fun SortDirectionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    description: String,
    active: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .size(34.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(if (active) TrailColors.ChargeOrange.copy(alpha = 0.16f) else TrailColors.Surface)
            .border(
                1.dp,
                if (active) TrailColors.ChargeOrange else TrailColors.Border,
                RoundedCornerShape(8.dp)
            )
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = description,
            tint = if (active) TrailColors.ChargeOrange else TrailColors.SubtleText,
            modifier = Modifier.size(18.dp)
        )
    }
}

@Composable
private fun ActivityEditScreen(
    activity: ActivityDraft,
    onBack: () -> Unit,
    onSave: (
        activityId: String,
        name: String,
        distanceKm: Double,
        movingTimeMin: Double,
        dPlus: Int,
        type: String,
        intensity: String?,
        onDone: (Result<Unit>) -> Unit
    ) -> Unit
) {
    var activityName by remember(activity.id) { mutableStateOf(activity.name) }
    var distanceKm by remember(activity.id) { mutableStateOf(format1(activity.distanceKm)) }
    var movingTimeMin by remember(activity.id) { mutableStateOf(formatEditableDuration(activity.movingTimeMin)) }
    var dPlus by remember(activity.id) { mutableStateOf(activity.dPlus.toString()) }
    var type by remember(activity.id) { mutableStateOf(activity.type) }
    var intensity by remember(activity.id) { mutableStateOf(activity.intensity) }
    var errorMessage by remember(activity.id) { mutableStateOf<String?>(null) }
    var isSaving by remember(activity.id) { mutableStateOf(false) }
    val supportsIntensity = typeSupportsIntensity(type)
    val chooseSportMsg = stringResource(R.string.cockpit_choose_sport)
    val errInvalidTitle = stringResource(R.string.error_invalid_title)
    val errInvalidDistance = stringResource(R.string.error_invalid_distance)
    val errInvalidDuration = stringResource(R.string.error_invalid_duration)
    val errActivityLoad = stringResource(R.string.error_activity_load_failed)
    val errInvalidElevation = stringResource(R.string.activities_field_elevation) + " invalide."

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(TrailColors.Background)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(TrailColors.Surface)
                .border(1.dp, TrailColors.Border)
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Retour",
                tint = TrailColors.Text,
                modifier = Modifier.size(22.dp).clickable(enabled = !isSaving) { onBack() }
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.activities_edit_title),
                    color = TrailColors.Text,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = "${formatActivityDate(activity.startedAtLocal)} • ${formatActivityTime(activity.startedAtLocal)}",
                    color = TrailColors.SubtleText,
                    fontSize = 15.sp
                )
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                SectionCard {
                    SectionTitle(stringResource(R.string.activities_single))
                    Spacer(Modifier.height(8.dp))
                    ActivityEditNumberField(
                        label = stringResource(R.string.activities_field_title),
                        value = activityName,
                        keyboardType = KeyboardType.Text
                    ) { activityName = it }
                }
            }

            item {
                SectionCard {
                    SectionTitle("M\u00E9triques")
                    Spacer(Modifier.height(12.dp))
                    ActivityEditNumberField(
                        label = stringResource(R.string.activities_field_distance),
                        value = distanceKm,
                        keyboardType = KeyboardType.Decimal
                    ) { distanceKm = sanitizeDecimalInput(it) }
                    Spacer(Modifier.height(12.dp))
                    ActivityEditNumberField(
                        label = stringResource(R.string.activities_field_duration),
                        value = movingTimeMin,
                        keyboardType = KeyboardType.Text
                    ) { movingTimeMin = sanitizeDurationInput(it) }
                    Spacer(Modifier.height(12.dp))
                    ActivityEditNumberField(
                        label = stringResource(R.string.activities_field_elevation),
                        value = dPlus,
                        keyboardType = KeyboardType.Number
                    ) { dPlus = it.filter(Char::isDigit) }
                }
            }

            item {
                SectionCard {
                    SectionTitle("Sport")
                    Spacer(Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        editableActivityTypes.forEach { option ->
                            ActionChip(
                                label = stringResource(option.labelRes),
                                active = type == option.value,
                                onClick = {
                                    type = option.value
                                    if (!typeSupportsIntensity(option.value)) {
                                        intensity = null
                                    } else if (intensity == null) {
                                        intensity = defaultIntensityForType(option.value)
                                    }
                                }
                            )
                        }
                    }
                }
            }

            if (supportsIntensity) {
                item {
                    SectionCard {
                        SectionTitle("Intensité")
                        Spacer(Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            intensityOptionsForType(type).forEach { option ->
                                ActionChip(
                                    label = intensityOptionLabel(option, type),
                                    active = intensity == option,
                                    onClick = { intensity = option }
                                )
                            }
                        }
                    }
                }
            }

            item {
                if (errorMessage != null) {
                    SectionCard {
                        Text(
                            text = errorMessage!!,
                            color = TrailColors.RunRed,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ActionChip(label = "Annuler", active = false, onClick = onBack)
                    ActionChip(
                        label = if (isSaving) "Enregistrement..." else "Enregistrer",
                        active = true,
                        onClick = {
                            val parsedDistance = distanceKm.replace(',', '.').toDoubleOrNull()
                            val parsedDuration = parseDurationMinutesInput(movingTimeMin)
                            val parsedDPlus = dPlus.toIntOrNull()

                            when {
                                activityName.isBlank() -> errorMessage = errInvalidTitle
                                parsedDistance == null || parsedDistance < 0 -> errorMessage = errInvalidDistance
                                parsedDuration == null || parsedDuration < 0 -> errorMessage = errInvalidDuration
                                parsedDPlus == null || parsedDPlus < 0 -> errorMessage = errInvalidElevation
                                type.isBlank() -> errorMessage = chooseSportMsg
                                else -> {
                                    errorMessage = null
                                    isSaving = true
                                    onSave(
                                        activity.id,
                                        activityName.trim(),
                                        parsedDistance,
                                        parsedDuration,
                                        parsedDPlus,
                                        type,
                                        if (supportsIntensity) intensity else null
                                    ) { result ->
                                        isSaving = false
                                        result.exceptionOrNull()?.let {
                                            errorMessage = it.message ?: "Impossible d'enregistrer."
                                        }
                                    }
                                }
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun SettingsTab(
    connected: Boolean,
    athleteName: String,
    authEvent: String?,
    themeMode: ThemeMode,
    onThemeModeChange: (ThemeMode) -> Unit,
    onConnectStrava: () -> Unit,
    onSyncStrava: () -> Unit = {},
    onLogout: () -> Unit = {}
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            SectionCard {
                SectionTitle("Compte et synchronisation")
                Spacer(Modifier.height(10.dp))
                SettingsRow(
                    title = "Connexion Strava",
                    value = if (connected) stringResource(R.string.cockpit_strava_connected_label) else stringResource(R.string.cockpit_strava_not_connected),
                    accent = if (connected) TrailColors.GreenOk else TrailColors.ChargeOrange
                )
                Spacer(Modifier.height(8.dp))
                SettingsRow(
                    title = stringResource(R.string.cockpit_strava_athlete),
                    value = athleteName,
                    accent = TrailColors.SeriesBlue
                )
                Spacer(Modifier.height(8.dp))
                SettingsRow(
                    title = stringResource(R.string.cockpit_strava_oauth_status),
                    value = authEvent ?: "Prêt pour le branchement final",
                    accent = TrailColors.SeriesYellow
                )
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ActionChip(
                        label = if (connected) stringResource(R.string.cockpit_strava_reconnect) else stringResource(R.string.cockpit_strava_connect),
                        active = true,
                        onClick = onConnectStrava
                    )
                    if (connected) {
                        ActionChip(label = "Sync", active = true, onClick = onSyncStrava)
                    }
                    ActionChip(
                        label = "Se déconnecter",
                        active = false,
                        onClick = onLogout
                    )
                }
            }
        }
        item {
            SectionCard {
                SectionTitle("Apparence")
                Spacer(Modifier.height(10.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ThemeMode.entries.forEach { mode ->
                        ActionChip(
                            label = mode.label,
                            active = mode == themeMode,
                            onClick = { onThemeModeChange(mode) }
                        )
                    }
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    text = when (themeMode) {
                        ThemeMode.Dark -> "Le draft V2 tourne actuellement en thème sombre natif."
                        ThemeMode.Light -> "Le thème clair est prévu dans ce bloc réglages. Je le brancherai proprement sur toute l'app à l'étape suivante."
                        ThemeMode.System -> "Le mode système servira à suivre automatiquement le téléphone quand les deux palettes seront en place."
                    },
                    color = TrailColors.SubtleText,
                    fontSize = 11.sp,
                    lineHeight = 16.sp
                )
            }
        }
        item {
            SectionCard {
                SectionTitle("Préférences cockpit")
                Spacer(Modifier.height(10.dp))
                SettingsRow(
                    title = "Écran d'ouverture",
                    value = "Cockpit",
                    accent = TrailColors.ChargeOrange
                )
                Spacer(Modifier.height(8.dp))
                SettingsRow(
                    title = "Source de données active",
                    value = if (connected) "Strava + données cockpit" else "Draft local + backend",
                    accent = TrailColors.SeriesBlue
                )
                Spacer(Modifier.height(8.dp))
                SettingsRow(
                    title = "Granularité stats",
                    value = stringResource(R.string.stats_weekly_label),
                    accent = TrailColors.GreenOk
                )
            }
        }
        item {
            SectionCard {
                SectionTitle("À venir")
                Spacer(Modifier.height(10.dp))
                BulletLine("Notifications de synchro Strava")
                BulletLine(stringResource(R.string.cockpit_fav_metrics))
                BulletLine("Unités, zones, fréquence cardiaque et seuils")
                BulletLine("Gestion du compte et export de données")
            }
        }
    }
}

@Composable
private fun BottomTabs(
    selectedTab: DashboardTab,
    onSelectedTab: (DashboardTab) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(TrailColors.Surface)
            .border(1.dp, TrailColors.Border)
            .padding(horizontal = 4.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        DashboardTab.entries.forEach { tab ->
            val selected = tab == selectedTab
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .clickable { onSelectedTab(tab) }
                    .background(if (selected) TrailColors.HeaderBg else Color.Transparent)
                    .padding(vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = when (tab) {
                        DashboardTab.Cockpit -> "⚡"
                        DashboardTab.Stats -> "📊"
                        DashboardTab.Charge -> "💪"
                        DashboardTab.Plan -> "📅"
                        DashboardTab.Activities -> "🏃"
                        DashboardTab.Settings -> "⚙️"
                    },
                    fontSize = 20.sp
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = stringResource(tab.labelRes),
                    color = if (selected) TrailColors.ChargeOrange else TrailColors.SubtleText,
                    fontSize = 13.sp,
                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
                )
            }
        }
    }
}

@Composable
private fun SectionCard(
    content: @Composable () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(TrailColors.CardBg)
            .border(1.dp, TrailColors.Border, RoundedCornerShape(12.dp))
            .padding(10.dp)
    ) {
        content()
    }
}

@Composable
private fun SettingsRow(
    title: String,
    value: String,
    accent: Color
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(TrailColors.Surface)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            color = TrailColors.Text,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = value,
            color = accent,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun BulletLine(text: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .padding(top = 6.dp)
                .size(6.dp)
                .clip(CircleShape)
                .background(TrailColors.ChargeOrange)
        )
        Text(
            text = text,
            color = TrailColors.SubtleText,
            fontSize = 11.sp
        )
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        color = TrailColors.SubtleText,
        fontWeight = FontWeight.SemiBold,
        fontSize = 15.sp
    )
}

@Composable
private fun TinyLabel(text: String) {
    Text(
        text = text.uppercase(),
        color = TrailColors.SubtleText,
        fontSize = 10.sp,
        fontWeight = FontWeight.SemiBold
    )
}

@Composable
private fun TsbBadge(tsb: Int) {
    val bg = when {
        tsb >= 10 -> Color(0xFF0C2A4A)
        tsb >= 0 -> TrailColors.PaleGreen
        tsb >= -10 -> Color(0xFF2A1F00)
        else -> Color(0xFF2A0A0A)
    }
    val fg = when {
        tsb >= 10 -> TrailColors.SeriesBlue
        tsb >= 0 -> TrailColors.GreenOk
        tsb >= -10 -> TrailColors.SeriesYellow
        else -> TrailColors.RunRed
    }
    val label = when {
        tsb >= 10 -> stringResource(R.string.charge_very_fresh)
        tsb >= 0 -> stringResource(R.string.charge_fit)
        tsb >= -10 -> stringResource(R.string.charge_moderate)
        else -> "Fatigué"
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .border(1.dp, fg.copy(alpha = 0.35f), RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 5.dp)
    ) {
        Text(
            text = label,
            color = fg,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun GoalProgressRow(
    label: String,
    current: Double,
    target: Double,
    unit: String,
    color: Color
) {
    val ratio = if (target <= 0.0) 0f else (current / target).coerceIn(0.0, 1.0).toFloat()
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(label, color = TrailColors.SubtleText, fontSize = 16.sp)
                Text(
                    text = "${format1(current)}$unit / ${format1(target)}$unit",
                    color = color,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp
                )
            }
            Spacer(Modifier.height(6.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(TrailColors.Border)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(ratio)
                        .height(6.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(color)
                )
            }
        }
    }
}

@Composable
private fun CompactMetricCard(
    label: String,
    value: Int,
    subtitle: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(TrailColors.Surface)
            .padding(12.dp)
    ) {
        TinyLabel(subtitle)
        Spacer(Modifier.height(3.dp))
        Text(
            text = value.toString(),
            color = color,
            fontWeight = FontWeight.Black,
            fontSize = 30.sp
        )
        Text(
            text = label,
            color = TrailColors.SubtleText,
            fontSize = 10.sp
        )
    }
}

@Composable
private fun HistoryPill(
    label: String,
    km: Double,
    dPlus: Int,
    suffer: Int,
    modifier: Modifier = Modifier
) {
    val active = km > 0
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (active) TrailColors.ChargeOrange.copy(alpha = 0.12f) else TrailColors.Surface)
            .border(1.dp, if (active) TrailColors.ChargeOrange.copy(alpha = 0.35f) else TrailColors.Border, RoundedCornerShape(12.dp))
            .padding(vertical = 10.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(text = label, color = if (active) TrailColors.ChargeOrange else TrailColors.SubtleText, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        if (active) {
            Text(text = format1(km), color = TrailColors.Text, fontWeight = FontWeight.Bold, fontSize = 19.sp)
            Text("km", color = TrailColors.SubtleText, fontSize = 15.sp)
            if (dPlus > 0) {
                Text("↑$dPlus", color = TrailColors.SeriesBlue, fontSize = 15.sp)
            }
            Text(
                text = "⚡ ${if (suffer > 0) "$suffer" else "—"}",
                color = if (suffer > 0) TrailColors.SeriesYellow else TrailColors.Border,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold
            )
        } else {
            Text("·", color = TrailColors.Border, fontSize = 20.sp)
        }
    }
}

@Composable
private fun ActionChip(
    label: String,
    active: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (active) TrailColors.ChargeOrange.copy(alpha = 0.16f) else TrailColors.Surface)
            .border(
                1.dp,
                if (active) TrailColors.ChargeOrange else TrailColors.Border,
                RoundedCornerShape(999.dp)
            )
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Text(
            text = label,
            color = if (active) TrailColors.ChargeOrange else TrailColors.SubtleText,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun WeekRecapRow(point: WeeklyPoint) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 7.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = shortWeekLabel(point.weekLabel),
            color = TrailColors.Text,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("${format1(point.km)} km", color = TrailColors.ChargeOrange, fontSize = 12.sp)
            Text("${point.dPlus} m", color = TrailColors.SeriesBlue, fontSize = 12.sp)
            Text(
                text = if (point.tsb > 0) "+${point.tsb}" else point.tsb.toString(),
                color = if (point.tsb >= 0) TrailColors.GreenOk else TrailColors.RunRed,
                fontSize = 12.sp
            )
        }
    }
}

@Composable
private fun CycleRow(cycle: CycleDraft) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(TrailColors.Surface)
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Box(
            modifier = Modifier
                .width(4.dp)
                .height(54.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(
                    when (cycle.title) {
                        "Cycle 1" -> TrailColors.ChargeOrange
                        "Cycle 2" -> TrailColors.SeriesBlue
                        "Cycle 3" -> TrailColors.GreenOk
                        else -> TrailColors.SeriesYellow
                    }
                )
        )
        Column {
            Text(
                text = "${cycle.title} - ${cycle.duration}",
                color = TrailColors.Text,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = cycle.objective,
                color = TrailColors.SubtleText,
                fontSize = 11.sp,
                lineHeight = 16.sp
            )
        }
    }
}

@Composable
private fun PlanSessionRow(session: DaySession) {
    if (session.label.isBlank() && session.volumeKm == 0.0) return
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = session.day.take(3),
            color = TrailColors.SubtleText,
            fontSize = 11.sp,
            modifier = Modifier.width(34.dp)
        )
        Text(
            text = session.label.ifBlank { "Repos" },
            color = TrailColors.Text,
            fontSize = 12.sp,
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = "${format1(session.volumeKm)} km",
            color = TrailColors.ChargeOrange,
            fontSize = 11.sp
        )
    }
}

@Composable
private fun TypeBadge(type: String) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val color = activityTypeColor(type)
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(color.copy(alpha = 0.16f))
            .border(1.dp, color.copy(alpha = 0.35f), RoundedCornerShape(999.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp)
    ) {
        Text(
            text = displayActivityType(type, context),
            color = color,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun ActivityMetricTile(
    label: String,
    value: String,
    unit: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    val safeLabel = when (label) {
        "DurÃ©e" -> "Dur\u00E9e"
        else -> label
    }
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(TrailColors.Surface)
            .padding(horizontal = 10.dp, vertical = 8.dp)
    ) {
        Text(
            text = safeLabel,
            color = TrailColors.SubtleText,
            fontSize = 11.sp
        )
        Spacer(Modifier.height(2.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                text = value,
                color = color,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp
            )
            if (unit.isNotEmpty()) {
                Spacer(Modifier.width(3.dp))
                Text(
                    text = unit,
                    color = TrailColors.SubtleText,
                    fontSize = 11.sp
                )
            }
        }
    }
}

@Composable
private fun ActivityEditNumberField(
    label: String,
    value: String,
    keyboardType: KeyboardType,
    onValueChange: (String) -> Unit
) {
    Column {
        Text(label, color = TrailColors.SubtleText, fontSize = 11.sp)
        Spacer(Modifier.height(4.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = TrailColors.Text,
                unfocusedTextColor = TrailColors.Text,
                focusedBorderColor = TrailColors.ChargeOrange,
                unfocusedBorderColor = TrailColors.Border,
                focusedContainerColor = TrailColors.Surface,
                unfocusedContainerColor = TrailColors.Surface
            ),
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun CockpitKpiTile(
    icon: String,
    title: String,
    subline: String,
    barValues: List<Float>,
    barLabels: List<String>,
    barColor: Color,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(TrailColors.Surface)
            .border(1.dp, TrailColors.Border, RoundedCornerShape(10.dp))
            .padding(horizontal = 8.dp, vertical = 5.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon.isNotEmpty()) {
                Text(text = icon, fontSize = 14.sp)
                Spacer(Modifier.width(3.dp))
            }
            Text(
                text = title,
                color = TrailColors.SubtleText,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Spacer(Modifier.height(3.dp))
        content()
        Spacer(Modifier.height(2.dp))
        Text(
            text = subline,
            color = TrailColors.SubtleText,
            fontSize = 12.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            lineHeight = 14.sp
        )
        Spacer(Modifier.height(4.dp))
        FullWidthBarStrip(values = barValues, labels = barLabels, color = barColor)
    }
}

@Composable
private fun GoalSettingsDialog(
    runWeekTarget: Int,
    dplusWeekTarget: Int,
    runYearTarget: Int,
    onConfirm: (Int, Int, Int) -> Unit,
    onDismiss: () -> Unit
) {
    var runWeekStr by remember { mutableStateOf(runWeekTarget.toString()) }
    var dplusStr by remember { mutableStateOf(dplusWeekTarget.toString()) }
    var yearStr by remember { mutableStateOf(runYearTarget.toString()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = TrailColors.CardBg,
        titleContentColor = TrailColors.Text,
        textContentColor = TrailColors.Text,
        title = { Text(stringResource(R.string.cockpit_goals_set), fontWeight = FontWeight.Bold, fontSize = 16.sp) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                GoalField("Distance run (semaine) — km", runWeekStr) { runWeekStr = it }
                GoalField("Dénivelé + (semaine) — m", dplusStr) { dplusStr = it }
                GoalField("Distance run (année) — km", yearStr) { yearStr = it }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onConfirm(
                    runWeekStr.toIntOrNull() ?: runWeekTarget,
                    dplusStr.toIntOrNull() ?: dplusWeekTarget,
                    yearStr.toIntOrNull() ?: runYearTarget
                )
            }) {
                Text("Valider", color = TrailColors.ChargeOrange, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler", color = TrailColors.SubtleText)
            }
        }
    )
}

@Composable
private fun GoalField(label: String, value: String, onValueChange: (String) -> Unit) {
    Column {
        Text(label, color = TrailColors.SubtleText, fontSize = 11.sp)
        Spacer(Modifier.height(4.dp))
        OutlinedTextField(
            value = value,
            onValueChange = { if (it.all { c -> c.isDigit() }) onValueChange(it) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = TrailColors.Text,
                unfocusedTextColor = TrailColors.Text,
                focusedBorderColor = TrailColors.ChargeOrange,
                unfocusedBorderColor = TrailColors.Border,
                focusedContainerColor = TrailColors.Surface,
                unfocusedContainerColor = TrailColors.Surface
            ),
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Composable
private fun SimpleGoalDialog(
    title: String,
    sport: SportMode,
    weekTarget: Int,
    yearTarget: Int,
    onConfirm: (Int, Int) -> Unit,
    onDismiss: () -> Unit
) {
    var weekStr by remember { mutableStateOf(weekTarget.toString()) }
    var yearStr by remember { mutableStateOf(yearTarget.toString()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = TrailColors.CardBg,
        titleContentColor = TrailColors.Text,
        textContentColor = TrailColors.Text,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(sport.icon, fontSize = 18.sp)
                Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                GoalField("Distance (semaine) — km", weekStr) { weekStr = it }
                GoalField("Distance (année) — km", yearStr) { yearStr = it }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onConfirm(weekStr.toIntOrNull() ?: weekTarget, yearStr.toIntOrNull() ?: yearTarget)
            }) {
                Text("Valider", color = TrailColors.ChargeOrange, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler", color = TrailColors.SubtleText)
            }
        }
    )
}

@Composable
private fun ChartPeriodDialog(
    current: ChartPeriod,
    onSelect: (ChartPeriod) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = TrailColors.CardBg,
        titleContentColor = TrailColors.Text,
        textContentColor = TrailColors.Text,
        title = { Text(stringResource(R.string.cockpit_chart_period), fontWeight = FontWeight.Bold, fontSize = 16.sp) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ChartPeriod.entries.forEach { period ->
                    val selected = period == current
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (selected) TrailColors.ChargeOrange.copy(alpha = 0.15f) else TrailColors.Surface)
                            .border(1.dp, if (selected) TrailColors.ChargeOrange else TrailColors.Border, RoundedCornerShape(10.dp))
                            .clickable { onSelect(period) }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = stringResource(period.labelRes),
                            color = if (selected) TrailColors.ChargeOrange else TrailColors.Text,
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                            fontSize = 14.sp
                        )
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler", color = TrailColors.SubtleText)
            }
        }
    )
}

@Composable
private fun BlockMoreIcon(onClick: () -> Unit) {
    Icon(
        imageVector = Icons.Default.MoreVert,
        contentDescription = stringResource(R.string.cockpit_configure_block),
        tint = TrailColors.SubtleText,
        modifier = Modifier.size(20.dp).clickable { onClick() }
    )
}

@Composable
private fun PagerDotsRow(pageCount: Int, currentPage: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        repeat(pageCount) { index ->
            val isActive = index == currentPage
            Box(
                modifier = Modifier
                    .padding(horizontal = 3.dp)
                    .size(if (isActive) 8.dp else 6.dp)
                    .clip(CircleShape)
                    .background(if (isActive) TrailColors.ChargeOrange else TrailColors.SubtleText.copy(alpha = 0.4f))
            )
        }
    }
}

@Composable
private fun AddBlockDialog(
    hiddenBlockTypes: List<BlockType>,
    onSelect: (BlockType) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = TrailColors.CardBg,
        titleContentColor = TrailColors.Text,
        title = { Text(stringResource(R.string.cockpit_add_block), fontWeight = FontWeight.Bold, fontSize = 16.sp) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                hiddenBlockTypes.forEach { blockType ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(TrailColors.Surface)
                            .border(1.dp, TrailColors.Border, RoundedCornerShape(10.dp))
                            .clickable { onSelect(blockType) }
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = blockType.typeName(),
                            color = TrailColors.Text,
                            fontSize = 14.sp
                        )
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler", color = TrailColors.SubtleText)
            }
        }
    )
}

@Composable
private fun BlockConfigScreen(
    blockType: BlockType,
    visibleBlocks: SnapshotStateList<CockpitBlock>,
    hiddenBlocks: SnapshotStateList<CockpitBlock>,
    onBack: () -> Unit
) {
    val allVariants = CockpitBlock.entries.filter { it.type == blockType }
    val visibleForType = visibleBlocks.filter { it.type == blockType }
    val defaultBlock = visibleForType.firstOrNull()

    Column(Modifier.fillMaxSize().background(TrailColors.Background)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(TrailColors.Surface)
                .border(1.dp, TrailColors.Border)
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Retour",
                tint = TrailColors.Text,
                modifier = Modifier.size(22.dp).clickable { onBack() }
            )
            Text(
                text = blockType.typeName(),
                color = TrailColors.Text,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp
            )
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item("hdr_visible") {
                Text(
                    stringResource(R.string.activities_to_display),
                    color = TrailColors.SubtleText,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
            }
            items(allVariants, key = { "vis_${it.name}" }) { block ->
                val isEnabled = block in visibleBlocks
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(TrailColors.CardBg)
                        .border(1.dp, TrailColors.Border, RoundedCornerShape(10.dp))
                        .clickable {
                            if (isEnabled) {
                                visibleBlocks.remove(block)
                                hiddenBlocks.add(0, block)
                            } else {
                                hiddenBlocks.remove(block)
                                val lastIdx = visibleBlocks.indexOfLast { it.type == blockType }
                                if (lastIdx >= 0) visibleBlocks.add(lastIdx + 1, block)
                                else visibleBlocks.add(block)
                            }
                        }
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Checkbox(
                        checked = isEnabled,
                        onCheckedChange = null,
                        colors = CheckboxDefaults.colors(
                            checkedColor = TrailColors.ChargeOrange,
                            uncheckedColor = TrailColors.SubtleText
                        )
                    )
                    Text(
                        text = block.sport?.icon ?: "⚡",
                        fontSize = 18.sp
                    )
                    Text(
                        text = block.sport?.let { stringResource(it.labelRes) } ?: stringResource(R.string.block_all_activities),
                        color = TrailColors.Text,
                        fontWeight = if (isEnabled) FontWeight.SemiBold else FontWeight.Normal,
                        fontSize = 15.sp,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            item("hint_hide_block") {
                Text(
                    text = stringResource(R.string.cockpit_uncheck_hides_block),
                    color = TrailColors.SubtleText,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 6.dp, start = 4.dp)
                )
            }

            item("hdr_default") {
                Spacer(Modifier.height(12.dp))
                Text(
                    stringResource(R.string.cockpit_default_activity),
                    color = TrailColors.SubtleText,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
                Text(
                    stringResource(R.string.cockpit_shown_first),
                    color = TrailColors.SubtleText,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(bottom = 6.dp)
                )
            }
            if (visibleForType.isEmpty()) {
                item("def_empty") {
                    Text(
                        stringResource(R.string.cockpit_block_hidden),
                        color = TrailColors.SubtleText,
                        fontSize = 13.sp
                    )
                }
            } else {
                items(visibleForType, key = { "def_${it.name}" }) { block ->
                    val isDefault = block == defaultBlock
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (isDefault) TrailColors.ChargeOrange.copy(alpha = 0.12f) else TrailColors.CardBg)
                            .border(1.dp, if (isDefault) TrailColors.ChargeOrange else TrailColors.Border, RoundedCornerShape(10.dp))
                            .clickable {
                                if (!isDefault) {
                                    val firstIdx = visibleBlocks.indexOfFirst { it.type == blockType }
                                    if (firstIdx >= 0) {
                                        val others = visibleForType.filter { it != block }
                                        visibleBlocks.removeAll { it.type == blockType }
                                        visibleBlocks.addAll(firstIdx, listOf(block) + others)
                                    }
                                }
                            }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        RadioButton(
                            selected = isDefault,
                            onClick = null,
                            colors = RadioButtonDefaults.colors(
                                selectedColor = TrailColors.ChargeOrange,
                                unselectedColor = TrailColors.SubtleText
                            )
                        )
                        Text(
                            text = block.sport?.icon ?: "⚡",
                            fontSize = 18.sp
                        )
                        Text(
                            text = block.sport?.let { stringResource(it.labelRes) } ?: stringResource(R.string.block_all_activities),
                            color = if (isDefault) TrailColors.ChargeOrange else TrailColors.Text,
                            fontWeight = if (isDefault) FontWeight.SemiBold else FontWeight.Normal,
                            fontSize = 15.sp,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BlockType.typeName(): String = when (this) {
    BlockType.Kpis -> "Volume d'activités"
    BlockType.Goals -> stringResource(R.string.cockpit_goals_title)
    BlockType.Chart -> "km/D+"
    BlockType.Days -> stringResource(R.string.cockpit_historique)
    BlockType.KmDPlus -> stringResource(R.string.stats_km_dplus_title)
    BlockType.CumulMonths -> stringResource(R.string.stats_km_monthly_title)
    BlockType.Load -> "Charge"
    BlockType.Intensity -> "Intensités"
    BlockType.Strava -> "Sync Strava"
    BlockType.CurrentWeek -> "Semaine en cours"
}

private data class CumulativeMonthsChartData(val xLabels: List<String>, val series: List<LineSeries>)

@Composable
private fun getCumulativeMonthsData(
    sport: SportMode?,
    activities: List<ActivityDraft>,
    bikeMonthlyKm: List<Double>,
    swimMonthlyKm: List<Double>
): CumulativeMonthsChartData {
    val monthColors = listOf(TrailColors.SeriesGreen, TrailColors.SeriesOrange, TrailColors.SeriesRed, TrailColors.SeriesBlue)
    val currentYear = LocalDate.now().year
    val monthLabels = (1..4).map { i -> "${java.time.Month.of(i).getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.getDefault())} $currentYear" }
    val daysPerMonth = listOf(31, 28, 31, 26) // Last 4 months (Jan, Feb, Mar, Apr)

    val lastDayIndices = daysPerMonth.map { it - 1 }

    val xLabels = (1..31).map { "$it" }
    val series = mutableListOf<LineSeries>()

    when (sport) {
        SportMode.Run -> {
            val runData = calculateRunCumulativeData(activities, daysPerMonth)
            runData.forEachIndexed { i, data ->
                series.add(LineSeries(monthLabels[i], monthColors[i], data.take(daysPerMonth[i]), drawPoints = true, valueLabelIndices = listOf(lastDayIndices[i])))
            }
        }
        SportMode.Bike -> {
            val bikeData = (0..3).map { m ->
                val monthTotal = bikeMonthlyKm.getOrElse(m) { 0.0 }
                val daysInMonth = daysPerMonth[m]
                val daysData = mutableListOf<Double>()
                for (d in 1..daysInMonth) {
                    daysData.add((monthTotal / daysInMonth) * d + (d % 3).toDouble())
                }
                daysData
            }
            bikeData.forEachIndexed { i, data ->
                series.add(LineSeries(monthLabels[i], monthColors[i], data, drawPoints = true, valueLabelIndices = listOf(lastDayIndices[i])))
            }
        }
        SportMode.Swim -> {
            val swimData = (0..3).map { m ->
                val monthTotal = swimMonthlyKm.getOrElse(m) { 0.0 }
                val daysInMonth = daysPerMonth[m]
                val daysData = mutableListOf<Double>()
                for (d in 1..daysInMonth) {
                    daysData.add((monthTotal / daysInMonth) * d + (d % 4).toDouble() * 0.5)
                }
                daysData
            }
            swimData.forEachIndexed { i, data ->
                series.add(LineSeries(monthLabels[i], monthColors[i], data, drawPoints = true, valueLabelIndices = listOf(lastDayIndices[i])))
            }
        }
        null -> {
            val runData = calculateRunCumulativeData(activities, daysPerMonth)
            val combinedData = (0..3).map { m ->
                val daysInMonth = daysPerMonth[m]
                val bikeTotal = bikeMonthlyKm.getOrElse(m) { 0.0 }
                val swimTotal = swimMonthlyKm.getOrElse(m) { 0.0 }
                val bikePerDay = bikeTotal / daysInMonth
                val swimPerDay = swimTotal / daysInMonth
                runData[m].take(daysInMonth).map { it + (bikePerDay + swimPerDay) * ((runData[m].take(daysInMonth).indexOf(it) + 1)) }
            }
            combinedData.forEachIndexed { i, data ->
                series.add(LineSeries(monthLabels[i], monthColors[i], data, drawPoints = true, valueLabelIndices = listOf(lastDayIndices[i])))
            }
        }
    }

    return CumulativeMonthsChartData(xLabels, series)
}

private fun calculateRunCumulativeData(activities: List<ActivityDraft>, daysPerMonth: List<Int>): List<List<Double>> {
    val monthIndices = listOf(0, 1, 2, 3) // Jan, Feb, Mar, Apr
    val currentYear = LocalDate.now().year.toString()

    return monthIndices.map { monthIndex ->
        val monthNum = monthIndex + 1
        val daysInMonth = daysPerMonth[monthIndex]
        val dailyKm = MutableList(daysInMonth) { 0.0 }

        // Filter activities for Running and this month
        activities
            .filter { it.type.equals("Run", ignoreCase = true) }
            .filter {
                val parts = it.date.split("-")
                parts.getOrNull(0) == currentYear && parts.getOrNull(1)?.toIntOrNull() == monthNum
            }
            .forEach { activity ->
                val dayOfMonth = activity.date.split("-").getOrNull(2)?.toIntOrNull() ?: return@forEach
                if (dayOfMonth in 1..daysInMonth) {
                    dailyKm[dayOfMonth - 1] += activity.distanceKm
                }
            }

        // Convert daily km to cumulative km
        var cumulative = 0.0
        dailyKm.map { km ->
            cumulative += km
            cumulative
        }
    }
}

private fun monthShortLabel(yyyyMm: String): String {
    val month = yyyyMm.split("-").getOrNull(1)?.toIntOrNull() ?: return yyyyMm
    return try {
        java.time.Month.of(month).getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.getDefault())
    } catch (_: Exception) { yyyyMm }
}

private fun shortWeekLabel(isoDate: String): String {
    val parts = isoDate.split("-")
    return if (parts.size == 3) "${parts[2]}/${parts[1]}" else isoDate
}

private fun shortDayLabel(isoDate: String): String {
    val parts = isoDate.split("-")
    return if (parts.size == 3) "${parts[2]}/${parts[1]}" else isoDate
}

private data class ActivityTypeOption(
    val value: String,
    @StringRes val labelRes: Int
)

private data class ActivityMetricSpec(
    val label: String,
    val value: String,
    val unit: String
)

private val editableActivityTypes = listOf(
    ActivityTypeOption("Run", R.string.sport_run_type_run),
    ActivityTypeOption("TrailRun", R.string.sport_run_type_trail),
    ActivityTypeOption("Walk", R.string.sport_run_type_walk),
    ActivityTypeOption("Hike", R.string.sport_run_type_hike),
    ActivityTypeOption("Ride", R.string.sport_bike_type_ride),
    ActivityTypeOption("VirtualRide", R.string.sport_bike_type_virtual),
    ActivityTypeOption("EBikeRide", R.string.sport_bike_type_ebike),
    ActivityTypeOption("Swim", R.string.sport_swim_type)
)

private fun sanitizeDecimalInput(value: String): String {
    val normalized = value.replace(',', '.')
    val builder = StringBuilder()
    var seenDot = false
    normalized.forEach { char ->
        when {
            char.isDigit() -> builder.append(char)
            char == '.' && !seenDot -> {
                builder.append(char)
                seenDot = true
            }
        }
    }
    return builder.toString()
}

private fun sanitizeDurationInput(value: String): String {
    val builder = StringBuilder()
    var seenColon = false
    value.forEach { char ->
        when {
            char.isDigit() -> builder.append(char)
            char == ':' && !seenColon -> {
                builder.append(char)
                seenColon = true
            }
        }
    }
    return builder.toString()
}

private fun parseDurationMinutesInput(value: String): Double? {
    val normalized = value.trim()
    if (normalized.isEmpty()) return null
    if (!normalized.contains(':')) return normalized.toDoubleOrNull()

    val parts = normalized.split(':')
    if (parts.size != 2) return null
    val minutes = parts[0].toIntOrNull() ?: return null
    val seconds = parts[1].toIntOrNull() ?: return null
    if (minutes < 0 || seconds !in 0..59) return null
    return minutes + (seconds / 60.0)
}

private fun formatEditableDuration(value: Double): String {
    val totalSeconds = (value * 60).toInt()
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "${minutes}:${seconds.toString().padStart(2, '0')}"
}

private fun formatPace(value: Double): String {
    if (value <= 0) return "--:--"
    val totalSeconds = (value * 60).toInt()
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "${minutes}:${seconds.toString().padStart(2, '0')}"
}

private fun formatSpeed(distanceKm: Double, movingTimeMin: Double): String {
    if (distanceKm <= 0 || movingTimeMin <= 0) return "--.-"
    val speed = distanceKm / (movingTimeMin / 60.0)
    return format1(speed)
}

private fun formatSwimPace(distanceKm: Double, movingTimeMin: Double): String {
    val distanceMeters = distanceKm * 1000.0
    if (distanceMeters <= 0 || movingTimeMin <= 0) return "--:--"
    val secondsPer100m = ((movingTimeMin * 60.0) / distanceMeters) * 100.0
    val totalSeconds = secondsPer100m.toInt()
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "${minutes}:${seconds.toString().padStart(2, '0')}"
}

private const val MapTileSize = 256.0
private const val MinMapZoom = 2
private const val MaxMapZoom = 19

private data class MapTileKey(val zoom: Int, val x: Int, val y: Int)
private data class VisibleMapTile(val key: MapTileKey, val worldX: Int, val worldY: Int)
private data class MapPixelPoint(val x: Double, val y: Double)
private data class MapLatLng(val lat: Double, val lng: Double)
private data class MapCamera(val zoom: Int, val lat: Double, val lng: Double)

private fun normalizedMapPoints(points: List<ActivityMapPoint>, encodedPolyline: String): List<ActivityMapPoint> {
    val source = points.ifEmpty { decodeActivityPolyline(encodedPolyline) }
    return source.filter { point ->
        point.lat in -85.05112878..85.05112878 && point.lng in -180.0..180.0
    }
}

private fun decodeActivityPolyline(encoded: String): List<ActivityMapPoint> {
    if (encoded.isBlank()) return emptyList()
    val decoded = mutableListOf<ActivityMapPoint>()
    var index = 0
    var lat = 0
    var lng = 0

    while (index < encoded.length) {
        var shift = 0
        var result = 0
        var b: Int
        do {
            if (index >= encoded.length) return decoded
            b = encoded[index++].code - 63
            result = result or ((b and 0x1f) shl shift)
            shift += 5
        } while (b >= 0x20)
        lat += if ((result and 1) != 0) (result shr 1).inv() else result shr 1

        shift = 0
        result = 0
        do {
            if (index >= encoded.length) return decoded
            b = encoded[index++].code - 63
            result = result or ((b and 0x1f) shl shift)
            shift += 5
        } while (b >= 0x20)
        lng += if ((result and 1) != 0) (result shr 1).inv() else result shr 1

        decoded += ActivityMapPoint(lat = lat / 100000.0, lng = lng / 100000.0)
    }

    return decoded
}

private fun projectMapPoint(lat: Double, lng: Double, zoom: Int): MapPixelPoint {
    val safeLat = lat.coerceIn(-85.05112878, 85.05112878)
    val sinLat = sin(safeLat * PI / 180.0)
    val scale = MapTileSize * 2.0.pow(zoom)
    return MapPixelPoint(
        x = (lng + 180.0) / 360.0 * scale,
        y = (0.5 - ln((1.0 + sinLat) / (1.0 - sinLat)) / (4.0 * PI)) * scale
    )
}

private fun unprojectMapPoint(x: Double, y: Double, zoom: Int): MapLatLng {
    val scale = MapTileSize * 2.0.pow(zoom)
    val lng = x / scale * 360.0 - 180.0
    val n = PI - 2.0 * PI * y / scale
    val lat = 180.0 / PI * atan(0.5 * (exp(n) - exp(-n)))
    return MapLatLng(
        lat = lat.coerceIn(-85.05112878, 85.05112878),
        lng = wrapLongitude(lng)
    )
}

private fun wrapLongitude(lng: Double): Double {
    return ((lng + 180.0) % 360.0 + 360.0) % 360.0 - 180.0
}

private fun fitMapCamera(points: List<ActivityMapPoint>, size: IntSize): MapCamera {
    if (points.size == 1) return MapCamera(MaxMapZoom - 3, points.first().lat, points.first().lng)

    val width = max(size.width.toDouble(), 320.0)
    val height = max(size.height.toDouble(), 240.0)
    val padding = 56.0

    for (zoom in MaxMapZoom downTo MinMapZoom) {
        var minX = Double.POSITIVE_INFINITY
        var maxX = Double.NEGATIVE_INFINITY
        var minY = Double.POSITIVE_INFINITY
        var maxY = Double.NEGATIVE_INFINITY

        points.forEach { point ->
            val projected = projectMapPoint(point.lat, point.lng, zoom)
            minX = min(minX, projected.x)
            maxX = max(maxX, projected.x)
            minY = min(minY, projected.y)
            maxY = max(maxY, projected.y)
        }

        if (maxX - minX <= width - padding && maxY - minY <= height - padding) {
            val center = unprojectMapPoint((minX + maxX) / 2.0, (minY + maxY) / 2.0, zoom)
            return MapCamera(zoom, center.lat, center.lng)
        }
    }

    val first = points.first()
    return MapCamera(MinMapZoom, first.lat, first.lng)
}

private fun visibleMapTiles(size: IntSize, zoom: Int, centerLat: Double, centerLng: Double): List<VisibleMapTile> {
    if (size.width <= 0 || size.height <= 0) return emptyList()

    val center = projectMapPoint(centerLat, centerLng, zoom)
    val originX = center.x - size.width / 2.0
    val originY = center.y - size.height / 2.0
    val startX = floor(originX / MapTileSize).toInt()
    val endX = floor((originX + size.width) / MapTileSize).toInt()
    val startY = floor(originY / MapTileSize).toInt()
    val endY = floor((originY + size.height) / MapTileSize).toInt()
    val tileCount = 1 shl zoom
    val tiles = mutableListOf<VisibleMapTile>()

    for (x in startX..endX) {
        for (y in startY..endY) {
            if (y !in 0 until tileCount) continue
            val wrappedX = ((x % tileCount) + tileCount) % tileCount
            tiles += VisibleMapTile(
                key = MapTileKey(zoom, wrappedX, y),
                worldX = x,
                worldY = y
            )
        }
    }

    return tiles
}

private suspend fun loadOsmTile(key: MapTileKey): ImageBitmap? {
    val bitmap = withContext(Dispatchers.IO) {
        runCatching {
            var connection: HttpURLConnection? = null
            try {
                connection = (URL("https://tile.openstreetmap.org/${key.zoom}/${key.x}/${key.y}.png").openConnection() as HttpURLConnection).apply {
                    connectTimeout = 5000
                    readTimeout = 5000
                    setRequestProperty("User-Agent", "TrailCockpit Android")
                }
                connection.inputStream.use { BitmapFactory.decodeStream(it) }
            } finally {
                connection?.disconnect()
            }
        }.getOrNull()
    }
    return bitmap?.asImageBitmap()
}

private fun DrawScope.drawNativeMap(
    routePoints: List<ActivityMapPoint>,
    visibleTiles: List<VisibleMapTile>,
    tileCache: Map<MapTileKey, ImageBitmap?>,
    zoom: Int,
    centerLat: Double,
    centerLng: Double
) {
    drawRect(Color(0xFF10201B))

    val center = projectMapPoint(centerLat, centerLng, zoom)
    val originX = center.x - size.width / 2.0
    val originY = center.y - size.height / 2.0

    visibleTiles.forEach { tile ->
        val left = (tile.worldX * MapTileSize - originX).toFloat()
        val top = (tile.worldY * MapTileSize - originY).toFloat()
        val image = tileCache[tile.key]
        if (image != null) {
            drawImage(image, topLeft = Offset(left, top))
        } else {
            drawRect(
                color = Color(0xFF163226),
                topLeft = Offset(left, top),
                size = Size(MapTileSize.toFloat(), MapTileSize.toFloat())
            )
            drawRect(
                color = Color.White.copy(alpha = 0.05f),
                topLeft = Offset(left, top),
                size = Size(MapTileSize.toFloat(), 1f)
            )
            drawRect(
                color = Color.White.copy(alpha = 0.05f),
                topLeft = Offset(left, top),
                size = Size(1f, MapTileSize.toFloat())
            )
        }
    }

    val path = Path()
    routePoints.forEachIndexed { index, point ->
        val projected = projectMapPoint(point.lat, point.lng, zoom)
        val x = (projected.x - originX).toFloat()
        val y = (projected.y - originY).toFloat()
        if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
    }

    drawPath(
        path = path,
        color = Color.White.copy(alpha = 0.9f),
        style = Stroke(width = 9f, cap = StrokeCap.Round, join = StrokeJoin.Round)
    )
    drawPath(
        path = path,
        color = Color(0xFFFF5A1F),
        style = Stroke(width = 5f, cap = StrokeCap.Round, join = StrokeJoin.Round)
    )

    fun marker(point: ActivityMapPoint, color: Color) {
        val projected = projectMapPoint(point.lat, point.lng, zoom)
        val centerOffset = Offset((projected.x - originX).toFloat(), (projected.y - originY).toFloat())
        drawCircle(Color.White, radius = 9f, center = centerOffset)
        drawCircle(color, radius = 6f, center = centerOffset)
    }

    marker(routePoints.first(), Color(0xFF22C55E))
    marker(routePoints.last(), Color(0xFFEF4444))
}

private fun buildInteractiveMapHtml(points: List<ActivityMapPoint>, encodedPolyline: String): String {
    val pointsJson = JSONArray().apply {
        points.forEach { point ->
            put(JSONArray().put(point.lat).put(point.lng))
        }
    }.toString()
    val encoded = JSONObject.quote(encodedPolyline)
    return """
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            html, body { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#0B1512; }
            #map {
              position:relative;
              width:100%;
              height:100%;
              overflow:hidden;
              touch-action:none;
              background:
                radial-gradient(circle at 20% 25%, rgba(53, 111, 81, .32), transparent 26%),
                radial-gradient(circle at 76% 12%, rgba(42, 91, 128, .26), transparent 22%),
                linear-gradient(135deg, #0B1512 0%, #10201B 100%);
              font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              color:#EAF6F0;
            }
            #tiles, #route { position:absolute; inset:0; width:100%; height:100%; }
            #tiles img {
              position:absolute;
              width:256px;
              height:256px;
              user-select:none;
              -webkit-user-drag:none;
            }
            #route { pointer-events:none; }
            .zoom {
              position:absolute;
              right:12px;
              top:12px;
              display:flex;
              flex-direction:column;
              border-radius:14px;
              overflow:hidden;
              box-shadow:0 12px 30px rgba(0,0,0,.28);
              z-index:3;
            }
            .zoom button {
              width:38px;
              height:36px;
              border:0;
              border-bottom:1px solid rgba(13,27,22,.12);
              background:rgba(247, 250, 248, .94);
              color:#0C1915;
              font-size:23px;
              font-weight:800;
              line-height:1;
            }
            .zoom button:last-child { border-bottom:0; }
            .attribution {
              position:absolute;
              right:8px;
              bottom:6px;
              padding:3px 6px;
              border-radius:8px;
              background:rgba(255,255,255,.82);
              color:#24312D;
              font-size:9px;
              z-index:3;
            }
            .hint {
              position:absolute;
              left:12px;
              bottom:12px;
              padding:7px 10px;
              border-radius:999px;
              background:rgba(12,25,21,.76);
              color:#DDEAE5;
              font-size:11px;
              font-weight:700;
              letter-spacing:.01em;
              z-index:3;
              backdrop-filter: blur(8px);
            }
          </style>
        </head>
        <body>
          <div id="map">
            <div id="tiles"></div>
            <canvas id="route"></canvas>
            <div class="zoom">
              <button id="zoomIn" aria-label="Zoomer">+</button>
              <button id="zoomOut" aria-label="D&eacute;zoomer">-</button>
            </div>
            <div class="hint">D&eacute;place et zoome la carte</div>
            <div class="attribution">&copy; OpenStreetMap</div>
          </div>
          <script>
            function decodePolyline(encoded) {
              var points = [], index = 0, lat = 0, lng = 0;
              while (index < encoded.length) {
                var b, shift = 0, result = 0;
                do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
                var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1)); lat += dlat;
                shift = 0; result = 0;
                do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
                var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1)); lng += dlng;
                points.push([lat / 1e5, lng / 1e5]);
              }
              return points;
            }

            var map = document.getElementById('map');
            var tiles = document.getElementById('tiles');
            var canvas = document.getElementById('route');
            var ctx = canvas.getContext('2d');
            var tileSize = 256;
            var minZoom = 2;
            var maxZoom = 19;
            var points = $pointsJson;
            var encoded = $encoded;
            if ((!points || points.length === 0) && encoded) points = decodePolyline(encoded);

            var state = {
              zoom: 13,
              centerLat: points.length ? points[0][0] : 48.8566,
              centerLng: points.length ? points[0][1] : 2.3522
            };

            function clamp(value, min, max) {
              return Math.max(min, Math.min(max, value));
            }

            function wrapLng(lng) {
              return ((lng + 180) % 360 + 360) % 360 - 180;
            }

            function project(lat, lng, zoom) {
              var sin = Math.sin(clamp(lat, -85.05112878, 85.05112878) * Math.PI / 180);
              var scale = tileSize * Math.pow(2, zoom);
              return {
                x: (lng + 180) / 360 * scale,
                y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
              };
            }

            function unproject(x, y, zoom) {
              var scale = tileSize * Math.pow(2, zoom);
              var lng = x / scale * 360 - 180;
              var n = Math.PI - 2 * Math.PI * y / scale;
              var lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
              return [clamp(lat, -85.05112878, 85.05112878), wrapLng(lng)];
            }

            function fitRoute() {
              if (!points || points.length === 0) return;
              if (points.length === 1) {
                state.zoom = 16;
                state.centerLat = points[0][0];
                state.centerLng = points[0][1];
                return;
              }
              var width = Math.max(map.clientWidth, 320);
              var height = Math.max(map.clientHeight, 240);
              var padding = 52;
              for (var zoom = maxZoom; zoom >= minZoom; zoom--) {
                var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                for (var i = 0; i < points.length; i++) {
                  var p = project(points[i][0], points[i][1], zoom);
                  minX = Math.min(minX, p.x);
                  maxX = Math.max(maxX, p.x);
                  minY = Math.min(minY, p.y);
                  maxY = Math.max(maxY, p.y);
                }
                if ((maxX - minX) <= width - padding && (maxY - minY) <= height - padding) {
                  state.zoom = zoom;
                  var center = unproject((minX + maxX) / 2, (minY + maxY) / 2, zoom);
                  state.centerLat = center[0];
                  state.centerLng = center[1];
                  return;
                }
              }
            }

            function topLeft(width, height) {
              var center = project(state.centerLat, state.centerLng, state.zoom);
              return { x: center.x - width / 2, y: center.y - height / 2 };
            }

            function drawTiles(origin, width, height) {
              var zoom = state.zoom;
              var count = Math.pow(2, zoom);
              var startX = Math.floor(origin.x / tileSize);
              var endX = Math.floor((origin.x + width) / tileSize);
              var startY = Math.floor(origin.y / tileSize);
              var endY = Math.floor((origin.y + height) / tileSize);
              var html = '';
              for (var x = startX; x <= endX; x++) {
                for (var y = startY; y <= endY; y++) {
                  if (y < 0 || y >= count) continue;
                  var wrappedX = ((x % count) + count) % count;
                  var left = Math.round(x * tileSize - origin.x);
                  var top = Math.round(y * tileSize - origin.y);
                  html += '<img alt="" draggable="false" style="left:' + left + 'px;top:' + top + 'px" src="https://tile.openstreetmap.org/' + zoom + '/' + wrappedX + '/' + y + '.png">';
                }
              }
              tiles.innerHTML = html;
            }

            function canvasPoint(point, origin) {
              var p = project(point[0], point[1], state.zoom);
              return { x: p.x - origin.x, y: p.y - origin.y };
            }

            function drawMarker(point, color, origin) {
              var p = canvasPoint(point, origin);
              ctx.beginPath();
              ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
              ctx.fillStyle = color;
              ctx.fill();
              ctx.lineWidth = 3;
              ctx.strokeStyle = '#ffffff';
              ctx.stroke();
            }

            function drawRoute(origin, width, height) {
              var dpr = window.devicePixelRatio || 1;
              canvas.width = Math.floor(width * dpr);
              canvas.height = Math.floor(height * dpr);
              canvas.style.width = width + 'px';
              canvas.style.height = height + 'px';
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
              ctx.clearRect(0, 0, width, height);
              if (!points || points.length === 0) return;

              ctx.lineJoin = 'round';
              ctx.lineCap = 'round';
              ctx.beginPath();
              for (var i = 0; i < points.length; i++) {
                var p = canvasPoint(points[i], origin);
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
              }
              ctx.strokeStyle = 'rgba(255,255,255,.88)';
              ctx.lineWidth = 9;
              ctx.stroke();

              ctx.beginPath();
              for (var j = 0; j < points.length; j++) {
                var q = canvasPoint(points[j], origin);
                if (j === 0) ctx.moveTo(q.x, q.y);
                else ctx.lineTo(q.x, q.y);
              }
              ctx.strokeStyle = '#ff5a1f';
              ctx.lineWidth = 5;
              ctx.stroke();

              drawMarker(points[0], '#22c55e', origin);
              drawMarker(points[points.length - 1], '#ef4444', origin);
            }

            function render() {
              var width = Math.max(map.clientWidth, 1);
              var height = Math.max(map.clientHeight, 1);
              var origin = topLeft(width, height);
              drawTiles(origin, width, height);
              drawRoute(origin, width, height);
            }

            function zoomBy(delta) {
              state.zoom = clamp(state.zoom + delta, minZoom, maxZoom);
              render();
            }

            function shiftCenter(dx, dy) {
              var current = project(state.centerLat, state.centerLng, state.zoom);
              var next = unproject(current.x - dx, current.y - dy, state.zoom);
              state.centerLat = next[0];
              state.centerLng = next[1];
              render();
            }

            var activePointers = {};
            var lastDrag = null;
            var pinch = null;

            function pointerList() {
              var list = [];
              for (var id in activePointers) list.push(activePointers[id]);
              return list;
            }

            function pinchState(list) {
              var dx = list[0].x - list[1].x;
              var dy = list[0].y - list[1].y;
              return { distance: Math.sqrt(dx * dx + dy * dy), zoom: state.zoom };
            }

            map.addEventListener('pointerdown', function(event) {
              event.preventDefault();
              if (map.setPointerCapture) map.setPointerCapture(event.pointerId);
              activePointers[event.pointerId] = { x: event.clientX, y: event.clientY };
              var list = pointerList();
              if (list.length === 1) lastDrag = { x: event.clientX, y: event.clientY };
              if (list.length === 2) pinch = pinchState(list);
            });

            map.addEventListener('pointermove', function(event) {
              if (!activePointers[event.pointerId]) return;
              event.preventDefault();
              activePointers[event.pointerId] = { x: event.clientX, y: event.clientY };
              var list = pointerList();
              if (list.length === 1 && lastDrag) {
                var dx = event.clientX - lastDrag.x;
                var dy = event.clientY - lastDrag.y;
                lastDrag = { x: event.clientX, y: event.clientY };
                shiftCenter(dx, dy);
              } else if (list.length === 2 && pinch) {
                var now = pinchState(list);
                var ratio = now.distance / pinch.distance;
                if (ratio > 1.18 && state.zoom < maxZoom) {
                  state.zoom += 1;
                  pinch = pinchState(list);
                  render();
                } else if (ratio < 0.84 && state.zoom > minZoom) {
                  state.zoom -= 1;
                  pinch = pinchState(list);
                  render();
                }
              }
            });

            function releasePointer(event) {
              delete activePointers[event.pointerId];
              var list = pointerList();
              lastDrag = list.length === 1 ? { x: list[0].x, y: list[0].y } : null;
              pinch = list.length === 2 ? pinchState(list) : null;
            }

            map.addEventListener('pointerup', releasePointer);
            map.addEventListener('pointercancel', releasePointer);
            map.addEventListener('wheel', function(event) {
              event.preventDefault();
              zoomBy(event.deltaY < 0 ? 1 : -1);
            }, { passive:false });

            document.getElementById('zoomIn').addEventListener('click', function(event) {
              event.preventDefault();
              zoomBy(1);
            });
            document.getElementById('zoomOut').addEventListener('click', function(event) {
              event.preventDefault();
              zoomBy(-1);
            });

            fitRoute();
            render();
            window.addEventListener('resize', render);
            setTimeout(render, 250);
            setTimeout(render, 900);
          </script>
        </body>
        </html>
    """.trimIndent()
}

private fun formatActivityDate(value: String): String {
    val datePart = value.substringBefore('T', value)
    val parts = datePart.split("-")
    return if (parts.size == 3) "${parts[2]}/${parts[1]}/${parts[0]}" else datePart
}

private fun formatActivityTime(value: String): String {
    val timePart = value.substringAfter('T', "00:00:00")
    return timePart.take(5).ifBlank { "00:00" }
}

private fun formatDurationMinutes(value: Double): String {
    val totalSeconds = (value * 60).toInt()
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) {
        "${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s"
    } else {
        "${minutes}m ${seconds.toString().padStart(2, '0')}s"
    }
}

private fun displayActivityType(type: String, context: android.content.Context): String {
    val res = editableActivityTypes.firstOrNull { it.value == type }?.labelRes ?: return type
    return context.getString(res)
}

private fun typeSupportsIntensity(type: String): Boolean {
    return type in setOf("Run", "TrailRun", "Ride", "VirtualRide", "EBikeRide")
}

private fun intensityOptionsForType(type: String): List<String> = when (type) {
    "Run", "TrailRun" -> listOf("Footing / EF", "Runtaf", "VMA", "Seuil", "Côtes", "Sortie longue", "Autre")
    "Ride", "VirtualRide", "EBikeRide" -> listOf("Balade", "Vélotaf", "Seuil", "Côtes", "Sortie longue", "Autre")
    else -> emptyList()
}

private fun defaultIntensityForType(type: String): String? {
    return intensityOptionsForType(type).firstOrNull()
}

private fun intensityOptionLabel(option: String, activityType: String): String = when (option) {
    "VMA" -> "🔥 VMA"
    "Seuil" -> "🥵 Seuil"
    "Côtes" -> "⛰️ Côtes"
    "Sortie longue" -> "⌚ Sortie longue"
    "Runtaf" -> "🏃‍♂️🏢 Runtaf"
    "Vélotaf" -> "🚴🏻🏢 Vélotaf"
    "Footing / EF" -> "🤘 Footing / EF"
    "Balade" -> "🤘 Balade"
    "Autre" -> if (isBikeActivityType(activityType)) "🚴🏻 Autre" else "🏃‍♂️ Autre"
    else -> option
}

private fun intensityEmoji(option: String, activityType: String): String = when (option) {
    "VMA" -> "🔥"
    "Seuil" -> "🥵"
    "Côtes" -> "⛰️"
    "Sortie longue" -> "⌚"
    "Runtaf" -> "🏃‍♂️🏢"
    "Vélotaf" -> "🚴🏻🏢"
    "Footing / EF" -> "🤘"
    "Balade" -> "🤘"
    "Autre" -> if (isBikeActivityType(activityType)) "🚴🏻" else "🏃‍♂️"
    else -> ""
}

private fun isBikeActivityType(type: String): Boolean {
    return type in setOf("Ride", "VirtualRide", "EBikeRide")
}

private fun isSwimActivityType(type: String): Boolean {
    return type == "Swim"
}

@Composable
private fun fourthMetricForActivity(activity: ActivityDraft): ActivityMetricSpec {
    return when {
        isBikeActivityType(activity.type) -> ActivityMetricSpec(
            label = stringResource(R.string.activities_field_speed),
            value = formatSpeed(activity.distanceKm, activity.movingTimeMin),
            unit = stringResource(R.string.unit_km_h)
        )
        isSwimActivityType(activity.type) -> ActivityMetricSpec(
            label = stringResource(R.string.activities_field_pace),
            value = formatSwimPace(activity.distanceKm, activity.movingTimeMin),
            unit = stringResource(R.string.unit_swim_pace)
        )
        else -> ActivityMetricSpec(
            label = stringResource(R.string.activities_field_pace),
            value = formatPace(activity.paceMinPerKm),
            unit = stringResource(R.string.unit_per_km)
        )
    }
}

@Composable
private fun activityTypeColor(type: String): Color = when (type) {
    "Swim" -> TrailColors.SeriesBlue
    "Ride", "VirtualRide", "EBikeRide" -> TrailColors.SeriesGreen
    "Walk", "Hike" -> TrailColors.SeriesYellow
    "TrailRun" -> TrailColors.RunRed
    "Run" -> TrailColors.ChargeOrange
    else -> TrailColors.SubtleText
}

private fun format1(value: Double): String {
    val pattern = if (value % 1.0 == 0.0) "%.0f" else "%.1f"
    return String.format(java.util.Locale.US, pattern, value)
}
