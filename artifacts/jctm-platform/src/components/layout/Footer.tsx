import { Facebook, Twitter, Youtube, Instagram } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-background border-t border-border mt-auto py-12">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 text-primary">
        <div className="md:col-span-2">
          <h3 className="font-serif font-bold text-2xl mb-4">Jesus Christ Temple Ministry</h3>
          <p className="text-muted-foreground leading-relaxed max-w-sm">
            A digital sanctuary for the Correction Mandate. Led by Prophet Amos Evomobor, preaching primitive Christianity and total restoration.
          </p>
        </div>
        
        <div>
          <h4 className="font-bold mb-4">Location</h4>
          <address className="not-italic text-muted-foreground space-y-2">
            <p>Warri,</p>
            <p>Delta State,</p>
            <p>Nigeria</p>
          </address>
        </div>

        <div>
          <h4 className="font-bold mb-4">Connect</h4>
          <div className="flex space-x-4">
            <a href="#" className="text-muted-foreground hover:text-accent transition-colors" aria-label="Facebook">
              <Facebook className="h-5 w-5" />
            </a>
            <a href="#" className="text-muted-foreground hover:text-accent transition-colors" aria-label="Twitter">
              <Twitter className="h-5 w-5" />
            </a>
            <a href="#" className="text-muted-foreground hover:text-accent transition-colors" aria-label="YouTube">
              <Youtube className="h-5 w-5" />
            </a>
            <a href="#" className="text-muted-foreground hover:text-accent transition-colors" aria-label="Instagram">
              <Instagram className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Jesus Christ Temple Ministry. All rights reserved.</p>
      </div>
    </footer>
  );
}
