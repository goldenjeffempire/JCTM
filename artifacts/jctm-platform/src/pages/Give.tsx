import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Heart, Shield, Star, CheckCircle, Globe } from "lucide-react";
import { toast } from "sonner";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PRESET_NGN = [1000, 2000, 5000, 10000, 20000, 50000];
const PRESET_USD = [5, 10, 25, 50, 100, 250];

const GIVING_TYPES = [
  { id: "tithe", label: "Tithe", icon: "🏛️" },
  { id: "offering", label: "Offering", icon: "🙏" },
  { id: "first_fruits", label: "First Fruits", icon: "🌿" },
  { id: "missions", label: "Missions", icon: "🌍" },
  { id: "building_fund", label: "Building Fund", icon: "🏗️" },
];

export default function Give() {
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [amount, setAmount] = useState("");
  const [givingType, setGivingType] = useState("offering");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const presets = currency === "NGN" ? PRESET_NGN : PRESET_USD;
  const symbol = currency === "NGN" ? "₦" : "$";

  useEffect(() => { document.title = "Give | JCTM Digital Sanctuary"; }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) { setError("Please enter a valid amount."); return; }
    if (!email) { setError("Email is required for payment confirmation."); return; }
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${BASE}/api/giving/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numAmount,
          currency,
          givingType,
          donorName: name || undefined,
          donorEmail: email,
        }),
      });
      const data = await res.json();
      if (res.ok && data.paymentUrl) {
        toast.success("Redirecting to payment...", {
          description: "You will be securely redirected to complete your giving.",
        });
        window.location.href = data.paymentUrl;
      } else if (res.ok) {
        setStep("success");
        toast.success("Payment Processed", {
          description: "Your gift has been received. May God multiply it back to you.",
        });
      } else {
        setError(data.error ?? "Payment could not be initiated. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 flex justify-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel rounded-3xl p-12 max-w-md text-center border border-accent/20">
            <CheckCircle className="h-14 w-14 text-accent mx-auto mb-5" />
            <h2 className="text-3xl font-serif font-bold text-primary mb-3">Thank You!</h2>
            <p className="text-muted-foreground mb-6">Your giving has been received. May God multiply it back to you a hundredfold.</p>
            <p className="text-accent italic font-medium mb-8">"Give, and it will be given to you — pressed down, shaken together, running over." — Luke 6:38</p>
            <Button onClick={() => { setStep("form"); setAmount(""); }} className="rounded-full bg-accent text-white hover:bg-accent/90 px-8">Give Again</Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center mb-12">
          <span className="inline-block text-xs font-semibold text-accent uppercase tracking-widest mb-4 border border-accent/30 rounded-full px-4 py-1.5">Kingdom Giving</span>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">Give to the Ministry</h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">Your generosity fuels the Correction Mandate and takes the Gospel to the nations.</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 max-w-5xl mx-auto">
          <div className="lg:col-span-3">
            <div className="glass-panel rounded-2xl p-8 border border-border/50">
              <div className="flex gap-2 mb-6 p-1 bg-muted rounded-full">
                {(["NGN", "USD"] as const).map(c => (
                  <button key={c} onClick={() => { setCurrency(c); setAmount(""); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-medium transition-all ${currency === c ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-primary"}`}>
                    {c === "NGN" ? "🇳🇬 Naira (NGN)" : "🌐 Dollar (USD)"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="text-sm font-semibold text-primary mb-2 block">Giving Type</label>
                  <div className="flex flex-wrap gap-2">
                    {GIVING_TYPES.map(gt => (
                      <button key={gt.id} type="button" onClick={() => setGivingType(gt.id)}
                        className={`text-xs px-4 py-2 rounded-full border transition-colors flex items-center gap-1.5 ${givingType === gt.id ? "bg-accent text-white border-accent" : "border-border text-muted-foreground hover:border-accent hover:text-accent"}`}>
                        <span>{gt.icon}</span> {gt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-primary mb-2 block">Amount ({currency})</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {presets.map(p => (
                      <button key={p} type="button" onClick={() => setAmount(String(p))}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${amount === String(p) ? "bg-accent text-white border-accent" : "border-border text-muted-foreground hover:border-accent hover:text-accent"}`}>
                        {symbol}{p.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">{symbol}</span>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="Or enter custom amount"
                      className="bg-white pl-8 text-lg h-12 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-primary mb-1.5 block">Full Name (optional)</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="bg-white" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-primary mb-1.5 block">Email *</label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="For confirmation" required className="bg-white" />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
                )}

                <Button type="submit" disabled={loading || !amount || !email} className="w-full bg-accent text-white hover:bg-accent/90 rounded-full h-12 text-base font-semibold shadow-lg shadow-accent/20">
                  <Heart className="h-4 w-4 mr-2" />
                  {loading ? "Processing..." : `Give ${amount ? `${symbol}${parseFloat(amount).toLocaleString()}` : ""} Now`}
                </Button>

                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Secured by {currency === "NGN" ? "Paystack" : "Stripe"}</div>
                  <div className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Encrypted payment</div>
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="glass-panel rounded-2xl p-6 border border-accent/20">
              <Star className="h-6 w-6 text-accent mb-3" />
              <h3 className="font-serif font-bold text-primary mb-2">Where Your Gift Goes</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {["Spreading the Correction Mandate", "Feeding the poor in Warri", "Ministry website & digital outreach", "Supporting ministers in need", "Church building maintenance"].map(item => (
                  <li key={item} className="flex items-start gap-2"><span className="text-accent mt-0.5">✓</span>{item}</li>
                ))}
              </ul>
            </div>

            <div className="glass-panel rounded-2xl p-6 border border-border/50">
              <h3 className="font-serif font-bold text-primary mb-1">Direct Transfer</h3>
              <p className="text-xs text-muted-foreground mb-4">For direct bank transfers, use any of the accounts below:</p>

              {/* NGN Accounts */}
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-2">🇳🇬 NGN Accounts</p>
              <p className="text-xs font-semibold text-primary mb-2">Account Name: Jesus Christ Temple Ministry</p>
              <div className="space-y-2 text-sm mb-5">
                {[
                  { bank: "UBA", number: "1018953924" },
                  { bank: "FCMB", number: "4642959015" },
                  { bank: "GTBank", number: "0165388758" },
                  { bank: "Zenith Bank", number: "1015851298" },
                ].map(({ bank, number }) => (
                  <div key={bank} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                    <span className="text-muted-foreground font-medium">{bank}</span>
                    <span className="font-mono font-bold text-primary tracking-wide">{number}</span>
                  </div>
                ))}
              </div>

              {/* USD Account */}
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-2">🌐 USD Account</p>
              <div className="space-y-1.5 text-sm bg-accent/5 rounded-xl p-3 border border-accent/15">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Account Name</span>
                  <span className="font-semibold text-primary">Evomobor Amos</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bank</span>
                  <span className="font-semibold text-primary">Guaranty Trust Bank</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Account No</span>
                  <span className="font-mono font-bold text-primary tracking-wide">0737296821</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Swift Code</span>
                  <span className="font-mono font-bold text-accent tracking-widest">GTBINGLA</span>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 border border-border/50 text-center">
              <p className="text-muted-foreground text-sm italic leading-relaxed">
                "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver."
              </p>
              <p className="text-primary font-semibold text-xs mt-3">— 2 Corinthians 9:7</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
