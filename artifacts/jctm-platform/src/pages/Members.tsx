import { useState } from "react";
import { useListMembers, getListMembersQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
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
              <div key={i} className="glass-panel rounded-2xl p-5 animate-pulse text-center">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-3" />
                <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-2" />
                <div className="h-3 bg-muted rounded w-1/2 mx-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(members ?? []).map((member, i) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="glass-panel rounded-2xl p-5 text-center hover:shadow-lg transition-all duration-300 group"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-accent/10 transition-colors">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={`${member.firstName} ${member.lastName}`}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <User className="h-7 w-7 text-primary group-hover:text-accent transition-colors" />
                  )}
                </div>
                <h3 className="font-semibold text-primary text-sm leading-tight mb-1">
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
