import { createContext, useContext, useState, ReactNode } from "react";

interface Organization {
  id: string;
  name: string;
  role: string;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization) => void;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

// Demo organizations - replace with real data when backend is connected
const demoOrganizations: Organization[] = [
  { id: "1", name: "Acme Wholesale", role: "admin" },
  { id: "2", name: "Demo Corp", role: "manager" },
  { id: "3", name: "Test Company", role: "viewer" },
];

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const [organizations] = useState<Organization[]>(demoOrganizations);
  const [currentOrg, setCurrentOrg] = useState<Organization>(demoOrganizations[0]);

  return (
    <OrganizationContext.Provider value={{ organizations, currentOrg, setCurrentOrg }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
};
