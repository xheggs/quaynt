import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';

// --- Shared styles ---

export const colors = {
  primary: '#1a1a2e',
  secondary: '#4A90D9',
  text: '#333333',
  textLight: '#666666',
  textMuted: '#999999',
  border: '#e0e0e0',
  borderLight: '#f0f0f0',
  background: '#f8f9fa',
  white: '#ffffff',
  up: '#2ecc71',
  down: '#e74c3c',
  stable: '#95a5a6',
} as const;

export const baseStyles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 60,
    fontFamily: 'NotoSans',
    fontSize: 10,
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.primary,
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: colors.secondary,
  },
});

// --- PageFooter ---

const footerStyles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  text: { fontSize: 8, color: colors.textMuted },
});

interface PageFooterProps {
  generatedBy: string;
}

export function PageFooter({ generatedBy }: PageFooterProps) {
  return (
    <View style={footerStyles.footer} fixed>
      <Text style={footerStyles.text}>{generatedBy}</Text>
      <Text
        style={footerStyles.text}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

// --- KpiCard ---

const kpiStyles = StyleSheet.create({
  card: {
    width: '30%',
    backgroundColor: colors.background,
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  label: { fontSize: 9, color: colors.textLight, marginBottom: 4 },
  value: { fontSize: 20, fontWeight: 700, color: colors.primary, marginBottom: 4 },
  changeRow: { flexDirection: 'row', alignItems: 'center' },
  changeText: { fontSize: 9 },
});

interface KpiCardProps {
  label: string;
  value: string;
  change?: string;
  direction?: 'up' | 'down' | 'stable' | null;
}

export function KpiCard({ label, value, change, direction }: KpiCardProps) {
  const changeColor =
    direction === 'up' ? colors.up : direction === 'down' ? colors.down : colors.stable;
  const arrow = direction === 'up' ? '\u25B2' : direction === 'down' ? '\u25BC' : '';

  return (
    <View style={kpiStyles.card}>
      <Text style={kpiStyles.label}>{label}</Text>
      <Text style={kpiStyles.value}>{value}</Text>
      {change && (
        <View style={kpiStyles.changeRow}>
          <Text style={[kpiStyles.changeText, { color: changeColor }]}>
            {arrow} {change}
          </Text>
        </View>
      )}
    </View>
  );
}

// --- DataTable ---

const tableStyles = StyleSheet.create({
  table: { marginTop: 8 },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 6,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: 4,
  },
  rowAlt: { backgroundColor: colors.background },
  headerCell: { fontSize: 9, fontWeight: 700, color: colors.primary },
  cell: { fontSize: 9, color: colors.text },
});

interface DataTableProps {
  headers: { label: string; flex: number }[];
  rows: string[][];
}

export function DataTable({ headers, rows }: DataTableProps) {
  return (
    <View style={tableStyles.table}>
      <View style={tableStyles.headerRow}>
        {headers.map((h, i) => (
          <Text key={i} style={[tableStyles.headerCell, { flex: h.flex }]}>
            {h.label}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={rowIdx % 2 === 1 ? [tableStyles.row, tableStyles.rowAlt] : tableStyles.row}
        >
          {row.map((cell, cellIdx) => (
            <Text key={cellIdx} style={[tableStyles.cell, { flex: headers[cellIdx].flex }]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// --- ChartWithTable: chart image + data table ---

const chartSectionStyles = StyleSheet.create({
  container: { marginBottom: 20 },
  chartImage: { width: 460, height: 276, marginBottom: 8 },
  noData: { fontSize: 10, color: colors.textMuted, textAlign: 'center', padding: 40 },
});

interface ChartWithTableProps {
  chartBuffer?: Buffer;
  noDataLabel: string;
  headers: { label: string; flex: number }[];
  rows: string[][];
}

export function ChartWithTable({ chartBuffer, noDataLabel, headers, rows }: ChartWithTableProps) {
  return (
    <View style={chartSectionStyles.container}>
      {chartBuffer ? (
        /* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop; data table serves as text alternative */
        <Image src={{ data: chartBuffer, format: 'png' }} style={chartSectionStyles.chartImage} />
      ) : (
        <Text style={chartSectionStyles.noData}>{noDataLabel}</Text>
      )}
      {rows.length > 0 && <DataTable headers={headers} rows={rows} />}
    </View>
  );
}

// --- Warning banner ---

const warningStyles = StyleSheet.create({
  banner: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffc107',
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
  text: { fontSize: 9, color: '#856404' },
});

interface WarningBannerProps {
  message: string;
}

export function WarningBanner({ message }: WarningBannerProps) {
  return (
    <View style={warningStyles.banner}>
      <Text style={warningStyles.text}>{message}</Text>
    </View>
  );
}
