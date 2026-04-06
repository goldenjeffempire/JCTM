import { useState } from "react";
import { useListTestimonies, getListTestimoniesQueryKey, useSubmitTestimony } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { MessageSquare, Heart, Plus, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Testimonies() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", content: "", category: "" });
  const [submitted, setSubmitted] = useState(false);

  const queryClient = useQueryClient();
  const { data: testimonies, isLoading } = useListTestimonies(
    { limit: 20, offset: 0 },
    { query: { queryKey: getListTestimoniesQueryKey() } }
  );

  const submitMutation = useSubmitTestimony({
    mutation: {
      onSuccess: () => {
        setSubmitted(true);
        setShowForm(false);
        setForm({ name: "", email: "", content: "", category: "" });
        queryClient.invalidateQueries({ queryKey: getListTestimoniesQueryKey() });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.content) return;
    submitMutation.mutate({
      data: {
        name: form.name,
        email: form.email || undefined,
        content: form.content,
        category: form.category || undefined,
      }
    });
  };

  const categories = ["Healing", "Deliverance", "Financial Breakthrough", "Marriage Restoration", "Salvation", "Other"];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-4"
        >
          <div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
              Testimony Vault
            </h1>
            <p className="text-muted-foreground text-lg">
              What God is doing through the Correction Mandate ministry. Share your testimony.
            </p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-accent text-white hover:bg-accent/90 flex items-center gap-2 rounded-full px-6"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Close Form" : "Share Your Testimony"}
          </Button>
        </motion.div>

        {submitted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel border border-accent/30 rounded-2xl p-6 mb-8 text-center"
          >
            <Heart className="h-10 w-10 text-accent mx-auto mb-3" />
            <h3 className="font-semibold text-primary text-lg mb-1">Testimony Received</h3>
            <p className="text-muted-foreground text-sm">Your testimony has been submitted and is pending approval. Thank you for sharing what God has done!</p>
          </motion.div>
        )}

        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-2xl p-8 mb-10 border border-accent/20"
          >
            <h2 className="text-xl font-semibold text-primary mb-6">Share Your Testimony</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-primary mb-1.5 block">Full Name *</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Your name"
                    required
                    className="bg-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-primary mb-1.5 block">Email (optional)</label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="your@email.com"
                    type="email"
                    className="bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-primary mb-1.5 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, category: p.category === cat ? "" : cat }))}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.category === cat ? "bg-accent text-white border-accent" : "border-border text-primary hover:border-accent hover:text-accent"}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-primary mb-1.5 block">Your Testimony *</label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Share what God has done for you through this ministry..."
                  required
                  rows={5}
                  className="bg-white resize-none"
                />
              </div>
              <Button
                type="submit"
                disabled={submitMutation.isPending || !form.name || !form.content}
                className="bg-accent text-white hover:bg-accent/90 rounded-full px-8"
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Testimony"}
              </Button>
            </form>
          </motion.div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-panel rounded-2xl p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                <div className="h-3 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(testimonies ?? []).map((testimony, i) => (
              <motion.div
                key={testimony.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="glass-panel rounded-2xl p-6 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                {testimony.category && (
                  <span className="inline-block text-xs font-medium text-accent border border-accent/30 rounded-full px-3 py-0.5 w-fit">
                    {testimony.category}
                  </span>
                )}
                <MessageSquare className="h-5 w-5 text-accent" />
                <p className="text-muted-foreground text-sm leading-relaxed line-clamp-5">
                  "{testimony.content}"
                </p>
                <div className="mt-auto pt-3 border-t border-border">
                  <p className="font-medium text-primary text-sm">{testimony.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(testimony.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
