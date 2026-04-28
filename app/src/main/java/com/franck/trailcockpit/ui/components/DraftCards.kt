package com.franck.trailcockpit.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Route
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Timeline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.franck.trailcockpit.data.ActivityDraft
import com.franck.trailcockpit.data.BackendStepDraft
import com.franck.trailcockpit.data.CycleDraft
import com.franck.trailcockpit.data.StravaConnectionDraft
import com.franck.trailcockpit.data.SyncMode
import com.franck.trailcockpit.data.TrainingSourceDraft
import com.franck.trailcockpit.R
import com.franck.trailcockpit.data.WorkbookSectionDraft
import com.franck.trailcockpit.ui.theme.TrailColors

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TrainingSourceCard(source: TrainingSourceDraft) {
    DraftSectionCard(
        title = stringResource(R.string.draft_data_sources_title),
        subtitle = stringResource(R.string.draft_data_sources_subtitle)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DraftBadge(
                label = if (source.apiPushEnabled) stringResource(R.string.draft_api_push_active)
                        else stringResource(R.string.draft_api_push_inactive),
                bg = TrailColors.ProgressDPlusBg,
                fg = TrailColors.SeriesBlue
            )
            DraftBadge(
                label = when (source.syncMode) {
                    SyncMode.PushApi -> stringResource(R.string.draft_mode_push)
                    SyncMode.StravaOauth -> stringResource(R.string.draft_mode_strava)
                },
                bg = TrailColors.ProgressRunBg,
                fg = TrailColors.SeriesGreen
            )
        }
        Spacer(Modifier.height(10.dp))
        Text(
            text = stringResource(R.string.draft_file_ref, source.workbook.fileName),
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = TrailColors.Text
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = source.workbook.importedAt,
            fontSize = 11.sp,
            color = TrailColors.SubtleText
        )
        Spacer(Modifier.height(8.dp))
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            source.workbook.sheetNames.forEach { sheet ->
                DraftBadge(
                    label = sheet,
                    bg = TrailColors.HeaderBg,
                    fg = TrailColors.Text
                )
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(
            text = stringResource(R.string.draft_transition_mode, source.nextSyncWindow),
            fontSize = 11.sp,
            color = TrailColors.SubtleText
        )
    }
}

