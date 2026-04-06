import { useState } from "react";
import { useInitiateDonation, useGetGivingStats, getGetGivingStatsQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Heart, CheckCircle, ExternalLink } from "lucide-react";

const PRESET_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];
const PURPOSES = ["Tithe", "Offering", "Mission Support", "Building Fund", "Media Ministry", "General Giving"];

export default function Give() {
  const [amount, setAmount] = useState<number | "">("");
  const [customAmount, setCustomAmount] = useState("");
  const [purpose, setPurpose] = useState("Offering");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ reference: string; authorizationUrl?: string | null; message: string } | null>(null);

  const { data: stats } = useGetGivingStats({ query: { queryKey: getGetGivingStatsQueryKey() } });
  const donateMutation = useInitiateDonation({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        if (data.authorizationUrl) {
          window.open(data.authorizationUrl, "_blank");
        }
      }
    }
  });

  const finalAmount = amount !== "" ? amount : parseFloat(customAmount || "0");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !finalAmount || finalAmount <= 0) return;
    donateMutation.mutate({
      data: {
        donorName: name,
        donorEmail: email,
        amount: finalAmount,
        currency: "NGN",
        purpose,
      }
    });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto"
        >
          <div className="text-center mb-12">
            <Heart className="h-12 w-12 text-accent mx-auto mb-4" />
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
              Support the Ministry
            </h1>
            <p className="text-muted-foreground text-lg">
              Your giving sustains the Correction Mandate. Every seed plants the gospel deeper into this generation.
            </p>

            {stats && (
              <div className="flex gap-6 justify-center mt-8">
                <div className="glass-panel px-6 py-4 rounded-2xl">
                  <div className="text-2xl font-bold text-primary">
                    {stats.totalDonations}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Partners</div>
                </div>
                <div className="glass-panel px-6 py-4 rounded-2xl">
                  <div className="text-2xl font-bold text-primary">
                    &#8358;{stats.totalAmount.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Total Received</div>
                </div>
              </div>
            )}
          </div>

          {result ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel rounded-2xl p-8 text-center border border-accent/30"
            >
              <CheckCircle className="h-12 w-12 text-accent mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-primary mb-3">Donation Recorded</h2>
              <p className="text-muted-foreground mb-4">{result.message}</p>
              <p className="text-sm bg-muted px-4 py-2 rounded-lg font-mono text-primary mb-6">
                Ref: {result.reference}
              </p>
              {result.authorizationUrl && (
                <a href={result.authorizationUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-accent text-white rounded-full flex items-center gap-2 mx-auto">
                    <ExternalLink className="h-4 w-4" />
                    Complete Payment on Paystack
                  </Button>
                </a>
              )}
              <button
                onClick={() => setResult(null)}
                className="block mx-auto mt-4 text-sm text-muted-foreground hover:text-primary"
              >
                Make another donation
              </button>
            </motion.div>
          ) : (
            <div className="glass-panel rounded-2xl p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-primary mb-3 block">Select Amount (NGN)</label>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {PRESET_AMOUNTS.map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => { setAmount(preset); setCustomAmount(""); }}
                        className={`py-3 rounded-xl border text-sm font-medium transition-all ${amount === preset ? "bg-accent text-white border-accent shadow-lg shadow-accent/20" : "border-border text-primary hover:border-accent hover:text-accent"}`}
                      >
                        &#8358;{preset.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    placeholder="Or enter custom amount"
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setAmount(""); }}
                    className="bg-white"
                    min={100}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-primary mb-3 block">Purpose</label>
                  <div className="flex flex-wrap gap-2">
                    {PURPOSES.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPurpose(p)}
                        className={`text-sm px-4 py-2 rounded-full border transition-colors ${purpose === p ? "bg-primary text-white border-primary" : "border-border text-primary hover:border-primary"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-primary mb-1.5 block">Full Name *</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      required
                      className="bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-primary mb-1.5 block">Email Address *</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="bg-white"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={donateMutation.isPending || !name || !email || !finalAmount || finalAmount <= 0}
                  className="w-full bg-accent text-white hover:bg-accent/90 rounded-full h-12 text-base font-semibold shadow-lg shadow-accent/20"
                >
                  {donateMutation.isPending ? "Processing..." : `Give ₦${finalAmount ? finalAmount.toLocaleString() : "..."} Now`}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  Secured by Paystack. Your giving is protected and processed safely.
                </p>
                <div className="mt-4 text-xs text-muted-foreground text-center">
                  <p className="font-medium text-primary mb-1">Direct Bank Transfer</p>
                  <p>Bank: GTBank | Account: Jesus Christ Temple Ministry</p>
                  <p>Contact: +234-XXX-XXXX-XXX for account details</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
