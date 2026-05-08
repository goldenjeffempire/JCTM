import React, { useState } from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCrusadeCountdown } from "@/hooks/useCrusadeCountdown";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const BASE = DOMAIN ? `https://${DOMAIN}` : "";

const GIVING_TYPES = [
  { key: "tithe", label: "Tithe", icon: "💎", desc: "10% of your income" },
  { key: "offering", label: "Offering", icon: "🙏", desc: "Freewill worship" },
  { key: "missions", label: "Missions", icon: "🌍", desc: "Global outreach" },
  { key: "crusade", label: "Crusade", icon: "🔥", desc: "Warri Crusade 2026" },
];

const CURRENCY_OPTIONS = [
  { code: "NGN", symbol: "₦", label: "Naira (NGN)" },
  { code: "USD", symbol: "$", label: "Dollar (USD)" },
];

const QUICK_AMOUNTS_NGN = [1000, 2500, 5000, 10000, 25000, 50000];
const QUICK_AMOUNTS_USD = [5, 10, 25, 50, 100, 250];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function CrusadeGivingStrip({ colors }: { colors: ReturnType<typeof useColors> }) {
  const cd = useCrusadeCountdown();
  if (cd.phase === "ended") return null;
  const isLive = cd.phase === "live";

  return (
    <TouchableOpacity
      style={[styles.crusadeStrip, { backgroundColor: isLive ? "#E53E3E" : "#1a2e5e" }]}
      onPress={() => Linking.openURL(`${BASE}/crusade`)}
      activeOpacity={0.88}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.crusadeStripTitle}>
          {isLive ? "🔴 Warri Crusade is LIVE!" : "🔥 Support the Warri Crusade"}
        </Text>
        <Text style={styles.crusadeStripSub}>
          {isLive
            ? `Ends in ${pad2(cd.hours)}:${pad2(cd.minutes)}:${pad2(cd.seconds)} — Give Now`
            : `Starts in ${cd.days > 0 ? `${cd.days}d ` : ""}${pad2(cd.hours)}:${pad2(cd.minutes)}:${pad2(cd.seconds)}`}
        </Text>
      </View>
      <View style={[styles.crusadeStripBtn, { backgroundColor: "#F6C90E" }]}>
        <Text style={styles.crusadeStripBtnText}>Give →</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function GiveScreen() {
  const colors = useColors();
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [givingType, setGivingType] = useState("offering");
  const [amount, setAmount] = useState("");

  const quickAmounts = currency === "NGN" ? QUICK_AMOUNTS_NGN : QUICK_AMOUNTS_USD;
  const currencyObj = CURRENCY_OPTIONS.find((c) => c.code === currency)!;

  const handleGive = () => {
    const encoded = encodeURIComponent(amount || "0");
    const url = `${BASE}/give?currency=${currency}&type=${givingType}&amount=${encoded}`;
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Give</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Support the Correction Mandate
          </Text>
        </View>

        {/* Crusade urgency strip — only visible before / during the crusade */}
        <CrusadeGivingStrip colors={colors} />

        {/* Scripture Banner */}
        <View style={[styles.scriptureBanner, { backgroundColor: colors.primary }]}>
          <Text style={styles.scriptureVerse}>
            "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver."
          </Text>
          <Text style={styles.scriptureRef}>— 2 Corinthians 9:7</Text>
        </View>

        {/* Currency Toggle */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Currency</Text>
          <View style={styles.currencyRow}>
            {CURRENCY_OPTIONS.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[
                  styles.currencyBtn,
                  {
                    backgroundColor: currency === c.code ? colors.primary : colors.card,
                    borderColor: currency === c.code ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => { setCurrency(c.code as "NGN" | "USD"); setAmount(""); }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.currencyBtnText,
                    { color: currency === c.code ? "#fff" : colors.foreground },
                  ]}
                >
                  {c.symbol} {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Giving Type */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Giving Type</Text>
          <View style={styles.typeGrid}>
            {GIVING_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[
                  styles.typeItem,
                  {
                    backgroundColor: givingType === t.key ? colors.accent : colors.card,
                    borderColor: givingType === t.key ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setGivingType(t.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.typeIcon}>{t.icon}</Text>
                <Text
                  style={[
                    styles.typeLabel,
                    { color: givingType === t.key ? "#fff" : colors.foreground },
                  ]}
                >
                  {t.label}
                </Text>
                <Text
                  style={[
                    styles.typeDesc,
                    { color: givingType === t.key ? "rgba(255,255,255,0.75)" : colors.mutedForeground },
                  ]}
                >
                  {t.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Amount</Text>
          <View style={[styles.amountInputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.amountSymbol, { color: colors.mutedForeground }]}>
              {currencyObj.symbol}
            </Text>
            <TextInput
              style={[styles.amountInput, { color: colors.foreground }]}
              placeholder="Enter amount"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </View>

          {/* Quick amounts */}
          <View style={styles.quickAmountGrid}>
            {quickAmounts.map((a) => (
              <TouchableOpacity
                key={a}
                style={[
                  styles.quickAmountBtn,
                  {
                    backgroundColor: amount === String(a) ? colors.primary : colors.muted,
                    borderColor: amount === String(a) ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setAmount(String(a))}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.quickAmountText,
                    { color: amount === String(a) ? "#fff" : colors.foreground },
                  ]}
                >
                  {currencyObj.symbol}{a.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Give Button */}
        <TouchableOpacity
          style={[styles.giveBtn, { backgroundColor: colors.primary, opacity: amount ? 1 : 0.5 }]}
          onPress={handleGive}
          disabled={!amount}
          activeOpacity={0.85}
        >
          <Text style={styles.giveBtnText}>
            Give {amount ? `${currencyObj.symbol}${Number(amount).toLocaleString()}` : "Now"} →
          </Text>
        </TouchableOpacity>

        {/* Bank details */}
        <View style={[styles.bankCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.bankTitle, { color: colors.foreground }]}>Direct Bank Transfer (NGN)</Text>
          <Text style={[styles.bankAccountName, { color: colors.mutedForeground }]}>Account Name: Jesus Christ Temple Ministry</Text>

          {/* Zenith Bank */}
          <View style={[styles.bankEntry, { borderColor: colors.border }]}>
            <Text style={[styles.bankEntryBank, { color: colors.foreground }]}>Zenith Bank</Text>
            <Text style={[styles.bankEntryNum, { color: colors.accent }]}>1013825491</Text>
          </View>

          {/* GTBank */}
          <View style={[styles.bankEntry, { borderColor: colors.border }]}>
            <Text style={[styles.bankEntryBank, { color: colors.foreground }]}>GTBank</Text>
            <Text style={[styles.bankEntryNum, { color: colors.accent }]}>0123456789</Text>
          </View>

          {/* UBA */}
          <View style={[styles.bankEntry, { borderColor: colors.border }]}>
            <Text style={[styles.bankEntryBank, { color: colors.foreground }]}>UBA</Text>
            <Text style={[styles.bankEntryNum, { color: colors.accent }]}>2087654321</Text>
          </View>

          {/* FCMB */}
          <View style={[styles.bankEntry, { borderColor: colors.border }]}>
            <Text style={[styles.bankEntryBank, { color: colors.foreground }]}>FCMB</Text>
            <Text style={[styles.bankEntryNum, { color: colors.accent }]}>3456789012</Text>
          </View>
        </View>

        <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
          Secured by Paystack. Your giving supports Temple TV broadcasts and the Correction Mandate worldwide.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 104 },
  crusadeStrip: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  crusadeStripTitle: { color: "#fff", fontWeight: "800", fontSize: 14 },
  crusadeStripSub: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  crusadeStripBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  crusadeStripBtnText: { color: "#001533", fontWeight: "800", fontSize: 13 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "800" },
  headerSub: { fontSize: 12, marginTop: 2 },
  scriptureBanner: { marginHorizontal: 20, borderRadius: 16, padding: 18, marginBottom: 20 },
  scriptureVerse: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    lineHeight: 20,
    fontStyle: "italic",
    marginBottom: 6,
  },
  scriptureRef: { color: "rgba(255,255,255,0.6)", fontSize: 11 },
  section: { marginHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  currencyRow: { flexDirection: "row", gap: 10 },
  currencyBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 12,
    alignItems: "center",
  },
  currencyBtnText: { fontWeight: "700", fontSize: 14 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeItem: {
    width: "47%",
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    gap: 3,
  },
  typeIcon: { fontSize: 22, marginBottom: 2 },
  typeLabel: { fontSize: 14, fontWeight: "700" },
  typeDesc: { fontSize: 11 },
  amountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 12,
    gap: 6,
  },
  amountSymbol: { fontSize: 20, fontWeight: "700" },
  amountInput: { flex: 1, fontSize: 20, fontWeight: "700" },
  quickAmountGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickAmountBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickAmountText: { fontSize: 13, fontWeight: "600" },
  giveBtn: {
    marginHorizontal: 20,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  giveBtnText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  bankCard: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  bankTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  bankRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  bankLabel: { fontSize: 12 },
  bankValue: { fontSize: 12, fontWeight: "600", textAlign: "right", flex: 1 },
  footerNote: { fontSize: 11, textAlign: "center", paddingHorizontal: 24, paddingBottom: 8 },
});
