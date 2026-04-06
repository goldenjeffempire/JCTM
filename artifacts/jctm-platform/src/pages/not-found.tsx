import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full text-center"
      >
        <div className="glass-panel rounded-3xl p-10 border border-border">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <Compass className="h-8 w-8 text-accent" />
          </div>

          <p className="text-7xl font-serif font-bold text-primary/10 mb-2 leading-none">404</p>

          <h1 className="text-2xl font-serif font-bold text-primary mb-3">
            Page Not Found
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            This page has not yet been built in the Digital Sanctuary. But do not worry — the foundations of the Lord stand sure.
          </p>

          <p className="text-accent italic text-sm mb-8">
            "Your word is a lamp to my feet and a light to my path." — Psalm 119:105
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button className="rounded-full bg-accent text-white hover:bg-accent/90 px-8 w-full sm:w-auto">
                Return Home
              </Button>
            </Link>
            <Link href="/sermons">
              <Button variant="outline" className="rounded-full border-primary text-primary px-8 w-full sm:w-auto">
                Visit Sermon Hub
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
