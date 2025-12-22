import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Building, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const Onboarding = () => {
  const [orgName, setOrgName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create an organization.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Call the database function to create org and assign admin role
      const { data, error } = await supabase.rpc("create_organization_with_admin", {
        org_name: orgName,
      });

      if (error) throw error;

      toast({
        title: "Organization created!",
        description: `Welcome to ${orgName}. You've been assigned as admin.`,
      });

      // Small delay to let the auth context refresh
      setTimeout(() => {
        navigate("/dashboard");
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error("Error creating organization:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create organization. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      
      <div className="w-full max-w-md relative animate-fade-in">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">FBA Wholesale</h1>
              <p className="text-sm text-muted-foreground">Management Platform</p>
            </div>
          </div>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center flex items-center justify-center gap-2">
              <Building className="h-6 w-6" />
              Create Your Organization
            </CardTitle>
            <CardDescription className="text-center">
              Set up your organization to get started with the platform
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  type="text"
                  placeholder="Acme Wholesale Inc."
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                You'll be assigned as the admin of this organization and can invite team members later.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full gap-2"
                disabled={isLoading || !orgName.trim()}
              >
                {isLoading ? "Creating..." : "Create Organization"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
