import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';
import { Bet } from '../types';
import { CompactBet } from './CompactBet';

/** A pop-up list of tickets (e.g. this week's wins): tap one to see its legs. */
export function TicketListSheet({
  title,
  subtitle,
  bets,
  onClose,
  onEditBet,
}: {
  title: string;
  subtitle?: string;
  bets: Bet[] | null;
  onClose: () => void;
  onEditBet: (b: Bet) => void;
}) {
  return (
    <Modal visible={!!bets} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View
        style={[
          styles.root,
          // Clear the iPhone status bar on the home-screen app.
          { paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' as unknown as number },
        ]}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
          </View>
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
        <FlatList
          data={bets ?? []}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <CompactBet bet={item} variant="past" onEdit={() => onEditBet(item)} />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No tickets here yet.</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.brand + '55',
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: { color: colors.text, fontSize: 18, fontWeight: '800' },
  list: { padding: space.lg, paddingBottom: 60 },
  empty: { color: colors.textDim, fontSize: 15, textAlign: 'center', marginTop: 40 },
});
