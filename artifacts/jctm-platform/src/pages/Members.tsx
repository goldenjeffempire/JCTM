import { useState } from "react";
import { useListMembers, getListMembersQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/SEO";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Search, User } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  "Senior Prophet": "bg-accent/10 text-accent border-accent/30",
  "Co-Pastor": "bg-primary/10 text-primary border-primary/30",
  "Worship Director": "bg-purple-100 text-purple-700 border-purple-200",
  "Media Director": "bg-blue-100 text-blue-700 border-blue-200",
  "Deacon": "bg-green-100 text-green-700 border-green-200",
  "Minister": "bg-orange-100 text-orange-700 border-orange-200",
};

export default function Members() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data: members, isLoading } = useListMembers(
    { search: debouncedSearch || undefined, limit: 50, offset: 0 },
    { query: { queryKey: getListMembersQueryKey({ search: debouncedSearch || undefined }) } }
  );

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout(window._memberSearchTimeout);
    window._memberSearchTimeout = setTimeout(() => setDebouncedSearch(val), 400) as unknown as number;
  };

  return (
    <Layout>
      <SEO
        title="Member Directory — JCTM Digital Sanctuary | Jesus Christ Temple Ministry"
        description="Connect with registered members of Jesus Christ Temple Ministry (JCTM), Warri, Nigeria. Join a growing community of believers walking in holiness, apostolic doctrine, and the Correction Mandate."
        path="/members"
        keywords="JCTM members, Jesus Christ Temple Ministry community, JCTM believers Nigeria, apostolic church members Nigeria, holiness church community Warri, join JCTM, register JCTM Digital Sanctuary"
        breadcrumbs={[
          { name: "Home", url: "https://jctm.org.ng/" },
          { name: "Member Directory", url: "https://jctm.org.ng/members" },
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "JCTM Member Directory — Digital Sanctuary",
            "description": "The JCTM Digital Sanctuary member directory — a community of believers registered with Jesus Christ Temple Ministry (JCTM). Walking together in holiness, apostolic doctrine, and the Correction Mandate.",
            "url": "https://jctm.org.ng/members",
            "inLanguage": "en-NG",
            "about": {
              "@type": "ReligiousOrganization",
              "name": "Jesus Christ Temple Ministry (JCTM)",
              "url": "https://jctm.org.ng"
            },
            "potentialAction": {
              "@type": "JoinAction",
              "name": "Join JCTM Digital Sanctuary",
              "target": "https://jctm.org.ng/join"
            }
          }
        ]}
      />
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4">
            Member Directory
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Meet the servants of God at Jesus Christ Temple Ministry.
          </p>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or department..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass-panel rounded-2xl overflow-hidden animate-pulse text-center">
                <div className="aspect-square w-full bg-muted" />
                <div className="px-3 pt-3 pb-4">
                  <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2 mx-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {((members as Array<{ id: number; firstName: string; lastName: string; role: string; avatarUrl?: string | null; department?: string | null; bio?: string | null }> | undefined) ?? []).map((member, i: number) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="glass-panel rounded-2xl overflow-hidden text-center hover:shadow-lg transition-all duration-300 group"
              >
                <div className="aspect-square w-full bg-primary/10 group-hover:bg-accent/10 transition-colors relative">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={`${member.firstName} ${member.lastName}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <User className="h-12 w-12 text-primary group-hover:text-accent transition-colors" />
                    </div>
                  )}
                </div>
                <div className="px-3 pt-3 pb-4">
                <h3 className="font-bold text-primary text-sm leading-tight mb-1 text-center">
                  {member.firstName} {member.lastName}
                </h3>
                <span className={`inline-block text-xs border rounded-full px-2.5 py-0.5 mb-2 ${ROLE_COLORS[member.role] ?? "bg-muted text-muted-foreground border-border"}`}>
                  {member.role}
                </span>
                {member.department && (
                  <p className="text-xs text-muted-foreground">{member.department}</p>
                )}
                {member.bio && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3 hidden group-hover:block transition-all">
                    {member.bio}
                  </p>
                )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

declare global {
  interface Window { _memberSearchTimeout: number }
}
