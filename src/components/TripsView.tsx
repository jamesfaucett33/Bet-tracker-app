import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isValidISODate, todayISO, uid } from '../format';
import { useStore } from '../store';
import { colors, space } from '../theme';
import { Bet, Trip } from '../types';
import { TripCard } from './TripCard';
import { Button, Card, confirm, Field } from './ui';

const plusDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Profile → Trips: plan a trip, then see every trip's totals and tickets. */
export function TripsView({ onEditBet }: { onEditBet: (b: Bet) => void }) {
  const { settings, updateSettings } = useStore();
  const trips = settings.trips ?? [];
  const [adding, setAdding] = useState(trips.length === 0);
  const [name, setName] = useState('');
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(plusDays(todayISO(), 3));
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) return setErr('Name your trip (e.g. Vegas).');
    if (!isValidISODate(start) || !isValidISODate(end)) return setErr('Dates look like 2026-03-12.');
    if (end < start) return setErr('The trip has to end after it starts.');
    const trip: Trip = { id: uid(), name: name.trim(), start, end };
    updateSettings({ trips: [trip, ...trips] });
    setName('');
    setErr(null);
    setAdding(false);
  };

  return (
    <View>
      <Text style={styles.intro}>
        Heading to Vegas or a big weekend? Make a trip and every bet you place on those dates is
        totaled up: wagered, record, profit and your biggest hit.
      </Text>
      {adding ? (
        <Card style={{ gap: space.sm, marginBottom: space.lg }}>
          <Field label="Trip name" value={name} onChangeText={setName} placeholder="e.g. Vegas" />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Starts" value={start} onChangeText={setStart} placeholder="YYYY-MM-DD" autoCapitalize="none" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Ends" value={end} onChangeText={setEnd} placeholder="YYYY-MM-DD" autoCapitalize="none" />
            </View>
          </View>
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <Button title="Save trip" onPress={save} />
          {trips.length ? (
            <Button title="Cancel" variant="secondary" onPress={() => setAdding(false)} />
          ) : null}
        </Card>
      ) : (
        <Button title="🎰 Plan a trip" onPress={() => setAdding(true)} style={{ marginBottom: space.lg }} />
      )}
      {trips.map((t) => (
        <TripCard
          key={t.id}
          trip={t}
          onEditBet={onEditBet}
          onDelete={() =>
            confirm(
              'Delete trip?',
              `Removes "${t.name}" from your trips. Your tickets stay.`,
              () => updateSettings({ trips: trips.filter((x) => x.id !== t.id) }),
              'Delete',
            )
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.textDim, fontSize: 14, lineHeight: 20, marginBottom: space.lg },
  err: { color: colors.loss, fontSize: 13, fontWeight: '600' },
});