@Composable
fun WorkbookMappingCard(sections: List<WorkbookSectionDraft>) {
    DraftSectionCard(
        title = stringResource(R.string.draft_workbook_mapping_title),
        subtitle = stringResource(R.string.draft_workbook_mapping_subtitle)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            sections.forEach { section ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(TrailColors.Surface)
                        .border(1.dp, TrailColors.Border, RoundedCornerShape(10.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(TrailColors.HeaderBg),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Map,
                            contentDescription = null,
                            tint = TrailColors.SeriesBlue
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = section.title,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = TrailColors.Text
                        )
                        Spacer(Modifier.height(2.dp))
                        DraftBadge(
                            label = section.sheetName,
                            bg = TrailColors.ProgressDPlusBg,
                            fg = TrailColors.SeriesBlue
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = section.summary,
                            fontSize = 11.sp,
                            color = TrailColors.SubtleText
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun StravaConnectionCard(connection: StravaConnectionDraft) {
    StravaConnectionCard(connection = connection, authEvent = null, onConnect = {})
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun StravaConnectionCard(
    connection: StravaConnectionDraft,
    authEvent: String?,
    onConnect: () -> Unit
) {
    DraftSectionCard(
        title = stringResource(R.string.draft_strava_title),
        subtitle = connection.note
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            StravaMiniStat(
                icon = {
                    Icon(
                        imageVector = Icons.Default.Link,
                        contentDescription = null,
                        tint = TrailColors.SeriesOrange
                    )
                },
                label = stringResource(R.string.draft_strava_athlete),
                value = connection.athleteName
            )
            StravaMiniStat(
                icon = {
                    Icon(
                        imageVector = Icons.Default.Security,
                        contentDescription = null,
                        tint = TrailColors.SeriesBlue
                    )
                },
                label = stringResource(R.string.draft_strava_auth),
                value = connection.authStatusLabel
            )
            StravaMiniStat(
                icon = {
                    Icon(
                        imageVector = Icons.Default.CloudSync,
                        contentDescription = null,
                        tint = TrailColors.SeriesGreen
                    )
                },
                label = stringResource(R.string.draft_strava_status),
                value = if (connection.isConnected) stringResource(R.string.draft_strava_connected)
                        else stringResource(R.string.draft_strava_pending)
            )
        }
        Spacer(Modifier.height(10.dp))
        Text(
            text = "${connection.city} - ${connection.lastSyncLabel}",
            fontSize = 11.sp,
            color = TrailColors.SubtleText
        )
        if (authEvent != null) {
            Spacer(Modifier.height(8.dp))
            DraftBadge(
                label = authEvent,
                bg = TrailColors.ProgressDPlusBg,
                fg = TrailColors.SeriesBlue
            )
        }
        Spacer(Modifier.height(8.dp))
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            connection.scopes.forEach { scope ->
                DraftBadge(
                    label = scope,
                    bg = TrailColors.ProgressVolumeBg,
                    fg = TrailColors.RunRed
                )
            }
        }
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = onConnect,
            colors = ButtonDefaults.buttonColors(
                containerColor = TrailColors.SeriesOrange,
                contentColor = Color.White
            )
        ) {
            Text(if (connection.isConnected) stringResource(R.string.draft_strava_button_reconnect)
                 else stringResource(R.string.draft_strava_button_connect))
        }
    }
}

@Composable
fun CycleFocusCard(cycles: List<CycleDraft>) {
    DraftSectionCard(
        title = stringResource(R.string.draft_prep_cycles_title),
        subtitle = stringResource(R.string.draft_prep_cycles_subtitle)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            cycles.forEach { cycle ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(TrailColors.Surface)
                        .border(1.dp, TrailColors.Border, RoundedCornerShape(10.dp))
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(TrailColors.ProgressRunBg),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Timeline,
                            contentDescription = null,
                            tint = TrailColors.SeriesGreen
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = cycle.title,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = TrailColors.Text
                            )
                            DraftBadge(
                                label = cycle.duration,
                                bg = TrailColors.ProgressRunBg,
                                fg = TrailColors.SeriesGreen
                            )
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = cycle.objective,
                            fontSize = 11.sp,
                            color = TrailColors.Text
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = cycle.weeklyFocus,
                            fontSize = 11.sp,
                            color = TrailColors.SubtleText
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun DeliveryPlanCard(steps: List<BackendStepDraft>) {
    DraftSectionCard(
        title = stringResource(R.string.draft_delivery_title),
        subtitle = stringResource(R.string.draft_delivery_subtitle)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            steps.forEach { step ->
                Row(
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = if (step.done) Icons.Default.CheckCircle else Icons.Default.Route,
                        contentDescription = null,
                        tint = if (step.done) TrailColors.SeriesGreen else TrailColors.SeriesOrange,
                        modifier = Modifier.size(18.dp)
                    )
                    Column {
                        Text(
                            text = step.title,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TrailColors.Text
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = step.detail,
                            fontSize = 11.sp,
                            color = TrailColors.SubtleText
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun RecentActivitiesCard(activities: List<ActivityDraft>) {
    DraftSectionCard(
        title = stringResource(R.string.draft_recent_activities_title),
        subtitle = stringResource(R.string.draft_recent_activities_subtitle)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            activities.forEach { activity ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(TrailColors.Surface)
                        .border(1.dp, TrailColors.Border, RoundedCornerShape(8.dp))
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(if (activity.type == "Run") TrailColors.RunRed else TrailColors.BikeBlack)
                    )
                    Spacer(Modifier.width(8.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = activity.name,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TrailColors.Text
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = "${activity.date} - ${activity.type} - ${format1(activity.distanceKm)} km - D+ ${activity.dPlus} m",
                            fontSize = 11.sp,
                            color = TrailColors.SubtleText
                        )
                    }
                    DraftBadge(
                        label = stringResource(R.string.draft_suffer_score, activity.sufferScore),
                        bg = TrailColors.ProgressVolumeBg,
                        fg = TrailColors.RunRed
                    )
                }
            }
        }
    }
}

@Composable
private fun DraftSectionCard(
    title: String,
    subtitle: String,
    content: @Composable () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(TrailColors.CardBg)
            .border(1.dp, TrailColors.Border, RoundedCornerShape(10.dp))
            .padding(12.dp)
    ) {
        Text(
            text = title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = TrailColors.Text
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = subtitle,
            fontSize = 12.sp,
            color = TrailColors.SubtleText
        )
        Spacer(Modifier.height(12.dp))
        content()
    }
}

@Composable
private fun DraftBadge(label: String, bg: Color, fg: Color) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 5.dp)
    ) {
        Text(
            text = label,
            color = fg,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun RowScope.StravaMiniStat(
    icon: @Composable () -> Unit,
    label: String,
    value: String
) {
    Column(
        modifier = Modifier
            .weight(1f)
            .clip(RoundedCornerShape(8.dp))
            .background(TrailColors.HeaderBg)
            .padding(10.dp)
    ) {
        icon()
        Spacer(Modifier.height(8.dp))
        Text(
            text = label,
            fontSize = 11.sp,
            color = TrailColors.SubtleText
        )
        Spacer(Modifier.height(2.dp))
        Text(
            text = value,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = TrailColors.Text
        )
    }
}

private fun format1(v: Double): String =
    if (v % 1.0 == 0.0) "%.0f".format(v) else "%.2f".format(v)
