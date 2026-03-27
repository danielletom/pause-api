import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { dailyLogs, medications, medLogs } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const daysParam = parseInt(searchParams.get('days') || '30') as 30 | 60 | 90;
    const days = [30, 60, 90].includes(daysParam) ? daysParam : 30;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const startDateStr = startDate.toISOString().split('T')[0]!;
    const endDateStr = endDate.toISOString().split('T')[0]!;

    // Fetch logs
    const logs = await db
      .select()
      .from(dailyLogs)
      .where(
        and(
          eq(dailyLogs.userId, userId),
          gte(dailyLogs.date, startDateStr),
          lte(dailyLogs.date, endDateStr)
        )
      )
      .orderBy(desc(dailyLogs.date));

    // Fetch medications for med name lookups
    const medsMap = new Map<number, string>();
    const meds = await db
      .select()
      .from(medications)
      .where(eq(medications.userId, userId));

    meds.forEach((med) => {
      medsMap.set(med.id, med.name);
    });

    // Fetch med logs for med tracking columns
    const medLogsData = await db
      .select()
      .from(medLogs)
      .where(
        and(
          eq(medLogs.userId, userId),
          gte(medLogs.date, startDateStr),
          lte(medLogs.date, endDateStr)
        )
      );

    const medLogsByDate = new Map<string, Map<number, boolean>>();
    medLogsData.forEach((ml) => {
      if (!medLogsByDate.has(ml.date)) {
        medLogsByDate.set(ml.date, new Map());
      }
      medLogsByDate.get(ml.date)!.set(ml.medicationId, ml.taken ?? false);
    });

    // Build CSV rows
    const headers = [
      'Date',
      'Symptoms',
      'Mood (1-10)',
      'Energy (1-10)',
      'Sleep Hours',
      'Sleep Quality',
      'Meds Taken',
      'Notes',
    ];

    // Add dynamic med columns (medications taken in the period)
    const activeMeds = new Set(
      Array.from(medLogsByDate.values())
        .flatMap((m) => Array.from(m.keys()))
    );
    activeMeds.forEach((medId) => {
      const medName = medsMap.get(medId);
      if (medName) {
        headers.push(`${medName} (taken)`);
      }
    });

    const rows: string[][] = [headers];

    // Add data rows
    logs.forEach((log) => {
      const row: string[] = [
        log.date,
        formatSymptoms(log.symptomsJson),
        log.mood?.toString() || '',
        log.energy?.toString() || '',
        log.sleepHours?.toString() || '',
        log.sleepQuality || '',
        formatMedsTaken(log.date, medLogsData),
        log.notes || '',
      ];

      // Add med columns
      const dateLogEntry = medLogsByDate.get(log.date);
      activeMeds.forEach((medId) => {
        const taken = dateLogEntry?.get(medId) ?? false;
        row.push(taken ? 'Yes' : 'No');
      });

      rows.push(row);
    });

    // Convert to CSV string
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            const escaped = cell.replace(/"/g, '""');
            if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
              return `"${escaped}"`;
            }
            return escaped;
          })
          .join(',')
      )
      .join('\n');

    // Return as file download
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pause-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('[export/csv] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSV export' },
      { status: 500 }
    );
  }
}

// ── Utility Functions ───────────────────────────────────────────────────────

function formatSymptoms(symptomsJson: unknown): string {
  if (!symptomsJson || typeof symptomsJson !== 'object') return '';

  if (Array.isArray(symptomsJson)) {
    return (symptomsJson as any[])
      .map(
        (s) =>
          `${s.name}${s.severity ? ` (${s.severity}/5)` : ''}`
      )
      .join('; ');
  }

  const record = symptomsJson as Record<string, unknown>;
  return Object.entries(record)
    .map(([key, val]) => {
      const sev =
        typeof val === 'number'
          ? val
          : typeof val === 'object' && val !== null
            ? ((val as any).severity ?? '')
            : '';
      return `${key}${sev ? ` (${sev}/5)` : ''}`;
    })
    .join('; ');
}

function formatMedsTaken(date: string, medLogs: any[]): string {
  const medsForDate = medLogs.filter((ml) => ml.date === date && ml.taken);
  return medsForDate.length > 0 ? 'Yes' : 'No';
}
