import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BetCard } from '../components/BetCard';
import { ShareCardButton } from '../components/ShareCardButton';
import { Button } from '../components/ui';
import { useStore } from '../store';
import { colors, radius, space } from '../theme';
import { Bet } from '../types';

/**
 * One ticket, read-only: every leg and how it did (live stats while games
 * are on), with Share and an Edit button.
 */
export function TicketScreen({
  betId,
  onClose,
  onEdit,
}: {
  betId: string;
  onClose: () => void;
  onEdit: (b: Bet) => void;
}) {
  const { bets } = useStore();
  const bet = bets.find((b) => b.id === betId);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={styles.title}>Bet details</Text>
        <Pressable
          onPress={onClose}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.closeBtn}
        >
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      {bet ? (
        <ScrollView contentContainerStyle={styles.container}>
          <BetCard bet={bet} onPress={() => {}} />
          <ShareCardButton bet={bet} />
          <Button
            title="✏️ Edit bet"
            variant="secondary"
            onPress={() => onEdit(bet)}
            style={{ marginTop: space.md }}
          />
        </ScrollView>
      ) : (
        <Text style={styles.gone}>This ticket was deleted.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.brand + '55',
  },
  title: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '900' },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: { color: colors.text, fontSize: 18, fontWeight: '800' },
  container: { padding: space.lg, paddingBottom: 60 },
  gone: { color: colors.textDim, fontSize: 15, textAlign: 'center', marginTop: 40, borderRadius: radius.md },
});
