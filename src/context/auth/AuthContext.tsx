import React, { createContext, useContext, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContextProps } from "./types";
import { useAuthState } from "./authHooks";
import { 
  signUp as signUpAction,
  signIn as signInAction,
  signOut as signOutAction,
  deleteAccount as deleteAccountAction,
  updateProfile as updateProfileAction,
  resetPassword as resetPasswordAction,
  signInWithX as signInWithXAction
} from "./authActions";

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { user, session, profile, isLoading, fetchProfile } = useAuthState();
  const navigate = useNavigate();

  const signUp = async (
    email: string,
    password: string,
    username: string,
    firstName: string,
    lastName: string
  ): Promise<void> => {
    await signUpAction(email, password, username, firstName, lastName);
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    await signInAction(email, password);
    navigate("/");
  };

  const signOut = async (): Promise<void> => {
    await signOutAction();
    navigate("/auth/login");
  };

  const deleteAccount = async (): Promise<void> => {
    await deleteAccountAction();
    navigate("/auth/login");
  };

  const updateProfile = async (
    data: Partial<{ username: string; first_name: string; last_name: string }>
  ): Promise<void> => {
    if (!user) return;
    await updateProfileAction(user.id, data, fetchProfile);
  };

  const resetPassword = async (email: string): Promise<void> => {
    await resetPasswordAction(email);
  };

  const signInWithX = async (): Promise<void> => {
    await signInWithXAction();
  };

  const contextValue: AuthContextProps = {
    user,
    session,
    profile,
    isLoading,
    signUp,
    signIn,
    signInWithX,
    signOut,
    deleteAccount,
    updateProfile,
    resetPassword,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
