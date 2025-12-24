import { useState } from "react";
import { Search, MoreHorizontal, Users, Trash2, UserPlus, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  purchasing: "Purchasing",
  warehouse: "Warehouse",
  accounting: "Accounting",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive",
  manager: "bg-primary/10 text-primary",
  purchasing: "bg-accent/10 text-accent",
  warehouse: "bg-warning/10 text-warning",
  accounting: "bg-muted text-muted-foreground",
  viewer: "bg-muted text-muted-foreground",
};

const UserManagement = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [approveDialogUser, setApproveDialogUser] = useState<any>(null);
  const [selectedApproveRole, setSelectedApproveRole] = useState<AppRole>("viewer");
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "viewer" as AppRole,
  });
  const { organizationId, user, session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users in organization
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["org_users", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select(`
          *,
          profiles:user_id(id, full_name, avatar_url, created_at)
        `)
        .eq("organization_id", organizationId);
      
      if (rolesError) throw rolesError;
      return userRoles || [];
    },
    enabled: !!organizationId,
  });

  // Fetch pending users
  const { data: pendingUsers = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["pending_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_users")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Add user mutation
  const addUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      if (!organizationId) throw new Error("No organization selected");

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.full_name,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: authData.user.id,
          organization_id: organizationId,
          role: userData.role,
        });

      if (roleError) throw roleError;

      return authData.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org_users"] });
      setIsAddDialogOpen(false);
      setNewUser({ email: "", password: "", full_name: "", role: "viewer" });
      toast({
        title: "User Added",
        description: "New user has been added to the organization. They will need to verify their email.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add user.",
        variant: "destructive",
      });
    },
  });

  // Approve pending user mutation
  const approveUserMutation = useMutation({
    mutationFn: async ({ pendingUserId, role }: { pendingUserId: string; role: AppRole }) => {
      if (!organizationId) throw new Error("No organization selected");
      if (!session?.access_token) throw new Error("You must be logged in to approve users.");

      const { data, error } = await supabase.functions.invoke("approve-pending-user", {
        body: {
          pendingUserId,
          organizationId,
          role,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      return data as { userId: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org_users"] });
      queryClient.invalidateQueries({ queryKey: ["pending_users"] });
      setApproveDialogUser(null);
      toast({
        title: "User Approved",
        description: "User has been approved and added to the organization. They will receive an email to set their password.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve user.",
        variant: "destructive",
      });
    },
  });

  // Reject pending user mutation
  const rejectUserMutation = useMutation({
    mutationFn: async (pendingUserId: string) => {
      const { error } = await supabase
        .from("pending_users")
        .update({ 
          status: "rejected", 
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id 
        })
        .eq("id", pendingUserId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_users"] });
      toast({
        title: "Request Rejected",
        description: "The signup request has been rejected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request.",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userRoleId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", userRoleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org_users"] });
      setDeleteUserId(null);
      toast({
        title: "User Removed",
        description: "User has been removed from the organization.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove user.",
        variant: "destructive",
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userRoleId, newRole }: { userRoleId: string; newRole: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("id", userRoleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org_users"] });
      toast({
        title: "Role Updated",
        description: "User role has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update role.",
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users.filter(
    (userRole: any) =>
      userRole.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userRole.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email.trim() || !newUser.password.trim()) return;
    addUserMutation.mutate(newUser);
  };

  const roleCounts = {
    admin: users.filter((u: any) => u.role === "admin").length,
    manager: users.filter((u: any) => u.role === "manager").length,
    purchasing: users.filter((u: any) => u.role === "purchasing").length,
    other: users.filter((u: any) => !["admin", "manager", "purchasing"].includes(u.role)).length,
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage users and their roles in your organization
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleAddUser}>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user account and assign them to this organization.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    placeholder="John Doe"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value: AppRole) => setNewUser({ ...newUser, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addUserMutation.isPending}>
                  {addUserMutation.isPending ? "Adding..." : "Add User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Pending", count: pendingUsers.length, color: "text-warning", icon: Clock },
          { label: "Admins", count: roleCounts.admin, color: "text-destructive", icon: null },
          { label: "Managers", count: roleCounts.manager, color: "text-primary", icon: null },
          { label: "Purchasing", count: roleCounts.purchasing, color: "text-accent", icon: null },
          { label: "Other", count: roleCounts.other, color: "text-muted-foreground", icon: null },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                {stat.icon && <stat.icon className={`h-4 w-4 ${stat.color}`} />}
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
              </div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs for Pending vs Active Users */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending Requests
            {pendingUsers.length > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingUsers.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-2">
            <Users className="h-4 w-4" />
            Active Users
          </TabsTrigger>
        </TabsList>

        {/* Pending Users Tab */}
        <TabsContent value="pending">
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Pending Signup Requests</CardTitle>
              <CardDescription>
                Review and approve new user signup requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : pendingUsers.length === 0 ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
                  <CheckCircle className="h-8 w-8 opacity-50" />
                  <p>No pending requests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Requested Role</TableHead>
                      <TableHead>Requested At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.map((pendingUser: any) => (
                      <TableRow key={pendingUser.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-warning">
                                {pendingUser.full_name?.charAt(0)?.toUpperCase() || "?"}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{pendingUser.full_name}</p>
                              <p className="text-sm text-muted-foreground">{pendingUser.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {pendingUser.requested_role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(pendingUser.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-destructive hover:text-destructive"
                              onClick={() => rejectUserMutation.mutate(pendingUser.id)}
                              disabled={rejectUserMutation.isPending}
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={() => {
                                setSelectedApproveRole(pendingUser.requested_role as AppRole);
                                setApproveDialogUser(pendingUser);
                              }}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Approve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Users Tab */}
        <TabsContent value="active">
          {/* Search */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm mb-4">
            <CardContent className="p-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background/50"
                />
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Organization Users</CardTitle>
              <CardDescription>
                {filteredUsers.length} users found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Users className="h-8 w-8 opacity-50" />
                            <p>No users found</p>
                            <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(true)}>
                              Add first user
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((userRole: any) => (
                        <TableRow key={userRole.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium text-primary">
                                  {userRole.profiles?.full_name?.charAt(0)?.toUpperCase() || "U"}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{userRole.profiles?.full_name || "Unknown"}</p>
                                <p className="text-sm text-muted-foreground">ID: {userRole.user_id.slice(0, 8)}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={ROLE_COLORS[userRole.role as AppRole]}>
                              {ROLE_LABELS[userRole.role as AppRole] || userRole.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {userRole.created_at
                              ? new Date(userRole.created_at).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                  <DropdownMenuItem
                                    key={value}
                                    onClick={() => updateRoleMutation.mutate({ 
                                      userRoleId: userRole.id, 
                                      newRole: value as AppRole 
                                    })}
                                    disabled={userRole.role === value}
                                  >
                                    Set as {label}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuItem
                                  onClick={() => setDeleteUserId(userRole.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove from Organization
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve User Dialog */}
      <Dialog open={!!approveDialogUser} onOpenChange={() => setApproveDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve User</DialogTitle>
            <DialogDescription>
              Approve {approveDialogUser?.full_name} and assign them a role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={approveDialogUser?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Assign Role</Label>
              <Select
                value={selectedApproveRole}
                onValueChange={(value: AppRole) => setSelectedApproveRole(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                approveUserMutation.mutate({
                  pendingUserId: approveDialogUser.id,
                  role: selectedApproveRole,
                })
              }
              disabled={approveUserMutation.isPending}
            >
              {approveUserMutation.isPending ? "Approving..." : "Approve User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this user from the organization? 
              They will lose access to all organization data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteUserMutation.mutate(deleteUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending ? "Removing..." : "Remove User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserManagement;