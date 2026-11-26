import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * Simple cumulative-profit column chart built from Views (no native chart
 * dependency). Columns above the zero line are green, below are red.
 */
export function ProfitChart({ series, height = 120 }: { series: number[]; height?: number }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (series.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Settle a couple of bets to see your profit trend.</Text>
      </View>
    );
  }

  // Downsample to at most ~one column per 4px.
  const maxCols = Math.max(2, Math.floor(width / 4) || 60);
  const step = Math.max(1, Math.ceil(series.length / maxCols));
  const pts: number[] = [];
  for (let i = step - 1; i < series.length; i += step) pts.push(series[i]);
  if (pts[pts.length - 1] !== series[series.length - 1]) pts.push(series[series.length - 1]);

  const max = Math.max(0, ...pts);
  const min = Math.min(0, ...pts);
  const range = max - min || 1;
  const zeroY = (max / range) * height; // distance from top to zero line

  return (
    <View style={{ height }} onLayout={onLayout}>
      <View style={[styles.zero, { top: zeroY }]} />
      <View style={styles.cols}>
        {pts.map((v, i) => {
          const h = Math.max(1, (Math.abs(v) / range) * height);
          return (
            <View key={i} style={styles.colWrap}>
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: h,
                  top: v >= 0 ? zeroY - h : zeroY,
                  backgroundColor: v >= 0 ? colors.win : colors.loss,
                  opacity: i === pts.length - 1 ? 1 : 0.75,
                  borderRadius: 1,
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cols: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 1,
  },
  colWrap: { flex: 1 },
  zero: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.border },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textFaint, fontSize: 13, textAlign: 'center' },
});
