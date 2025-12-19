import { useState } from "react";
import { Check, ChevronsUpDown, Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/contexts/OrganizationContext";

const OrganizationSwitcher = () => {
  const [open, setOpen] = useState(false);
  const { organizations, currentOrg, setCurrentOrg } = useOrganization();

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      case "manager":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between px-3 py-2 h-auto hover:bg-sidebar-accent"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium truncate max-w-[140px]">
                {currentOrg?.name || "Select Organization"}
              </span>
              {currentOrg && (
                <Badge variant={getRoleBadgeVariant(currentOrg.role)} className="text-[10px] px-1.5 py-0 h-4">
                  {currentOrg.role}
                </Badge>
              )}
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search organizations..." />
          <CommandList>
            <CommandEmpty>No organization found.</CommandEmpty>
            <CommandGroup heading="Organizations">
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.name}
                  onSelect={() => {
                    setCurrentOrg(org);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                      <Building2 className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm">{org.name}</span>
                      <span className="text-xs text-muted-foreground capitalize">{org.role}</span>
                    </div>
                  </div>
                  <Check
                    className={cn(
                      "h-4 w-4",
                      currentOrg?.id === org.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem className="py-2 cursor-pointer">
                <Plus className="mr-2 h-4 w-4" />
                <span>Create Organization</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default OrganizationSwitcher;
