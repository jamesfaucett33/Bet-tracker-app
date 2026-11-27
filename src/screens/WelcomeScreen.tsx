import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AccountCard } from '../components/AccountCard';
import { colors, space } from '../theme';

/**
 * Shown to anyone not signed in: BetKeyper needs an account (bets are saved
 * to it, and bet uploads belong to it). Sign up or sign in here.
 */
export function WelcomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <Image source={require('../../assets/badge.png')} style={styles.badge} />
        <Text style={styles.word}>
          Bet<Text style={{ color: colors.brand }}>Keyper</Text>
        </Text>
        <Text style={styles.slogan}>Every ticket. Every book. One place.</Text>
        <View style={styles.perks}>
          {[
            '📷  Snap any ticket and we fill in every leg',
            '🔥  Sweat it live, leg by leg',
            '📊  See your real record: won, lost, net',
          ].map((t) => (
            <Text key={t} style={styles.perk}>
              {t}
            </Text>
          ))}
        </View>
      </View>
      <AccountCard />
      <Text style={styles.fine}>
        Free to use. BetKeyper tracks bets you've placed elsewhere; it doesn't take wagers. 21+.
        Gambling problem? Call 1-800-GAMBLER.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, paddingBottom: 60, gap: space.lg },
  hero: { alignItems: 'center', paddingTop: space.lg },
  badge: { width: 84, height: 84 },
  word: { color: colors.text, fontSize: 40, fontWeight: '900', marginTop: space.sm },
  slogan: { color: colors.textDim, fontSize: 16, fontWeight: '700', marginTop: 4 },
  perks: { marginTop: space.lg, gap: 8, alignSelf: 'stretch' },
  perk: { color: colors.text, fontSize: 15, fontWeight: '600' },
  fine: { color: colors.textFaint, fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
